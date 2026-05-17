import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// ========================
// Observer Pattern cho Socket events ở Frontend
// Các component subscribe vào events thay vì gọi trực tiếp
// ========================
const listeners = new Map(); // eventName -> Set of callbacks

/**
 * Subscribe to a socket lifecycle event
 * Events: 'connected', 'disconnected', 'reconnecting', 'reconnected', 'reconnect_failed'
 */
export function onSocketEvent(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  // Return unsubscribe function
  return () => {
    listeners.get(event)?.delete(callback);
  };
}

function notifyListeners(event, data) {
  listeners.get(event)?.forEach((cb) => {
    try {
      cb(data);
    } catch (err) {
      console.error(`[Socket Observer] Error in ${event} listener:`, err);
    }
  });
}

/**
 * Lấy hoặc tạo socket instance với auto-reconnect config
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,

      // ========================
      // AUTO-RECONNECT CONFIG
      // ========================
      reconnection: true,
      reconnectionAttempts: 10,        // Thử reconnect tối đa 10 lần
      reconnectionDelay: 1000,         // Delay ban đầu 1s
      reconnectionDelayMax: 5000,      // Delay tối đa 5s
      randomizationFactor: 0.5,        // Random factor để tránh thundering herd

      // Timeouts
      timeout: 10000,                  // Connection timeout 10s

      // Transport (Ưu tiên polling trước trên Vercel do Vercel Serverless không hỗ trợ native websocket)
      transports: ['polling', 'websocket'],
    });

    // ========================
    // LIFECYCLE EVENT HANDLERS
    // ========================

    socket.on('connect', () => {
      console.log('[Socket] ✅ Connected:', socket.id);
      notifyListeners('connected', { id: socket.id });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] ⚠️ Disconnected:', reason);
      notifyListeners('disconnected', { reason });

      // Nếu server disconnect → thử reconnect
      if (reason === 'io server disconnect') {
        console.log('[Socket] 🔄 Server disconnected, attempting reconnect...');
        socket.connect();
      }
      // Các lý do khác socket.io tự xử lý reconnect
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] 🔄 Reconnecting... attempt ${attempt}`);
      notifyListeners('reconnecting', { attempt });
    });

    socket.io.on('reconnect', (attempt) => {
      console.log(`[Socket] ✅ Reconnected after ${attempt} attempts`);
      notifyListeners('reconnected', { attempt });
    });

    socket.io.on('reconnect_failed', () => {
      console.error('[Socket] ❌ Reconnection failed after max attempts');
      notifyListeners('reconnect_failed', {});
    });

    socket.io.on('reconnect_error', (err) => {
      console.error('[Socket] ❌ Reconnection error:', err.message);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] ❌ Connection error:', err.message);
      notifyListeners('connect_error', { error: err.message });
    });
  }
  return socket;
}

/**
 * Kết nối socket
 */
export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * Ngắt kết nối socket
 */
export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}

/**
 * Kiểm tra trạng thái kết nối
 */
export function isSocketConnected() {
  return socket?.connected || false;
}

export default { getSocket, connectSocket, disconnectSocket, isSocketConnected, onSocketEvent };
