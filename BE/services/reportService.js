const Report = require('../models/Report');

const REPORT_CATEGORIES = new Set(['spam', 'harassment', 'inappropriate', 'cheating', 'other']);

class ReportService {
  constructor(options = {}) {
    this.Report = options.ReportModel || Report;
  }

  async submitReport({ reporterId, category, description = '' }) {
    if (!reporterId) throw { status: 401, message: 'Vui lòng đăng nhập' };
    if (!REPORT_CATEGORIES.has(category)) {
      throw { status: 400, message: 'Loại báo cáo không hợp lệ' };
    }
    if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 1000) {
      throw { status: 400, message: 'Mô tả báo cáo phải từ 10 đến 1000 ký tự' };
    }

    return this.Report.create({
      reporterId,
      category,
      description: description.trim(),
      status: 'pending',
    });
  }
}

const reportService = new ReportService();
reportService.ReportService = ReportService;
module.exports = reportService;