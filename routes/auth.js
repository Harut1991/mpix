const express = require('express');
const router = express.Router();
const UserModel = require('../models/User');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, email, and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if user already exists
    const existingUserByUsername = await UserModel.findUser({ username: username.toLowerCase().trim() });
    const existingUserByEmail = await UserModel.findUser({ email: email.toLowerCase().trim() });

    if (existingUserByUsername || existingUserByEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username or email already exists' 
      });
    }

    // Only allow creating admin users if explicitly set (for initial setup)
    // In production, you might want to restrict this
    const userRole = role === 'admin' ? 'admin' : 'user';

    // Create new user
    const user = await UserModel.createUser({
      username,
      email,
      password,
      role: userRole
    });

    // Set session (auto-login after registration)
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error registering user' 
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }

    // Find user
    const user = await UserModel.findUserByUsernameOrEmail(username);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    // Check password
    const isMatch = await UserModel.comparePassword(user, password);

    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid username or password' 
      });
    }

    // Set session
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;

    // Generate token (simple token based on user ID and timestamp)
    const crypto = require('crypto');
    const tokenData = `${user._id}:${user.role}:${Date.now()}`;
    const token = crypto.createHash('sha256').update(tokenData + (process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production')).digest('hex');

    // Store token in session for verification
    req.session.token = token;

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error logging in' 
    });
  }
});

// Logout (supports both session and token)
router.post('/logout', (req, res) => {
  // Check for token in Authorization header
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    // Clear token from session if it matches
    if (req.session && req.session.token && token === req.session.token) {
      req.session.token = null;
    }
  }
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error logging out' 
      });
    }
    res.clearCookie('connect.sid');
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  });
});

// Get current user (supports both session and token auth)
router.get('/me', (req, res) => {
  // Check for token in Authorization header
  const authHeader = req.headers.authorization;
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // Check session-based auth
  if (req.session && req.session.userId) {
    // If token is provided, verify it matches session token
    if (token && req.session.token && token === req.session.token) {
      return res.json({
        success: true,
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.role
        }
      });
    } else if (!token) {
      // No token provided, use session
      return res.json({
        success: true,
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.role
        }
      });
    }
  }
  
  res.json({ 
    success: false, 
    user: null 
  });
});

module.exports = router;

