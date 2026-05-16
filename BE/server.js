const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config');
const dbObserver = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');

// Import socket handler
const setupSocket = require('./socket');

// ========================
// Express App Setup
// ========================
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// API Routes
// ========================
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);

// Health check (bao gồm DB status)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbObserver.isConnected ? 'connected' : 'disconnected',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// ========================
// Socket.io Setup
// ========================
const io = new Server(server, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Auto-reconnect configs cho socket.io server
  pingTimeout: 30000,
  pingInterval: 10000,
  connectTimeout: 10000,
});

setupSocket(io);

// ========================
// Observer: Lắng nghe DB events
// ========================
dbObserver.on('connected', () => {
  console.log('[Server] Database is ready');
});

dbObserver.on('disconnected', () => {
  console.warn('[Server] Database disconnected - app still running with in-memory data');
});

dbObserver.on('error', (err) => {
  console.error('[Server] Database error:', err.message);
});

// ========================
// Start Server
// ========================
async function startServer() {
  // Kết nối MongoDB
  await dbObserver.connect(config.mongoUri);

  // Start Express server
  server.listen(config.port, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║     🎓 StudyRandom Backend              ║
  ║     Port: ${config.port}                         ║
  ║     Env: ${config.nodeEnv}                 ║
  ║     Client: ${config.clientUrl}       ║
  ║     MongoDB: ${config.mongoUri}  ║
  ╚══════════════════════════════════════════╝
    `);
  });
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
});

module.exports = { app, server, io };
