const crypto = require('crypto');
const EventEmitter = require('events');
const config = require('../config');
const Session = require('../models/Session');

// Hằng số đặc biệt cho chế độ Ghép Nhanh (không cần chọn môn)
const QUICK_MATCH_SUBJECT = '__quick__';
const VALID_SKILL_LEVELS = new Set(['any', 'beginner', 'intermediate', 'advanced']);
const VALID_GOALS = new Set(['any', 'practice', 'discuss', 'self_study', 'casual']);
const SKILL_RANK = { beginner: 0, intermediate: 1, advanced: 2 };
const RELAX_GOAL_AFTER_MS = 60_000;
const RELAX_ALL_AFTER_MS = 120_000;
const DEFAULT_MAX_QUEUE_SIZE = 500;

class MatchmakingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MatchmakingError';
    this.code = code;
  }
}

/**
 * MatchmakingService - Observer Pattern
 * 
 * Events emitted:
 *  - 'user:queued'        → { subjectId, socketId, user }
 *  - 'user:dequeued'      → { socketId }
 *  - 'match:found'        → { roomId, user1, user2, subject }
 *  - 'room:created'       → { roomId, room }
 *  - 'room:message'       → { roomId, message }
 *  - 'room:user_left'     → { roomId, socketId, remaining }
 *  - 'room:auto_closing'  → { roomId, countdown } 
 *  - 'room:auto_closed'   → { roomId }
 *  - 'room:closed'        → { roomId }
 *  - 'stats:updated'      → { queueStats }
 */
class MatchmakingService extends EventEmitter {
  constructor(options = {}) {
    super();
    // Hàng đợi: key = subjectId, value = array of queue entries theo thứ tự đến.
    this.queues = new Map();
    this.queueEntriesBySocket = new Map();
    this.queueEntriesByUser = new Map();
    // Phòng học đang hoạt động: key = roomId, value = room object
    this.activeRooms = {};
    this.activeRoomByUser = new Map();
    // Auto-disconnect timers: key = roomId, value = setTimeout ID
    this.disconnectTimers = {};
    this.sessionTimers = {};
    // Relax timers: key = socketId, value = { t1: TimeoutID, t2: TimeoutID }
    this.relaxTimers = {};
    this.now = options.now || Date.now;
    this.setTimer = options.setTimer || setTimeout;
    this.clearTimer = options.clearTimer || clearTimeout;
    this.maxQueueSizePerSubject = options.maxQueueSizePerSubject || DEFAULT_MAX_QUEUE_SIZE;
    this.supportedSubjects = new Set([
      ...config.subjects.map((subject) => subject.id),
      QUICK_MATCH_SUBJECT,
    ]);
  }

  _validateQueueInput(subjectId, socketId, user) {
    if (!this.supportedSubjects.has(subjectId)) {
      throw new MatchmakingError('INVALID_SUBJECT', 'Môn học không được hỗ trợ');
    }
    if (typeof socketId !== 'string' || !socketId) {
      throw new MatchmakingError('INVALID_SOCKET', 'Kết nối không hợp lệ');
    }
    if (!user || typeof user.userId !== 'string' || !user.userId) {
      throw new MatchmakingError('INVALID_USER', 'Người dùng không hợp lệ');
    }
    if (!VALID_SKILL_LEVELS.has(user.skillLevel || 'any')) {
      throw new MatchmakingError('INVALID_SKILL', 'Trình độ không hợp lệ');
    }
    if (!VALID_GOALS.has(user.goal || 'any')) {
      throw new MatchmakingError('INVALID_GOAL', 'Mục tiêu học không hợp lệ');
    }
    if (this.activeRoomByUser.has(user.userId)) {
      throw new MatchmakingError('ALREADY_IN_ROOM', 'Bạn đang ở trong một phòng học');
    }
  }

  _registerRoom(room) {
    room.users.forEach((participant) => {
      participant.connected = true;
      participant.connectionVersion = participant.connectionVersion || 0;
      this.activeRoomByUser.set(participant.user.userId, room.id);
    });
    this.activeRooms[room.id] = room;
  }

  _closeRoom(roomId) {
    const room = this.activeRooms[roomId];
    if (!room) return null;

    this._clearDisconnectTimer(roomId);
    this._clearSessionTimer(roomId);
    delete this.activeRooms[roomId];
    room.initialUsers.forEach((userId) => {
      if (this.activeRoomByUser.get(userId) === roomId) {
        this.activeRoomByUser.delete(userId);
      }
    });
    return room;
  }

  _removeQueueEntry(entry) {
    if (!entry) return false;

    const queue = this.queues.get(entry.subjectId);
    const entryIndex = queue?.findIndex((item) => item.entryId === entry.entryId) ?? -1;
    if (entryIndex !== -1) {
      queue.splice(entryIndex, 1);
      if (queue.length === 0) this.queues.delete(entry.subjectId);
    }

    if (this.queueEntriesBySocket.get(entry.socketId)?.entryId === entry.entryId) {
      this.queueEntriesBySocket.delete(entry.socketId);
    }
    if (this.queueEntriesByUser.get(entry.user.userId)?.entryId === entry.entryId) {
      this.queueEntriesByUser.delete(entry.user.userId);
    }
    this._clearRelaxTimers(entry.socketId);
    return entryIndex !== -1;
  }

  /**
   * Thêm user vào hàng đợi theo môn học
   */
  addToQueue(subjectId, socketId, user) {
    this._validateQueueInput(subjectId, socketId, user);

    const targetQueue = this.queues.get(subjectId) || [];
    const replacesTargetEntry = targetQueue.some((entry) => (
      entry.socketId === socketId || entry.user.userId === user.userId
    ));
    if (targetQueue.length >= this.maxQueueSizePerSubject && !replacesTargetEntry) {
      throw new MatchmakingError('QUEUE_FULL', 'Hàng đợi môn học đang quá tải, vui lòng thử lại sau');
    }

    // Một user/socket chỉ được sở hữu một entry; request mới nhất thay thế request cũ.
    const existingEntries = new Set([
      this.queueEntriesBySocket.get(socketId),
      this.queueEntriesByUser.get(user.userId),
    ]);
    existingEntries.forEach((entry) => this._removeQueueEntry(entry));

    const queue = this.queues.get(subjectId) || [];
    const entry = {
      entryId: crypto.randomUUID(),
      subjectId,
      socketId,
      user: {
        ...user,
        skillLevel: user.skillLevel || 'any',
        goal: user.goal || 'any',
      },
      joinedAt: this.now(),
    };
    queue.push(entry);
    this.queues.set(subjectId, queue);
    this.queueEntriesBySocket.set(socketId, entry);
    this.queueEntriesByUser.set(user.userId, entry);
    console.log(`[Matchmaking] ${user.username} joined queue for ${subjectId} [skill=${entry.user.skillLevel}, goal=${entry.user.goal}]. Queue size: ${queue.length}`);

    this.emit('user:queued', { subjectId, socketId, user });
    this.emit('stats:updated', { queueStats: this.getQueueStats() });

    // Quick match không cần relax timer (đã ghép bất kỳ ai từ đầu)
    if (subjectId !== QUICK_MATCH_SUBJECT) {
      this._startRelaxTimers(entry);
    }

    return this.tryMatch(subjectId);
  }

  /**
   * Xóa user khỏi tất cả hàng đợi
   */
  removeFromQueue(socketId) {
    const removed = this._removeQueueEntry(this.queueEntriesBySocket.get(socketId));
    if (removed) {
      this.emit('user:dequeued', { socketId });
      this.emit('stats:updated', { queueStats: this.getQueueStats() });
    }
    return removed;
  }

  removeUserFromQueue(userId) {
    const entry = this.queueEntriesByUser.get(userId);
    const removed = this._removeQueueEntry(entry);
    if (removed) {
      this.emit('user:dequeued', { socketId: entry.socketId, userId });
      this.emit('stats:updated', { queueStats: this.getQueueStats() });
    }
    return removed;
  }

  /**
   * Thử ghép đôi 2 user cùng môn
   */
  /**
   * Tính điểm phù hợp giữa 2 user trong queue
   * Score cao = phù hợp hơn → được ghép ưu tiên
   */
  _getRelaxLevel(entry, now = this.now()) {
    const waitTime = Math.max(0, now - entry.joinedAt);
    if (waitTime >= RELAX_ALL_AFTER_MS) return 2;
    if (waitTime >= RELAX_GOAL_AFTER_MS) return 1;
    return 0;
  }

  _evaluatePair(entry1, entry2, now = this.now()) {
    if (entry1.user.userId === entry2.user.userId) return null;

    const u1 = entry1.user;
    const u2 = entry2.user;
    const relaxLevel = Math.min(
      this._getRelaxLevel(entry1, now),
      this._getRelaxLevel(entry2, now)
    );
    let score = 0;

    const skill1 = u1.skillLevel || 'any';
    const skill2 = u2.skillLevel || 'any';
    if (skill1 === 'any' || skill2 === 'any') {
      score += 25;
    } else if (skill1 === skill2) {
      score += 40;
    } else {
      const skillDistance = Math.abs(SKILL_RANK[skill1] - SKILL_RANK[skill2]);
      if (relaxLevel >= 2) {
        score += 0;
      } else if (relaxLevel >= 1 && skillDistance === 1) {
        score += 15;
      } else {
        return null;
      }
    }

    const goal1 = u1.goal || 'any';
    const goal2 = u2.goal || 'any';
    if (goal1 === 'any' || goal2 === 'any') {
      score += 15;
    } else if (goal1 === goal2) {
      score += 30;
    } else if (relaxLevel < 1) {
      return null;
    }

    const reputation1 = Number.isFinite(Number(u1.reputation)) ? Number(u1.reputation) : 5;
    const reputation2 = Number.isFinite(Number(u2.reputation)) ? Number(u2.reputation) : 5;
    score += Math.max(0, 10 - Math.abs(reputation1 - reputation2) * 2);

    const commonWaitSeconds = Math.min(now - entry1.joinedAt, now - entry2.joinedAt) / 1000;
    score += Math.min(20, Math.max(0, Math.floor(commonWaitSeconds / 15)));

    return { score, relaxLevel };
  }

  _calculateMatchScore(entry1, entry2) {
    return this._evaluatePair(entry1, entry2)?.score ?? -Infinity;
  }

  tryMatch(subjectId) {
    const queuedEntries = this.queues.get(subjectId) || [];
    for (const entry of [...queuedEntries]) {
      if (this.activeRoomByUser.has(entry.user.userId)) this._removeQueueEntry(entry);
    }

    const queue = this.queues.get(subjectId);
    if (!queue || queue.length < 2) {
      return null;
    }

    let selectedPair = null;

    // Duyệt theo thứ tự chờ để một entry không tương thích không chặn cả queue.
    for (let anchorIndex = 0; anchorIndex < queue.length - 1; anchorIndex++) {
      const anchor = queue[anchorIndex];
      let bestPartnerIndex = -1;
      let bestScore = -Infinity;

      for (let candidateIndex = anchorIndex + 1; candidateIndex < queue.length; candidateIndex++) {
        const candidate = queue[candidateIndex];
        if (candidate.user.userId === anchor.user.userId) continue;

        const evaluation = this._evaluatePair(anchor, candidate);
        if (!evaluation) continue;

        const currentBest = bestPartnerIndex === -1 ? null : queue[bestPartnerIndex];
        const isBetterTie = evaluation.score === bestScore && currentBest && (
          candidate.joinedAt < currentBest.joinedAt ||
          (candidate.joinedAt === currentBest.joinedAt && candidate.user.userId.localeCompare(currentBest.user.userId) < 0)
        );
        if (evaluation.score > bestScore || isBetterTie) {
          bestScore = evaluation.score;
          bestPartnerIndex = candidateIndex;
        }
      }

      if (bestPartnerIndex !== -1) {
        selectedPair = { anchorIndex, bestPartnerIndex, bestScore };
        break;
      }
    }

    if (!selectedPair) {
      console.log(`[Matchmaking] 🕐 No suitable pair for ${subjectId}. Waiting...`);
      return null;
    }

    const { anchorIndex, bestPartnerIndex, bestScore } = selectedPair;
    const user1 = queue[anchorIndex];
    const user2 = queue[bestPartnerIndex];
    this._removeQueueEntry(user1);
    this._removeQueueEntry(user2);

    // Huỷ relax timers cho cả 2 user đã ghép
    this._clearRelaxTimers(user1.socketId);
    this._clearRelaxTimers(user2.socketId);

    console.log(`[Matchmaking] 🎯 Score=${bestScore} | skill: ${user1.user.skillLevel||'any'}↔${user2.user.skillLevel||'any'} | goal: ${user1.user.goal||'any'}↔${user2.user.goal||'any'}`);

    const roomId = crypto.randomUUID();

    const room = {
      id: roomId,
      users: [user1, user2],
      initialUsers: [user1.user.userId, user2.user.userId],
      subject: subjectId,
      messages: [],
      quotaReservations: [],
      createdAt: new Date(),
    };

    this._registerRoom(room);
    this._beginSessionPersistence(room);

    console.log(`[Matchmaking] ✅ Matched ${user1.user.username} with ${user2.user.username} in room ${roomId}`);

    const matchResult = { roomId, user1, user2, subject: subjectId };

    this.emit('match:found', matchResult);
    this.emit('room:created', { roomId, room });
    this.emit('stats:updated', { queueStats: this.getQueueStats() });

    return matchResult;
  }

  /**
   * Tạo phòng trực tiếp cho 2 user (dùng cho mời bạn bè)
   */
  createDirectRoom(subject, user1Data, user2Data) {
    if (!this.supportedSubjects.has(subject) || subject === QUICK_MATCH_SUBJECT) {
      throw new MatchmakingError('INVALID_SUBJECT', 'Môn học không được hỗ trợ');
    }
    if (user1Data.user.userId === user2Data.user.userId) {
      throw new MatchmakingError('INVALID_PARTICIPANTS', 'Không thể tạo phòng với chính mình');
    }
    if (this.activeRoomByUser.has(user1Data.user.userId) || this.activeRoomByUser.has(user2Data.user.userId)) {
      throw new MatchmakingError('ALREADY_IN_ROOM', 'Một người dùng đang ở trong phòng học khác');
    }

    this.removeUserFromQueue(user1Data.user.userId);
    this.removeUserFromQueue(user2Data.user.userId);
    const roomId = crypto.randomUUID();
    const room = {
      id: roomId,
      users: [
        { socketId: user1Data.socketId, user: user1Data.user },
        { socketId: user2Data.socketId, user: user2Data.user },
      ],
      initialUsers: [user1Data.user.userId, user2Data.user.userId],
      subject,
      messages: [],
      quotaReservations: [],
      createdAt: new Date(),
      isDirect: true,
    };
    this._registerRoom(room);
    this._beginSessionPersistence(room);
    console.log(`[Matchmaking] ✅ Direct room ${roomId} created for ${user1Data.user.username} & ${user2Data.user.username}`);
    this.emit('room:created', { roomId, room });
    return { roomId, room };
  }

  /**
   * Lấy phòng theo ID
   */
  getRoom(roomId) {
    return this.activeRooms[roomId] || null;
  }

  isRoomParticipant(roomId, userId) {
    const room = this.getRoom(roomId);
    return Boolean(room?.initialUsers.includes(userId));
  }

  isConnectedRoomParticipant(roomId, userId, socketId) {
    const room = this.getRoom(roomId);
    return Boolean(room?.users.some((entry) => (
      entry.user.userId === userId &&
      entry.socketId === socketId &&
      entry.connected
    )));
  }

  setQuotaReservations(roomId, reservations) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    room.quotaReservations = reservations.map((reservation) => ({ ...reservation }));
    return true;
  }

  setSessionTimeLimit(roomId, limitsInMinutes) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    const finiteLimits = limitsInMinutes.filter((limit) => Number.isFinite(limit) && limit > 0);
    if (finiteLimits.length === 0) return true;

    this._clearSessionTimer(roomId);
    const limitMinutes = Math.min(...finiteLimits);
    room.sessionTimeLimit = limitMinutes;
    this.sessionTimers[roomId] = this.setTimer(async () => {
      const activeRoom = this.getRoom(roomId);
      if (!activeRoom) return;
      activeRoom.endReason = 'session_limit';
      this.emit('room:time_limit_reached', { roomId, room: activeRoom, limitMinutes });
      this._closeRoom(roomId);
      await this._finalizeClosedRoom(activeRoom, 'session_limit');
    }, limitMinutes * 60 * 1000);
    return true;
  }

  reconnectUser(roomId, userId, socketId) {
    const room = this.getRoom(roomId);
    if (!room || !room.initialUsers.includes(userId)) return null;

    const participant = room.users.find((entry) => entry.user.userId === userId);
    if (!participant) return null;

    const previousSocketId = participant.socketId;
    participant.socketId = socketId;
    participant.connected = true;
    participant.connectionVersion += 1;
    delete participant.disconnectedAt;

    if (room.users.every((entry) => entry.connected)) {
      this.cancelAutoDisconnect(roomId);
    }
    this._persistConnectionStateInDB(roomId, participant).catch(() => { });
    return { room, participant, previousSocketId };
  }

  /**
   * Thêm tin nhắn vào phòng
   */
  addMessage(roomId, message) {
    if (this.activeRooms[roomId]) {
      const msgData = {
        ...message,
        timestamp: new Date(),
      };
      this.activeRooms[roomId].messages.push(msgData);
      if (this.activeRooms[roomId].messages.length > 200) {
        this.activeRooms[roomId].messages.shift();
      }

      this.emit('room:message', { roomId, message: msgData });

      // Lưu tin nhắn vào DB (async)
      this._saveMessageToDB(roomId, msgData).catch(() => { });

      return true;
    }
    return false;
  }

  /**
   * Xóa user khỏi phòng + bắt đầu auto-disconnect timer
   */
  removeUserFromRoom(socketId) {
    for (const roomId in this.activeRooms) {
      const room = this.activeRooms[roomId];
      const leavingUser = room.users.find((entry) => entry.socketId === socketId && entry.connected);

      if (leavingUser) {
        leavingUser.connected = false;
        leavingUser.connectionVersion += 1;
        leavingUser.disconnectedAt = new Date(this.now());
        const connectedUsers = room.users.filter((entry) => entry.connected);

        if (connectedUsers.length === 0) {
          // Cả 2 đều rời → đóng phòng luôn
          room.endReason = 'both_left';
          this._closeRoom(roomId);

          this.emit('room:closed', { roomId });
          this._finalizeClosedRoom(room, 'both_left').catch(() => { });

          return { roomId, remaining: null, leavingUser };
        }

        const remaining = connectedUsers[0];

        this.emit('room:user_left', { roomId, socketId, remaining, leavingUser });

        // === AUTO-DISCONNECT: Bắt đầu đếm ngược 5s ===
        this._startAutoDisconnectTimer(roomId);

        // Cập nhật DB
        this._persistConnectionStateInDB(roomId, leavingUser).catch(() => { });

        return { roomId, remaining, leavingUser };
      }
    }
    return null;
  }

  /**
   * Xóa phòng thủ công
   */
  removeRoom(roomId) {
    const room = this._closeRoom(roomId);
    if (room) {
      room.endReason = 'user_left';
      this.emit('room:closed', { roomId });
      this._finalizeClosedRoom(room, 'user_left').catch(() => { });
    }
  }

  discardRoom(roomId, reason) {
    const room = this._closeRoom(roomId);
    if (!room) return null;
    room.endReason = reason;
    this.emit('room:closed', { roomId });
    this._finalizeClosedRoom(room, reason, { creditStudyTime: false, handleClosure: false }).catch(() => { });
    return room;
  }

  // ========================
  // AUTO-DISCONNECT LOGIC
  // ========================

  /**
   * Bắt đầu timer auto-disconnect 5s
   * Nếu sau 5s mà người còn lại không có partner mới → tự đóng phòng
   */
  _startAutoDisconnectTimer(roomId) {
    // Clear timer cũ nếu có
    this._clearDisconnectTimer(roomId);

    const timeout = config.autoDisconnectTimeout || 10000;

    console.log(`[AutoDisconnect] ⏱️ Room ${roomId}: auto-close in ${timeout / 1000}s`);

    this.emit('room:auto_closing', { roomId, countdown: timeout });

    this.disconnectTimers[roomId] = this.setTimer(async () => {
      const room = this.activeRooms[roomId];
      const connectedUsers = room?.users.filter((entry) => entry.connected) || [];
      if (room && connectedUsers.length <= 1) {
        console.log(`[AutoDisconnect] 🔴 Room ${roomId}: auto-closed after ${timeout / 1000}s`);

        this.emit('room:auto_closed', { roomId, remainingUsers: connectedUsers });

        // Đóng phòng
        room.endReason = 'auto_disconnect';
        this._closeRoom(roomId);
        await this._finalizeClosedRoom(room, 'auto_disconnect');
      }
    }, timeout);
  }

  /**
   * Hủy timer auto-disconnect (VD: khi user reconnect)
   */
  cancelAutoDisconnect(roomId) {
    if (this.disconnectTimers[roomId]) {
      this._clearDisconnectTimer(roomId);
      console.log(`[AutoDisconnect] ✅ Room ${roomId}: auto-disconnect cancelled`);
      this.emit('room:auto_closing_cancelled', { roomId });
    }
  }

  _clearDisconnectTimer(roomId) {
    if (this.disconnectTimers[roomId]) {
      this.clearTimer(this.disconnectTimers[roomId]);
      delete this.disconnectTimers[roomId];
    }
  }

  _clearSessionTimer(roomId) {
    if (this.sessionTimers[roomId]) {
      this.clearTimer(this.sessionTimers[roomId]);
      delete this.sessionTimers[roomId];
    }
  }

  async _handleRoomClosure(room) {
    if (room.isDirect) return; // Do not refund direct invite sessions
    
    const durationMinutes = (Date.now() - room.createdAt.getTime()) / 60000;
    console.log(`[Matchmaking] Room ${room.id} closed. Total duration: ${durationMinutes.toFixed(2)} minutes.`);
    
    if (durationMinutes >= 5) {
      console.log(`[Matchmaking] Session lasted ${durationMinutes.toFixed(2)} minutes (>= 5 mins). No refund.`);
      return;
    }
    
    if (room.quotaRefunded) return;
    room.quotaRefunded = true;
    console.log(`[Matchmaking] Session lasted less than 5 minutes (${durationMinutes.toFixed(2)} mins). Refunding finite quotas...`);

    const premiumService = require('./premiumService');
    for (const reservation of room.quotaReservations || []) {
      if (!reservation.consumed) continue;
      try {
        const refund = await premiumService.refundMatchQuota(reservation.userId);
        if (refund.refunded) {
          console.log(`[Matchmaking] Refunded daily match for ${reservation.userId}. New daily count: ${refund.dailyMatchCount}`);
          this.emit('user:refunded', { userId: reservation.userId.toString(), dailyMatchCount: refund.dailyMatchCount });
        }
      } catch (err) {
        console.error(`[Matchmaking] Error refunding user ${reservation.userId}:`, err.message);
      }
    }
  }

  // ========================
  // RELAX TIMERS
  // ========================

  /**
   * Bắt đầu 2 timer relax cho user:
   *  - t1 (60s): nới lỏng filter goal → thử ghép lại
   *  - t2 (120s): nới lỏng hoàn toàn → thử ghép lại
   */
  _startRelaxTimers(entry) {
    const { entryId, subjectId, socketId } = entry;
    this._clearRelaxTimers(socketId);

    const t1 = this.setTimer(() => {
      const currentEntry = this.queueEntriesBySocket.get(socketId);
      if (!currentEntry || currentEntry.entryId !== entryId) return;

      console.log(`[Matchmaking] ⏳ Relax Level 1 for socket ${socketId} (60s wait)`);
      this.emit('queue:relaxed', { socketId, level: 1 });

      // Thử ghép lại với tiêu chí nới lỏng
      const match = this.tryMatch(subjectId);
      if (match) {
        // Socket layer sẽ xử lý emit 'matched' như bình thường
        this.emit('match:retry_found', match);
      }
    }, 60000);

    const t2 = this.setTimer(() => {
      const currentEntry = this.queueEntriesBySocket.get(socketId);
      if (!currentEntry || currentEntry.entryId !== entryId) return;

      console.log(`[Matchmaking] ⏳ Relax Level 2 for socket ${socketId} (120s wait)`);
      this.emit('queue:relaxed', { socketId, level: 2 });

      // Thử ghép lại — lúc này isFullyRelaxed = true, ghép với bất kỳ ai
      const match = this.tryMatch(subjectId);
      if (match) {
        this.emit('match:retry_found', match);
      }
    }, 120000);

    this.relaxTimers[socketId] = { t1, t2 };
  }

  /**
   * Huỷ relax timers của một socket
   */
  _clearRelaxTimers(socketId) {
    if (this.relaxTimers[socketId]) {
      this.clearTimer(this.relaxTimers[socketId].t1);
      this.clearTimer(this.relaxTimers[socketId].t2);
      delete this.relaxTimers[socketId];
    }
  }

  // ========================
  // STATS
  // ========================

  getQueueStats() {
    const stats = {};
    for (const [subjectId, queue] of this.queues) {
      stats[subjectId] = queue.length;
    }
    return stats;
  }

  // ========================
  // MongoDB persistence (async, non-blocking)
  // ========================

  _beginSessionPersistence(room) {
    room.persistencePromise = this._saveSessionToDB(room.id, room).catch((error) => {
      console.error('[Matchmaking] Failed to save session to DB:', error.message);
    });
  }

  async _creditRoomStudyTime(room) {
    if (room.studyCreditPromise) return room.studyCreditPromise;
    room.studyCreditPromise = (async () => {
      const userService = require('./userService');
      const results = await Promise.allSettled(
        room.initialUsers.map((userId) => userService.updateStudyTime(userId, room.id))
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected' && result.reason?.status !== 400) {
          console.error(`[Matchmaking] Failed to credit study time for ${room.initialUsers[index]}:`, result.reason?.message);
        }
      });
    })();
    return room.studyCreditPromise;
  }

  async _finalizeClosedRoom(room, reason, options = {}) {
    if (room.finalizationPromise) return room.finalizationPromise;
    const { creditStudyTime = true, handleClosure = true } = options;
    room.endReason = reason;
    room.finalizationPromise = (async () => {
      await room.persistencePromise;
      await Promise.all(room.users.map((participant) => (
        this._persistConnectionStateInDB(room.id, participant)
      )));
      await this._endSessionInDB(room.id, reason);
      if (creditStudyTime) await this._creditRoomStudyTime(room);
      if (handleClosure) await this._handleRoomClosure(room);
    })();
    return room.finalizationPromise;
  }

  async _saveSessionToDB(roomId, room) {
    try {
      await Session.create({
        roomId,
        subject: room.subject,
        users: room.users.map((u) => ({
          userId: u.user.userId,
          username: u.user.username,
          joinedAt: room.createdAt,
          connectionVersion: 0,
        })),
        status: 'active',
      });
      await Promise.all(room.users.map((participant) => (
        this._persistConnectionStateInDB(roomId, participant)
      )));
    } catch (err) {
      // Silently fail - in-memory is primary
      console.error('[DB] Save session error:', err.message);
    }
  }

  async _saveMessageToDB(roomId, message) {
    try {
      await Session.updateOne(
        { roomId },
        {
          $push: {
            messages: {
              $each: [{
                text: message.text,
                userId: message.userId,
                username: message.user?.username,
                timestamp: message.timestamp,
              }],
              $slice: -500,
            },
          },
        }
      );
    } catch (err) {
      // Silently fail
    }
  }

  async _persistConnectionStateInDB(roomId, participant) {
    try {
      const version = participant.connectionVersion || 0;
      const versionFilter = {
        $or: [
          { connectionVersion: { $lt: version } },
          { connectionVersion: { $exists: false } },
        ],
      };
      const update = {
        $set: {
          'users.$.connectionVersion': version,
        },
      };
      if (participant.connected) {
        update.$unset = { 'users.$.leftAt': 1 };
      } else {
        update.$set['users.$.leftAt'] = participant.disconnectedAt || new Date(this.now());
      }
      await Session.updateOne(
        {
          roomId,
          users: {
            $elemMatch: {
              userId: participant.user.userId,
              ...versionFilter,
            },
          },
        },
        update
      );
    } catch (err) {
      // In-memory room state remains authoritative during the live session.
    }
  }

  async _endSessionInDB(roomId, reason) {
    try {
      await Session.updateOne(
        { roomId },
        {
          $set: {
            status: reason === 'auto_disconnect' ? 'auto_disconnected' : 'ended',
            endedAt: new Date(),
            endReason: reason,
          },
        }
      );
    } catch (err) {
      // Silently fail
    }
  }
}

// Singleton instance
const matchmaking = new MatchmakingService();

matchmaking.QUICK_MATCH_SUBJECT = QUICK_MATCH_SUBJECT;
matchmaking.MatchmakingService = MatchmakingService;
matchmaking.MatchmakingError = MatchmakingError;
module.exports = matchmaking;
