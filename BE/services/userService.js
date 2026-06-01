const User = require('../models/User');
const Review = require('../models/Review');
const UserDto = require('../dtos/userDto');

class UserService {
  /**
   * Get leaderboard sorted by study minutes or reputation
   */
  async getLeaderboard(sortBy = 'totalStudyMinutes', limit = 10) {
    const sortOption = {};
    sortOption[sortBy] = -1; // Descending order

    const topUsers = await User.find()
      .sort(sortOption)
      .limit(parseInt(limit))
      .select('username displayName avatar totalStudyMinutes reputation streak badges');

    return topUsers.map((u) => UserDto.toLeaderboard(u));
  }

  /**
   * Peers review (reputation evaluation)
   */
  async submitReview({ reviewerId, revieweeId, sessionId, rating, comment }) {
    if (!reviewerId || !revieweeId || !sessionId || !rating) {
      throw { status: 400, message: 'Thiếu thông tin đánh giá' };
    }

    // Check if reviewed already
    const existingReview = await Review.findOne({ reviewerId, revieweeId, sessionId });
    if (existingReview) {
      throw { status: 400, message: 'Bạn đã đánh giá người dùng này trong phiên học này rồi' };
    }

    // Create review
    await Review.create({
      reviewerId,
      revieweeId,
      sessionId,
      rating,
      comment,
    });

    // Recalculate reputation
    const reviewee = await User.findById(revieweeId);
    if (!reviewee) {
      throw { status: 404, message: 'Không tìm thấy người dùng được đánh giá' };
    }

    const newRatingCount = reviewee.ratingCount + 1;
    const currentTotal = reviewee.reputation * reviewee.ratingCount;
    const newReputation = (currentTotal + parseInt(rating)) / newRatingCount;

    reviewee.ratingCount = newRatingCount;
    reviewee.reputation = parseFloat(newReputation.toFixed(2));
    await reviewee.save();

    return { message: 'Cảm ơn bạn đã đánh giá!' };
  }

  /**
   * Log study time and recalculate streaks and badges
   */
  async updateStudyTime(userId, minutes) {
    if (!userId || !minutes) {
      throw { status: 400, message: 'Thiếu thông tin' };
    }

    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    // Accumulate study minutes
    user.totalStudyMinutes += parseInt(minutes);

    // Calculate daily streak
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (user.lastStudyDate) {
      const lastStudy = new Date(user.lastStudyDate);
      const lastStudyDay = new Date(lastStudy.getFullYear(), lastStudy.getMonth(), lastStudy.getDate());

      const diffTime = Math.abs(today - lastStudyDay);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        user.streak += 1;
      } else if (diffDays > 1) {
        user.streak = 1; // start new streak
      }
    } else {
      user.streak = 1; // first time
    }

    user.lastStudyDate = now;

    // Award badges (Gamification)
    const newBadges = new Set(user.badges);

    if (!newBadges.has('FIRST_STEP') && user.totalStudyMinutes > 0) {
      newBadges.add('FIRST_STEP');
    }

    if (!newBadges.has('DEDICATED') && user.totalStudyMinutes >= 600) {
      newBadges.add('DEDICATED');
    }

    if (!newBadges.has('WEEK_STREAK') && user.streak >= 7) {
      newBadges.add('WEEK_STREAK');
    }

    user.badges = Array.from(newBadges);
    
    // Save modifications
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          totalStudyMinutes: user.totalStudyMinutes,
          streak: user.streak,
          lastStudyDate: user.lastStudyDate,
          badges: user.badges,
        },
      }
    );

    return {
      totalStudyMinutes: user.totalStudyMinutes,
      streak: user.streak,
      badges: user.badges,
    };
  }

  /**
   * Search for users matching a search query by username or displayName
   */
  async searchUsers(query, currentUserId) {
    if (!query) return [];
    
    const users = await User.find({
      _id: { $ne: currentUserId }, // Exclude current user
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } },
      ],
    })
    .limit(20)
    .select('username displayName avatar email');

    return users;
  }
}

module.exports = new UserService();
