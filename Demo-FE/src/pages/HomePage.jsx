import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaGraduationCap } from 'react-icons/fa';
import { FiArrowRight, FiSearch, FiZap, FiMessageSquare, FiVideo, FiEdit3, FiUsers, FiHeart } from 'react-icons/fi';
import backgroundDashboard from '../../background/backgroundDashboard.png';
import cachhoatdong from '../../background/Cachhoatdong.png';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import './HomePage.css';

export default function HomePage() {
  const { isLoggedIn } = useAuth();

  return (
    <div className="home-page">

      {/* ===================== HERO SECTION ===================== */}
      <section className="hero-section" style={{ backgroundImage: `url(${backgroundDashboard})` }}>
        <div className="hero-overlay"></div>

        <div className="container hero-container">
          <div className="hero-content animate-fade-in">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span>Miễn phí 100% • Không cần đăng ký phức tạp</span>
            </div>

            <h1 className="hero-title">
              TÌM <span className="hero-title-highlight">BẠN HỌC</span>
              <br />
              NGẪU NHIÊN TRỰC TUYẾN
            </h1>

            <p className="hero-description">
              Kết nối ngay với bạn học cùng môn chỉ trong vài giây. Học tập
              hiệu quả hơn khi có bạn đồng hành : video call, chat và bảng
              trắng tương tác.
            </p>

            <div className="hero-actions">
              <Link to={isLoggedIn ? '/lobby' : '/login'} className="btn-hero-primary">
                Vào sảnh chờ
              </Link>
              <a href="#features" className="btn-hero-secondary">
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

      {/* ===================== FEATURES SECTION ===================== */}
      <section className="features-section" id="features">
        {/*
          Mascot1 ở góc trái, ngang với hàng card đầu (Bộ lọc thông minh)
          Mascot2 ở góc phải, ngang với hàng card đầu (Chat Trực Tuyến)
          — KHÔNG trùng lặp với hero, chỉ dùng ở đây
        */}
        <div className="features-mascot features-mascot-left">
          <img src={mascot1} alt="Mascot 1" />
        </div>
        <div className="features-mascot features-mascot-right">
          <img src={mascot2} alt="Mascot 2" />
        </div>

        <div className="container">
          <div className="section-header animate-fade-in-up">
            <h2 className="section-title-dark">Tính năng nổi bật</h2>
            <p className="section-subtitle-dark">
              Mọi thứ bạn cần để tìm bạn học và học tập hiệu quả
            </p>
          </div>

          <div className="features-grid stagger-children">
            <div className="feature-card-new">
              <div className="feature-icon-wrap-new feature-icon-blue">
                <FiSearch />
              </div>
              <h3 className="feature-card-title">Bộ lọc thông minh</h3>
              <p className="feature-card-desc">Chọn môn học bạn muốn ôn tập — Toán, Lập trình, Tiếng Anh và nhiều hơn nữa.</p>
            </div>

            <div className="feature-card-new">
              <div className="feature-icon-wrap-new feature-icon-yellow">
                <FiZap />
              </div>
              <h3 className="feature-card-title">Ghép Đôi Tức Thì</h3>
              <p className="feature-card-desc">Hệ thống realtime tự động tìm và kết nối bạn với người cùng môn học trong vài giây</p>
            </div>

            <div className="feature-card-new">
              <div className="feature-icon-wrap-new feature-icon-purple">
                <FiMessageSquare />
              </div>
              <h3 className="feature-card-title">Chat Trực Tuyến</h3>
              <p className="feature-card-desc">Nhắn tin trao đổi bài vở, chia sẻ kiến thức ngay trong phòng học chung.</p>
            </div>

            <div className="feature-card-new">
              <div className="feature-icon-wrap-new feature-icon-pink">
                <FiVideo />
              </div>
              <h3 className="feature-card-title">Video &amp; Voice Call</h3>
              <p className="feature-card-desc">Gọi video/voice qua WebRTC — nhìn thấy và nghe thấy bạn học như ngồi cùng bàn.</p>
            </div>

            <div className="feature-card-new">
              <div className="feature-icon-wrap-new feature-icon-teal">
                <FiEdit3 />
              </div>
              <h3 className="feature-card-title">Bảng Trắng</h3>
              <p className="feature-card-desc">Giải bài tập cùng nhau trên bảng trắng tương tác vẽ, viết, minh hoạ dễ dàng.</p>
            </div>

            <div className="feature-card-new">
              <div className="feature-icon-wrap-new feature-icon-orange">
                <FiUsers />
              </div>
              <h3 className="feature-card-title">Kết Bạn &amp; Report</h3>
              <p className="feature-card-desc">Thêm bạn học yêu thích vào danh sách, báo cáo hành vi không phù hợp.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section className="howto-section" style={{ backgroundImage: `url(${cachhoatdong})` }}>
        {/* Overlay màu nhẹ - KHÔNG blur */}
        <div className="howto-overlay"></div>

        <div className="container howto-container">
          <div className="howto-header animate-fade-in-up">
            <h2 className="howto-title">Cách hoạt động</h2>
            <div className="howto-subtitle-badge">Chỉ 3 bước đơn giản để bắt đầu</div>
          </div>

          {/* 3 khung tách biệt, không mascot, không blur */}
          <div className="howto-steps stagger-children">
            <div className="howto-step-new">
              <h3 className="howto-step-title">Nhập tên &amp; Đăng nhập</h3>
              <p className="howto-step-desc">Không cần email, không cần mật khẩu. Chỉ cần nhập tên là xong!</p>
            </div>

            <div className="howto-step-new">
              <h3 className="howto-step-title">Chọn môn học</h3>
              <p className="howto-step-desc">Chọn môn bạn muốn ôn tập và bấm "Tìm bạn học".</p>
            </div>

            <div className="howto-step-new">
              <h3 className="howto-step-title">Học tập cùng nhau!</h3>
              <p className="howto-step-desc">Hệ thống ghép bạn với partner cùng môn - chat, gọi video và giải bài tập.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass-card">
            <div className="cta-glow"></div>
            <h2>Sẵn sàng tìm bạn học?</h2>
            <p>Tham gia cộng đồng StudyRandom ngay hôm nay — hoàn toàn miễn phí!</p>
            <Link to={isLoggedIn ? '/lobby' : '/login'} className="btn btn-primary btn-lg">
              <span><FaGraduationCap /></span>
              {isLoggedIn ? 'Tìm Bạn Học Ngay' : 'Bắt Đầu Miễn Phí'}
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <span><FaGraduationCap /></span> StudyRandom
            </div>
            <p className="footer-text">
              © 2026 StudyRandom. Made with <FiHeart style={{ verticalAlign: 'middle', color: '#ff6b6b' }} /> for students everywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
