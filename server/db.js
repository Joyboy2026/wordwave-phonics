import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'lifetime')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_ref TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'lifetime')),
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(expires_at);

CREATE TABLE IF NOT EXISTS user_data (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS study_daily (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS study_module_daily (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  module TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day, module)
);

CREATE TABLE IF NOT EXISTS redeem_codes (
  code TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'lifetime')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_at TEXT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_redeem_used ON redeem_codes(used_by);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
`;

export function openDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");
  migrate(db);
  return db;
}

function migrate(db) {
  const row = db.prepare("PRAGMA user_version").get();
  const current = Number(row?.user_version ?? 0);
  if (current < SCHEMA_VERSION) {
    db.exec(SCHEMA);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  } else {
    // Keep idempotent table creation for partially-created databases.
    db.exec(SCHEMA);
  }
}

export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore rollback failure */
    }
    throw error;
  }
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name || row.username,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || null,
    lastSeenAt: row.last_seen_at || null
  };
}

export function getUserById(db, id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(Number(id));
}

export function getUserByUsername(db, username) {
  return db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(String(username));
}

export function audit(db, { actorId = null, action, targetType = null, targetId = null, detail = null, ip = null }) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, detail, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    actorId === null ? null : Number(actorId),
    String(action),
    targetType,
    targetId === null ? null : String(targetId),
    detail === null ? null : JSON.stringify(detail),
    ip,
    new Date().toISOString()
  );
}

export function studyTotals(db, userId, sinceDay = null) {
  const params = [Number(userId)];
  let where = "user_id = ?";
  if (sinceDay) {
    where += " AND day >= ?";
    params.push(sinceDay);
  }
  const row = db
    .prepare(`SELECT COALESCE(SUM(seconds), 0) AS seconds FROM study_daily WHERE ${where}`)
    .get(...params);
  return Number(row?.seconds ?? 0);
}

export function userDataSummary(db, userId) {
  return db
    .prepare("SELECT key, LENGTH(value) AS bytes, updated_at FROM user_data WHERE user_id = ? ORDER BY key")
    .all(Number(userId))
    .map((row) => ({ key: row.key, bytes: Number(row.bytes), updatedAt: row.updated_at }));
}
