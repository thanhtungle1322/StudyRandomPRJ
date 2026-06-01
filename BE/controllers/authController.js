const authService = require('../services/authService');
const passport = require('passport');
const config = require('../config');
const jwt = require('jsonwebtoken');

class AuthController {
  /**
   * Register a new user account
   */
  async register(req, res) {
    try {
      const { email, password, displayName } = req.body;
      const result = await authService.register({ email, password, displayName });
      res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[AuthCtrl] Register error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Login with email and password
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({ email, password });
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[AuthCtrl] Login error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Fetch details of currently logged-in user
   */
  async getMe(req, res) {
    try {
      const userId = req.user.userId;
      const user = await authService.getMe(userId);
      res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error('[AuthCtrl] Get me error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Logout user
   */
  async logout(req, res) {
    try {
      const userId = req.user.userId;
      const result = await authService.logout(userId);
      res.json(result);
    } catch (error) {
      console.error('[AuthCtrl] Logout error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Get public profile of another user
   */
  async getPublicProfile(req, res) {
    try {
      const userId = req.params.id;
      const user = await authService.getPublicProfile(userId);
      res.json({
        success: true,
        user,
      });
    } catch (error) {
      console.error('[AuthCtrl] Get public profile error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Handle Google OAuth callback and redirect to frontend with token
   */
  googleCallback(req, res, next) {
    passport.authenticate('google', (err, user, info) => {
      const clientUrl = config.clientUrl.split(',')[0].trim();

      if (err) {
        console.error('[AuthCtrl] Google callback - Passport error:', err.message);
        return res.redirect(`${clientUrl}/login?error=google_auth_failed&reason=passport_error`);
      }

      if (!user) {
        console.error('[AuthCtrl] Google callback - No user returned. Info:', info);
        return res.redirect(`${clientUrl}/login?error=google_auth_failed&reason=no_user`);
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[AuthCtrl] Google callback - req.logIn error:', loginErr.message);
          return res.redirect(`${clientUrl}/login?error=google_auth_failed&reason=login_error`);
        }

        console.log('[AuthCtrl] Google callback - Success! User:', user._id, user.displayName);

        const tokenPayload = {
          userId: user._id.toString(),
          displayName: user.displayName,
          email: user.email,
        };

        const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '7d' });
        res.redirect(`${clientUrl}/auth/callback?token=${token}`);
      });
    })(req, res, next);
  }
}

module.exports = new AuthController();
