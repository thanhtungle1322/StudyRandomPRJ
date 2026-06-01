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
const friendsRoutes = require('./routes/friends');
const premiumRoutes = require('./routes/premium');
const adminRoutes = require('./routes/admin');
const feedbackRoutes = require('./routes/feedback');

const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
app.use('/api/friends', friendsRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);

// Cấp TURN Server credentials động cho WebRTC (Dùng Secret/Static Key bảo mật)
app.get('/api/turn-credentials', async (req, res) => {
  try {
    const secretKey = config.meteredApiKey;
    const domain = config.meteredDomain;
    const username = config.meteredUsername;
    const password = config.meteredPassword;
    
    // Cách 1: Sử dụng REST API động (Khuyên dùng vì bảo mật hơn, tự động thay đổi token)
    if (secretKey && domain) {
      try {
        console.log('[WebRTC] Fetching TURN credentials from Metered API dynamically...');
        const getResponse = await fetch(`https://${domain}.metered.live/api/v1/turn/credentials?apiKey=${secretKey}`);
        if (getResponse.ok) {
          const iceServers = await getResponse.json();
          console.log('[WebRTC] Dynamic TURN credentials loaded successfully.');
          return res.json(iceServers);
        }
        
        const errorText = await getResponse.text();
        console.error(`[WebRTC] Metered API returned error status: ${getResponse.status}, response: ${errorText}`);
      } catch (apiError) {
        console.error('[WebRTC] Error calling Metered API:', apiError);
      }
    }

    // Cách 2: Fallback hoặc Sử dụng Credentials tĩnh có sẵn từ Environment Variables
    if (username && password) {
      console.log('[WebRTC] Falling back or using configured static Metered credentials...');
      const staticIceServers = [
        {
          urls: 'stun:stun.relay.metered.ca:80',
        },
        {
          urls: 'turn:standard.relay.metered.ca:80',
          username: username,
          credential: password,
        },
        {
          urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
          username: username,
          credential: password,
        },
        {
          urls: 'turn:standard.relay.metered.ca:443',
          username: username,
          credential: password,
        },
        {
          urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
          username: username,
          credential: password,
        },
      ];
      return res.json(staticIceServers);
    }

    console.warn('[WebRTC] Neither Metered API Key nor static credentials are configured. Returning empty.');
    res.json([]);
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

  // Seed default admin account
  try {
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    const adminEmail = 'admin@studyrandom.com';
    const adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      console.log('[Seed] Default Admin user not found. Seeding admin account...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await User.create({
        email: adminEmail,
        password: hashedPassword,
        displayName: 'Quản trị viên (Admin)',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        authProvider: 'local',
        role: 'admin',
        plan: 'premium',
        premiumTier: 'ultimate',
        premiumExpiresAt: null, // Admin không bao giờ hết hạn
        badges: ['PREMIUM_ULTIMATE'],
        isOnline: false,
      });
      console.log('[Seed] Successfully seeded default Admin account: admin@studyrandom.com / admin123');
    }
    // Đảm bảo tất cả admin đều có gói Ultimate vĩnh viễn
    await User.updateMany(
      { role: 'admin', premiumTier: { $ne: 'ultimate' } },
      { $set: { plan: 'premium', premiumTier: 'ultimate', premiumExpiresAt: null }, $addToSet: { badges: 'PREMIUM_ULTIMATE' } }
    );
  } catch (seedError) {
    console.error('[Seed] Failed to seed default Admin account:', seedError.message);
  }

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
