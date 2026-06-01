const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { 
      userId: decoded.userId, 
      displayName: decoded.displayName, 
      email: decoded.email,
      role: decoded.role || 'customer'
    };
    next();
  } catch (err) {
    console.error('[AuthMiddleware] JWT Verification Failed! Error:', err.message, 'Secret used:', config.jwtSecret ? 'YES (length: ' + config.jwtSecret.length + ')' : 'NO');
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin.' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
      req.user = { 
        userId: decoded.userId, 
        displayName: decoded.displayName, 
        email: decoded.email,
        role: decoded.role || 'customer'
      };
    } catch (_) {}
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, optionalAuth };
