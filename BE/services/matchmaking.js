const crypto = require('crypto');
const EventEmitter = require('events');
const config = require('../config');
const Session = require('../models/Session');

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
  constructor() {
    super();
    // Hàng đợi: key = subjectId, value = array of { socketId, user }
    this.queues = {};
    // Phòng học đang hoạt động: key = roomId, value = room object
    this.activeRooms = {};
    // Auto-disconnect timers: key = roomId, value = setTimeout ID
    this.disconnectTimers = {};
  }

  /**
   * Thêm user vào hàng đợi theo môn học
   */
  addToQueue(subjectId, socketId, user) {
    if (!this.queues[subjectId]) {
      this.queues[subjectId] = [];
    }

    // Kiểm tra user đã trong queue chưa
    const existing = this.queues[subjectId].find((q) => q.socketId === socketId);
    if (existing) return null;

    this.queues[subjectId].push({ socketId, user });
    console.log(`[Matchmaking] ${user.username} joined queue for ${subjectId}. Queue size: ${this.queues[subjectId].length}`);

    this.emit('user:queued', { subjectId, socketId, user });
    this.emit('stats:updated', { queueStats: this.getQueueStats() });

    return this.tryMatch(subjectId);
  }

  /**
   * Xóa user khỏi tất cả hàng đợi
   */
  removeFromQueue(socketId) {
    let removed = false;
    for (const subjectId in this.queues) {
      const before = this.queues[subjectId].length;
      this.queues[subjectId] = this.queues[subjectId].filter((q) => q.socketId !== socketId);
      if (this.queues[subjectId].length < before) removed = true;
    }
    if (removed) {
      this.emit('user:dequeued', { socketId });
      this.emit('stats:updated', { queueStats: this.getQueueStats() });
    }
  }

  /**
   * Thử ghép đôi 2 user cùng môn
   */
  tryMatch(subjectId) {
    if (!this.queues[subjectId] || this.queues[subjectId].length < 2) {
      return null;
    }

    const user1 = this.queues[subjectId].shift();
    const user2 = this.queues[subjectId].shift();

    const roomId = crypto.randomUUID();

    const room = {
      id: roomId,
      users: [user1, user2],
      subject: subjectId,
      messages: [],
      createdAt: new Date(),
    };

    this.activeRooms[roomId] = room;

    console.log(`[Matchmaking] ✅ Matched ${user1.user.username} with ${user2.user.username} in room ${roomId}`);

    const matchResult = { roomId, user1, user2, subject: subjectId };

    this.emit('match:found', matchResult);
    this.emit('room:created', { roomId, room });
    this.emit('stats:updated', { queueStats: this.getQueueStats() });

    // Lưu session vào MongoDB (async, không block)
    this._saveSessionToDB(roomId, room).catch((err) => {
      console.error('[Matchmaking] Failed to save session to DB:', err.message);
    });

    return matchResult;
  }

  /**
   * Tạo phòng trực tiếp cho 2 user (dùng cho mời bạn bè)
   */
  createDirectRoom(subject, user1Data, user2Data) {
    const roomId = crypto.randomUUID();
    const room = {
      id: roomId,
      users: [
        { socketId: user1Data.socketId, user: user1Data.user },
        { socketId: user2Data.socketId, user: user2Data.user },
      ],
      subject,
      messages: [],
      createdAt: new Date(),
      isDirect: true,
    };
    this.activeRooms[roomId] = room;
    console.log(`[Matchmaking] ✅ Direct room ${roomId} created for ${user1Data.user.username} & ${user2Data.user.username}`);
    this.emit('room:created', { roomId, room });
    // Save to DB async
    this._saveSessionToDB(roomId, room).catch((err) => {
      console.error('[Matchmaking] Failed to save direct room to DB:', err.message);
    });
    return { roomId, room };
  }

  /**
   * Lấy phòng theo ID
   */
  getRoom(roomId) {
    return this.activeRooms[roomId] || null;
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
      const userIndex = room.users.findIndex((u) => u.socketId === socketId);

      if (userIndex !== -1) {
        const leavingUser = room.users[userIndex];
        room.users.splice(userIndex, 1);

        if (room.users.length === 0) {
          // Cả 2 đều rời → đóng phòng luôn
          this._clearDisconnectTimer(roomId);
          delete this.activeRooms[roomId];

          this.emit('room:closed', { roomId });
          this._endSessionInDB(roomId, 'both_left').catch(() => { });

          return { roomId, remaining: null, leavingUser };
        }

        const remaining = room.users[0];

        this.emit('room:user_left', { roomId, socketId, remaining, leavingUser });

        // === AUTO-DISCONNECT: Bắt đầu đếm ngược 5s ===
        this._startAutoDisconnectTimer(roomId);

        // Cập nhật DB
        this._markUserLeftInDB(roomId, leavingUser).catch(() => { });

        return { roomId, remaining, leavingUser };
      }
    }
    return null;
  }

  /**
   * Xóa phòng thủ công
   */
  removeRoom(roomId) {
    this._clearDisconnectTimer(roomId);
    delete this.activeRooms[roomId];
    this.emit('room:closed', { roomId });
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

    this.disconnectTimers[roomId] = setTimeout(() => {
      const room = this.activeRooms[roomId];
      if (room && room.users.length <= 1) {
        console.log(`[AutoDisconnect] 🔴 Room ${roomId}: auto-closed after ${timeout / 1000}s`);

        this.emit('room:auto_closed', { roomId, remainingUsers: room.users });

        // Đóng phòng
        delete this.activeRooms[roomId];
        delete this.disconnectTimers[roomId];

        this._endSessionInDB(roomId, 'auto_disconnect').catch(() => { });
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
      clearTimeout(this.disconnectTimers[roomId]);
      delete this.disconnectTimers[roomId];
    }
  }

  // ========================
  // STATS
  // ========================

  getQueueStats() {
    const stats = {};
    for (const subjectId in this.queues) {
      stats[subjectId] = this.queues[subjectId].length;
    }
    return stats;
  }

  // ========================
  // MongoDB persistence (async, non-blocking)
  // ========================

  async _saveSessionToDB(roomId, room) {
    try {
      await Session.create({
        roomId,
        subject: room.subject,
        users: room.users.map((u) => ({
          userId: u.user.userId,
          username: u.user.username,
          joinedAt: room.createdAt,
        })),
        status: 'active',
      });
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
              text: message.text,
              userId: message.userId,
              username: message.user?.username,
              timestamp: message.timestamp,
            },
          },
        }
      );
    } catch (err) {
      // Silently fail
    }
  }

  async _markUserLeftInDB(roomId, leavingUser) {
    try {
      await Session.updateOne(
        { roomId, 'users.userId': leavingUser.user.userId },
        { $set: { 'users.$.leftAt': new Date() } }
      );
    } catch (err) {
      // Silently fail
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

module.exports = matchmaking;
