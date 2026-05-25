# 🎓 StudyRandom - Tìm Bạn Học Ngẫu Nhiên

Ứng dụng web ghép ngẫu nhiên bạn học (1-1) dành cho học tập.

## 🚀 Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Realtime**: Socket.io
- **Styling**: Vanilla CSS (Dark Theme, Glassmorphism)

## 📦 Cài đặt

### Backend
```bash
cd BE
npm install
npm run dev
```

### Frontend
```bash
cd Demo-FE
npm install
npm run dev
```
## ✨ Tính năng

| Tính năng | Trạng thái |
|-----------|------------|
| Đăng nhập đơn giản (nhập tên) | ✅ Hoàn thành |
| Bộ lọc môn học | ✅ Hoàn thành |
| Hàng đợi Realtime (Socket.io) | ✅ Hoàn thành |
| Ghép đôi tự động | ✅ Hoàn thành |
| Chat trong phòng học | ✅ Hoàn thành |
| Video/Voice Call (WebRTC) | 🔧 UI sẵn, chưa kết nối |
| Bảng trắng tương tác | 📋 UI tĩnh |
| Kết bạn | 📋 UI tĩnh |
| Report | 📋 UI tĩnh |

## 🏗️ Cấu trúc dự án

```
StudyRandomPRJ/
├── BE/                          # Backend
│   ├── config/index.js          # Cấu hình ứng dụng
│   ├── routes/
│   │   ├── auth.js              # Đăng nhập
│   │   └── subjects.js          # Danh sách môn học
│   ├── services/
│   │   └── matchmaking.js       # Logic ghép đôi
│   ├── socket/
│   │   └── index.js             # Socket.io handlers
│   ├── server.js                # Entry point
│   ├── .env                     # Biến môi trường
│   └── package.json
│
├── Demo-FE/                     # Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Navigation bar
│   │   │   └── Navbar.css
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Auth state management
│   │   ├── pages/
│   │   │   ├── HomePage.*       # Landing page
│   │   │   ├── LoginPage.*      # Đăng nhập
│   │   │   ├── LobbyPage.*     # Sảnh chờ + tìm kiếm
│   │   │   ├── StudyRoom.*     # Phòng học + chat
│   │   │   ├── WhiteboardPage.* # Bảng trắng (UI)
│   │   │   ├── FriendsPage.*   # Bạn bè (UI)
│   │   │   ├── ReportPage.*    # Báo cáo (UI)
│   │   │   └── StaticPages.css
│   │   ├── services/
│   │   │   ├── api.js           # Axios instance
│   │   │   └── socket.js        # Socket.io client
│   │   ├── App.jsx              # Routes
│   │   ├── main.jsx             # Entry
│   │   └── index.css            # Design system
│   ├── .env
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## 🎯 Hướng dẫn test

1. Mở 2 terminal, chạy BE và FE
2. Mở 2 tab trình duyệt
3. Đăng nhập với 2 tên khác nhau
4. Chọn cùng 1 môn học ở cả 2 tab
5. Bấm "Tìm Bạn Học" ở cả 2 tab
6. Hệ thống tự ghép đôi → Vào phòng chat
