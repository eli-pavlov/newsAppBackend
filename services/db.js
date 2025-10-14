// services/db.js
const { Pool } = require("pg");
const { envVar } = require("./env");

let pool;

function getPool() {
  if (pool) return pool;
  const connectionString = envVar("DATABASE_URL");
  if (connectionString) {
    pool = new Pool({ connectionString });
  } else {
    pool = new Pool({
      host: envVar("PGHOST", "127.0.0.1"),
      port: parseInt(envVar("PGPORT", "5432"), 10),
      user: envVar("PGUSER", "postgres"),
      password: envVar("PGPASSWORD", ""),
      database: envVar("PGDATABASE", "postgres"),
      max: 10,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

async function initDB() {
  const client = await getPool().connect();
  try {
    // Create a minimal table used by /files/list if it doesn't exist.
    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);
    return { success: true };
  } catch (err) {
    console.error("DB init error:", err);
    return { success: false, message: String(err) };
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    client.release();
  }
}

async function listFiles() {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query("SELECT id, name, size, created_at FROM files ORDER BY created_at DESC, id DESC");
    return rows;
  } finally {
    client.release();
  }
}

module.exports = { getPool, initDB, healthCheck, listFiles };
