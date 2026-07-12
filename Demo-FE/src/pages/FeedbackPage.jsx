import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import api from '../services/api';
import { FiStar, FiArrowLeft, FiSend, FiCheckCircle } from 'react-icons/fi';
import backgroundLogin from '../../background/backgroundLogin.webp';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import './FeedbackPage.css';

export default function FeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }

    if (rating === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn số sao đánh giá (1-5 sao)' });
      return;
    }

    if (!comment.trim() || comment.trim().length < 5) {
      setMessage({ type: 'error', text: 'Nhận xét phải có ít nhất 5 ký tự' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await api.post('/feedback', { rating, comment });
      if (data.success) {
        setMessage({
          type: 'success',
          text: data.message || 'Cảm ơn bạn đã gửi đánh giá thành công! 🎉'
        });
        setRating(0);
        setComment('');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feedback-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>
      <img src={mascot1} alt="" aria-hidden="true" className="page-mascot page-mascot-left" />
      <img src={mascot2} alt="" aria-hidden="true" className="page-mascot page-mascot-right" />

      <div className="container feedback-container">
        <button className="feedback-back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Quay lại
        </button>

        <div className="feedback-header animate-fade-in">
          <div className="feedback-badge">
            <span className="feedback-badge-dot"></span>
            <span>Góp ý phát triển cộng đồng học tập</span>
          </div>
          <h1 className="feedback-title">
            Đánh Giá <span className="feedback-title-highlight">Trang Web</span>
          </h1>
          <p className="feedback-subtitle">
            Ý kiến của bạn là động lực giúp StudyRandom hoàn thiện và đem lại trải nghiệm ghép học tốt nhất!
          </p>
        </div>

        <div className="feedback-card-wrapper glass-card animate-fade-in-up">
          {message.type === 'success' ? (
            <div className="feedback-success-state">
              <div className="success-icon-glow">
                <FiCheckCircle className="check-icon" />
              </div>
              <h2>Cảm ơn bạn rất nhiều!</h2>
              <p className="success-desc">{message.text}</p>
              <div className="success-actions">
                <button className="btn btn-primary" onClick={() => navigate('/lobby')}>
                  Quay lại Sảnh chờ
                </button>
                <button className="btn btn-secondary" onClick={() => setMessage({ type: '', text: '' })}>
                  Gửi thêm đánh giá khác
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="feedback-form">
              {message.text && (
                <div className={`feedback-alert ${message.type}`}>
                  {message.text}
                </div>
              )}

              {/* Star Rating Section */}
              <div className="feedback-section rating-section">
                <h3>Bạn đánh giá trải nghiệm chung thế nào?</h3>
                <div className="stars-wrapper">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const active = starValue <= (hoverRating || rating);
                    return (
                      <button
                        key={starValue}
                        type="button"
                        className={`star-btn ${active ? 'active' : ''}`}
                        onClick={() => setRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`${starValue} sao`}
                        aria-pressed={rating === starValue}
                      >
                        <FiStar className="star-icon" />
                      </button>
                    );
                  })}
                </div>
                {rating > 0 && (
                  <p className="rating-desc">
                    {rating === 1 && '😞 Rất tệ - Cần cải thiện nhiều'}
                    {rating === 2 && '😐 Tạm ổn - Còn nhiều thiếu sót'}
                    {rating === 3 && '🙂 Khá tốt - Phục vụ được nhu cầu'}
                    {rating === 4 && '😀 Tuyệt vời - Rất hài lòng'}
                    {rating === 5 && '😍 Hoàn hảo - Không có gì để chê!'}
                  </p>
                )}
              </div>

              {/* Comment Text Area */}
              <div className="feedback-section comment-section">
                <h3>Ý kiến đóng góp chi tiết</h3>
                <p className="comment-tip">Đừng ngần ngại báo lỗi, đề xuất tính năng mới hoặc chia sẻ cảm xúc của bạn!</p>
                <div className="textarea-wrapper">
                  <textarea
                    className="feedback-textarea"
                    aria-label="Ý kiến đóng góp chi tiết"
                    placeholder="Mô tả cảm nghĩ của bạn tại đây (ít nhất 5 ký tự)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={6}
                    maxLength={1000}
                    disabled={submitting}
                  />
                  <span className="char-counter">{comment.trim().length}/1000</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="feedback-submit-btn btn btn-primary btn-lg"
                disabled={submitting}
              >
                {submitting ? (
                  <><span className="app-spinner" aria-hidden="true"></span> Đang gửi đánh giá...</>
                ) : (
                  <><FiSend /> Gửi Đánh Giá</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
