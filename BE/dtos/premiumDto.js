const TIER_LEVELS = {
  none: 0,
  free: 0,
  starter: 1,
  pro: 2,
  ultimate: 3
};

class PremiumDto {
  /**
   * Kiểm tra và so sánh cấp độ gói premium hiện tại với gói muốn đổi/mua
   * Trả về true nếu hợp lệ (gói muốn đổi cao hơn gói hiện tại)
   * Ném ra lỗi nếu gói muốn đổi thấp hơn hoặc bằng gói hiện tại
   */
  static validateUpgrade(currentTier, targetTier) {
    const currentLevel = TIER_LEVELS[currentTier || 'none'] || 0;
    const targetLevel = TIER_LEVELS[targetTier] || 0;

    if (targetLevel === 0) {
      throw { status: 400, message: 'Gói nâng cấp mục tiêu không hợp lệ' };
    }

    if (currentLevel >= targetLevel) {
      const tierNames = {
        starter: 'Premium Starter',
        pro: 'Premium Pro',
        ultimate: 'Premium Ultimate'
      };
      const currentName = tierNames[currentTier] || 'hiện tại';
      const targetName = tierNames[targetTier] || 'mới';
      throw { 
        status: 400, 
        message: `Bạn đang sở hữu gói ${currentName}, không thể hạ cấp hoặc đổi sang gói ${targetName} thấp hơn/bằng.` 
      };
    }

    return true;
  }
}

module.exports = {
  PremiumDto,
  TIER_LEVELS
};
