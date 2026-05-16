import { useState } from 'react';
import { Link } from 'react-router-dom';
import './StaticPages.css';

export default function ReportPage() {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const reportTypes = [
    { id: 'spam', label: '🗑️ Spam / Quảng cáo', desc: 'Người dùng gửi tin nhắn rác' },
    { id: 'harassment', label: '😤 Quấy rối', desc: 'Ngôn ngữ xúc phạm, đe doạ' },
    { id: 'inappropriate', label: '🚫 Nội dung không phù hợp', desc: 'Nội dung vi phạm quy tắc' },
    { id: 'cheating', label: '📝 Gian lận', desc: 'Không học tập nghiêm túc' },
    { id: 'other', label: '❓ Khác', desc: 'Vấn đề khác' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="static-page">
      <div className="container">
        <div className="static-header animate-fade-in">
          <span className="static-icon">🚨</span>
          <h1>Báo Cáo Vấn Đề</h1>
          <p className="static-subtitle">
            Giúp chúng tôi giữ môi trường học tập an toàn và lành mạnh
          </p>
        </div>

        <div className="static-content animate-fade-in-up">
          {submitted ? (
            <div className="report-success glass-card">
              <span className="success-icon">✅</span>
              <h2>Cảm ơn bạn đã báo cáo!</h2>
              <p>
                Đội ngũ quản trị sẽ xem xét báo cáo của bạn trong thời gian sớm nhất.
                Chúng tôi cam kết tạo môi trường học tập an toàn cho mọi người.
              </p>
              <div className="success-actions">
                <Link to="/lobby" className="btn btn-primary">
                  ← Quay lại Sảnh chờ
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSubmitted(false);
                    setReportType('');
                    setDescription('');
                  }}
                >
                  Gửi báo cáo khác
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="report-form">
              <div className="report-types">
                <h3>Chọn loại vi phạm:</h3>
                <div className="report-type-grid">
                  {reportTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className={`report-type-card glass-card ${
                        reportType === type.id ? 'selected' : ''
                      }`}
                      onClick={() => setReportType(type.id)}
                    >
                      <span className="report-type-label">{type.label}</span>
                      <span className="report-type-desc">{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="report-desc">Mô tả chi tiết (tuỳ chọn):</label>
                <textarea
                  id="report-desc"
                  className="input-field report-textarea"
                  placeholder="Mô tả thêm về vấn đề bạn gặp phải..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="report-actions">
                <button
                  type="submit"
                  className="btn btn-danger btn-lg"
                  disabled={!reportType}
                >
                  🚨 Gửi Báo Cáo
                </button>
                <Link to="/lobby" className="btn btn-secondary btn-lg">
                  Huỷ
                </Link>
              </div>
            </form>
          )}

          <div className="static-notice glass-card" style={{ marginTop: 32 }}>
            <span>🚧</span>
            <p>
              <strong>Tính năng đang phát triển.</strong> Hệ thống báo cáo sẽ được 
              kết nối với hệ thống quản trị trong phiên bản tiếp theo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
