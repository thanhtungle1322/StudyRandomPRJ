const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const matchmaking = require('../services/matchmaking');
const config = require('../config');
const User = require('../models/User');

const userSockets = new Map();

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
      socket.to(roomId).emit('webrtc_offer', { offer, senderId: socket.id });
    });

    socket.on('webrtc_answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('webrtc_answer', { answer, senderId: socket.id });
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
    // DISCONNECT
    // ========================

    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] User disconnected: ${username} (${socket.id}, reason: ${reason})`);

      userSockets.delete(socket.id);

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
