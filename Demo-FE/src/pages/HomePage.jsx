import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

export default function HomePage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="home-page">
      {/* Hero Background Effects */}
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1"></div>
        <div className="hero-orb hero-orb-2"></div>
        <div className="hero-orb hero-orb-3"></div>
        <div className="hero-grid"></div>
      </div>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content animate-fade-in">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span>Miễn phí 100% • Không cần đăng ký phức tạp</span>
            </div>
            
            <h1 className="hero-title">
              Tìm <span className="gradient-text">Bạn Học</span>
              <br />
              Ngẫu Nhiên Trực Tuyến
            </h1>
            
            <p className="hero-description">
              Kết nối ngay với bạn học cùng môn chỉ trong vài giây. 
              Học tập hiệu quả hơn khi có bạn đồng hành — video call, 
              chat và bảng trắng tương tác.
            </p>
            
            <div className="hero-actions">
              <Link to={isLoggedIn ? '/lobby' : '/login'} className="btn btn-primary btn-lg">
                <span>🚀</span>
                {isLoggedIn ? 'Vào Sảnh Chờ' : 'Bắt Đầu Ngay'}
              </Link>
              <a href="#features" className="btn btn-secondary btn-lg">
                Tìm hiểu thêm
              </a>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">1000+</span>
                <span className="stat-label">Người dùng</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">8</span>
                <span className="stat-label">Môn học</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">&lt;5s</span>
                <span className="stat-label">Ghép đôi</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="container">
          <div className="section-header animate-fade-in-up">
            <h2 className="section-title">Tính Năng Nổi Bật</h2>
            <p className="section-subtitle">
              Mọi thứ bạn cần để tìm bạn học và học tập hiệu quả
            </p>
          </div>

          <div className="features-grid stagger-children">
            <div className="feature-card glass-card">
              <div className="feature-icon-wrap">
                <span className="feature-icon">🔍</span>
              </div>
              <h3>Bộ Lọc Thông Minh</h3>
              <p>Chọn môn học bạn muốn ôn tập — Toán, Lập trình, Tiếng Anh và nhiều hơn nữa.</p>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon-wrap">
                <span className="feature-icon">⚡</span>
              </div>
              <h3>Ghép Đôi Tức Thì</h3>
              <p>Hệ thống realtime tự động tìm và kết nối bạn với người cùng môn học trong vài giây.</p>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon-wrap">
                <span className="feature-icon">💬</span>
              </div>
              <h3>Chat Trực Tuyến</h3>
              <p>Nhắn tin trao đổi bài vở, chia sẻ kiến thức ngay trong phòng học chung.</p>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon-wrap">
                <span className="feature-icon">🎥</span>
              </div>
              <h3>Video & Voice Call</h3>
              <p>Gọi video/voice qua WebRTC — nhìn thấy và nghe thấy bạn học như ngồi cùng bàn.</p>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon-wrap">
                <span className="feature-icon">📝</span>
              </div>
              <h3>Bảng Trắng</h3>
              <p>Giải bài tập cùng nhau trên bảng trắng tương tác — vẽ, viết, minh hoạ dễ dàng.</p>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon-wrap">
                <span className="feature-icon">👥</span>
              </div>
              <h3>Kết Bạn & Report</h3>
              <p>Thêm bạn học yêu thích vào danh sách, báo cáo hành vi không phù hợp.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="howto-section">
        <div className="container">
          <div className="section-header animate-fade-in-up">
            <h2 className="section-title">Cách Hoạt Động</h2>
            <p className="section-subtitle">Chỉ 3 bước đơn giản để bắt đầu</p>
          </div>

          <div className="howto-steps stagger-children">
            <div className="howto-step">
              <div className="step-number">01</div>
              <div className="step-content">
                <h3>Nhập tên & Đăng nhập</h3>
                <p>Không cần email, không cần mật khẩu. Chỉ cần nhập tên là xong!</p>
              </div>
            </div>
            <div className="step-connector"></div>
            <div className="howto-step">
              <div className="step-number">02</div>
              <div className="step-content">
                <h3>Chọn môn học</h3>
                <p>Chọn môn bạn muốn ôn tập và bấm "Tìm bạn học".</p>
              </div>
            </div>
            <div className="step-connector"></div>
            <div className="howto-step">
              <div className="step-number">03</div>
              <div className="step-content">
                <h3>Học tập cùng nhau!</h3>
                <p>Hệ thống ghép bạn với partner cùng môn — chat, gọi video và giải bài tập.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass-card">
            <div className="cta-glow"></div>
            <h2>Sẵn sàng tìm bạn học?</h2>
            <p>Tham gia cộng đồng StudyRandom ngay hôm nay — hoàn toàn miễn phí!</p>
            <Link to={isLoggedIn ? '/lobby' : '/login'} className="btn btn-primary btn-lg">
              <span>🎓</span>
              {isLoggedIn ? 'Tìm Bạn Học Ngay' : 'Bắt Đầu Miễn Phí'}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <span>🎓</span> StudyRandom
            </div>
            <p className="footer-text">
              © 2026 StudyRandom. Made with ❤️ for students everywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
