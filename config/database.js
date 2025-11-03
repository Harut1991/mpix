const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');

async function initializeDatabase() {
  try {
    // For Node.js, sql.js will automatically find the WASM file in node_modules
    const SQL = await initSqlJs();

    // Load existing database or create new one
    let filebuffer;
    if (fs.existsSync(dbPath)) {
      filebuffer = fs.readFileSync(dbPath);
    }

    db = new SQL.Database(filebuffer);
  } catch (error) {
    console.error('Error initializing SQLite database:', error);
    throw error;
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      userId TEXT,
      pixels TEXT NOT NULL,
      imageData TEXT,
      imagePosition TEXT,
      link TEXT,
      text TEXT,
      email TEXT,
      telegram TEXT,
      price REAL,
      pixelCount INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      role TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_requests_createdAt ON requests(createdAt)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_userId ON tokens(userId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_expiresAt ON tokens(expiresAt)`);

  // Save database to file
  saveDatabase();

  console.log('SQLite database initialized (sql.js)');
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Please wait for dbPromise to resolve.');
  }
  return db;
}

// Initialize database synchronously (will be called when module loads)
let dbPromise = initializeDatabase();

module.exports = {
  getDatabase,
  saveDatabase,
  dbPromise
};
