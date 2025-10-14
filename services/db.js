// services/db.js
const { Pool } = require("pg");
const { envVar } = require("./env");

let pool;

function getPool() {
  if (pool) return pool;

  // Prefer DATABASE_URL if provided
  const connectionString = envVar("DATABASE_URL");
  if (connectionString) {
    pool = new Pool({ connectionString });
    return pool;
  }

  // Sensible defaults for CI/local Postgres
  const host = envVar("PGHOST", "127.0.0.1");
  const port = parseInt(envVar("PGPORT", "5432"), 10);
  const user = envVar("PGUSER", "postgres");
  // IMPORTANT: default password to 'postgres' if not set
  const password = envVar("PGPASSWORD", "postgres");
  const database = envVar("PGDATABASE", "postgres");

  pool = new Pool({
    host,
    port,
    user,
    password,
    database,
    max: 10,
    idleTimeoutMillis: 10000
  });

  return pool;
}

async function initDB() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )
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
    const { rows } = await client.query(
      "SELECT id, name, size, created_at FROM files ORDER BY created_at DESC, id DESC"
    );
    return rows;
  } finally {
    client.release();
  }
}

module.exports = { getPool, initDB, healthCheck, listFiles };
