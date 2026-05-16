const mongoose = require('mongoose');
const EventEmitter = require('events');

/**
 * DatabaseObserver - Observer Pattern cho MongoDB connection
 * Các module khác có thể subscribe vào events: 'connected', 'error', 'disconnected', 'reconnected'
 */
class DatabaseObserver extends EventEmitter {
  constructor() {
    super();
    this._isConnected = false;
    this._setupMongooseListeners();
  }

  get isConnected() {
    return this._isConnected;
  }

  /**
   * Lắng nghe mongoose connection events và emit cho observers
   */
  _setupMongooseListeners() {
    mongoose.connection.on('connected', () => {
      this._isConnected = true;
      console.log('[MongoDB] ✅ Connection established');
      this.emit('connected');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`[MongoDB] ❌ Connection error: ${err.message}`);
      this.emit('error', err);
    });

    mongoose.connection.on('disconnected', () => {
      this._isConnected = false;
      console.log('[MongoDB] ⚠️ Connection disconnected');
      this.emit('disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      this._isConnected = true;
      console.log('[MongoDB] 🔄 Reconnected successfully');
      this.emit('reconnected');
    });
  }

  /**
   * Kết nối MongoDB với auto-reconnect
   */
  async connect(uri) {
    try {
      await mongoose.connect(uri, {
        // Auto-reconnect configs (mongoose 7+ tự handle reconnect)
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      });
      console.log('[MongoDB] ✅ Connected successfully!');
    } catch (err) {
      console.error(`[MongoDB] ❌ Initial connection failed: ${err.message}`);
      console.log('[MongoDB] 🔄 Retrying in 5 seconds...');
      // Retry connection after 5s
      setTimeout(() => this.connect(uri), 5000);
    }
  }

  /**
   * Ngắt kết nối
   */
  async disconnect() {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected gracefully');
  }
}

// Singleton instance
const dbObserver = new DatabaseObserver();

module.exports = dbObserver;
