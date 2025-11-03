const { getDatabase, saveDatabase } = require('../config/database');

// Create a new token (no expiration - tokens don't expire)
function createToken(token, userId, role) {
  try {
    const db = getDatabase();
    const now = new Date();
    // Set expiration far in the future (100 years) - essentially no expiration
    const expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
    
    db.run(`
      INSERT OR REPLACE INTO tokens (token, userId, role, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [
      token,
      userId,
      role,
      expiresAt.toISOString(),
      now.toISOString()
    ]);
    
    saveDatabase();
    return { token, userId, role, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    console.error('Error creating token:', error);
    throw error;
  }
}

// Find token by token string
function findToken(token) {
  try {
    if (!token) return null;
    
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tokens WHERE token = ?');
    stmt.bind([token]);
    
    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    
    if (!row) {
      console.log('Token not found in database:', token.substring(0, 20) + '...');
      return null;
    }
    
    // Check if token is expired (optional - tokens don't expire by default)
    const expiresAt = new Date(row.expiresAt);
    if (expiresAt < new Date()) {
      console.log('Token expired:', token.substring(0, 20) + '...');
      // Token expired, delete it
      deleteToken(token);
      return null;
    }
    
    return {
      token: row.token,
      userId: row.userId,
      role: row.role,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt
    };
  } catch (error) {
    console.error('Error finding token:', error);
    return null;
  }
}

// Delete token
function deleteToken(token) {
  const db = getDatabase();
  db.run('DELETE FROM tokens WHERE token = ?', [token]);
  saveDatabase();
}

// Delete all tokens for a user
function deleteUserTokens(userId) {
  const db = getDatabase();
  db.run('DELETE FROM tokens WHERE userId = ?', [userId]);
  saveDatabase();
}

// Clean up expired tokens
function cleanupExpiredTokens() {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.run('DELETE FROM tokens WHERE expiresAt < ?', [now]);
  saveDatabase();
}

module.exports = {
  createToken,
  findToken,
  deleteToken,
  deleteUserTokens,
  cleanupExpiredTokens
};

