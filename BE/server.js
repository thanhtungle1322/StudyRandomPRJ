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

    // 1. Dùng Secret Key gọi POST để xin cấp apiKey tạm thời
    const postResponse = await fetch(`https://${domain}.metered.live/api/v1/turn/credential?secretKey=${secretKey}`, {
      method: 'POST'
    });
    
    if (!postResponse.ok) {
      throw new Error(`Metered POST API returned ${postResponse.status}`);
    }
    const data = await postResponse.json();
    
    // 2. Dùng apiKey tạm thời đó để GET danh sách toàn bộ ICE Servers chuẩn của hệ thống Metered
    const getResponse = await fetch(`https://${domain}.metered.live/api/v1/turn/credentials?apiKey=${data.apiKey}`);
    if (!getResponse.ok) {
      throw new Error(`Metered GET API returned ${getResponse.status}`);
    }
    const iceServers = await getResponse.json();
    
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
