import fs from "node:fs";
import { AppError, badRequest, conflict, notFound } from "./errors.js";
import {
  scryptHash,
  verifyPassword,
  randomToken,
  nowIso,
  dayKey,
  validateUsername,
  validatePassword,
  validateDisplayName,
  clampInt
} from "./security.js";
import { revokeAllSessions } from "./auth.js";
import { publicUser } from "./db.js";

const ROLES = new Set(["user", "admin"]);
const STATUSES = new Set(["active", "disabled"]);

export function createUser(db, { username, password, displayName = "", role = "user", status = "active", now = Date.now() }) {
  const nameCheck = validateUsername(username);
  if (!nameCheck.ok) throw badRequest(nameCheck.message, "invalid_username");
  const passCheck = validatePassword(password);
  if (!passCheck.ok) throw badRequest(passCheck.message, "invalid_password");
  if (!ROLES.has(role)) throw badRequest("角色不合法", "invalid_role");
  if (!STATUSES.has(status)) throw badRequest("状态不合法", "invalid_status");

  const created = new Date(now).toISOString();
  try {
    const result = db
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nameCheck.username,
        scryptHash(passCheck.password),
        validateDisplayName(displayName, nameCheck.username),
        role,
        status,
        created,
        created
      );
    return db.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid));
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      throw conflict("用户名已存在", "username_taken");
    }
    throw error;
  }
}

export function updateUser(db, userId, patch = {}) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(userId));
  if (!user) throw notFound("用户不存在", "user_not_found");

  const sets = [];
  const params = [];
  let passwordChanged = false;

  if (patch.displayName !== undefined) {
    sets.push("display_name = ?");
    params.push(validateDisplayName(patch.displayName, user.username));
  }
  if (patch.role !== undefined) {
    if (!ROLES.has(patch.role)) throw badRequest("角色不合法", "invalid_role");
    if (user.role === "admin" && patch.role !== "admin") assertNotLastAdmin(db, userId);
    sets.push("role = ?");
    params.push(patch.role);
  }
  if (patch.status !== undefined) {
    if (!STATUSES.has(patch.status)) throw badRequest("状态不合法", "invalid_status");
    if (user.role === "admin" && patch.status !== "active") assertNotLastAdmin(db, userId);
    sets.push("status = ?");
    params.push(patch.status);
  }
  if (patch.username !== undefined) {
    const check = validateUsername(patch.username);
    if (!check.ok) throw badRequest(check.message, "invalid_username");
    if (check.username.toLowerCase() !== String(user.username).toLowerCase()) {
      const exists = db
        .prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id <> ?")
        .get(check.username, Number(userId));
      if (exists) throw conflict("用户名已存在", "username_taken");
    }
    sets.push("username = ?");
    params.push(check.username);
  }
  if (patch.password !== undefined && patch.password !== "") {
    const check = validatePassword(patch.password);
    if (!check.ok) throw badRequest(check.message, "invalid_password");
    sets.push("password_hash = ?");
    params.push(scryptHash(check.password));
    passwordChanged = true;
  }

  if (!sets.length) return { user, passwordChanged: false };
  sets.push("updated_at = ?");
  params.push(nowIso());
  params.push(Number(userId));
  try {
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) throw conflict("用户名已存在", "username_taken");
    throw error;
  }
  if (passwordChanged || patch.status === "disabled") revokeAllSessions(db, userId);
  return { user: db.prepare("SELECT * FROM users WHERE id = ?").get(Number(userId)), passwordChanged };
}

export function assertNotLastAdmin(db, userId) {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?")
    .get(Number(userId));
  if (Number(row?.n ?? 0) === 0) {
    throw new AppError(409, "last_admin", "不能移除或停用最后一个管理员");
  }
}

export function deleteUser(db, userId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(userId));
  if (!user) throw notFound("用户不存在", "user_not_found");
  if (user.role === "admin") assertNotLastAdmin(db, userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(Number(userId));
  return user;
}

function entitlementFromRow(row, now) {
  const lifetime = Number(row.lifetime ?? 0) === 1;
  const expiry = row.monthly_expiry || null;
  const active = lifetime || Boolean(expiry && Date.parse(expiry) > now);
  return {
    active,
    lifetime,
    plan: lifetime ? "lifetime" : active ? "monthly" : null,
    expiresAt: lifetime ? null : expiry,
    remainingDays:
      lifetime || !expiry ? null : Math.max(0, Math.ceil((Date.parse(expiry) - now) / 86400000))
  };
}

export function listUsers(
  db,
  { q = "", role = "", status = "", paid = "", page = 1, pageSize = 20, timezone = "Asia/Shanghai", now = Date.now() }
) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = clampInt(pageSize, 1, 100, 20);
  const nowText = new Date(now).toISOString();
  const today = dayKey(new Date(now), timezone);
  const sevenStart = dayKey(new Date(now - 6 * 86400000), timezone);
  const thirtyStart = dayKey(new Date(now - 29 * 86400000), timezone);

  const where = [];
  const whereParams = [];
  const search = String(q || "").trim();
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(u.username LIKE ? ESCAPE '\\' COLLATE NOCASE OR u.display_name LIKE ? ESCAPE '\\')");
    whereParams.push(like, like);
  }
  if (role) {
    if (!ROLES.has(role)) throw badRequest("角色不合法", "invalid_role");
    where.push("u.role = ?");
    whereParams.push(role);
  }
  if (status) {
    if (!STATUSES.has(status)) throw badRequest("状态不合法", "invalid_status");
    where.push("u.status = ?");
    whereParams.push(status);
  }
  if (paid === "1" || paid === "true") {
    where.push(
      `EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND (s.expires_at IS NULL OR s.expires_at > ?))`
    );
    whereParams.push(nowText);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM users u ${whereSql}`).get(...whereParams)?.n ?? 0);
  const offset = (safePage - 1) * safeSize;

  const rows = db
    .prepare(
      `SELECT u.*,
        (SELECT seconds FROM study_daily sd WHERE sd.user_id = u.id AND sd.day = ?) AS today_seconds,
        (SELECT COALESCE(SUM(seconds), 0) FROM study_daily sd WHERE sd.user_id = u.id AND sd.day >= ?) AS seven_seconds,
        (SELECT COALESCE(SUM(seconds), 0) FROM study_daily sd WHERE sd.user_id = u.id AND sd.day >= ?) AS thirty_seconds,
        (SELECT COALESCE(SUM(seconds), 0) FROM study_daily sd WHERE sd.user_id = u.id) AS total_seconds,
        (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.expires_at IS NULL LIMIT 1) AS lifetime,
        (SELECT MAX(s.expires_at) FROM subscriptions s
          WHERE s.user_id = u.id AND s.plan = 'monthly' AND s.expires_at > ?) AS monthly_expiry,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'pending') AS pending_orders
       FROM users u ${whereSql}
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(today, sevenStart, thirtyStart, nowText, ...whereParams, safeSize, offset);

  return {
    total,
    page: safePage,
    pageSize: safeSize,
    pages: Math.max(1, Math.ceil(total / safeSize)),
    items: rows.map((row) => ({
      ...publicUser(row),
      entitlement: entitlementFromRow(row, now),
      study: {
        todaySeconds: Number(row.today_seconds ?? 0),
        sevenDaySeconds: Number(row.seven_seconds ?? 0),
        thirtyDaySeconds: Number(row.thirty_seconds ?? 0),
        totalSeconds: Number(row.total_seconds ?? 0)
      },
      pendingOrders: Number(row.pending_orders ?? 0)
    }))
  };
}

export function ensureInitialAdmin(db, config, logger = console) {
  const adminCount = Number(
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get()?.n ?? 0
  );
  if (adminCount > 0) return null;

  const username = config.adminUsername || "admin";
  let password = config.adminPassword;
  let generated = false;
  if (!password) {
    password = randomToken(12);
    generated = true;
  }
  let user;
  try {
    user = createUser(db, { username, password, displayName: "管理员", role: "admin" });
  } catch (error) {
    logger.error(`[wordwave] 初始化管理员失败：${error.message}`);
    return null;
  }

  const info = { username: user.username, password, generated };
  if (generated) {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const file = `${config.dataDir}/initial-admin.txt`;
    fs.writeFileSync(
      file,
      `WORDWAVE 初始管理员\n用户名: ${user.username}\n密码: ${password}\n\n请登录后立即在“账号”面板修改密码，并删除本文件。\n`,
      { mode: 0o600 }
    );
    logger.log(`[wordwave] 已创建初始管理员 ${user.username}，密码已写入 ${file}`);
    logger.log("[wordwave] 首次登录后请修改密码，并删除该密码文件。");
  }
  return info;
}

export function verifyUserPassword(user, password) {
  return verifyPassword(password, user.password_hash);
}
