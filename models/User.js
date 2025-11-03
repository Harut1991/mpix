const { getDatabase, saveDatabase } = require('../config/database');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Create a new user
async function createUser(userData) {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(userData.password, salt);

  db.run(`
    INSERT INTO users (id, username, email, password, role, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    userData.username.toLowerCase().trim(),
    userData.email.toLowerCase().trim(),
    hashedPassword,
    userData.role || 'user',
    now,
    now
  ]);

  saveDatabase();

  // Return user without password
  const user = findUser({ id });
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// Find user by query
function findUser(query) {
  const db = getDatabase();
  const conditions = [];
  const params = [];

  if (query.id) {
    conditions.push('id = ?');
    params.push(query.id);
  }
  if (query.username) {
    conditions.push('username = ?');
    params.push(query.username.toLowerCase().trim());
  }
  if (query.email) {
    conditions.push('email = ?');
    params.push(query.email.toLowerCase().trim());
  }
  if (query.role) {
    conditions.push('role = ?');
    params.push(query.role);
  }

  if (conditions.length === 0) return null;

  // Handle OR logic for username/email OR AND logic for others
  let sql;
  if (query.username && query.email && !query.id && !query.role) {
    // Special case: username OR email
    sql = `SELECT * FROM users WHERE username = ? OR email = ?`;
    params.length = 0;
    params.push(query.username.toLowerCase().trim(), query.email.toLowerCase().trim());
  } else {
    sql = `SELECT * FROM users WHERE ${conditions.join(' AND ')}`;
  }

  const stmt = db.prepare(sql);
  stmt.bind(params);

  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();

  if (!row) return null;

  return {
    ...row,
    _id: row.id,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

// Find user by username or email
function findUserByUsernameOrEmail(usernameOrEmail) {
  const normalized = usernameOrEmail.toLowerCase().trim();
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
  stmt.bind([normalized, normalized]);

  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();

  if (!row) return null;

  return {
    ...row,
    _id: row.id,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

// Compare password
async function comparePassword(user, candidatePassword) {
  return await bcrypt.compare(candidatePassword, user.password);
}

// Update user
async function updateUser(id, updateData) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const fields = [];
  const values = [];

  if (updateData.password) {
    const salt = await bcrypt.genSalt(10);
    updateData.password = await bcrypt.hash(updateData.password, salt);
    fields.push('password = ?');
    values.push(updateData.password);
  }
  if (updateData.username !== undefined) {
    fields.push('username = ?');
    values.push(updateData.username.toLowerCase().trim());
  }
  if (updateData.email !== undefined) {
    fields.push('email = ?');
    values.push(updateData.email.toLowerCase().trim());
  }
  if (updateData.role !== undefined) {
    fields.push('role = ?');
    values.push(updateData.role);
  }

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  if (fields.length === 1) {
    // Only updatedAt changed, return user as-is
    return findUser({ id });
  }

  const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, values);

  saveDatabase();

  const user = findUser({ id });
  if (user) {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
}

module.exports = {
  createUser,
  findUser,
  findUserByUsernameOrEmail,
  comparePassword,
  updateUser
};
