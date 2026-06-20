const crypto = require('crypto');
const EventEmitter = require('events');
const config = require('../config');
const Session = require('../models/Session');

// Hằng số đặc biệt cho chế độ Ghép Nhanh (không cần chọn môn)
const QUICK_MATCH_SUBJECT = '__quick__';
module.exports.QUICK_MATCH_SUBJECT = QUICK_MATCH_SUBJECT;

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
    // Hàng đợi: key = subjectId, value = array of { socketId, user, joinedAt }
    this.queues = {};
    // Phòng học đang hoạt động: key = roomId, value = room object
    this.activeRooms = {};
    // Auto-disconnect timers: key = roomId, value = setTimeout ID
    this.disconnectTimers = {};
    // Relax timers: key = socketId, value = { t1: TimeoutID, t2: TimeoutID }
    this.relaxTimers = {};
  }

  /**
   * Thêm user vào hàng đợi theo môn học
   */
  addToQueue(subjectId, socketId, user) {
    // Tự động xóa socket khỏi hàng đợi cũ (hoặc môn học khác) trước khi thêm mới
    this.removeFromQueue(socketId);

    if (!this.queues[subjectId]) {
      this.queues[subjectId] = [];
    }

    // === FIX: Chặn cùng 1 userId vào queue 2 lần (VD: mở 2 tab/2 máy) ===
    const existingUser = this.queues[subjectId].find((q) => q.user.userId === user.userId);
    if (existingUser) {
      console.log(`[Matchmaking] ⚠️ User ${user.username} already in queue for ${subjectId} (duplicate tab/device). Ignoring.`);
      return null;
    }

    const entry = { socketId, user, joinedAt: Date.now() };
    this.queues[subjectId].push(entry);
    console.log(`[Matchmaking] ${user.username} joined queue for ${subjectId} [skill=${user.skillLevel||'any'}, goal=${user.goal||'any'}]. Queue size: ${this.queues[subjectId].length}`);

    this.emit('user:queued', { subjectId, socketId, user });
    this.emit('stats:updated', { queueStats: this.getQueueStats() });

    // Quick match không cần relax timer (đã ghép bất kỳ ai từ đầu)
    if (subjectId !== QUICK_MATCH_SUBJECT) {
      this._startRelaxTimers(subjectId, socketId);
    }

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
      // Huỷ relax timers khi user rời queue
      this._clearRelaxTimers(socketId);
      this.emit('user:dequeued', { socketId });
      this.emit('stats:updated', { queueStats: this.getQueueStats() });
    }
  }

  /**
   * Thử ghép đôi 2 user cùng môn
   */
  /**
   * Tính điểm phù hợp giữa 2 user trong queue
   * Score cao = phù hợp hơn → được ghép ưu tiên
   */
  _calculateMatchScore(entry1, entry2) {
    const u1 = entry1.user;
    const u2 = entry2.user;

    // Xác định mức độ nới lỏng dựa trên thời gian chờ của người chờ lâu hơn
    const waitTime = Math.max(
      Date.now() - (entry1.joinedAt || Date.now()),
      Date.now() - (entry2.joinedAt || Date.now())
    );
    const relaxLevel = waitTime > 120000 ? 2 : waitTime > 60000 ? 1 : 0;

    let score = 100; // base score

    // ---- Skill Level (Trình độ) ----
    const s1 = u1.skillLevel || 'any';
    const s2 = u2.skillLevel || 'any';
    if (s1 === s2) {
      // Khớp chính xác trình độ (bao gồm cả khi cả hai cùng chọn 'any')
      score += 50;
    } else {
      // Lệch trình độ (bao gồm cả khi một bên chọn 'any' và bên kia chọn cụ thể)
      if (relaxLevel >= 2) {
        // Đã nới lỏng hoàn toàn do chờ lâu
        score += 0;
      } else {
        // Chưa nới lỏng -> phạt cực nặng để tránh ghép ngay
        score += relaxLevel >= 1 ? -80 : -150;
      }
    }

    // ---- Session Goal (Mục tiêu buổi học) ----
    const g1 = u1.goal || 'any';
    const g2 = u2.goal || 'any';
    if (g1 === g2) {
      // Khớp chính xác mục tiêu (bao gồm cả khi cả hai cùng chọn 'any')
      score += 30;
    } else {
      // Lệch mục tiêu
      if (relaxLevel >= 1) {
        score += 0;
      } else {
        score += -30;
      }
    }

    // ---- Reputation Proximity (+20 điểm) ----
    const repDiff = Math.abs((u1.reputation || 5) - (u2.reputation || 5));
    score += Math.max(0, 20 - repDiff * 5);

    return score;
  }

  tryMatch(subjectId) {
    if (!this.queues[subjectId] || this.queues[subjectId].length < 2) {
      return null;
    }

    // Lấy người đầu tiên trong queue
    const user1 = this.queues[subjectId].shift();

    // === FIX: Loại bỏ tất cả entries cùng userId với user1 (phòng trường hợp race condition) ===
    this.queues[subjectId] = this.queues[subjectId].filter(q => q.user.userId !== user1.user.userId);

    if (this.queues[subjectId].length === 0) {
      // Không còn ai khác để ghép → đưa user1 lại vào queue
      this.queues[subjectId].unshift(user1);
      return null;
    }

    // Tìm ứng viên có điểm phù hợp cao nhất
    let bestScore = -Infinity;
    let bestPartnerIndex = 0;

    for (let i = 0; i < this.queues[subjectId].length; i++) {
      const candidate = this.queues[subjectId][i];
      // === FIX: Bỏ qua nếu cùng userId (chống ghép với chính mình) ===
      if (candidate.user.userId === user1.user.userId) continue;

      const score = this._calculateMatchScore(user1, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestPartnerIndex = i;
      }
    }

    // Xác định ngưỡng điểm tối thiểu theo thời gian chờ
    const waitTime1 = Date.now() - (user1.joinedAt || Date.now());
    const isFullyRelaxed = waitTime1 > 120000;
    const MIN_SCORE = isFullyRelaxed ? -Infinity : 50; // Nếu đã chờ >120s → ghép bất kỳ ai

    if (bestScore < MIN_SCORE) {
      // Chưa tìm được partner phù hợp → đưa user1 lại vào đầu queue
      this.queues[subjectId].unshift(user1);
      console.log(`[Matchmaking] 🕐 No suitable match for ${user1.user.username} (bestScore=${bestScore}, min=${MIN_SCORE}). Waiting...`);
      return null;
    }

    // Extract the matched partner from the queue
    const user2 = this.queues[subjectId].splice(bestPartnerIndex, 1)[0];

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
      initialUsers: [user1Data.user.userId, user2Data.user.userId],
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

          this._handleRoomClosure(room).catch(() => {});

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
    const room = this.activeRooms[roomId];
    if (room) {
      this._clearDisconnectTimer(roomId);
      delete this.activeRooms[roomId];
      this.emit('room:closed', { roomId });
      
      this._handleRoomClosure(room).catch(() => {});
    }
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

        this._handleRoomClosure(room).catch(() => {});
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

  async _handleRoomClosure(room) {
    if (room.isDirect) return; // Do not refund direct invite sessions
    
    const durationMinutes = (Date.now() - room.createdAt.getTime()) / 60000;
    console.log(`[Matchmaking] Room ${room.id} closed. Total duration: ${durationMinutes.toFixed(2)} minutes.`);
    
    if (durationMinutes >= 5) {
      console.log(`[Matchmaking] Session lasted ${durationMinutes.toFixed(2)} minutes (>= 5 mins). No refund.`);
      return;
    }
    
    console.log(`[Matchmaking] Session lasted less than 5 minutes (${durationMinutes.toFixed(2)} mins). Refunding free users...`);
    
    const User = require('../models/User'); // avoid circular dependencies
    
    for (const userId of room.initialUsers) {
      try {
        const dbUser = await User.findById(userId);
        if (dbUser && dbUser.plan !== 'premium') {
          const today = new Date().toISOString().split('T')[0];
          if (dbUser.lastMatchDate === today && dbUser.dailyMatchCount > 0) {
            dbUser.dailyMatchCount -= 1;
            await dbUser.save();
            console.log(`[Matchmaking] 💸 Refunded daily match for ${dbUser.username}. New daily count: ${dbUser.dailyMatchCount}`);
            
            // Emit refund event so socket layer can notify this user if they are online
            this.emit('user:refunded', { userId: dbUser._id.toString(), dailyMatchCount: dbUser.dailyMatchCount });
          }
        }
      } catch (err) {
        console.error(`[Matchmaking] Error refunding user ${userId}:`, err.message);
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
  _startRelaxTimers(subjectId, socketId) {
    this._clearRelaxTimers(socketId);

    const t1 = setTimeout(() => {
      // Kiểm tra user vẫn còn trong queue
      const stillInQueue = this.queues[subjectId]?.some(q => q.socketId === socketId);
      if (!stillInQueue) return;

      console.log(`[Matchmaking] ⏳ Relax Level 1 for socket ${socketId} (60s wait)`);
      this.emit('queue:relaxed', { socketId, level: 1 });

      // Thử ghép lại với tiêu chí nới lỏng
      const match = this.tryMatch(subjectId);
      if (match) {
        // Socket layer sẽ xử lý emit 'matched' như bình thường
        this.emit('match:retry_found', match);
      }
    }, 60000);

    const t2 = setTimeout(() => {
      const stillInQueue = this.queues[subjectId]?.some(q => q.socketId === socketId);
      if (!stillInQueue) return;

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
      clearTimeout(this.relaxTimers[socketId].t1);
      clearTimeout(this.relaxTimers[socketId].t2);
      delete this.relaxTimers[socketId];
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
