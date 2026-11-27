import crypto from "node:crypto";
import { PLANS } from "./config.js";
import { nowIso, addDaysIso } from "./security.js";
import { AppError } from "./errors.js";

export class BillingError extends AppError {
  constructor(status, code, message) {
    super(status, code, message);
    this.name = "BillingError";
  }
}

export function orderPublic(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    plan: row.plan,
    planName: PLANS[row.plan]?.name || row.plan,
    amountCents: Number(row.amount_cents),
    amountText: `¥${(Number(row.amount_cents) / 100).toFixed(2).replace(/\.00$/, "")}`,
    status: row.status,
    provider: row.provider,
    providerRef: row.provider_ref || null,
    note: row.note || null,
    createdAt: row.created_at,
    paidAt: row.paid_at || null,
    confirmedBy: row.confirmed_by ? Number(row.confirmed_by) : null
  };
}

export function subscriptionPublic(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    plan: row.plan,
    startsAt: row.starts_at,
    expiresAt: row.expires_at || null,
    orderId: row.order_id ? Number(row.order_id) : null,
    note: row.note || null,
    createdAt: row.created_at
  };
}

export function getEntitlement(db, userId, now = Date.now()) {
  const nowText = new Date(now).toISOString();
  const rows = db
    .prepare(
      `SELECT * FROM subscriptions
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY (expires_at IS NULL) DESC, expires_at DESC`
    )
    .all(Number(userId), nowText);

  let lifetime = false;
  let maxExpiry = null;
  for (const row of rows) {
    if (row.expires_at === null) lifetime = true;
    else if (!maxExpiry || Date.parse(row.expires_at) > Date.parse(maxExpiry)) maxExpiry = row.expires_at;
  }
  const active = lifetime || Boolean(maxExpiry);
  return {
    active,
    lifetime,
    plan: lifetime ? "lifetime" : maxExpiry ? "monthly" : null,
    planName: lifetime ? PLANS.lifetime.name : maxExpiry ? PLANS.monthly.name : null,
    expiresAt: lifetime ? null : maxExpiry,
    remainingDays:
      lifetime || !maxExpiry ? null : Math.max(0, Math.ceil((Date.parse(maxExpiry) - now) / 86400000)),
    subscriptions: rows.map(subscriptionPublic)
  };
}

export function hasLifetime(db, userId) {
  return Boolean(
    db.prepare("SELECT 1 FROM subscriptions WHERE user_id = ? AND expires_at IS NULL LIMIT 1").get(Number(userId))
  );
}

export function currentMonthlyExpiry(db, userId, now = Date.now()) {
  const row = db
    .prepare(
      `SELECT MAX(expires_at) AS expires_at FROM subscriptions
       WHERE user_id = ? AND plan = 'monthly' AND expires_at > ?`
    )
    .get(Number(userId), new Date(now).toISOString());
  return row?.expires_at || null;
}

export function grantSubscription(db, { userId, plan, orderId = null, note = null, now = Date.now() }) {
  if (!PLANS[plan]) throw new BillingError(400, "bad_plan", "未知套餐");
  const created = new Date(now).toISOString();
  if (plan === "lifetime") {
    if (hasLifetime(db, userId)) return getEntitlement(db, userId, now);
    db.prepare(
      `INSERT INTO subscriptions (user_id, plan, starts_at, expires_at, order_id, note, created_at)
       VALUES (?, 'lifetime', ?, NULL, ?, ?, ?)`
    ).run(Number(userId), created, orderId === null ? null : Number(orderId), note, created);
    return getEntitlement(db, userId, now);
  }

  if (hasLifetime(db, userId)) return getEntitlement(db, userId, now);
  const existing = currentMonthlyExpiry(db, userId, now);
  const base = existing && Date.parse(existing) > now ? existing : created;
  const expires = addDaysIso(base, PLANS.monthly.periodDays);
  db.prepare(
    `INSERT INTO subscriptions (user_id, plan, starts_at, expires_at, order_id, note, created_at)
     VALUES (?, 'monthly', ?, ?, ?, ?, ?)`
  ).run(Number(userId), base, expires, orderId === null ? null : Number(orderId), note, created);
  return getEntitlement(db, userId, now);
}

export function assertCanBuy(db, userId, plan) {
  if (!PLANS[plan]) throw new BillingError(400, "bad_plan", "未知套餐");
  if (hasLifetime(db, userId)) {
    throw new BillingError(409, "already_lifetime", "你已买断，无需再次购买");
  }
}

export function createOrder(db, { userId, plan, provider = "manual", note = null, now = Date.now() }) {
  assertCanBuy(db, userId, plan);
  const created = new Date(now).toISOString();
  db.prepare(
    `UPDATE orders SET status = 'cancelled', note = COALESCE(note, '新订单替代')
     WHERE user_id = ? AND plan = ? AND status = 'pending'`
  ).run(Number(userId), plan);
  const result = db
    .prepare(
      `INSERT INTO orders (user_id, plan, amount_cents, status, provider, note, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`
    )
    .run(Number(userId), plan, PLANS[plan].priceCents, provider, note, created);
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(result.lastInsertRowid));
}

export function confirmOrder(db, orderId, { actorId = null, providerRef = null, note = null, now = Date.now() } = {}) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(orderId));
  if (!order) throw new BillingError(404, "order_not_found", "订单不存在");
  if (order.status === "paid") {
    return { order, entitlement: getEntitlement(db, order.user_id, now), alreadyPaid: true };
  }
  if (order.status !== "pending") {
    throw new BillingError(409, "order_closed", "订单已关闭，不能支付");
  }
  if (hasLifetime(db, order.user_id) && order.plan === "monthly") {
    throw new BillingError(409, "already_lifetime", "该用户已买断，月卡订单无法开通");
  }
  const paidAt = new Date(now).toISOString();
  db.prepare(
    `UPDATE orders SET status = 'paid', paid_at = ?, provider_ref = COALESCE(?, provider_ref),
      note = COALESCE(?, note), confirmed_by = COALESCE(?, confirmed_by) WHERE id = ?`
  ).run(paidAt, providerRef, note, actorId === null ? null : Number(actorId), Number(order.id));
  const entitlement = grantSubscription(db, {
    userId: order.user_id,
    plan: order.plan,
    orderId: order.id,
    note: note || `订单 #${order.id}`,
    now
  });
  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(order.id));
  return { order: updated, entitlement, alreadyPaid: false };
}

export function cancelOrder(db, orderId, { actorId = null, note = null } = {}) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(orderId));
  if (!order) throw new BillingError(404, "order_not_found", "订单不存在");
  if (order.status !== "pending") throw new BillingError(409, "order_closed", "只能取消待支付订单");
  db.prepare("UPDATE orders SET status = 'cancelled', note = COALESCE(?, note) WHERE id = ?").run(note, Number(order.id));
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(order.id));
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  const bytes = crypto.randomBytes(12);
  let body = "";
  for (let i = 0; i < 12; i += 1) body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `WW-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export function createRedeemCodes(db, { plan, count, actorId = null, note = null }) {
  if (!PLANS[plan]) throw new BillingError(400, "bad_plan", "未知套餐");
  const total = Math.min(100, Math.max(1, Number(count) || 1));
  const now = nowIso();
  const codes = [];
  const insert = db.prepare(
    "INSERT INTO redeem_codes (code, plan, created_by, created_at, note) VALUES (?, ?, ?, ?, ?)"
  );
  for (let i = 0; i < total; i += 1) {
    let code = randomCode();
    let guard = 0;
    while (db.prepare("SELECT 1 FROM redeem_codes WHERE code = ?").get(code) && guard < 5) {
      code = randomCode();
      guard += 1;
    }
    insert.run(code, plan, actorId === null ? null : Number(actorId), now, note);
    codes.push(code);
  }
  return codes;
}

export function redeemCode(db, { code, userId, now = Date.now() }) {
  const normalized = String(code || "").trim().toUpperCase();
  const row = db.prepare("SELECT * FROM redeem_codes WHERE code = ?").get(normalized);
  if (!row) throw new BillingError(404, "code_not_found", "兑换码不存在");
  if (row.used_at) throw new BillingError(409, "code_used", "兑换码已被使用");
  assertCanBuy(db, userId, row.plan);

  const created = new Date(now).toISOString();
  const order = db
    .prepare(
      `INSERT INTO orders (user_id, plan, amount_cents, status, provider, provider_ref, note, created_at, paid_at)
       VALUES (?, ?, 0, 'paid', 'redeem', ?, ?, ?, ?)`
    )
    .run(Number(userId), row.plan, normalized, `兑换码 ${normalized}`, created, created);
  const orderId = Number(order.lastInsertRowid);
  const used = db
    .prepare("UPDATE redeem_codes SET used_by = ?, used_at = ?, order_id = ? WHERE code = ? AND used_at IS NULL")
    .run(Number(userId), created, orderId, normalized);
  if (Number(used.changes) !== 1) throw new BillingError(409, "code_used", "兑换码已被使用");
  const entitlement = grantSubscription(db, {
    userId,
    plan: row.plan,
    orderId,
    note: `兑换码 ${normalized}`,
    now
  });
  return {
    order: db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId),
    entitlement
  };
}
