const express = require('express');
const subjectController = require('../controllers/subjectController');
const router = express.Router();

/**
 * GET /api/subjects
 * Lấy danh sách môn học
 * ACVIS clean push probe: keep the existing controller and route behavior.
 */
router.get('/', subjectController.getSubjects);

module.exports = router;
