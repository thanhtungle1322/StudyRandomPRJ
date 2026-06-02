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
      role: user.role,
      plan: user.plan,
      premiumTier: user.premiumTier || 'none',
      premiumPurchasedAt: user.premiumPurchasedAt,
      premiumExpiresAt: user.premiumExpiresAt,
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
      premiumTier: user.premiumTier || 'none',
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
    const id = user._id ? user._id.toString() : user.id;
    return {
      _id: id,       // FE dùng u._id làm React key và so sánh user hiện tại
      id,
      username: user.username || user.displayName, // support legacy field fallback
      displayName: user.displayName,
      avatar: user.avatar,
      premiumTier: user.premiumTier || 'none',
      totalStudyMinutes: user.totalStudyMinutes,
      reputation: user.reputation,
      streak: user.streak,
      badges: user.badges,
    };
  }
}

module.exports = UserDto;
