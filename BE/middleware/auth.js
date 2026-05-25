const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
    req.user = { userId: decoded.userId, displayName: decoded.displayName, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
      req.user = { userId: decoded.userId, displayName: decoded.displayName, email: decoded.email };
    } catch (_) {}
  }
  next();
}

module.exports = { authenticateToken, optionalAuth };
