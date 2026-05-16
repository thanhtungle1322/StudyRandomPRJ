const express = require('express');
const config = require('../config');
const matchmaking = require('../services/matchmaking');
const router = express.Router();

/**
 * GET /api/subjects
 * Lấy danh sách môn học
 */
router.get('/', (req, res) => {
  const stats = matchmaking.getQueueStats();
  
  const subjects = config.subjects.map((s) => ({
    ...s,
    queueCount: stats[s.id] || 0,
  }));

  res.json({
    success: true,
    subjects,
  });
});

module.exports = router;
