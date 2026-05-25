const express = require('express');
const User = require('../models/User');
const Review = require('../models/Review');
const Session = require('../models/Session');
const router = express.Router();

/**
 * GET /api/users/leaderboard
 * Lấy bảng xếp hạng theo thời gian học hoặc reputation
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { sortBy = 'totalStudyMinutes', limit = 10 } = req.query;
    
    const sortOption = {};
    sortOption[sortBy] = -1; // Giảm dần
    
    const topUsers = await User.find()
      .sort(sortOption)
      .limit(parseInt(limit))
      .select('username avatar totalStudyMinutes reputation streak badges');
      
    res.json({
      success: true,
      data: topUsers
    });
  } catch (error) {
    console.error('[Users] Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * POST /api/users/review
 * Đánh giá bạn học (Reputation System)
 */
router.post('/review', async (req, res) => {
  try {
    const { reviewerId, revieweeId, sessionId, rating, comment } = req.body;

    if (!reviewerId || !revieweeId || !sessionId || !rating) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đánh giá' });
    }

    // Kiểm tra xem đã đánh giá chưa
    const existingReview = await Review.findOne({ reviewerId, revieweeId, sessionId });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'Bạn đã đánh giá người dùng này trong phiên học này rồi' });
    }

    // Tạo review mới
    await Review.create({
      reviewerId,
      revieweeId,
      sessionId,
      rating,
      comment
    });

    // Tính toán lại điểm reputation cho reviewee
    const reviewee = await User.findById(revieweeId);
    if (!reviewee) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng được đánh giá' });
    }

    const newRatingCount = reviewee.ratingCount + 1;
    // Tính trung bình (trọng số của điểm cũ + điểm mới)
    const currentTotal = reviewee.reputation * reviewee.ratingCount;
    const newReputation = (currentTotal + parseInt(rating)) / newRatingCount;

    reviewee.ratingCount = newRatingCount;
    reviewee.reputation = parseFloat(newReputation.toFixed(2));
    await reviewee.save();

    res.json({ success: true, message: 'Cảm ơn bạn đã đánh giá!' });
  } catch (error) {
    console.error('[Users] Review error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * POST /api/users/study-time
 * Cập nhật thời gian học (Statistics & Gamification)
 */
router.post('/study-time', async (req, res) => {
  try {
    const { userId, minutes } = req.body;

    if (!userId || !minutes) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    // Cập nhật tổng thời gian
    user.totalStudyMinutes += parseInt(minutes);

    // Xử lý streak
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (user.lastStudyDate) {
      const lastStudy = new Date(user.lastStudyDate);
      const lastStudyDay = new Date(lastStudy.getFullYear(), lastStudy.getMonth(), lastStudy.getDate());
      
      const diffTime = Math.abs(today - lastStudyDay);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays === 1) {
        // Học ngày hôm sau
        user.streak += 1;
      } else if (diffDays > 1) {
        // Bỏ lỡ 1 ngày
        user.streak = 1; // Bắt đầu streak mới
      }
      // Nếu diffDays === 0, tức là học nhiều lần trong ngày -> không tăng streak
    } else {
      user.streak = 1; // Lần đầu học
    }
    
    user.lastStudyDate = now;

    // Xử lý Badges (Gamification)
    const newBadges = new Set(user.badges);
    
    // Badge "First Step": Lần đầu học
    if (!newBadges.has('FIRST_STEP') && user.totalStudyMinutes > 0) {
      newBadges.add('FIRST_STEP');
    }
    
    // Badge "Dedicated Student": Học 10 giờ
    if (!newBadges.has('DEDICATED') && user.totalStudyMinutes >= 600) {
      newBadges.add('DEDICATED');
    }
    
    // Badge "Week Streak": Streak 7 ngày
    if (!newBadges.has('WEEK_STREAK') && user.streak >= 7) {
      newBadges.add('WEEK_STREAK');
    }

    user.badges = Array.from(newBadges);
    await user.save();

    res.json({ 
      success: true, 
      data: {
        totalStudyMinutes: user.totalStudyMinutes,
        streak: user.streak,
        badges: user.badges
      }
    });
  } catch (error) {
    console.error('[Users] Study time error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
