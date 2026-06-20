require('dotenv').config();

// Nếu ở production thì BẮT BUỘC phải có biến môi trường, không dùng fallback chuỗi mặc định
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET;

if (isProduction && !jwtSecret) {
  console.error('[Config] FATAL: JWT_SECRET environment variable is not set in production!');
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: jwtSecret || 'studyrandom_secret_key_2026', // Fallback cho dev environment
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/studyrandom',
  // ... các cấu hình bên dưới giữ nguyên
  // CLIENT_URL có thể là nhiều domain (cách nhau dấu phẩy)
  // VD: "https://study-random-prj.vercel.app,http://localhost:5173"
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // TURN Server API Key
  meteredDomain: process.env.METERED_DOMAIN || '', // VD: "my-app"
  meteredApiKey: process.env.METERED_API_KEY || '',
  meteredUsername: process.env.METERED_USERNAME || '',
  meteredPassword: process.env.METERED_PASSWORD || '',

  get corsOrigins() {
    const urls = this.clientUrl.split(',').map((u) => u.trim());
    // Trong development, luôn thêm các port localhost thông dụng để tránh lỗi CORS khi đổi port
    if (this.nodeEnv === 'development') {
      const devPorts = ['5173', '5174', '5175', '5176'];
      devPorts.forEach(port => {
        const origin = `http://localhost:${port}`;
        if (!urls.includes(origin)) {
          urls.push(origin);
        }
        const ipOrigin = `http://127.0.0.1:${port}`;
        if (!urls.includes(ipOrigin)) {
          urls.push(ipOrigin);
        }
      });
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

  // PayOS Credentials
  payosClientId: process.env.PAYOS_CLIENT_ID || '',
  payosApiKey: process.env.PAYOS_API_KEY || '',
  payosChecksumKey: process.env.PAYOS_CHECKSUM_KEY || '',

  // Danh sách môn học hỗ trợ
  subjects: [
    // Phổ thông
    { id: 'math', name: 'Toán học', icon: '📐' },
    { id: 'physics', name: 'Vật lý', icon: '⚡' },
    { id: 'hoa', name: 'Hóa học', icon: '🧪' },
    { id: 'sinh', name: 'Sinh học', icon: '🧬' },
    { id: 'tinhoc', name: 'Tin học', icon: '💻' },
    { id: 'english', name: 'Tiếng Anh', icon: '🇬🇧' },
    { id: 'van', name: 'Ngữ văn', icon: '✍️' },
    { id: 'lichsu', name: 'Lịch sử', icon: '🐍' },
    { id: 'diali', name: 'Địa lí', icon: '⚛️' },
    { id: 'gdcd', name: 'GDCD', icon: '🏅' },

    // Lập trình / CNTT
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'nodejs', name: 'NodeJS', icon: '🟢' },
    { id: 'react', name: 'React', icon: '⚛️' },
    { id: 'database', name: 'Cơ sở dữ liệu', icon: '🗄️' },
    { id: 'algorithm', name: 'Thuật toán', icon: '🧮' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'csharp', name: 'C#', icon: '🔷' },
    { id: 'cpp', name: 'C/C++', icon: '⚙️' },
    { id: 'flutter', name: 'Flutter', icon: '📱' },
    { id: 'ai', name: 'AI / ML', icon: '🤖' },
    { id: 'mang_may_tinh', name: 'Mạng máy tính', icon: '🌐' },
    { id: 'an_toan_thong_tin', name: 'An toàn thông tin', icon: '🔒' },

    // Đại học
    { id: 'triet', name: 'Triết học', icon: '💚' },
    { id: 'kinh_te', name: 'Kinh tế', icon: '📊' },
    { id: 'tam_ly', name: 'Tâm lý học', icon: '🧠' },
    { id: 'ke_toan', name: 'Kế toán', icon: '💸' },
    { id: 'phap_luat', name: 'Pháp luật', icon: '⚖️' },
    { id: 'marketing', name: 'Marketing', icon: '📢' },
    { id: 'quan_tri', name: 'Quản trị kinh doanh', icon: '💼' },
    { id: 'xa_hoi_hoc', name: 'Xã hội học', icon: '👥' },
    { id: 'luat_dai_cuong', name: 'Luật đại cương', icon: '📚' },

    // Ngoại ngữ
    { id: 'tieng_anh_gt', name: 'Tiếng Anh giao tiếp', icon: '🇬🇧' },
    { id: 'tieng_trung', name: 'Tiếng Trung', icon: '🇨🇳' },
    { id: 'tieng_nhat', name: 'Tiếng Nhật', icon: '🇯🇵' },
    { id: 'tieng_han', name: 'Tiếng Hàn', icon: '🇰🇷' },

    // Y học & Sức khỏe
    { id: 'giai_phau', name: 'Giải phẫu học', icon: '🫁' },
    { id: 'duoc_ly', name: 'Dược lý học', icon: '🧪' },
    { id: 'dinh_duong', name: 'Dinh dưỡng học', icon: '🥗' },

    // Mỹ thuật & Thiết kế
    { id: 'graphic_design', name: 'Thiết kế đồ họa', icon: '🎨' },
    { id: 'ux_ui', name: 'Thiết kế UX/UI', icon: '📱' },
    { id: 'nhiep_anh', name: 'Nhiếp ảnh cơ bản', icon: '📷' },
  ],
};
