const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const isPostgres = !!process.env.DATABASE_URL;

let pool = null;
let sqliteDb = null;

if (isPostgres) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('[Website Database]: Using cloud PostgreSQL (Supabase).');
} else {
  const dbDir = path.join(__dirname, '..', 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'keys.db');
  sqliteDb = new sqlite3.Database(dbPath);
  console.log('[Website Database]: Using local SQLite3 (db/keys.db).');
}

// Chuyển đổi tham số ? thành $1, $2... cho Postgres
function convertParamsSql(sql) {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

function dbRun(sql, params = []) {
  if (isPostgres) {
    return new Promise((resolve, reject) => {
      const pgSql = convertParamsSql(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) reject(err);
        else resolve({ changes: res ? res.rowCount : 0, lastID: null });
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this); // 'this' contains changes and lastID
      });
    });
  }
}

function dbGet(sql, params = []) {
  if (isPostgres) {
    return new Promise((resolve, reject) => {
      const pgSql = convertParamsSql(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) reject(err);
        else resolve(res && res.rows ? res.rows[0] : null);
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

function dbAll(sql, params = []) {
  if (isPostgres) {
    return new Promise((resolve, reject) => {
      const pgSql = convertParamsSql(sql);
      pool.query(pgSql, params, (err, res) => {
        if (err) reject(err);
        else resolve(res && res.rows ? res.rows : []);
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

async function initDatabase() {
  try {
    if (isPostgres) {
      // 1. Products table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          price_30_days INTEGER NOT NULL,
          price_180_days INTEGER NOT NULL,
          price_365_days INTEGER NOT NULL,
          image_url TEXT,
          download_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      try {
        await dbRun("ALTER TABLE products ADD COLUMN IF NOT EXISTS download_url TEXT");
      } catch (e) {
        console.error("[Website Database] Postgres migration download_url failed:", e);
      }

      // 2. Users table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255),
          picture TEXT,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Keys table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS keys (
          id SERIAL PRIMARY KEY,
          key_value VARCHAR(255) UNIQUE NOT NULL,
          user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE,
          product_id INTEGER REFERENCES products(id) ON DELETE SET NULL
        )
      `);

      // 4. Transactions table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL,
          memo_code VARCHAR(255) UNIQUE NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
          package_type VARCHAR(50)
        )
      `);
    } else {
      // SQLite
      await dbRun(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          price_30_days INTEGER NOT NULL,
          price_180_days INTEGER NOT NULL,
          price_365_days INTEGER NOT NULL,
          image_url TEXT,
          download_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          picture TEXT,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key_value TEXT UNIQUE NOT NULL,
          user_id TEXT,
          type TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          memo_code TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // SQLite Migrations
      try {
        await dbRun("ALTER TABLE keys ADD COLUMN product_id INTEGER REFERENCES products(id)");
      } catch (e) {}
      try {
        await dbRun("ALTER TABLE transactions ADD COLUMN product_id INTEGER REFERENCES products(id)");
      } catch (e) {}
      try {
        await dbRun("ALTER TABLE transactions ADD COLUMN package_type TEXT");
      } catch (e) {}
      try {
        await dbRun("ALTER TABLE products ADD COLUMN download_url TEXT");
      } catch (e) {}
    }

    // Seed default product if empty
    const productCount = await dbGet("SELECT COUNT(*) as count FROM products");
    if (parseInt(productCount.count || productCount.COUNT || 0) === 0) {
      await dbRun(`
        INSERT INTO products (id, name, description, price_30_days, price_180_days, price_365_days, image_url)
        VALUES (1, 'AIO Media Scraper', 'Công cụ cào và trích xuất dữ liệu đa nguồn từ mạng xã hội, báo chí tự động, ổn định, chuyên nghiệp.', 50000, 250000, 450000, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60')
      `);
      console.log('[Website Database Seed]: Seeded default product AIO Media Scraper.');
      
      if (isPostgres) {
        // Đồng bộ sequence sau khi chèn cứng ID
        await dbRun("SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products");
      }
    }

    // Update existing null columns (SQLite only, Postgres starts clean)
    if (!isPostgres) {
      await dbRun("UPDATE keys SET product_id = 1 WHERE product_id IS NULL");
      await dbRun("UPDATE transactions SET product_id = 1 WHERE product_id IS NULL");
      await dbRun("UPDATE transactions SET package_type = '30_days' WHERE package_type IS NULL AND amount <= 50000");
      await dbRun("UPDATE transactions SET package_type = '180_days' WHERE package_type IS NULL AND amount > 50000 AND amount <= 250000");
      await dbRun("UPDATE transactions SET package_type = '365_days' WHERE package_type IS NULL AND amount > 250000");
    }

    console.log('[Website Database]: Schema initialized and migrated successfully.');
  } catch (err) {
    console.error('[Website Database] Initialization/Migration failed:', err);
  }
}

module.exports = {
  initDatabase,
  dbRun,
  dbGet,
  dbAll,
  isPostgres
};
