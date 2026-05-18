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
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// API Routes
// ========================
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);

// Cấp TURN Server credentials động cho WebRTC (Dùng Secret Key)
app.get('/api/turn-credentials', async (req, res) => {
  try {
    const secretKey = config.meteredApiKey; // Bản chất đây là Secret Key
    const domain = config.meteredDomain;
    
    if (!secretKey || !domain) {
      console.warn('[WebRTC] METERED_API_KEY or METERED_DOMAIN not set. Return empty.');
      return res.json([]);
    }

    // Dùng Secret Key gọi POST để xin cấp một bộ credential động (sống tạm thời)
    const response = await fetch(`https://${domain}.metered.live/api/v1/turn/credential?secretKey=${secretKey}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Metered API returned ${response.status}`);
    }
    const data = await response.json();
    
    // Tự format lại thành chuẩn iceServers của WebRTC trả về cho Frontend
    const iceServers = [
      { urls: `turn:${domain}.metered.live:80`, username: data.username, credential: data.password },
      { urls: `turn:${domain}.metered.live:443?transport=tcp`, username: data.username, credential: data.password }
    ];
    
    res.json(iceServers);
  } catch (error) {
    console.error('[WebRTC] Error generating TURN credentials:', error);
    res.status(500).json({ error: 'Failed to generate TURN credentials' });
  }
});

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
    origin: config.corsOrigins,
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

  // Chỉ listen cổng nếu KHÔNG deploy trên Vercel Serverless
  if (!process.env.VERCEL) {
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
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
});

// Phải export app cho Vercel serverless function
module.exports = app;
