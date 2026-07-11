import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertOctagon, FiCheckCircle, FiAlertCircle, FiTrash2, FiHelpCircle, FiEdit3, FiSlash, FiArrowLeft, FiFrown } from 'react-icons/fi';
import api from '../services/api';
import './StaticPages.css';

export default function ReportPage() {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reportTypes = [
    { id: 'spam', icon: <FiTrash2 />, label: 'Spam / Quảng cáo', desc: 'Người dùng gửi tin nhắn rác' },
    { id: 'harassment', icon: <FiFrown />, label: 'Quấy rối', desc: 'Ngôn ngữ xúc phạm, đe doạ' },
    { id: 'inappropriate', icon: <FiSlash />, label: 'Nội dung không phù hợp', desc: 'Nội dung vi phạm quy tắc' },
    { id: 'cheating', icon: <FiEdit3 />, label: 'Gian lận', desc: 'Không học tập nghiêm túc' },
    { id: 'other', icon: <FiHelpCircle />, label: 'Khác', desc: 'Vấn đề khác' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/reports', {
        category: reportType,
        description,
      });
      if (!data.success) throw new Error(data.message || 'Không thể gửi báo cáo');
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Không thể gửi báo cáo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="static-page">
      <div className="container">
        <div className="static-header animate-fade-in">
          <span className="static-icon"><FiAlertOctagon style={{ color: '#ff6b6b' }} /></span>
          <h1>Báo Cáo Vấn Đề</h1>
          <p className="static-subtitle">
            Giúp chúng tôi giữ môi trường học tập an toàn và lành mạnh
          </p>
        </div>

        <div className="static-content animate-fade-in-up">
          {submitted ? (
            <div className="report-success glass-card">
              <span className="success-icon"><FiCheckCircle style={{ color: '#51cf66' }} /></span>
              <h2>Cảm ơn bạn đã báo cáo!</h2>
              <p>
                Đội ngũ quản trị sẽ xem xét báo cáo của bạn trong thời gian sớm nhất.
                Chúng tôi cam kết tạo môi trường học tập an toàn cho mọi người.
              </p>
              <div className="success-actions">
                <Link to="/lobby" className="btn btn-primary">
                  <FiArrowLeft /> Quay lại Sảnh chờ
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
                      aria-pressed={reportType === type.id}
                    >
                      <span className="report-type-label">{type.icon} {type.label}</span>
                      <span className="report-type-desc">{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="report-desc">Mô tả chi tiết *</label>
                <textarea
                  id="report-desc"
                  className="input-field report-textarea"
                  placeholder="Mô tả thêm về vấn đề bạn gặp phải..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                />
              </div>

              {error && <div className="report-error" role="alert"><FiAlertCircle /> {error}</div>}

              <div className="report-actions">
                <button
                  type="submit"
                  className="btn btn-danger btn-lg"
                  disabled={!reportType || description.trim().length < 10 || submitting}
                >
                  {submitting ? <><span className="app-spinner" aria-hidden="true" /> Đang gửi...</> : <><FiAlertOctagon /> Gửi Báo Cáo</>}
                </button>
                <Link to="/lobby" className="btn btn-secondary btn-lg">
                  Huỷ
                </Link>
              </div>
            </form>
          )}

          <div className="static-notice glass-card report-privacy-note">
            <span><FiAlertCircle style={{ color: '#ff922b' }} /></span>
            <p>
              <strong>Thông tin được bảo mật.</strong> Báo cáo được lưu để quản trị viên xem xét và không hiển thị công khai.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
