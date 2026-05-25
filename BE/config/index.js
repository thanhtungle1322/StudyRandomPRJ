require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'studyrandom_secret_key_2026';

if (process.env.NODE_ENV === 'production' && jwtSecret === 'studyrandom_secret_key_2026') {
  console.error('[Config] FATAL: JWT_SECRET environment variable is not set in production!');
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/studyrandom',

  // CLIENT_URL có thể là nhiều domain (cách nhau dấu phẩy)
  // VD: "https://study-random-prj.vercel.app,http://localhost:5173"
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // TURN Server API Key
  meteredDomain: process.env.METERED_DOMAIN || '', // VD: "my-app"
  meteredApiKey: process.env.METERED_API_KEY || '',

  // Parse ra array cho CORS
  get corsOrigins() {
    const urls = this.clientUrl.split(',').map((u) => u.trim());
    // Trong development, luôn thêm localhost
    if (this.nodeEnv === 'development') {
      if (!urls.includes('http://localhost:5173')) {
        urls.push('http://localhost:5173');
      }
    }
    return urls;
  },

  // Auto-disconnect: thời gian chờ trước khi tự đóng phòng (ms)
  autoDisconnectTimeout: 5000,

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',

  // Session secret (cho OAuth state)
  sessionSecret: process.env.SESSION_SECRET || 'studyrandom_session_secret_2026',

  // Danh sách môn học hỗ trợ
  subjects: [
    { id: 'math', name: 'Toán học', icon: '📐' },
    { id: 'triet', name: 'Triết học', icon: '💚' },
    { id: 'english', name: 'Tiếng Anh', icon: '🇬🇧' },
    { id: 'lichsu', name: 'Lịch sử', icon: '🐍' },
    { id: 'diali', name: 'Địa lí', icon: '⚛️' },
    { id: 'database', name: 'Cơ sở dữ liệu', icon: '🗄️' },
    { id: 'algorithm', name: 'Thuật toán', icon: '🧮' },
    { id: 'physics', name: 'Vật lý', icon: '⚡' },
  ],
};
