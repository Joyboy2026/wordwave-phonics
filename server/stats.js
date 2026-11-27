import { dayKey, daysBackKeys } from "./security.js";

export const STUDY_MODULES = ["phonics", "wordlab", "ipa", "ocr", "other"];

export function normalizeModule(module) {
  return STUDY_MODULES.includes(module) ? module : "other";
}

/**
 * Add verified study seconds. Client heartbeats are untrusted, so each beat is
 * capped and the per-day total is capped too. Attribution uses the server's
 * configured timezone, never a client-provided date.
 */
export function recordStudy(db, { userId, seconds, module, timezone, dailyCapSeconds, now = Date.now() }) {
  const safeSeconds = Math.min(120, Math.max(0, Math.floor(Number(seconds) || 0)));
  if (!safeSeconds) return { addedSeconds: 0, todaySeconds: 0 };
  const day = dayKey(new Date(now), timezone);
  const at = new Date(now).toISOString();
  const mod = normalizeModule(module);

  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db
      .prepare("SELECT seconds FROM study_daily WHERE user_id = ? AND day = ?")
      .get(Number(userId), day);
    const currentSeconds = Number(current?.seconds ?? 0);
    const remaining = Math.max(0, dailyCapSeconds - currentSeconds);
    const added = Math.min(safeSeconds, remaining);
    if (added > 0) {
      db.prepare(
        `INSERT INTO study_daily (user_id, day, seconds, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, day) DO UPDATE SET seconds = seconds + excluded.seconds, updated_at = excluded.updated_at`
      ).run(Number(userId), day, added, at);
      db.prepare(
        `INSERT INTO study_module_daily (user_id, day, module, seconds, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, day, module) DO UPDATE SET seconds = seconds + excluded.seconds, updated_at = excluded.updated_at`
      ).run(Number(userId), day, mod, added, at);
      db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(at, Number(userId));
    }
    db.exec("COMMIT");
    return { addedSeconds: added, todaySeconds: currentSeconds + added, day };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export function studySummary(db, userId, { days = 30, timezone = "Asia/Shanghai", now = Date.now() } = {}) {
  const keys = daysBackKeys(days, timezone);
  const first = keys[0];
  const today = dayKey(new Date(now), timezone);
  const rows = db
    .prepare("SELECT day, seconds FROM study_daily WHERE user_id = ? AND day >= ? ORDER BY day")
    .all(Number(userId), first);
  const map = new Map(rows.map((row) => [row.day, Number(row.seconds)]));
  const daily = keys.map((day) => ({ day, seconds: map.get(day) || 0 }));
  const modules = db
    .prepare(
      `SELECT module, SUM(seconds) AS seconds FROM study_module_daily
       WHERE user_id = ? AND day >= ? GROUP BY module ORDER BY seconds DESC`
    )
    .all(Number(userId), first)
    .map((row) => ({ module: row.module, seconds: Number(row.seconds) }));

  const total = Number(
    db.prepare("SELECT COALESCE(SUM(seconds), 0) AS s FROM study_daily WHERE user_id = ?").get(Number(userId))?.s ?? 0
  );
  const sevenDayStart = keys[Math.max(0, keys.length - 7)] || first;
  const sevenDay = Number(
    db
      .prepare("SELECT COALESCE(SUM(seconds), 0) AS s FROM study_daily WHERE user_id = ? AND day >= ?")
      .get(Number(userId), sevenDayStart)?.s ?? 0
  );
  const thirtyDayStart = keys[Math.max(0, keys.length - 30)] || first;
  const thirtyDay = Number(
    db
      .prepare("SELECT COALESCE(SUM(seconds), 0) AS s FROM study_daily WHERE user_id = ? AND day >= ?")
      .get(Number(userId), thirtyDayStart)?.s ?? 0
  );
  return {
    todaySeconds: map.get(today) || 0,
    sevenDaySeconds: sevenDay,
    thirtyDaySeconds: thirtyDay,
    totalSeconds: total,
    daily,
    modules
  };
}

export function adminOverview(db, { days = 7, timezone = "Asia/Shanghai", now = Date.now() } = {}) {
  const nowText = new Date(now).toISOString();
  const keys = daysBackKeys(days, timezone);
  const first = keys[0];
  const sevenStart = new Date(now - 7 * 86400000).toISOString();
  const today = dayKey(new Date(now), timezone);

  const count = (sql, ...params) => Number(db.prepare(sql).get(...params)?.n ?? 0);
  const totals = {
    users: count("SELECT COUNT(*) AS n FROM users"),
    activeUsers: count("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
    paidUsers: count(
      `SELECT COUNT(*) AS n FROM users u WHERE EXISTS (
         SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND (s.expires_at IS NULL OR s.expires_at > ?)
       )`,
      nowText
    ),
    newUsers7d: count("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", sevenStart),
    pendingOrders: count("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
    todayLearners: count("SELECT COUNT(*) AS n FROM study_daily WHERE day = ? AND seconds > 0", today),
    todaySeconds: count("SELECT COALESCE(SUM(seconds), 0) AS n FROM study_daily WHERE day = ?", today),
    totalSeconds: count("SELECT COALESCE(SUM(seconds), 0) AS n FROM study_daily")
  };

  const dayRows = db
    .prepare(
      `SELECT day, SUM(seconds) AS seconds, COUNT(*) AS learners FROM study_daily
       WHERE day >= ? GROUP BY day`
    )
    .all(first);
  const dayMap = new Map(dayRows.map((row) => [row.day, row]));
  const daily = keys.map((day) => ({
    day,
    seconds: Number(dayMap.get(day)?.seconds ?? 0),
    learners: Number(dayMap.get(day)?.learners ?? 0)
  }));

  const modules = db
    .prepare(
      `SELECT module, SUM(seconds) AS seconds FROM study_module_daily
       WHERE day >= ? GROUP BY module ORDER BY seconds DESC`
    )
    .all(first)
    .map((row) => ({ module: row.module, seconds: Number(row.seconds) }));

  const recentOrders = db
    .prepare(
      `SELECT o.*, u.username, u.display_name FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 8`
    )
    .all()
    .map((row) => ({
      id: Number(row.id),
      username: row.username,
      displayName: row.display_name || row.username,
      plan: row.plan,
      amountCents: Number(row.amount_cents),
      status: row.status,
      provider: row.provider,
      createdAt: row.created_at
    }));

  const topLearners = db
    .prepare(
      `SELECT s.user_id, u.username, u.display_name, SUM(s.seconds) AS seconds
       FROM study_daily s JOIN users u ON u.id = s.user_id
       WHERE s.day >= ? GROUP BY s.user_id ORDER BY seconds DESC LIMIT 5`
    )
    .all(keys[Math.max(0, keys.length - 7)] || first)
    .map((row) => ({
      userId: Number(row.user_id),
      username: row.username,
      displayName: row.display_name || row.username,
      seconds: Number(row.seconds)
    }));

  return { days, totals, daily, modules, recentOrders, topLearners };
}

export function adminUserStudy(db, userId, { days = 30, timezone = "Asia/Shanghai", now = Date.now() } = {}) {
  return studySummary(db, userId, { days, timezone, now });
}
