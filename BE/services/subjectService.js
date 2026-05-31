const config = require('../config');
const matchmaking = require('./matchmaking');

class SubjectService {
  /**
   * Get all subjects populated with active queue stats
   */
  getSubjectsWithStats() {
    const stats = matchmaking.getQueueStats();
    
    return config.subjects.map((s) => ({
      ...s,
      queueCount: stats[s.id] || 0,
    }));
  }
}

module.exports = new SubjectService();
