const User = require('../models/User');
const Review = require('../models/Review');
const Session = require('../models/Session');
const UserDto = require('../dtos/userDto');

class UserService {
  constructor(options = {}) {
    this.User = options.UserModel || User;
    this.Session = options.SessionModel || Session;
    this.now = options.now || (() => new Date());
  }

  /**
   * Get leaderboard sorted by study minutes or reputation
   */
  async getLeaderboard(sortBy = 'totalStudyMinutes', limit = 50) {
    // Validate sortBy để tránh injection
    const allowedSortFields = ['totalStudyMinutes', 'reputation', 'streak'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'totalStudyMinutes';

    const safeLimit = Math.min(parseInt(limit) || 50, 100); // giới hạn tối đa 100

    const topUsers = await User.find()
      .sort({ [safeSortBy]: -1, _id: 1 }) // secondary sort bằng _id để kết quả ổn định
      .limit(safeLimit)
      .select('username displayName avatar totalStudyMinutes reputation streak badges');

    return topUsers.map((u) => UserDto.toLeaderboard(u));
  }

  /**
   * Peers review (reputation evaluation)
   */
  async submitReview({ reviewerId, roomId, revieweeId, rating, comment }) {
    if (!roomId || !revieweeId || rating === undefined) {
      throw { status: 400, message: 'Thiếu thông tin đánh giá' };
    }

    const ratingVal = parseInt(rating);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      throw { status: 400, message: 'Điểm đánh giá phải là số nguyên từ 1 đến 5' };
    }

    if (String(reviewerId) === String(revieweeId)) {
      throw { status: 400, message: 'Không thể tự đánh giá bản thân' };
    }

    const session = await Session.findOne({ roomId });
    if (!session) {
      throw { status: 404, message: 'Không tìm thấy phiên học' };
    }
    const sessionId = session._id;

    const isReviewerInSession = session.users.some(u => String(u.userId) === String(reviewerId));
    const isRevieweeInSession = session.users.some(u => String(u.userId) === String(revieweeId));
    if (!isReviewerInSession || !isRevieweeInSession) {
      throw { status: 403, message: 'Bạn hoặc người được đánh giá không tham gia phiên học này' };
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
      rating: ratingVal,
      comment: comment || '',
    });

    // Recalculate reputation
    const reviewee = await User.findById(revieweeId);
    if (!reviewee) {
      throw { status: 404, message: 'Không tìm thấy người dùng được đánh giá' };
    }

    const newRatingCount = reviewee.ratingCount + 1;
    const currentTotal = reviewee.reputation * reviewee.ratingCount;
    const newReputation = (currentTotal + ratingVal) / newRatingCount;

    reviewee.ratingCount = newRatingCount;
    reviewee.reputation = parseFloat(newReputation.toFixed(2));
    await reviewee.save();

    return { message: 'Cảm ơn bạn đã đánh giá!' };
  }

  /**
   * Log study time and recalculate streaks and badges
   */
  async updateStudyTime(userId, roomId) {
    if (!userId || typeof roomId !== 'string' || !roomId) {
      throw { status: 400, message: 'Thiếu thông tin phiên học' };
    }

    const session = await this.Session.findOne({ roomId, 'users.userId': userId });
    if (!session) {
      throw { status: 404, message: 'Không tìm thấy phiên học của bạn' };
    }
    const participant = session.users.find((entry) => String(entry.userId) === String(userId));
    if (!participant) {
      throw { status: 403, message: 'Bạn không tham gia phiên học này' };
    }
    if (participant.studyCreditedAt) {
      return {
        creditedMinutes: participant.studyCreditedMinutes || 0,
        alreadyCredited: true,
      };
    }

    const now = this.now();
    const startedAt = new Date(participant.joinedAt);
    const endedAt = participant.leftAt || session.endedAt || now;
    const minutesVal = Math.min(240, Math.max(0, Math.floor((new Date(endedAt) - startedAt) / 60000)));
    if (!Number.isFinite(minutesVal) || minutesVal <= 0) {
      throw { status: 400, message: 'Phiên học chưa đủ một phút để ghi nhận' };
    }

    const creditClaim = await this.Session.updateOne(
      {
        _id: session._id,
        users: { $elemMatch: { userId, studyCreditedAt: null } },
      },
      {
        $set: {
          'users.$.studyCreditedAt': now,
          'users.$.studyCreditedMinutes': minutesVal,
        },
      }
    );
    if (creditClaim.matchedCount === 0) {
      return { creditedMinutes: 0, alreadyCredited: true };
    }

    let user;
    try {
      user = await this.User.findOneAndUpdate(
        { _id: userId },
        [
          {
            $set: {
              totalStudyMinutes: { $add: [{ $ifNull: ['$totalStudyMinutes', 0] }, minutesVal] },
              streak: {
                $cond: [
                  { $eq: [{ $ifNull: ['$lastStudyDate', null] }, null] },
                  1,
                  {
                    $let: {
                      vars: {
                        dayDifference: {
                          $dateDiff: {
                            startDate: { $dateTrunc: { date: '$lastStudyDate', unit: 'day', timezone: 'UTC' } },
                            endDate: { $dateTrunc: { date: now, unit: 'day', timezone: 'UTC' } },
                            unit: 'day',
                          },
                        },
                      },
                      in: {
                        $switch: {
                          branches: [
                            {
                              case: { $eq: ['$$dayDifference', 1] },
                              then: { $add: [{ $ifNull: ['$streak', 0] }, 1] },
                            },
                            { case: { $gt: ['$$dayDifference', 1] }, then: 1 },
                          ],
                          default: { $ifNull: ['$streak', 1] },
                        },
                      },
                    },
                  },
                ],
              },
              lastStudyDate: now,
            },
          },
          {
            $set: {
              badges: {
                $setUnion: [
                  { $ifNull: ['$badges', []] },
                  { $cond: [{ $gt: ['$totalStudyMinutes', 0] }, ['FIRST_STEP'], []] },
                  { $cond: [{ $gte: ['$totalStudyMinutes', 600] }, ['DEDICATED'], []] },
                  { $cond: [{ $gte: ['$streak', 7] }, ['WEEK_STREAK'], []] },
                ],
              },
            },
          },
        ],
        { new: true }
      );
      if (!user) throw { status: 404, message: 'Không tìm thấy user' };
    } catch (error) {
      await this.Session.updateOne(
        { _id: session._id, users: { $elemMatch: { userId, studyCreditedAt: now } } },
        { $unset: { 'users.$.studyCreditedAt': 1, 'users.$.studyCreditedMinutes': 1 } }
      ).catch(() => {});
      throw error;
    }

    return {
      creditedMinutes: minutesVal,
      alreadyCredited: false,
      totalStudyMinutes: user.totalStudyMinutes,
      streak: user.streak,
      badges: user.badges,
    };
  }

  /**
   * Get personal study statistics
   */
  async getStats(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    const totalSessions = await Session.countDocuments({
      status: 'ended',
      'users.userId': userId,
    });

    const dailyMinutes = {};
    const daysOrder = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dateStr = `${dd}/${mm}`;
      dailyMinutes[dateStr] = 0;
      daysOrder.push(dateStr);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSessions = await Session.find({
      status: 'ended',
      'users.userId': userId,
      endedAt: { $gte: sevenDaysAgo },
    });

    recentSessions.forEach(session => {
      const userSession = session.users.find(u => String(u.userId) === String(userId));
      if (userSession && userSession.joinedAt) {
        const joined = new Date(userSession.joinedAt);
        if (!isNaN(joined.getTime())) {
          const left = userSession.leftAt ? new Date(userSession.leftAt) : (session.endedAt ? new Date(session.endedAt) : new Date());
          const diffMinutes = Math.max(0, Math.floor((left - joined) / 60000));
          const dd = String(joined.getDate()).padStart(2, '0');
          const mm = String(joined.getMonth() + 1).padStart(2, '0');
          const dateStr = `${dd}/${mm}`;
          if (dailyMinutes[dateStr] !== undefined) {
            dailyMinutes[dateStr] += diffMinutes;
          }
        }
      }
    });

    const dailyStudyChart = daysOrder.map(date => ({
      date,
      minutes: dailyMinutes[date],
    }));

    const allSessions = await Session.find({
      status: 'ended',
      'users.userId': userId,
    });

    const subjectStats = {};
    allSessions.forEach(session => {
      const userSession = session.users.find(u => String(u.userId) === String(userId));
      if (userSession && userSession.joinedAt) {
        const joined = new Date(userSession.joinedAt);
        if (!isNaN(joined.getTime())) {
          const left = userSession.leftAt ? new Date(userSession.leftAt) : (session.endedAt ? new Date(session.endedAt) : new Date());
          const diffMinutes = Math.max(0, Math.floor((left - joined) / 60000));
          const sub = session.subject;
          subjectStats[sub] = (subjectStats[sub] || 0) + diffMinutes;
        }
      }
    });

    const sortedSubjects = Object.keys(subjectStats)
      .map(key => ({ subject: key, minutes: subjectStats[key] }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      totalStudyMinutes: user.totalStudyMinutes,
      streak: user.streak,
      reputation: user.reputation,
      badges: user.badges,
      totalSessions,
      dailyStudyChart,
      favoriteSubjects: sortedSubjects.slice(0, 5),
    };
  }
  /**
   * Search users by displayName or email
   */
  async searchUsers(query, currentUserId) {
    if (!query || query.trim().length < 2) {
      throw { status: 400, message: 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự' };
    }

    const regex = new RegExp(query.trim(), 'i');
    const users = await User.find({
      $or: [
        { displayName: regex },
        { email: regex },
      ],
      _id: { $ne: currentUserId }, // loại bỏ bản thân
    })
      .limit(20)
      .select('displayName email avatar isOnline');

    return users;
  }
}

const userService = new UserService();
userService.UserService = UserService;
module.exports = userService;
