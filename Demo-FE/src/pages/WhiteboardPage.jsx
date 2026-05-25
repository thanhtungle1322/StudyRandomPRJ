import { Link } from 'react-router-dom';
import { FiEdit3, FiEdit2, FiTrash2, FiRefreshCw, FiTriangle, FiAlertCircle, FiArrowLeft, FiType, FiMinus } from 'react-icons/fi';
import { FaPaintBrush, FaPalette, FaEraser } from 'react-icons/fa';
import { BiUndo, BiRedo, BiRectangle, BiCircle } from 'react-icons/bi';
import backgroundDashboard from '../../background/backgroundDashboard.png';
import './WhiteboardPage.css';

export default function WhiteboardPage() {
  return (
    <div className="whiteboard-page" style={{ backgroundImage: `url(${backgroundDashboard})` }}>
      <div className="whiteboard-overlay" />

      <div className="container whiteboard-container">
        {/* Header */}
        <div className="whiteboard-header animate-fade-in">
          <span className="whiteboard-header-icon">🎨</span>
          <h1>Bảng Trắng Tương Tác</h1>
          <p>Giải bài tập và minh hoạ ý tưởng cùng bạn học trên bảng trắng thời gian thực</p>
        </div>

        <div className="whiteboard-body animate-fade-in-up">
          {/* Demo Whiteboard */}
          <div className="whiteboard-demo-card">
            {/* Toolbar */}
            <div className="wb-toolbar">
              <div className="wb-toolbar-group">
                <button className="wb-tool active" title="Bút vẽ"><FiEdit2 /></button>
                <button className="wb-tool" title="Hình chữ nhật"><BiRectangle /></button>
                <button className="wb-tool" title="Hình tròn"><BiCircle /></button>
                <button className="wb-tool" title="Đường thẳng"><FiMinus /></button>
                <button className="wb-tool" title="Văn bản"><FiType /></button>
                <button className="wb-tool" title="Tẩy"><FaEraser /></button>
              </div>

              <div className="wb-toolbar-group">
                <div className="wb-colors">
                  <span className="wb-color-dot" style={{ background: '#ff6b6b' }} />
                  <span className="wb-color-dot" style={{ background: '#51cf66' }} />
                  <span className="wb-color-dot active" style={{ background: '#339af0' }} />
                  <span className="wb-color-dot" style={{ background: '#fcc419' }} />
                  <span className="wb-color-dot" style={{ background: '#f1f3f5' }} />
                </div>
              </div>

              <div className="wb-toolbar-group">
                <button className="wb-tool" title="Hoàn tác"><BiUndo /></button>
                <button className="wb-tool" title="Làm lại"><BiRedo /></button>
                <button className="wb-tool" title="Xoá tất cả"><FiTrash2 /></button>
              </div>
            </div>

            {/* Canvas area */}
            <div className="wb-canvas">
              <div className="wb-canvas-placeholder">
                <span><FaPalette /></span>
                <p>Khu vực vẽ sẽ được hiển thị ở đây</p>
                <p className="wb-canvas-hint">Cả hai người có thể vẽ cùng lúc trên bảng trắng này</p>
              </div>
              <svg className="wb-demo-drawing" viewBox="0 0 600 300">
                <text x="50" y="40" fill="#1971c2" fontSize="18" fontFamily="Nunito, Inter">f(x) = x² + 3x + 2</text>
                <line x1="50" y1="250" x2="550" y2="250" stroke="#495057" strokeWidth="2" />
                <line x1="300" y1="50" x2="300" y2="280" stroke="#495057" strokeWidth="2" />
                <path d="M 100 230 Q 200 180 300 100 Q 400 20 500 60" stroke="#1971c2" strokeWidth="3" fill="none" />
                <circle cx="300" cy="100" r="5" fill="#e03131" />
                <text x="310" y="95" fill="#e03131" fontSize="12">(0, 2)</text>
              </svg>
            </div>
          </div>

          {/* Feature cards */}
          <div className="wb-features">
            <div className="wb-feature-card">
              <span className="wb-feature-icon" style={{ background: 'rgba(116,192,252,0.2)', color: '#74c0fc' }}>
                <FaPaintBrush />
              </span>
              <div>
                <h3>Vẽ tự do</h3>
                <p>Sử dụng bút vẽ để giải thích bài toán, vẽ hình minh hoạ</p>
              </div>
            </div>
            <div className="wb-feature-card">
              <span className="wb-feature-icon" style={{ background: 'rgba(81,207,102,0.2)', color: '#51cf66' }}>
                <FiRefreshCw />
              </span>
              <div>
                <h3>Realtime Sync</h3>
                <p>Tất cả thay đổi được đồng bộ ngay lập tức giữa 2 người</p>
              </div>
            </div>
            <div className="wb-feature-card">
              <span className="wb-feature-icon" style={{ background: 'rgba(255,167,77,0.2)', color: '#ffa94d' }}>
                <FiTriangle />
              </span>
              <div>
                <h3>Công cụ hình học</h3>
                <p>Vẽ hình chữ nhật, tròn, đường thẳng chính xác</p>
              </div>
            </div>
          </div>

          {/* Notice */}
          <div className="wb-notice">
            <FiAlertCircle style={{ color: '#ffa94d', fontSize: 20, flexShrink: 0 }} />
            <p>
              <strong>Tính năng đang phát triển.</strong> Bảng trắng tương tác sẽ
              được tích hợp vào phòng học trong phiên bản tiếp theo.
            </p>
          </div>

          {/* CTA */}
          <div className="wb-cta">
            <Link to="/lobby" className="btn-wb-back">
              <FiArrowLeft /> Quay lại Sảnh chờ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
