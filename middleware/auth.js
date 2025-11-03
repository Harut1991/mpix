// Authentication middleware
const TokenModel = require('../models/Token');

// Check if user is authenticated (supports both session and token)
const isAuthenticated = (req, res, next) => {
  // Check for token in Authorization header (case-insensitive)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;
  
  if (authHeader && (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer '))) {
    token = authHeader.substring(7);
    
    try {
      // Verify token from database (independent of session)
      const tokenData = TokenModel.findToken(token);
      if (tokenData) {
        // Token is valid, restore session if needed
        if (!req.session || !req.session.userId) {
          // Get user info from database to restore session
          const UserModel = require('../models/User');
          const user = UserModel.findUser({ id: tokenData.userId });
          if (user) {
            req.session.userId = user._id;
            req.session.username = user.username;
            req.session.role = user.role;
            req.session.token = token;
          }
        }
        return next();
      }
    } catch (error) {
      console.error('Error verifying token from database:', error);
      // Continue to fallback checks
    }
    
    // Also check session token as fallback (for backward compatibility)
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
  // Check for token in Authorization header (case-insensitive)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;
  
  if (authHeader && (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer '))) {
    token = authHeader.substring(7);
    
    try {
      // Verify token from database (independent of session)
      const tokenData = TokenModel.findToken(token);
      if (tokenData) {
        if (tokenData.role === 'admin') {
          // Token is valid and user is admin, restore session if needed
          if (!req.session || !req.session.userId) {
            // Get user info from database to restore session
            const UserModel = require('../models/User');
            const user = UserModel.findUser({ id: tokenData.userId });
            if (user) {
              req.session.userId = user._id;
              req.session.username = user.username;
              req.session.role = user.role;
              req.session.token = token;
            }
          }
          return next();
        } else {
          // Token exists but user is not admin
          console.log('Token found but user is not admin:', tokenData.role);
        }
      } else {
        // Token not in database - might be an old token or database issue
        // Try to verify via session token match
        console.log('Token not found in database, checking session...');
      }
    } catch (error) {
      console.error('Error verifying token from database:', error);
      console.error('Token being verified:', token ? token.substring(0, 20) + '...' : 'null');
      // Continue to fallback checks
    }
    
    // Also check session token as fallback (for backward compatibility)
    if (req.session && req.session.token && token === req.session.token && req.session.role === 'admin') {
      return next();
    }
  } else {
    // Log if no auth header found
    if (!authHeader) {
      console.log('No Authorization header found in request');
    }
  }
  
  // Fall back to session-based auth
  if (req.session && req.session.userId && req.session.role === 'admin') {
    return next();
  }
  
  console.log('Admin access denied. Session:', req.session ? { userId: req.session.userId, role: req.session.role } : 'none');
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

