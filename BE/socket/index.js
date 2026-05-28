const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const matchmaking = require('../services/matchmaking');
const config = require('../config');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

const userSockets = new Map(); // socketId -> userId (existing)
const userSocketsReverse = new Map(); // userId -> Set<socketId> (new - for targeting specific users)

function emitToUser(io, userId, event, data) {
  const socketIds = userSocketsReverse.get(userId);
  if (socketIds) {
    socketIds.forEach(sid => {
      const sock = io.sockets.sockets.get(sid);
      if (sock) sock.emit(event, data);
    });
  }
}

module.exports = function setupSocket(io) {

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.userId;
      socket.username = decoded.displayName;
      socket.userAvatar = decoded.avatar;
      next();
    } catch (err) {
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

  matchmaking.on('stats:updated', ({ queueStats }) => {
    io.emit('queue_stats', queueStats);
  });

  // ================================================================
  // SOCKET CONNECTIONS
  // ================================================================

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const username = socket.username;
    const avatar = socket.userAvatar;

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

    socket.on('join_queue', ({ subjectId }) => {
      console.log(`[Socket] ${username} joining queue for ${subjectId}`);

      const match = matchmaking.addToQueue(subjectId, socket.id, socketUser);

      if (match) {
        const { roomId, user1, user2, subject } = match;

        const socket1 = io.sockets.sockets.get(user1.socketId);
        const socket2 = io.sockets.sockets.get(user2.socketId);

        if (socket1) socket1.join(roomId);
        if (socket2) socket2.join(roomId);

        if (socket1) {
          socket1.emit('matched', {
            roomId,
            subject,
            partner: user2.user,
          });
        }
        if (socket2) {
          socket2.emit('matched', {
            roomId,
            subject,
            partner: user1.user,
          });
        }

        console.log(`[Socket] Room ${roomId} created for ${user1.user.username} & ${user2.user.username}`);
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
    // CHAT
    // ========================

    socket.on('send_message', ({ roomId, message }) => {
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
      const room = matchmaking.getRoom(roomId);
      if (room) {
        socket.join(roomId);

        matchmaking.cancelAutoDisconnect(roomId);

        const existingUser = room.users.find(
          (u) => u.user.userId === userId
        );
        if (existingUser) {
          existingUser.socketId = socket.id;
        }

        socket.emit('room_data', room);

        socket.to(roomId).emit('partner_reconnected', {
          message: 'Bạn học đã kết nối lại!',
        });
      } else {
        socket.emit('room_error', { message: 'Phòng không tồn tại hoặc đã đóng' });
      }
    });

    socket.on('leave_room', ({ roomId }) => {
      socket.leave(roomId);
      const result = matchmaking.removeUserFromRoom(socket.id);
      if (result && result.remaining) {
        io.to(roomId).emit('partner_left', {
          message: 'Bạn học đã rời phòng',
        });
      }
    });

    // ========================
    // WEBRTC Signaling
    // ========================

    socket.on('webrtc_offer', ({ roomId, offer }) => {
      console.log(`[WebRTC] Relaying offer in room ${roomId} from ${socket.id}`);
      socket.to(roomId).emit('webrtc_offer', { offer });
    });

    socket.on('webrtc_answer', ({ roomId, answer }) => {
      console.log(`[WebRTC] Relaying answer in room ${roomId} from ${socket.id}`);
      socket.to(roomId).emit('webrtc_answer', { answer });
    });

    socket.on('webrtc_ice_candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('webrtc_ice_candidate', { candidate, senderId: socket.id });
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
        const invitationId = crypto.randomUUID();

        // Send invitation to friend
        emitToUser(io, friendId, 'room:invitation_received', {
          invitationId,
          inviter: {
            _id: userId,
            displayName: inviterUser?.displayName || username,
            avatar: inviterUser?.avatar || avatar,
          },
          subject,
          socketId: socket.id,
        });

        socket.emit('room:invite_sent', { invitationId, friendId, subject });
      } catch (err) {
        console.error('[Room] Error inviting:', err.message);
        socket.emit('room:invite_error', { message: 'Lỗi mời vào phòng' });
      }
    });

    // Phản hồi lời mời vào phòng
    socket.on('room:invite_respond', async ({ invitationId, inviterSocketId, inviterId, subject, action }) => {
      try {
        if (action === 'accept') {
          // Create direct room
          const inviterSocket = io.sockets.sockets.get(inviterSocketId);

          if (!inviterSocket) {
            socket.emit('room:invite_error', { message: 'Người mời đã offline' });
            return;
          }

          const inviterUserData = {
            socketId: inviterSocketId,
            user: { userId: inviterId, username: inviterSocket.username, avatar: inviterSocket.userAvatar },
          };
          const accepterUserData = {
            socketId: socket.id,
            user: { userId, username, avatar },
          };

          const { roomId } = matchmaking.createDirectRoom(subject, inviterUserData, accepterUserData);

          // Both join the socket room
          socket.join(roomId);
          inviterSocket.join(roomId);

          // Notify both users to navigate to the room
          const inviterInfo = { userId: inviterId, username: inviterSocket.username, avatar: inviterSocket.userAvatar };
          const accepterInfo = { userId, username, avatar };

          inviterSocket.emit('room:invitation_accepted', {
            invitationId,
            roomId,
            subject,
            partner: accepterInfo,
          });

          socket.emit('room:invitation_accepted', {
            invitationId,
            roomId,
            subject,
            partner: inviterInfo,
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
        socket.emit('room:invite_error', { message: 'Lỗi phản hồi lời mời' });
      }
    });

    // ========================
    // DISCONNECT
    // ========================

    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] User disconnected: ${username} (${socket.id}, reason: ${reason})`);

      userSockets.delete(socket.id);
      const userSocketSet = userSocketsReverse.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSocketsReverse.delete(userId);
        }
      }

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
      } catch (_) {}

      matchmaking.removeFromQueue(socket.id);

      const result = matchmaking.removeUserFromRoom(socket.id);
      if (result && result.remaining) {
        io.to(result.roomId).emit('partner_left', {
          message: 'Bạn học đã ngắt kết nối',
        });
      }
    });
  });
};
