// Authentication middleware

// Check if user is authenticated (supports both session and token)
const isAuthenticated = (req, res, next) => {
  // Check for token in Authorization header
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    
    // Verify token matches session token
    if (req.session && req.session.token && token === req.session.token) {
      return next();
    }
  }
  
  // Fall back to session-based auth
  if (req.session && req.session.userId) {
    return next();
  }
  
  return res.status(401).json({ success: false, error: 'Authentication required' });
};

// Check if user is admin (supports both session and token)
const isAdmin = (req, res, next) => {
  // Check for token in Authorization header
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    
    // Verify token matches session token and user is admin
    if (req.session && req.session.token && token === req.session.token && req.session.role === 'admin') {
      return next();
    }
  }
  
  // Fall back to session-based auth
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

