const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

/**
 * Authenticate JWT token.
 * SECURITY: Only userId is trusted from the JWT payload.
 * Role and other sensitive fields are ALWAYS fetched from the database
 * to prevent token manipulation attacks.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    // SECURITY: Fetch role and critical fields from DB, NOT from JWT
    const user = await User.findById(decoded.userId).select('displayName email role plan premiumTier');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại' });
    }

    req.user = { 
      userId: user._id.toString(), 
      displayName: user.displayName, 
      email: user.email,
      role: user.role || 'customer'  // Always from DB
    };
    next();
  } catch (err) {
    console.error('[AuthMiddleware] JWT Verification Failed! Error:', err.message);
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin.' });
  }
  next();
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
      // SECURITY: Fetch role from DB for optional auth too
      const user = await User.findById(decoded.userId).select('displayName email role');
      if (user) {
        req.user = { 
          userId: user._id.toString(), 
          displayName: user.displayName, 
          email: user.email,
          role: user.role || 'customer'
        };
      }
    } catch (_) {}
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, optionalAuth };
