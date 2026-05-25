const express = require('express');
const http = require('http');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config');
const dbObserver = require('./config/db');

const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');
const profileRoutes = require('./routes/profile');
const usersRoutes = require('./routes/users');

const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);

// Cấp TURN Server credentials động cho WebRTC (Dùng Secret Key)
app.get('/api/turn-credentials', async (req, res) => {
  try {
    const secretKey = config.meteredApiKey;
    const domain = config.meteredDomain;
    
    if (!secretKey || !domain) {
      console.warn('[WebRTC] METERED_API_KEY or METERED_DOMAIN not set. Return empty.');
      return res.json([]);
    }

    const getResponse = await fetch(`https://${domain}.metered.live/api/v1/turn/credentials?apiKey=${secretKey}`);
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error(`[WebRTC] Metered GET API failed. Status: ${getResponse.status}, Response: ${errorText}`);
      return res.json([]); // Gracefully fallback to empty array (STUN only)
    }
    const iceServers = await getResponse.json();
    
    res.json(iceServers);
  } catch (error) {
    console.error('[WebRTC] Error generating TURN credentials:', error);
    res.status(500).json({ error: 'Failed to generate TURN credentials' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbObserver.isConnected ? 'connected' : 'disconnected',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  connectTimeout: 10000,
});

setupSocket(io);

dbObserver.on('connected', () => {
  console.log('[Server] Database is ready');
});

dbObserver.on('disconnected', () => {
  console.warn('[Server] Database disconnected - app still running with in-memory data');
});

dbObserver.on('reconnected', () => {
  console.log('[Server] Database reconnected');
});

dbObserver.on('error', (err) => {
  console.error('[Server] Database error:', err.message);
});

async function startServer() {
  await dbObserver.connect(config.mongoUri);

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

module.exports = app;
