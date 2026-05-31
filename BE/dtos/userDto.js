class UserDto {
  /**
   * Format private/own user data (e.g. for /me, register, login)
   */
  static toSelf(user) {
    if (!user) return null;
    return {
      id: user._id ? user._id.toString() : user.id,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
      plan: user.plan,
      premiumPurchasedAt: user.premiumPurchasedAt,
      dailyMatchCount: user.dailyMatchCount,
      lastMatchDate: user.lastMatchDate,
      authProvider: user.authProvider,
      totalSessions: user.totalSessions,
      createdAt: user.createdAt,
      reputation: user.reputation,
      ratingCount: user.ratingCount,
      totalStudyMinutes: user.totalStudyMinutes,
      streak: user.streak,
      badges: user.badges,
    };
  }

  /**
   * Format public profile user data (viewed by others)
   */
  static toPublic(user) {
    if (!user) return null;
    return {
      id: user._id ? user._id.toString() : user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      isOnline: user.isOnline,
      createdAt: user.createdAt,
      reputation: user.reputation,
      ratingCount: user.ratingCount,
      totalStudyMinutes: user.totalStudyMinutes,
      streak: user.streak,
      badges: user.badges,
    };
  }

  /**
   * Format user data for leaderboard listing
   */
  static toLeaderboard(user) {
    if (!user) return null;
    return {
      id: user._id ? user._id.toString() : user.id,
      username: user.username || user.displayName, // support legacy field fallback
      displayName: user.displayName,
      avatar: user.avatar,
      totalStudyMinutes: user.totalStudyMinutes,
      reputation: user.reputation,
      streak: user.streak,
      badges: user.badges,
    };
  }
}

module.exports = UserDto;
