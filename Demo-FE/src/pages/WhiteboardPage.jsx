import { Link } from 'react-router-dom';
import './StaticPages.css';

export default function WhiteboardPage() {
  return (
    <div className="static-page">
      <div className="container">
        <div className="static-header animate-fade-in">
          <span className="static-icon">📝</span>
          <h1>Bảng Trắng Tương Tác</h1>
          <p className="static-subtitle">
            Giải bài tập và minh hoạ ý tưởng cùng bạn học trên bảng trắng thời gian thực
          </p>
        </div>

        <div className="static-content animate-fade-in-up">
          {/* Demo Whiteboard UI */}
          <div className="whiteboard-demo glass-card">
            <div className="whiteboard-toolbar">
              <div className="toolbar-group">
                <button className="tool-btn active" title="Bút vẽ">✏️</button>
                <button className="tool-btn" title="Hình chữ nhật">▭</button>
                <button className="tool-btn" title="Hình tròn">○</button>
                <button className="tool-btn" title="Đường thẳng">╱</button>
                <button className="tool-btn" title="Văn bản">T</button>
                <button className="tool-btn" title="Tẩy">🧹</button>
              </div>
              <div className="toolbar-group">
                <div className="color-picker">
                  <span className="color-dot" style={{ background: '#ff6b6b' }}></span>
                  <span className="color-dot" style={{ background: '#51cf66' }}></span>
                  <span className="color-dot active" style={{ background: '#339af0' }}></span>
                  <span className="color-dot" style={{ background: '#fcc419' }}></span>
                  <span className="color-dot" style={{ background: '#f1f3f5' }}></span>
                </div>
              </div>
              <div className="toolbar-group">
                <button className="tool-btn" title="Hoàn tác">↶</button>
                <button className="tool-btn" title="Làm lại">↷</button>
                <button className="tool-btn" title="Xoá tất cả">🗑️</button>
              </div>
            </div>

            <div className="whiteboard-canvas">
              <div className="canvas-placeholder">
                <span className="canvas-icon">🎨</span>
                <p>Khu vực vẽ sẽ được hiển thị ở đây</p>
                <p className="canvas-hint">
                  Cả hai người có thể vẽ cùng lúc trên bảng trắng này
                </p>
              </div>

              {/* Demo Drawing Elements */}
              <svg className="demo-drawing" viewBox="0 0 600 300">
                <text x="50" y="40" fill="#339af0" fontSize="18" fontFamily="Inter">f(x) = x² + 3x + 2</text>
                <line x1="50" y1="250" x2="550" y2="250" stroke="#495057" strokeWidth="2" />
                <line x1="300" y1="50" x2="300" y2="280" stroke="#495057" strokeWidth="2" />
                <path d="M 100 230 Q 200 180 300 100 Q 400 20 500 60" stroke="#339af0" strokeWidth="3" fill="none" />
                <circle cx="300" cy="100" r="5" fill="#ff6b6b" />
                <text x="310" y="95" fill="#ff6b6b" fontSize="12">(0, 2)</text>
              </svg>
            </div>
          </div>

          {/* Feature Description */}
          <div className="feature-list">
            <div className="feature-item glass-card">
              <span className="feature-emoji">✏️</span>
              <div>
                <h3>Vẽ tự do</h3>
                <p>Sử dụng bút vẽ để giải thích bài toán, vẽ hình minh hoạ</p>
              </div>
            </div>
            <div className="feature-item glass-card">
              <span className="feature-emoji">🔄</span>
              <div>
                <h3>Realtime Sync</h3>
                <p>Tất cả thay đổi được đồng bộ ngay lập tức giữa 2 người</p>
              </div>
            </div>
            <div className="feature-item glass-card">
              <span className="feature-emoji">📐</span>
              <div>
                <h3>Công cụ hình học</h3>
                <p>Vẽ hình chữ nhật, tròn, đường thẳng chính xác</p>
              </div>
            </div>
          </div>

          <div className="static-notice glass-card">
            <span>🚧</span>
            <p>
              <strong>Tính năng đang phát triển.</strong> Bảng trắng tương tác sẽ 
              được tích hợp vào phòng học trong phiên bản tiếp theo.
            </p>
          </div>

          <div className="static-cta">
            <Link to="/lobby" className="btn btn-primary btn-lg">
              ← Quay lại Sảnh chờ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
