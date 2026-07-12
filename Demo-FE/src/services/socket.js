import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

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
    const currentSocket = io(SOCKET_URL, {
      autoConnect: false,

      auth: (cb) => {
        cb({ token: localStorage.getItem('studyrandom_token_v2') || localStorage.getItem('studyrandom_token') });
      },

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
    socket = currentSocket;

    // ========================
    // LIFECYCLE EVENT HANDLERS
    // ========================

    currentSocket.on('connect', () => {
      console.log('[Socket] ✅ Connected:', currentSocket.id);
      notifyListeners('connected', { id: currentSocket.id });
    });

    currentSocket.on('disconnect', (reason) => {
      console.log('[Socket] ⚠️ Disconnected:', reason);
      notifyListeners('disconnected', { reason });

      // Nếu server disconnect → thử reconnect
      if (reason === 'io server disconnect' && socket === currentSocket) {
        console.log('[Socket] 🔄 Server disconnected, attempting reconnect...');
        currentSocket.connect();
      }
      // Các lý do khác socket.io tự xử lý reconnect
    });

    currentSocket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] 🔄 Reconnecting... attempt ${attempt}`);
      notifyListeners('reconnecting', { attempt });
    });

    currentSocket.io.on('reconnect', (attempt) => {
      console.log(`[Socket] ✅ Reconnected after ${attempt} attempts`);
      notifyListeners('reconnected', { attempt });
    });

    currentSocket.io.on('reconnect_failed', () => {
      console.error('[Socket] ❌ Reconnection failed after max attempts');
      notifyListeners('reconnect_failed', {});
    });

    currentSocket.io.on('reconnect_error', (err) => {
      console.error('[Socket] ❌ Reconnection error:', err.message);
    });

    currentSocket.on('connect_error', (err) => {
      console.error('[Socket] ❌ Connection error:', err.message);
      notifyListeners('connect_error', { error: err.message });
      if (/invalid token|account no longer exists/i.test(err.message)) {
        window.dispatchEvent(new Event('studyrandom:auth-expired'));
      }
    });

    currentSocket.on('account_revoked', () => {
      window.dispatchEvent(new Event('studyrandom:auth-expired'));
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
  if (socket) {
    socket.io.reconnection(false);
    socket.disconnect();
    socket = null;
  }
}

/**
 * Kiểm tra trạng thái kết nối
 */
export function isSocketConnected() {
  return socket?.connected || false;
}

export default { getSocket, connectSocket, disconnectSocket, isSocketConnected, onSocketEvent };
