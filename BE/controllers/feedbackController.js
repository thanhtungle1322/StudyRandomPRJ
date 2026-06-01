const Feedback = require('../models/Feedback');

class FeedbackController {
  /**
   * Submit website feedback
   */
  async submitFeedback(req, res) {
    try {
      const userId = req.user.userId;
      const { rating, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Đánh giá phải từ 1 đến 5 sao' });
      }

      if (!comment || comment.trim().length < 5) {
        return res.status(400).json({ success: false, message: 'Nhận xét phải có ít nhất 5 ký tự' });
      }

      const feedback = await Feedback.create({
        userId,
        rating,
        comment: comment.trim(),
      });

      res.status(201).json({
        success: true,
        message: 'Cảm ơn bạn đã gửi phản hồi và đóng góp ý kiến để cải thiện trang web! ❤️',
        feedback,
      });
    } catch (error) {
      console.error('[FeedbackCtrl] Submit feedback error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server khi gửi phản hồi' });
    }
  }
}

module.exports = new FeedbackController();
