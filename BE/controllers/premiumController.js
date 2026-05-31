const premiumService = require('../services/premiumService');

class PremiumController {
  /**
   * Get all premium pricing plans
   */
  getPlans(req, res) {
    try {
      const data = premiumService.getPlans();
      res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error('[PremiumCtrl] Get plans error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  /**
   * Retrieve premium quota status
   */
  async getPremiumStatus(req, res) {
    try {
      const userId = req.user.userId;
      const status = await premiumService.getPremiumStatus(userId);
      
      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      console.error('[PremiumCtrl] Get status error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Upgrade account using planId
   */
  async purchasePremium(req, res) {
    try {
      const userId = req.user.userId;
      const { planId } = req.body;
      
      const result = await premiumService.purchasePremium(userId, planId);
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[PremiumCtrl] Purchase error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Check if user is eligible to join matchmaking
   */
  async checkMatchLimit(req, res) {
    try {
      const userId = req.user.userId;
      const result = await premiumService.checkMatchLimit(userId);
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[PremiumCtrl] Check limit error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
}

module.exports = new PremiumController();
