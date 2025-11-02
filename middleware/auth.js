// Authentication middleware

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required' });
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Admin access required' });
};

// Optional: Check if user is authenticated (for optional user tracking)
const optionalAuth = (req, res, next) => {
  // If user is logged in, attach user info, otherwise continue
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role
    };
  }
  next();
};

module.exports = {
  isAuthenticated,
  isAdmin,
  optionalAuth
};

