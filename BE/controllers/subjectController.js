const subjectService = require('../services/subjectService');

class SubjectController {
  /**
   * Get all active study subjects populated with queue sizes
   */
  getSubjects(req, res) {
    try {
      const subjects = subjectService.getSubjectsWithStats();
      
      res.json({
        success: true,
        subjects,
      });
    } catch (error) {
      console.error('[SubjectCtrl] Get subjects error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
}

module.exports = new SubjectController();
