const matchmaking = require('../services/matchmaking');
const config = require('../config');

module.exports = function setupSocket(io) {

  // ================================================================
  // OBSERVER: Lắng nghe events từ MatchmakingService
  // Decoupled - socket handler không gọi trực tiếp logic nữa
  // ================================================================

  // Khi phòng bị auto-closed sau 5s → thông báo user còn lại
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

  // Khi countdown auto-disconnect bắt đầu → thông báo user còn lại
  matchmaking.on('room:auto_closing', ({ roomId, countdown }) => {
    io.to(roomId).emit('auto_disconnect_warning', {
      message: `Bạn học đã rời phòng. Phòng sẽ tự đóng sau ${countdown / 1000} giây...`,
      countdown,
      roomId,
    });
  });

  // Khi auto-disconnect bị hủy (user reconnect)
  matchmaking.on('room:auto_closing_cancelled', ({ roomId }) => {
    io.to(roomId).emit('auto_disconnect_cancelled', {
      message: 'Bạn học đã quay lại!',
      roomId,
    });
  });

  // Khi queue stats thay đổi → broadcast cho tất cả
  matchmaking.on('stats:updated', ({ queueStats }) => {
    io.emit('queue_stats', queueStats);
  });

  // ================================================================
  // SOCKET CONNECTIONS
  // ================================================================

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // ========================
    // MATCHMAKING - Tìm bạn học
    // ========================

    socket.on('join_queue', ({ subjectId, user }) => {
      console.log(`[Socket] ${user.username} joining queue for ${subjectId}`);

      const match = matchmaking.addToQueue(subjectId, socket.id, user);

      if (match) {
        // Ghép đôi thành công!
        const { roomId, user1, user2, subject } = match;

        // Cả 2 user join vào room Socket.io
        const socket1 = io.sockets.sockets.get(user1.socketId);
        const socket2 = io.sockets.sockets.get(user2.socketId);

        if (socket1) socket1.join(roomId);
        if (socket2) socket2.join(roomId);

        // Gửi thông tin partner riêng cho từng user
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
        // Đang chờ trong hàng đợi
        socket.emit('waiting', {
          message: 'Đang tìm bạn học phù hợp...',
          queueStats: matchmaking.getQueueStats(),
        });
      }
    });

    // User rời hàng đợi
    socket.on('leave_queue', () => {
      matchmaking.removeFromQueue(socket.id);
      socket.emit('queue_left', { message: 'Đã rời hàng đợi' });
    });

    // ========================
    // CHAT - Nhắn tin trong phòng
    // ========================

    socket.on('send_message', ({ roomId, message, user }) => {
      const msgData = {
        id: Date.now().toString(),
        text: message,
        user,
        timestamp: new Date(),
      };

      matchmaking.addMessage(roomId, msgData);

      // Gửi tin nhắn cho cả phòng
      io.to(roomId).emit('new_message', msgData);
    });

    // ========================
    // ROOM - Quản lý phòng
    // ========================

    // User join lại phòng (reconnect)
    socket.on('join_room', ({ roomId, user }) => {
      const room = matchmaking.getRoom(roomId);
      if (room) {
        socket.join(roomId);

        // Nếu user reconnect → hủy auto-disconnect timer
        matchmaking.cancelAutoDisconnect(roomId);

        // Cập nhật socketId nếu user reconnect với socket mới
        if (user) {
          const existingUser = room.users.find(
            (u) => u.user.id === user.id || u.user.username === user.username
          );
          if (existingUser) {
            existingUser.socketId = socket.id;
          }
        }

        socket.emit('room_data', room);

        // Thông báo partner rằng user đã reconnect
        socket.to(roomId).emit('partner_reconnected', {
          message: 'Bạn học đã kết nối lại!',
        });
      } else {
        socket.emit('room_error', { message: 'Phòng không tồn tại hoặc đã đóng' });
      }
    });

    // User rời phòng (chủ động)
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
    // WEBRTC Signaling (cơ bản)
    // ========================

    socket.on('webrtc_offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('webrtc_offer', { offer });
    });

    socket.on('webrtc_answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('webrtc_answer', { answer });
    });

    socket.on('webrtc_ice_candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('webrtc_ice_candidate', { candidate });
    });

    // ========================
    // Queue Stats - Thống kê
    // ========================

    socket.on('get_queue_stats', () => {
      socket.emit('queue_stats', matchmaking.getQueueStats());
    });

    // ========================
    // DISCONNECT
    // ========================

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected: ${socket.id} (reason: ${reason})`);

      // Xóa khỏi hàng đợi
      matchmaking.removeFromQueue(socket.id);

      // Xóa khỏi phòng → auto-disconnect timer bắt đầu tự động
      const result = matchmaking.removeUserFromRoom(socket.id);
      if (result && result.remaining) {
        io.to(result.roomId).emit('partner_left', {
          message: 'Bạn học đã ngắt kết nối',
        });
      }
    });
  });
};
