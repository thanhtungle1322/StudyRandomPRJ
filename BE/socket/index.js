const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const matchmakingService = require('../services/matchmaking');
const matchmaking = matchmakingService;
const { MatchmakingError, QUICK_MATCH_SUBJECT } = matchmakingService;
const config = require('../config');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const premiumService = require('../services/premiumService');

const userSockets = new Map(); // socketId -> userId (existing)
const userSocketsReverse = new Map(); // userId -> Set<socketId> (new - for targeting specific users)
const pendingUserSocketsReverse = new Map();
const revokedUserIds = new Set();
let socketServer = null;

function trackPendingSocket(userId, socket) {
  if (!pendingUserSocketsReverse.has(userId)) pendingUserSocketsReverse.set(userId, new Set());
  pendingUserSocketsReverse.get(userId).add(socket);
}

function untrackPendingSocket(userId, socket) {
  const sockets = pendingUserSocketsReverse.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) pendingUserSocketsReverse.delete(userId);
}

function disconnectUserSockets(userId) {
  revokedUserIds.add(userId);
  const pendingSockets = [...(pendingUserSocketsReverse.get(userId) || [])];
  pendingSockets.forEach((socket) => {
    socket.data = socket.data || {};
    socket.data.accountRevoked = true;
  });
  const socketIds = userSocketsReverse.get(userId);
  const sockets = socketServer && socketIds ? [...socketIds]
    .map((socketId) => socketServer.sockets.sockets.get(socketId))
    .filter(Boolean) : [];
  sockets.forEach((socket) => {
    socket.emit('account_revoked', { message: 'Tài khoản của bạn đã bị xóa.' });
    socket.disconnect(true);
  });
  return sockets.length + pendingSockets.length;
}

function getLiveInvitationSockets(io, inviterSocketId, accepterSocket) {
  const inviterSocket = io.sockets.sockets.get(inviterSocketId);
  const currentAccepterSocket = io.sockets.sockets.get(accepterSocket.id);
  if (
    !inviterSocket?.connected ||
    !accepterSocket.connected ||
    currentAccepterSocket !== accepterSocket
  ) {
    return null;
  }
  return { inviterSocket, accepterSocket };
}

class RoomInvitationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoomInvitationError';
    this.code = code;
  }
}

class RoomInvitationStore {
  constructor({ ttlMs = 60_000, maxSize = 10_000, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.now = now;
    this.invitations = new Map();
  }

  _pruneExpired() {
    const now = this.now();
    for (const [invitationId, invitation] of this.invitations) {
      if (invitation.expiresAt <= now) this.invitations.delete(invitationId);
    }
  }

  create(data) {
    this._pruneExpired();
    if (this.invitations.size >= this.maxSize) {
      const oldestId = this.invitations.keys().next().value;
      this.invitations.delete(oldestId);
    }
    const invitation = {
      ...data,
      invitationId: crypto.randomUUID(),
      expiresAt: this.now() + this.ttlMs,
    };
    this.invitations.set(invitation.invitationId, invitation);
    return invitation;
  }

  consume(invitationId, recipientId) {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      throw new RoomInvitationError('INVITATION_NOT_FOUND', 'Lời mời không tồn tại hoặc đã được sử dụng');
    }
    if (invitation.expiresAt <= this.now()) {
      this.invitations.delete(invitationId);
      throw new RoomInvitationError('INVITATION_EXPIRED', 'Lời mời đã hết hạn');
    }
    if (invitation.recipientId !== recipientId) {
      throw new RoomInvitationError('INVITATION_FORBIDDEN', 'Lời mời này không dành cho bạn');
    }
    this.invitations.delete(invitationId);
    return invitation;
  }

  removeByInviterSocket(socketId) {
    for (const [invitationId, invitation] of this.invitations) {
      if (invitation.inviterSocketId === socketId) this.invitations.delete(invitationId);
    }
  }
}

function emitToUser(io, userId, event, data) {
  const socketIds = userSocketsReverse.get(userId);
  console.log(`[emitToUser] userId=${userId}, event=${event}, found sockets=${socketIds ? [...socketIds].join(',') : 'NONE'}`);
  if (socketIds) {
    socketIds.forEach(sid => {
      const sock = io.sockets.sockets.get(sid);
      if (sock) sock.emit(event, data);
    });
  }
}

function enqueueOrReject(socket, subjectId, user) {
  try {
    return { accepted: true, match: matchmaking.addToQueue(subjectId, socket.id, user) };
  } catch (error) {
    const isValidationError = error instanceof MatchmakingError;
    if (!isValidationError) {
      console.error('[Matchmaking] Queue error:', error);
    }
    socket.emit('queue_error', {
      code: isValidationError ? error.code : 'QUEUE_ERROR',
      message: isValidationError ? error.message : 'Không thể tham gia hàng đợi lúc này',
    });
    return { accepted: false, match: null };
  }
}

function getAuthorizedRoom(socket, roomId, requireJoined = false) {
  if (typeof roomId !== 'string' || !roomId) return null;
  const room = matchmaking.getRoom(roomId);
  if (!room || !matchmaking.isRoomParticipant(roomId, socket.userId)) return null;
  if (requireJoined && (
    !socket.rooms.has(roomId) ||
    !matchmaking.isConnectedRoomParticipant(roomId, socket.userId, socket.id)
  )) {
    return null;
  }
  return room;
}

async function refundQuotaReservations(quotaService, reservations) {
  await Promise.allSettled(
    reservations
      .filter((reservation) => reservation.consumed)
      .map((reservation) => quotaService.refundMatchQuota(reservation.userId))
  );
}

async function reserveMatchQuotas(quotaService, userIds) {
  const settled = await Promise.allSettled(
    userIds.map((userId) => quotaService.consumeMatchQuota(userId))
  );
  const results = settled.map((result) => (
    result.status === 'fulfilled'
      ? result.value
      : { allowed: false, consumed: false, error: result.reason }
  ));
  const reservations = results.map((result, index) => ({
    userId: userIds[index],
    consumed: Boolean(result.consumed),
  }));
  const failureIndex = settled.findIndex((result, index) => (
    result.status === 'rejected' || !results[index].allowed
  ));

  if (failureIndex !== -1) {
    await refundQuotaReservations(quotaService, reservations);
    return { allowed: false, failureIndex, results, reservations };
  }
  return { allowed: true, failureIndex: -1, results, reservations };
}

function setupSocket(io) {
  socketServer = io;
  const roomInvitations = new RoomInvitationStore();

  const deliverMatch = async ({ roomId, user1, user2, subject }) => {
    const socket1 = io.sockets.sockets.get(user1.socketId);
    const socket2 = io.sockets.sockets.get(user2.socketId);
    if (!socket1 || !socket2) {
      matchmaking.discardRoom(roomId, 'socket_missing');
      const connectedSocket = socket1 || socket2;
      connectedSocket?.emit('queue_error', {
        code: 'PARTNER_DISCONNECTED',
        message: 'Bạn học vừa mất kết nối. Vui lòng tìm lại.',
      });
      return false;
    }

    const quotaReservation = await reserveMatchQuotas(premiumService, [
      user1.user.userId,
      user2.user.userId,
    ]);
    if (!quotaReservation.allowed) {
      const deniedIndex = quotaReservation.failureIndex;
      matchmaking.discardRoom(roomId, 'quota_rejected');
      [socket1, socket2].forEach((matchedSocket, index) => {
        const failedResult = quotaReservation.results[deniedIndex];
        const quotaDenied = index === deniedIndex && !failedResult.error;
        matchedSocket.emit(quotaDenied ? 'match_limit_reached' : 'queue_error', {
          code: quotaDenied ? 'MATCH_LIMIT_REACHED' : (index === deniedIndex ? 'QUOTA_ERROR' : 'PARTNER_LIMIT_REACHED'),
          message: quotaDenied
            ? 'Bạn đã hết lượt tìm bạn học hôm nay.'
            : (index === deniedIndex ? 'Không thể giữ lượt ghép. Vui lòng thử lại.' : 'Bạn học chưa thể ghép lúc này. Vui lòng tìm lại.'),
          remaining: 0,
          limit: quotaReservation.results[index].limits?.dailyMatches,
        });
      });
      return false;
    }

    const currentSocket1 = io.sockets.sockets.get(user1.socketId);
    const currentSocket2 = io.sockets.sockets.get(user2.socketId);
    if (!currentSocket1 || !currentSocket2 || !matchmaking.getRoom(roomId)) {
      await refundQuotaReservations(premiumService, quotaReservation.reservations);
      matchmaking.discardRoom(roomId, 'socket_missing');
      return false;
    }
    matchmaking.setQuotaReservations(roomId, quotaReservation.reservations);

    currentSocket1.join(roomId);
    currentSocket2.join(roomId);
    const isQuickMatch = subject === QUICK_MATCH_SUBJECT;
    const limits = quotaReservation.results.map((result) => (
      result.limits.sessionMinutes === Infinity ? null : result.limits.sessionMinutes
    ));
    matchmaking.setSessionTimeLimit(roomId, limits);

    currentSocket1.emit('matched', {
      roomId,
      subject,
      partner: user2.user,
      sessionTimeLimit: limits[0],
      isQuickMatch,
    });
    currentSocket2.emit('matched', {
      roomId,
      subject,
      partner: user1.user,
      sessionTimeLimit: limits[1],
      isQuickMatch,
    });
    console.log(`[Socket] Room ${roomId} delivered to ${user1.user.username} & ${user2.user.username}`);
    return true;
  };

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (revokedUserIds.has(decoded.userId)) return next(new Error('Account no longer exists'));
      socket.userId = decoded.userId;
      socket.username = decoded.displayName;
      socket.tokenExpiresAt = decoded.exp ? decoded.exp * 1000 : null;
      trackPendingSocket(decoded.userId, socket);
      
      // Fetch avatar tươi mới trực tiếp từ database vì JWT token giờ là lightweight (không chứa avatar Base64)
      const user = await User.findById(decoded.userId).select('displayName avatar');
      if (!user || revokedUserIds.has(decoded.userId) || socket.data?.accountRevoked) {
        untrackPendingSocket(decoded.userId, socket);
        return next(new Error('Account no longer exists'));
      }
      socket.username = user.displayName;
      socket.userAvatar = user.avatar || '';
      
      next();
    } catch (err) {
      if (socket.userId) untrackPendingSocket(socket.userId, socket);
      next(new Error('Invalid token'));
    }
  });

  // ================================================================
  // OBSERVER: Lắng nghe events từ MatchmakingService
  // ================================================================

  matchmaking.on('room:auto_closed', ({ roomId, remainingUsers }) => {
    console.log(`[Socket][Observer] Room ${roomId} auto-closed`);

    if (remainingUsers && remainingUsers.length > 0) {
      remainingUsers.forEach((u) => {
        const sock = io.sockets.sockets.get(u.socketId);
        if (sock) {
          sock.emit('room_auto_closed', {
            message: 'Phòng đã tự động đóng vì bạn học không quay lại sau 5 giây.',
            roomId,
          });
          sock.leave(roomId);
        }
      });
    }
  });

  matchmaking.on('room:auto_closing', ({ roomId, countdown }) => {
    io.to(roomId).emit('auto_disconnect_warning', {
      message: `Bạn học đã rời phòng. Phòng sẽ tự đóng sau ${countdown / 1000} giây...`,
      countdown,
      roomId,
    });
  });

  matchmaking.on('room:auto_closing_cancelled', ({ roomId }) => {
    io.to(roomId).emit('auto_disconnect_cancelled', {
      message: 'Bạn học đã quay lại!',
      roomId,
    });
  });

  matchmaking.on('room:time_limit_reached', ({ roomId, room, limitMinutes }) => {
    room.users.forEach((participant) => {
      const participantSocket = io.sockets.sockets.get(participant.socketId);
      if (participantSocket) {
        participantSocket.emit('session_time_limit_reached', { roomId, limitMinutes });
        participantSocket.leave(roomId);
      }
    });
  });

  matchmaking.on('stats:updated', ({ queueStats }) => {
    io.emit('queue_stats', queueStats);
  });

  matchmaking.on('user:refunded', async ({ userId, dailyMatchCount }) => {
    console.log(`[Socket][Observer] User ${userId} was refunded. New count: ${dailyMatchCount}`);
    try {
      const u = await User.findById(userId);
      const premiumService = require('../services/premiumService');
      const limits = premiumService.getLimitsForTier(u?.premiumTier || 'none');
      if (limits.dailyMatches !== Infinity) {
        const remaining = Math.max(0, limits.dailyMatches - dailyMatchCount);
        emitToUser(io, userId, 'match_refunded', {
          message: 'Phiên học của bạn kéo dài chưa đầy 5 phút. Bạn đã được hoàn trả lượt ghép học! 💸',
          dailyMatchCount,
          remaining,
          limit: limits.dailyMatches,
        });
      }
    } catch (_) {}
  });

  // Relay sự kiện nới lỏng tiêu chí về đúng client đối tượng
  matchmaking.on('queue:relaxed', ({ socketId, level }) => {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) {
      sock.emit('queue_relaxed', { level });
      console.log(`[Socket][Observer] queue:relaxed → socket ${socketId}, level=${level}`);
    }
  });

  // Xử lý kết quả ghép lại sau khi nới lỏng tiêu chí (cùng logic với match thông thường)
  matchmaking.on('match:retry_found', async (match) => {
    const { roomId } = match;
    console.log(`[Socket][Observer] match:retry_found — Room ${roomId}`);
    await deliverMatch(match);
  });

  // ================================================================
  // SOCKET CONNECTIONS
  // ================================================================

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const username = socket.username;
    const avatar = socket.userAvatar;
    const authExpiryTimer = socket.tokenExpiresAt
      ? setTimeout(() => socket.disconnect(true), Math.max(0, socket.tokenExpiresAt - Date.now()))
      : null;

    untrackPendingSocket(userId, socket);
    if (revokedUserIds.has(userId) || socket.data?.accountRevoked) {
      socket.disconnect(true);
      return;
    }

    console.log(`[Socket] User connected: ${username} (${socket.id})`);

    userSockets.set(socket.id, userId);
    if (!userSocketsReverse.has(userId)) {
      userSocketsReverse.set(userId, new Set());
    }
    userSocketsReverse.get(userId).add(socket.id);

    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });
    } catch (_) {}

    const socketUser = { userId, username, avatar };

    // ========================
    // MATCHMAKING
    // ========================

    socket.on('join_queue', async ({ subjectId, skillLevel = 'any', goal = 'any' }) => {
      console.log(`[Socket] ${username} joining queue for ${subjectId} [skill=${skillLevel}, goal=${goal}]`);

      let dbUser = null;
      // ---- Check free plan limits ----
      try {
        dbUser = await User.findById(userId);
        const premiumService = require('../services/premiumService');
        const limitCheck = await premiumService.checkMatchLimit(userId);

        if (!limitCheck.allowed) {
          socket.emit('match_limit_reached', {
            message: 'Bạn đã hết lượt tìm bạn học hôm nay. Nâng cấp Premium để có thêm lượt ghép học!',
            remaining: 0,
            limit: limitCheck.limit,
          });
          return;
        }
      } catch (err) {
        console.error('[Socket] Error checking match limits:', err.message);
      }

      const freshSocketUser = {
        userId,
        username,
        avatar: dbUser ? dbUser.avatar : avatar,
        plan: dbUser ? dbUser.plan : 'free',
        badges: dbUser ? dbUser.badges : [],
        reputation: dbUser ? dbUser.reputation : 5.0,
        ratingCount: dbUser ? dbUser.ratingCount : 0,
        skillLevel,  // Thêm mới: trình độ môn học
        goal,        // Thêm mới: mục tiêu buổi học
      };

      const queueResult = enqueueOrReject(socket, subjectId, freshSocketUser);
      if (!queueResult.accepted) return;
      const { match } = queueResult;

      if (match) {
        await deliverMatch(match);
      } else {
        socket.emit('waiting', {
          message: 'Đang tìm bạn học phù hợp...',
          queueStats: matchmaking.getQueueStats(),
        });
      }
    });

    socket.on('leave_queue', () => {
      matchmaking.removeFromQueue(socket.id);
      socket.emit('queue_left', { message: 'Đã rời hàng đợi' });
    });

    // ========================
    // QUICK MATCH (Ghép Nhanh)
    // ========================

    socket.on('join_quick_queue', async () => {
      console.log(`[Socket] ${username} joining QUICK queue`);

      let dbUser = null;
      // ---- Kiểm tra giới hạn lượt ghép (cùng logic với join_queue) ----
      try {
        dbUser = await User.findById(userId);
        const premiumService = require('../services/premiumService');
        const limitCheck = await premiumService.checkMatchLimit(userId);

        if (!limitCheck.allowed) {
          socket.emit('match_limit_reached', {
            message: 'Bạn đã hết lượt tìm bạn học hôm nay. Nâng cấp Premium để có thêm lượt ghép học!',
            remaining: 0,
            limit: limitCheck.limit,
          });
          return;
        }
      } catch (err) {
        console.error('[Socket] Error checking match limits (quick):', err.message);
      }

      const freshSocketUser = {
        userId,
        username,
        avatar: dbUser ? dbUser.avatar : avatar,
        plan: dbUser ? dbUser.plan : 'free',
        badges: dbUser ? dbUser.badges : [],
        reputation: dbUser ? dbUser.reputation : 5.0,
        ratingCount: dbUser ? dbUser.ratingCount : 0,
        skillLevel: 'any',  // Quick match không dùng filter
        goal: 'any',
      };

      // addToQueue sẽ tự bỏ qua relax timer cho QUICK_MATCH_SUBJECT
      const queueResult = enqueueOrReject(socket, QUICK_MATCH_SUBJECT, freshSocketUser);
      if (!queueResult.accepted) return;
      const { match } = queueResult;

      if (match) {
        await deliverMatch(match);
      } else {
        socket.emit('waiting', {
          message: 'Đang tìm bạn học...',
          queueStats: matchmaking.getQueueStats(),
          isQuickMatch: true,
        });
      }
    });

    // ========================
    // CHAT
    // ========================

    socket.on('send_message', ({ roomId, message }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) {
        socket.emit('room_error', { message: 'Bạn không có quyền gửi tin nhắn vào phòng này' });
        return;
      }
      if (typeof message !== 'string' || message.trim().length === 0 || message.length > 5000) {
        return;
      }

      const msgData = {
        id: crypto.randomUUID(),
        text: message.trim(),
        userId,
        user: socketUser,
        timestamp: new Date(),
      };

      matchmaking.addMessage(roomId, msgData);
      io.to(roomId).emit('new_message', msgData);
    });

    // ========================
    // ROOM
    // ========================

    socket.on('join_room', ({ roomId }) => {
      const room = getAuthorizedRoom(socket, roomId);
      if (!room) {
        socket.emit('room_error', { message: 'Phòng không tồn tại hoặc đã đóng' });
        return;
      }

      const reconnectResult = matchmaking.reconnectUser(roomId, userId, socket.id);
      if (!reconnectResult) {
        socket.emit('room_error', { message: 'Bạn không phải thành viên của phòng này' });
        return;
      }

      const previousSocket = io.sockets.sockets.get(reconnectResult.previousSocketId);
      if (previousSocket && previousSocket.id !== socket.id) previousSocket.leave(roomId);
      socket.join(roomId);
      socket.emit('room_data', reconnectResult.room);
      socket.to(roomId).emit('partner_reconnected', {
        message: 'Bạn học đã kết nối lại!',
      });
    });

    socket.on('leave_room', ({ roomId }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) return;
      socket.leave(roomId);
      const result = matchmaking.removeUserFromRoom(socket.id);
      if (result && result.remaining) {
        io.to(roomId).emit('partner_left', {
          message: 'Bạn học đã rời phòng',
        });
      }
    });

    socket.on('user_temp_away', ({ roomId }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) return;
      socket.to(roomId).emit('partner_temp_away', {
        message: 'Bạn học đang tạm thời chuyển trang...',
      });
    });

    socket.on('user_back', ({ roomId }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) return;
      socket.to(roomId).emit('partner_back', {
        message: 'Bạn học đã quay lại!',
      });
    });

    // ========================
    // WHITEBOARD SYNC (Excalidraw)
    // ========================

    // Relay bản vẽ từ user này sang partner trong cùng phòng
    socket.on('whiteboard:update', ({ roomId, elements, appState }) => {
      if (getAuthorizedRoom(socket, roomId, true)) {
        socket.to(roomId).emit('whiteboard:update', { elements, appState });
      }
    });

    // Khi user mở whiteboard, yêu cầu partner gửi state hiện tại
    socket.on('whiteboard:request_sync', ({ roomId }) => {
      if (getAuthorizedRoom(socket, roomId, true)) {
        socket.to(roomId).emit('whiteboard:send_sync');
      }
    });

    // Partner gửi lại toàn bộ state khi được yêu cầu sync
    socket.on('whiteboard:sync_response', ({ roomId, elements, appState }) => {
      if (getAuthorizedRoom(socket, roomId, true)) {
        socket.to(roomId).emit('whiteboard:sync_response', { elements, appState });
      }
    });

    // Xóa bảng có chủ ý — event riêng để phân biệt với broadcast rỗng do init
    socket.on('whiteboard:clear', ({ roomId }) => {
      if (getAuthorizedRoom(socket, roomId, true)) {
        socket.to(roomId).emit('whiteboard:clear');
      }
    });

    // ========================
    // POMODORO SYNC
    // ========================
    socket.on('pomodoro:action', (data) => {
      const { roomId } = data;
      if (getAuthorizedRoom(socket, roomId, true)) {
        console.log(`[Pomodoro] Relaying action in room ${roomId} from ${socket.id}`);
        socket.to(roomId).emit('pomodoro:action', data);
      }
    });

    socket.on('media_state_change', (data) => {
      const { roomId } = data;
      if (getAuthorizedRoom(socket, roomId, true)) {
        console.log(`[Media] Relaying state change in room ${roomId} from ${socket.id}`);
        socket.to(roomId).emit('media_state_change', data);
      }
    });

    // ========================
    // WEBRTC Signaling
    // ========================

    socket.on('webrtc_offer', ({ roomId, offer }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) return;
      console.log(`[WebRTC] Relaying offer in room ${roomId} from ${socket.id}`);
      socket.to(roomId).emit('webrtc_offer', { offer });
    });

    socket.on('webrtc_answer', ({ roomId, answer }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) return;
      console.log(`[WebRTC] Relaying answer in room ${roomId} from ${socket.id}`);
      socket.to(roomId).emit('webrtc_answer', { answer });
    });

    socket.on('webrtc_ice_candidate', ({ roomId, candidate }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) return;
      socket.to(roomId).emit('webrtc_ice_candidate', { candidate, senderId: socket.id });
    });

    socket.on('camera_status', ({ roomId, isVideoOff }) => {
      if (!getAuthorizedRoom(socket, roomId, true)) return;
      socket.to(roomId).emit('partner_camera_status', { isVideoOff });
    });

    // ========================
    // Queue Stats
    // ========================

    socket.on('get_queue_stats', () => {
      socket.emit('queue_stats', matchmaking.getQueueStats());
    });

    // ========================
    // FRIEND SYSTEM
    // ========================

    // Gửi lời mời kết bạn real-time
    socket.on('friend:request', async ({ recipientId }) => {
      try {
        // Check if already friends or pending
        const existing = await Friendship.findOne({
          $or: [
            { requester: userId, recipient: recipientId },
            { requester: recipientId, recipient: userId },
          ],
        });

        if (existing && existing.status === 'accepted') {
          socket.emit('friend:error', { message: 'Đã là bạn bè' });
          return;
        }
        if (existing && existing.status === 'pending') {
          socket.emit('friend:error', { message: 'Đã gửi lời mời rồi' });
          return;
        }

        // If rejected before, delete old and create new
        if (existing && existing.status === 'rejected') {
          await Friendship.deleteOne({ _id: existing._id });
        }

        const friendship = await Friendship.create({
          requester: userId,
          recipient: recipientId,
        });

        const requesterUser = await User.findById(userId).select('displayName avatar');

        // Notify recipient in real-time
        emitToUser(io, recipientId, 'friend:request_received', {
          friendshipId: friendship._id,
          requester: {
            _id: userId,
            displayName: requesterUser?.displayName || username,
            avatar: requesterUser?.avatar || avatar,
          },
          createdAt: friendship.createdAt,
        });

        socket.emit('friend:request_sent', { friendshipId: friendship._id, recipientId });
      } catch (err) {
        console.error('[Friend] Error sending request:', err.message);
        socket.emit('friend:error', { message: 'Lỗi gửi lời mời kết bạn' });
      }
    });

    // Phản hồi lời mời kết bạn
    socket.on('friend:respond', async ({ friendshipId, action }) => {
      try {
        const friendship = await Friendship.findById(friendshipId);
        if (!friendship || friendship.recipient.toString() !== userId) {
          socket.emit('friend:error', { message: 'Không hợp lệ' });
          return;
        }
        if (friendship.status !== 'pending') {
          socket.emit('friend:error', { message: 'Lời mời đã được xử lý' });
          return;
        }

        friendship.status = action === 'accept' ? 'accepted' : 'rejected';
        await friendship.save();

        const respondUser = await User.findById(userId).select('displayName avatar');

        if (action === 'accept') {
          // Notify requester
          emitToUser(io, friendship.requester.toString(), 'friend:request_accepted', {
            friendshipId: friendship._id,
            friend: {
              _id: userId,
              displayName: respondUser?.displayName || username,
              avatar: respondUser?.avatar || avatar,
            },
          });
        } else {
          emitToUser(io, friendship.requester.toString(), 'friend:request_rejected', {
            friendshipId: friendship._id,
          });
        }

        socket.emit('friend:respond_success', { friendshipId: friendship._id, action });
      } catch (err) {
        console.error('[Friend] Error responding:', err.message);
        socket.emit('friend:error', { message: 'Lỗi phản hồi lời mời' });
      }
    });

    // Mời bạn bè vào phòng học
    socket.on('room:invite', async ({ friendId, subject }) => {
      try {
        if (typeof friendId !== 'string' || friendId === userId) {
          socket.emit('room:invite_error', { message: 'Người nhận lời mời không hợp lệ' });
          return;
        }
        if (!config.subjects.some((item) => item.id === subject)) {
          socket.emit('room:invite_error', { message: 'Môn học không hợp lệ' });
          return;
        }
        if (!userSocketsReverse.has(friendId)) {
          socket.emit('room:invite_error', { message: 'Bạn học hiện không online' });
          return;
        }
        console.log(`[Room:invite] userId=${userId}, friendId=${friendId}, subject=${subject}`);
        // Verify they are friends
        const friendship = await Friendship.findOne({
          $or: [
            { requester: userId, recipient: friendId },
            { requester: friendId, recipient: userId },
          ],
          status: 'accepted',
        });

        console.log(`[Room:invite] friendship found:`, friendship ? `${friendship.requester} -> ${friendship.recipient} (${friendship.status})` : 'NONE');

        if (!friendship) {
          socket.emit('room:invite_error', { message: 'Chỉ có thể mời bạn bè' });
          return;
        }

        const inviterUser = await User.findById(userId).select('displayName avatar');
        const invitation = roomInvitations.create({
          inviterId: userId,
          inviterSocketId: socket.id,
          recipientId: friendId,
          subject,
        });

        // Send invitation to friend
        emitToUser(io, friendId, 'room:invitation_received', {
          invitationId: invitation.invitationId,
          inviter: {
            _id: userId,
            displayName: inviterUser?.displayName || username,
            avatar: inviterUser?.avatar || avatar,
          },
          subject,
          expiresAt: invitation.expiresAt,
        });

        socket.emit('room:invite_sent', { invitationId: invitation.invitationId, friendId, subject });
      } catch (err) {
        console.error('[Room] Error inviting:', err.message);
        socket.emit('room:invite_error', { message: 'Lỗi mời vào phòng' });
      }
    });

    // Phản hồi lời mời vào phòng
    socket.on('room:invite_respond', async ({ invitationId, action }) => {
      try {
        if (!['accept', 'reject'].includes(action)) {
          throw new RoomInvitationError('INVALID_ACTION', 'Phản hồi lời mời không hợp lệ');
        }
        const invitation = roomInvitations.consume(invitationId, userId);
        const { inviterSocketId, inviterId, subject } = invitation;

        if (action === 'accept') {
          // Create direct room
          let liveSockets = getLiveInvitationSockets(io, inviterSocketId, socket);

          if (!liveSockets) {
            socket.emit('room:invite_error', { message: 'Người mời đã offline' });
            return;
          }

          // Fetch current plan limits and profile data before creating the room.
          const [inviterStatus, accepterStatus, dbInviter, dbAccepter] = await Promise.all([
            premiumService.getPremiumStatus(inviterId),
            premiumService.getPremiumStatus(userId),
            User.findById(inviterId).select('avatar'),
            User.findById(userId).select('avatar'),
          ]);
          liveSockets = getLiveInvitationSockets(io, inviterSocketId, socket);
          if (!liveSockets || !dbInviter || !dbAccepter) {
            if (socket.connected) socket.emit('room:invite_error', { message: 'Lời mời đã hết hiệu lực do kết nối thay đổi' });
            return;
          }
          const { inviterSocket } = liveSockets;
          const freshInviterAvatar = dbInviter ? dbInviter.avatar : inviterSocket.userAvatar;
          const freshAccepterAvatar = dbAccepter ? dbAccepter.avatar : avatar;

          const inviterUserData = {
            socketId: inviterSocketId,
            user: { userId: inviterId, username: inviterSocket.username, avatar: freshInviterAvatar },
          };
          const accepterUserData = {
            socketId: socket.id,
            user: { userId, username, avatar: freshAccepterAvatar },
          };

          const { roomId } = matchmaking.createDirectRoom(subject, inviterUserData, accepterUserData);
          const directLimits = [
            inviterStatus.limits.sessionMinutes,
            accepterStatus.limits.sessionMinutes,
          ];
          matchmaking.setSessionTimeLimit(roomId, directLimits);

          // Both join the socket room
          socket.join(roomId);
          inviterSocket.join(roomId);

          // Notify both users to navigate to the room
          const inviterInfo = { userId: inviterId, username: inviterSocket.username, avatar: freshInviterAvatar };
          const accepterInfo = { userId, username, avatar: freshAccepterAvatar };

          inviterSocket.emit('room:invitation_accepted', {
            invitationId,
            roomId,
            subject,
            partner: accepterInfo,
            sessionTimeLimit: directLimits[0] === Infinity ? null : directLimits[0],
          });

          socket.emit('room:invitation_accepted', {
            invitationId,
            roomId,
            subject,
            partner: inviterInfo,
            sessionTimeLimit: directLimits[1] === Infinity ? null : directLimits[1],
          });
        } else {
          // Rejected
          emitToUser(io, inviterId, 'room:invitation_rejected', {
            invitationId,
            friendName: username,
          });
          socket.emit('room:invite_respond_success', { invitationId, action: 'reject' });
        }
      } catch (err) {
        console.error('[Room] Error responding to invite:', err.message);
        socket.emit('room:invite_error', {
          code: err instanceof RoomInvitationError ? err.code : 'INVITATION_ERROR',
          message: err instanceof RoomInvitationError ? err.message : 'Lỗi phản hồi lời mời',
        });
      }
    });

    // ========================
    // DISCONNECT
    // ========================

    socket.on('disconnect', async (reason) => {
      if (authExpiryTimer) clearTimeout(authExpiryTimer);
      console.log(`[Socket] User disconnected: ${username} (${socket.id}, reason: ${reason})`);

      userSockets.delete(socket.id);
      const userSocketSet = userSocketsReverse.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSocketsReverse.delete(userId);
        }
      }

      matchmaking.removeFromQueue(socket.id);
      roomInvitations.removeByInviterSocket(socket.id);

      const result = matchmaking.removeUserFromRoom(socket.id);
      if (result && result.remaining) {
        io.to(result.roomId).emit('partner_left', {
          message: 'Bạn học đã ngắt kết nối',
        });
      }

      if (!userSocketsReverse.has(userId)) {
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
        } catch (_) {}
      }
    });
  });
}

module.exports = setupSocket;
module.exports.getAuthorizedRoom = getAuthorizedRoom;
module.exports.RoomInvitationStore = RoomInvitationStore;
module.exports.RoomInvitationError = RoomInvitationError;
module.exports.reserveMatchQuotas = reserveMatchQuotas;
module.exports.disconnectUserSockets = disconnectUserSockets;
module.exports.getLiveInvitationSockets = getLiveInvitationSockets;
module.exports.trackPendingSocket = trackPendingSocket;
module.exports.isUserRevoked = (userId) => revokedUserIds.has(userId);
