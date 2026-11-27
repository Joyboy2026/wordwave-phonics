import crypto from "node:crypto";
import { randomToken, sha256, nowIso, addDaysIso } from "./security.js";

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    let value = part.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function clientIp(req, config) {
  if (config.trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}

export function createSession(db, user, req, config) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const created = nowIso();
  const expires = addDaysIso(created, config.sessionDays);
  db.prepare(
    `INSERT INTO sessions (user_id, token_hash, csrf_token, created_at, expires_at, last_seen_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(user.id),
    sha256(token),
    csrfToken,
    created,
    expires,
    created,
    clientIp(req, config),
    String(req.headers["user-agent"] || "").slice(0, 255)
  );

  // Keep the number of concurrent sessions per account bounded.
  const extra = db
    .prepare(
      `SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 10`
    )
    .all(Number(user.id));
  for (const row of extra) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(Number(row.id));
  }

  return { token, csrfToken, expiresAt: expires };
}

export function sessionCookie(token, config) {
  const parts = [
    `${config.cookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.round(config.sessionDays * 86400)}`
  ];
  if (config.cookieSecure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(config) {
  const parts = [`${config.cookieName}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (config.cookieSecure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Resolve the session cookie to { session, user }. Returns null for missing,
 * expired, revoked, or disabled accounts. Disabled accounts lose access
 * immediately even if their cookie is still present.
 */
export function readSession(db, req, config) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[config.cookieName];
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.*, u.username, u.display_name, u.role, u.status, u.created_at AS user_created_at,
              u.updated_at AS user_updated_at, u.last_login_at, u.last_seen_at AS user_last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(sha256(token));
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(Number(row.id));
    return null;
  }
  if (row.status !== "active") {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(Number(row.id));
    return null;
  }
  const lastSeen = Date.parse(row.last_seen_at || 0);
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > TOUCH_INTERVAL_MS) {
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), Number(row.id));
  }
  const user = {
    id: Number(row.user_id),
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    status: row.status,
    created_at: row.user_created_at,
    updated_at: row.user_updated_at,
    last_login_at: row.last_login_at,
    last_seen_at: row.user_last_seen_at
  };
  return { session: row, user };
}

export function revokeSession(db, token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function revokeAllSessions(db, userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(Number(userId));
}

export function cleanupSessions(db) {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length !== right.length) {
    // Compare anyway to keep timing closer, then fail.
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function verifyCsrf(session, req) {
  const header = req.headers["x-csrf-token"];
  return Boolean(session?.csrf_token) && safeEqual(header, session.csrf_token);
}
