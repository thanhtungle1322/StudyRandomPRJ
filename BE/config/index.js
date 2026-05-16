require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'studyrandom_secret_key_2026',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/studyrandom',

  // Auto-disconnect: thời gian chờ trước khi tự đóng phòng (ms)
  autoDisconnectTimeout: 5000,

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
