const reportService = require('../services/reportService');

class ReportController {
  async submitReport(req, res) {
    try {
      const report = await reportService.submitReport({
        reporterId: req.user.userId,
        category: req.body.category,
        description: req.body.description,
      });
      res.status(201).json({
        success: true,
        message: 'Báo cáo đã được ghi nhận và chuyển tới quản trị viên.',
        reportId: report._id,
      });
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Không thể gửi báo cáo' });
    }
  }
}

module.exports = new ReportController();