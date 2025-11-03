const { getDatabase, saveDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Helper function to convert pixels Map/Object to JSON string
function pixelsToJSON(pixels) {
  if (!pixels) return '{}';
  if (typeof pixels === 'string') return pixels;
  return JSON.stringify(pixels);
}

// Helper function to parse pixels from JSON string
function pixelsFromJSON(jsonString) {
  if (!jsonString) return {};
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return {};
  }
}

// Helper function to convert pixels Map to Object
function pixelsMapToObject(pixelsMap) {
  if (!pixelsMap) return {};
  if (typeof pixelsMap === 'object' && !(pixelsMap instanceof Map)) {
    return pixelsMap;
  }
  if (pixelsMap instanceof Map) {
    const obj = {};
    pixelsMap.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return {};
}

// Create a new request
function createRequest(data) {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const pixelsJSON = pixelsToJSON(data.pixels || {});
  const imagePositionJSON = data.imagePosition ? JSON.stringify(data.imagePosition) : null;

  db.run(`
    INSERT INTO requests (
      id, userId, pixels, imageData, imagePosition, link, text, email, 
      telegram, price, pixelCount, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.userId || null,
    pixelsJSON,
    data.imageData || null,
    imagePositionJSON,
    data.link || null,
    data.text || null,
    data.email || null,
    data.telegram || null,
    data.price || null,
    data.pixelCount || null,
    data.status || 'pending',
    now,
    now
  ]);

  saveDatabase();
  return findRequestById(id);
}

// Find requests with query
function findRequests(query = {}, sort = { createdAt: -1 }) {
  const db = getDatabase();
  let sql = 'SELECT * FROM requests WHERE 1=1';
  const params = [];

  // Build WHERE clause
  if (query.status) {
    sql += ' AND status = ?';
    params.push(query.status);
  }

  if (query.createdAt && query.createdAt.$gte) {
    sql += ' AND createdAt >= ?';
    params.push(query.createdAt.$gte instanceof Date ? query.createdAt.$gte.toISOString() : query.createdAt.$gte);
  }

  // Add ORDER BY
  const sortField = Object.keys(sort)[0] || 'createdAt';
  const sortOrder = sort[sortField] === -1 ? 'DESC' : 'ASC';
  sql += ` ORDER BY ${sortField} ${sortOrder}`;

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    let imagePosition = null;
    if (row.imagePosition) {
      try {
        imagePosition = JSON.parse(row.imagePosition);
      } catch (e) {
        // If parsing fails, keep as null
        imagePosition = null;
      }
    }
    
    results.push({
      ...row,
      _id: row.id,
      pixels: pixelsFromJSON(row.pixels),
      imagePosition: imagePosition,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    });
  }
  stmt.free();

  return results;
}

// Find one request by ID
function findRequestById(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM requests WHERE id = ?');
  stmt.bind([id]);

  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();

  if (!row) return null;

  return {
    ...row,
    _id: row.id,
    pixels: pixelsFromJSON(row.pixels),
    imagePosition: row.imagePosition ? JSON.parse(row.imagePosition) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
}

// Update request
function updateRequest(id, updateData) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const fields = [];
  const values = [];

  if (updateData.status !== undefined) {
    fields.push('status = ?');
    values.push(updateData.status);
  }
  if (updateData.pixels !== undefined) {
    fields.push('pixels = ?');
    values.push(pixelsToJSON(updateData.pixels));
  }
  if (updateData.imageData !== undefined) {
    fields.push('imageData = ?');
    values.push(updateData.imageData);
  }
  if (updateData.imagePosition !== undefined) {
    fields.push('imagePosition = ?');
    values.push(updateData.imagePosition ? JSON.stringify(updateData.imagePosition) : null);
  }
  if (updateData.link !== undefined) {
    fields.push('link = ?');
    values.push(updateData.link);
  }
  if (updateData.text !== undefined) {
    fields.push('text = ?');
    values.push(updateData.text);
  }
  if (updateData.email !== undefined) {
    fields.push('email = ?');
    values.push(updateData.email);
  }
  if (updateData.telegram !== undefined) {
    fields.push('telegram = ?');
    values.push(updateData.telegram);
  }
  if (updateData.price !== undefined) {
    fields.push('price = ?');
    values.push(updateData.price);
  }
  if (updateData.pixelCount !== undefined) {
    fields.push('pixelCount = ?');
    values.push(updateData.pixelCount);
  }

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  const sql = `UPDATE requests SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, values);

  saveDatabase();
  return findRequestById(id);
}

// Delete request
function deleteRequest(id) {
  const db = getDatabase();
  db.run('DELETE FROM requests WHERE id = ?', [id]);
  saveDatabase();
  return 1;
}

module.exports = {
  createRequest,
  findRequests,
  findRequestById,
  updateRequest,
  deleteRequest,
  pixelsMapToObject
};
