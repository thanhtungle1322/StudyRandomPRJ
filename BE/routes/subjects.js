const express = require('express');
const subjectController = require('../controllers/subjectController');
const router = express.Router();

/**
 * GET /api/subjects
 * Lấy danh sách môn học
 */
router.get('/', subjectController.getSubjects);

module.exports = router;
