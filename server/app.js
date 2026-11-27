import http from "node:http";
import { URL } from "node:url";
import { PLANS, planList } from "./config.js";
import {
  readSession,
  createSession,
  sessionCookie,
  clearSessionCookie,
  verifyCsrf,
  revokeSession,
  cleanupSessions,
  parseCookies,
  clientIp
} from "./auth.js";
import {
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  verifyUserPassword,
  ensureInitialAdmin
} from "./users.js";
import {
  getEntitlement,
  createOrder,
  confirmOrder,
  cancelOrder,
  createRedeemCodes,
  redeemCode,
  grantSubscription,
  orderPublic,
  subscriptionPublic
} from "./billing.js";
import { recordStudy, studySummary, adminOverview, adminUserStudy } from "./stats.js";
import { AppError, badRequest, notFound, forbidden, unauthorized } from "./errors.js";
import { publicUser, audit, userDataSummary, transaction } from "./db.js";
import { dayKey, nowIso, clampInt, randomToken, scryptHash } from "./security.js";
import { serveStatic } from "./static.js";

const DATA_KEYS = new Set([
  "wordwave.progress.v1",
  "wordwave.wordlab.v1",
  "wordwave.ipa.v1",
  "wordwave.browse.v1",
  "wordwave.ocr.v1",
  "wordwave.ocr.history.v1"
]);
const MAX_DATA_KEY_BYTES = 512 * 1024;
const MAX_DATA_TOTAL_BYTES = 2 * 1024 * 1024;
const JSON_LIMIT = 1024 * 1024;

// Used to keep failed-login timing roughly similar for unknown accounts.
const DUMMY_HASH = scryptHash("wordwave-dummy-password");

class RateLimiter {
  constructor() {
    this.buckets = new Map();
  }

  hit(key, limit, windowMs) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.reset <= now) {
      bucket = { count: 0, reset: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (this.buckets.size > 5000) {
      for (const [entryKey, entry] of this.buckets) {
        if (entry.reset <= now) this.buckets.delete(entryKey);
      }
    }
    if (bucket.count > limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
    }
    return { ok: true };
  }
}

function baseHeaders(secure) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin"
  };
  if (secure) headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return headers;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload ?? {});
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function sendText(res, status, text, extraHeaders = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(text);
}

async function readJson(req, limit = JSON_LIMIT) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new AppError(413, "payload_too_large", "请求体过大");
    chunks.push(chunk);
  }
  if (!total) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw badRequest("JSON 格式不正确", "invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw badRequest("请求体必须是 JSON 对象", "invalid_json");
  }
  return parsed;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function authPayload(ctx, userRow, csrfToken) {
  const entitlement = getEntitlement(ctx.db, userRow.id);
  const study = studySummary(ctx.db, userRow.id, { days: 1, timezone: ctx.config.timezone });
  return {
    user: publicUser(userRow),
    entitlement,
    csrfToken,
    plans: planList(),
    paymentMode: ctx.config.paymentMode,
    study: {
      todaySeconds: study.todaySeconds,
      totalSeconds: study.totalSeconds
    },
    serverTime: nowIso()
  };
}

function requireAuth(ctx) {
  if (!ctx.auth) throw unauthorized();
  return ctx.auth;
}

function requireAdmin(ctx) {
  const auth = requireAuth(ctx);
  if (auth.user.role !== "admin") throw forbidden("需要管理员权限", "admin_required");
  return auth;
}

function requireEntitled(ctx) {
  const auth = requireAuth(ctx);
  if (auth.user.role === "admin") return auth;
  const entitlement = getEntitlement(ctx.db, auth.user.id);
  if (!entitlement.active) {
    throw new AppError(402, "subscription_required", "需要开通订阅后才能同步学习记录");
  }
  return auth;
}

function paymentInfo(order, config) {
  const info = orderPublic(order);
  if (config.paymentMode === "mock") {
    return {
      mode: "mock",
      title: "测试支付模式",
      lines: [
        `订单号：#${info.id}`,
        `金额：${info.amountText}`,
        "当前为本地测试模式，点击“模拟支付并开通”即可立即生效。",
        "正式上线前请在 .env 中把 PAYMENT_MODE 改为 manual。"
      ]
    };
  }
  return {
    mode: "manual",
    title: "转账后由管理员确认",
    lines: [
      `订单号：#${info.id}`,
      `金额：${info.amountText}`,
      "请通过微信或支付宝联系管理员转账，并在备注里写上订单号。",
      "管理员在后台确认收款后，订阅会自动开通；开通后刷新本页即可。"
    ]
  };
}

function adminAudit(ctx, action, targetType, targetId, detail) {
  audit(ctx.db, {
    actorId: ctx.auth.user.id,
    action,
    targetType,
    targetId,
    detail,
    ip: ctx.ip
  });
}

export function createWordwaveServer({ config, db, logger = console }) {
  const limiter = new RateLimiter();

  const handler = async (req, res) => {
    const secure = config.cookieSecure;
    for (const [key, value] of Object.entries(baseHeaders(secure))) res.setHeader(key, value);

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    } catch {
      sendText(res, 400, "Bad Request");
      return;
    }
    const pathname = url.pathname;
    const method = req.method || "GET";
    const ip = clientIp(req, config);
    const ctx = { req, res, url, pathname, method, db, config, ip, auth: null };

    try {
      ctx.auth = readSession(db, req, config);

      if (pathname.startsWith("/api/")) {
        await handleApi(ctx, limiter, logger);
        return;
      }

      if (method !== "GET" && method !== "HEAD") {
        sendText(res, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
        return;
      }

      const served = await serveStatic(req, res, pathname, config.root);
      if (!served) sendText(res, 404, "Not Found");
    } catch (error) {
      if (res.writableEnded) return;
      if (error instanceof AppError) {
        sendJson(res, error.status, { error: error.code || "error", message: error.message }, error.headers || {});
        return;
      }
      logger.error("[wordwave] unhandled request error:", error);
      sendJson(res, 500, { error: "internal_error", message: "服务器内部错误" });
    }
  };

  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      logger.error("[wordwave] fatal request error:", error);
      if (!res.headersSent) sendText(res, 500, "Internal Server Error");
      else res.destroy();
    });
  });

  server.on("listening", () => {
    ensureInitialAdmin(db, config, logger);
    cleanupSessions(db);
  });

  const cleanup = setInterval(() => {
    try {
      cleanupSessions(db);
    } catch (error) {
      logger.error("[wordwave] session cleanup failed:", error);
    }
  }, 60 * 60 * 1000);
  cleanup.unref?.();

  return { server, db, config, cleanupInterval: cleanup };
}

async function handleApi(ctx, limiter, logger) {
  const { req, res, pathname, method, db, config, ip } = ctx;
  const safeMethod = method === "GET" || method === "HEAD";

  if (!safeMethod) {
    if (!sameOrigin(req)) throw forbidden("跨站请求被拒绝", "bad_origin");
    const isPublicAuth = pathname === "/api/auth/login" || pathname === "/api/auth/register";
    if (!isPublicAuth) {
      const auth = requireAuth(ctx);
      if (!verifyCsrf(auth.session, req)) throw forbidden("CSRF 校验失败，请刷新页面", "bad_csrf");
    }
  }

  // ---------- public ----------
  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "wordwave", time: nowIso() });
    return;
  }

  if (method === "GET" && pathname === "/api/plans") {
    sendJson(res, 200, { plans: planList(), paymentMode: config.paymentMode });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const ipLimit = limiter.hit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!ipLimit.ok) throw new AppError(429, "rate_limited", "注册过于频繁，请稍后再试", { "Retry-After": ipLimit.retryAfter });
    const body = await readJson(req);
    const user = createUser(db, {
      username: body.username,
      password: body.password,
      displayName: body.displayName,
      role: "user"
    });
    const session = createSession(db, user, req, config);
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(nowIso(), user.id);
    audit(db, { actorId: user.id, action: "register", targetType: "user", targetId: user.id, ip });
    sendJson(res, 201, authPayload(ctx, user, session.csrfToken), {
      "Set-Cookie": sessionCookie(session.token, config)
    });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const ipLimit = limiter.hit(`login-ip:${ip}`, 30, 15 * 60 * 1000);
    if (!ipLimit.ok) throw new AppError(429, "rate_limited", "登录尝试过多，请稍后再试", { "Retry-After": ipLimit.retryAfter });
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const userLimit = limiter.hit(`login-user:${username.toLowerCase()}:${ip}`, 8, 15 * 60 * 1000);
    if (!userLimit.ok) throw new AppError(429, "rate_limited", "登录尝试过多，请稍后再试", { "Retry-After": userLimit.retryAfter });

    const user = username
      ? db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username)
      : null;
    const ok = user ? verifyUserPassword(user, password) : (verifyUserPassword({ password_hash: DUMMY_HASH }, password), false);
    if (!ok) {
      audit(db, { actorId: null, action: "login_failed", targetType: "user", targetId: username || null, ip });
      throw unauthorized("用户名或密码不正确", "bad_credentials");
    }
    if (user.status !== "active") throw forbidden("账号已停用，请联系管理员", "account_disabled");

    const session = createSession(db, user, req, config);
    db.prepare("UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?").run(nowIso(), nowIso(), user.id);
    audit(db, { actorId: user.id, action: "login", targetType: "user", targetId: user.id, ip });
    sendJson(res, 200, authPayload(ctx, user, session.csrfToken), {
      "Set-Cookie": sessionCookie(session.token, config)
    });
    return;
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    const auth = requireAuth(ctx);
    sendJson(res, 200, authPayload(ctx, auth.user, auth.session.csrf_token));
    return;
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    if (ctx.auth) {
      revokeSession(db, parseCookies(req.headers.cookie)[config.cookieName]);
      audit(db, { actorId: ctx.auth.user.id, action: "logout", targetType: "user", targetId: ctx.auth.user.id, ip });
    }
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie(config) });
    return;
  }

  // ---------- signed-in user ----------
  if (method === "GET" && pathname === "/api/me/overview") {
    const auth = requireAuth(ctx);
    const entitlement = getEntitlement(db, auth.user.id);
    const study = studySummary(db, auth.user.id, { days: 30, timezone: config.timezone });
    const orders = db
      .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10")
      .all(auth.user.id)
      .map(orderPublic);
    sendJson(res, 200, {
      user: publicUser(auth.user),
      entitlement,
      study,
      orders,
      paymentMode: config.paymentMode,
      plans: planList(),
      csrfToken: auth.session.csrf_token
    });
    return;
  }

  if (method === "GET" && pathname === "/api/me/data") {
    requireEntitled(ctx);
    const rows = db.prepare("SELECT key, value, updated_at FROM user_data WHERE user_id = ?").all(ctx.auth.user.id);
    const data = {};
    const updatedAt = {};
    for (const row of rows) {
      data[row.key] = row.value;
      updatedAt[row.key] = row.updated_at;
    }
    sendJson(res, 200, { data, updatedAt });
    return;
  }

  const dataMatch = /^\/api\/me\/data\/([^/]+)$/.exec(pathname);
  if (dataMatch && (method === "PUT" || method === "DELETE")) {
    requireEntitled(ctx);
    const key = decodeURIComponent(dataMatch[1]);
    if (!DATA_KEYS.has(key)) throw badRequest("不支持的数据类型", "bad_data_key");

    if (method === "DELETE") {
      db.prepare("DELETE FROM user_data WHERE user_id = ? AND key = ?").run(ctx.auth.user.id, key);
      sendJson(res, 200, { ok: true, key });
      return;
    }

    const body = await readJson(req);
    const value = body.value;
    if (typeof value !== "string") throw badRequest("value 必须是字符串", "bad_data_value");
    const bytes = Buffer.byteLength(value);
    if (bytes > MAX_DATA_KEY_BYTES) throw new AppError(413, "data_too_large", "单个学习记录超过 512KB 限制");
    try {
      JSON.parse(value);
    } catch {
      throw badRequest("学习记录不是合法 JSON", "bad_data_value");
    }
    const used = Number(
      db
        .prepare("SELECT COALESCE(SUM(LENGTH(value)), 0) AS n FROM user_data WHERE user_id = ? AND key <> ?")
        .get(ctx.auth.user.id, key)?.n ?? 0
    );
    if (used + bytes > MAX_DATA_TOTAL_BYTES) {
      throw new AppError(413, "data_quota", "学习记录总大小超过 2MB 限制");
    }
    const at = nowIso();
    db.prepare(
      `INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(ctx.auth.user.id, key, value, at);
    sendJson(res, 200, { ok: true, key, bytes, updatedAt: at });
    return;
  }

  if (method === "POST" && pathname === "/api/me/heartbeat") {
    const auth = requireEntitled(ctx);
    const body = await readJson(req);
    const result = recordStudy(db, {
      userId: auth.user.id,
      seconds: body.seconds,
      module: body.module,
      timezone: config.timezone,
      dailyCapSeconds: config.dailyCapSeconds
    });
    sendJson(res, 200, { ok: true, ...result, dailyCapSeconds: config.dailyCapSeconds });
    return;
  }

  if (method === "POST" && pathname === "/api/me/password") {
    const auth = requireAuth(ctx);
    const body = await readJson(req);
    const currentUser = db.prepare("SELECT * FROM users WHERE id = ?").get(auth.user.id);
    if (!currentUser || !verifyUserPassword(currentUser, String(body.currentPassword || ""))) {
      throw badRequest("当前密码不正确", "bad_password");
    }
    updateUser(db, auth.user.id, { password: body.newPassword });
    const session = createSession(db, auth.user, req, config);
    audit(db, { actorId: auth.user.id, action: "password_change", targetType: "user", targetId: auth.user.id, ip });
    sendJson(
      res,
      200,
      authPayload(ctx, db.prepare("SELECT * FROM users WHERE id = ?").get(auth.user.id), session.csrfToken),
      { "Set-Cookie": sessionCookie(session.token, config) }
    );
    return;
  }

  if (method === "GET" && pathname === "/api/me/orders") {
    const auth = requireAuth(ctx);
    const rows = db
      .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
      .all(auth.user.id);
    sendJson(res, 200, {
      orders: rows.map(orderPublic),
      paymentMode: config.paymentMode
    });
    return;
  }

  if (method === "POST" && pathname === "/api/orders") {
    const auth = requireAuth(ctx);
    const body = await readJson(req);
    if (!PLANS[body.plan]) throw badRequest("未知套餐", "bad_plan");
    const order = transaction(db, () =>
      createOrder(db, {
        userId: auth.user.id,
        plan: body.plan,
        provider: config.paymentMode === "mock" ? "mock" : "manual"
      })
    );
    audit(db, {
      actorId: auth.user.id,
      action: "order_create",
      targetType: "order",
      targetId: order.id,
      detail: { plan: order.plan, amountCents: order.amount_cents },
      ip
    });
    sendJson(res, 201, {
      order: orderPublic(order),
      payment: paymentInfo(order, config),
      paymentMode: config.paymentMode
    });
    return;
  }

  const payMatch = /^\/api\/orders\/(\d+)\/pay$/.exec(pathname);
  if (method === "POST" && payMatch) {
    const auth = requireAuth(ctx);
    if (config.paymentMode !== "mock") throw forbidden("当前不是测试支付模式", "payment_disabled");
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(payMatch[1]));
    if (!order) throw notFound("订单不存在", "order_not_found");
    if (Number(order.user_id) !== auth.user.id) throw forbidden("不能支付他人的订单", "not_your_order");
    const result = transaction(db, () => confirmOrder(db, order.id, { now: Date.now() }));
    audit(db, {
      actorId: auth.user.id,
      action: "order_pay_mock",
      targetType: "order",
      targetId: order.id,
      detail: { plan: order.plan, amountCents: order.amount_cents },
      ip
    });
    sendJson(res, 200, {
      order: orderPublic(result.order),
      entitlement: result.entitlement
    });
    return;
  }

  const cancelMatch = /^\/api\/orders\/(\d+)\/cancel$/.exec(pathname);
  if (method === "POST" && cancelMatch) {
    const auth = requireAuth(ctx);
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(cancelMatch[1]));
    if (!order) throw notFound("订单不存在", "order_not_found");
    if (Number(order.user_id) !== auth.user.id) throw forbidden("不能操作他人的订单", "not_your_order");
    const updated = transaction(db, () => cancelOrder(db, order.id, { note: "用户取消" }));
    audit(db, {
      actorId: auth.user.id,
      action: "order_cancel",
      targetType: "order",
      targetId: order.id,
      ip
    });
    sendJson(res, 200, { order: orderPublic(updated) });
    return;
  }

  if (method === "POST" && pathname === "/api/redeem") {
    const auth = requireAuth(ctx);
    const limit = limiter.hit(`redeem:${auth.user.id}`, 10, 60 * 60 * 1000);
    if (!limit.ok) throw new AppError(429, "rate_limited", "兑换尝试过于频繁，请稍后再试", { "Retry-After": limit.retryAfter });
    const body = await readJson(req);
    const result = transaction(db, () => redeemCode(db, { code: body.code, userId: auth.user.id }));
    audit(db, {
      actorId: auth.user.id,
      action: "redeem",
      targetType: "order",
      targetId: result.order.id,
      detail: { plan: result.order.plan },
      ip
    });
    sendJson(res, 200, {
      order: orderPublic(result.order),
      entitlement: result.entitlement
    });
    return;
  }

  // ---------- admin ----------
  if (pathname.startsWith("/api/admin/")) {
    requireAdmin(ctx);

    if (method === "GET" && pathname === "/api/admin/overview") {
      const days = clampInt(ctx.url.searchParams.get("days"), 1, 90, 7);
      sendJson(res, 200, adminOverview(db, { days, timezone: config.timezone }));
      return;
    }

    if (method === "GET" && pathname === "/api/admin/users") {
      const params = ctx.url.searchParams;
      sendJson(
        res,
        200,
        listUsers(db, {
          q: params.get("q") || "",
          role: params.get("role") || "",
          status: params.get("status") || "",
          paid: params.get("paid") || "",
          page: params.get("page") || 1,
          pageSize: params.get("pageSize") || 20,
          timezone: config.timezone
        })
      );
      return;
    }

    if (method === "POST" && pathname === "/api/admin/users") {
      const body = await readJson(req);
      const initialPassword = body.password ? String(body.password) : randomToken(9);
      const result = transaction(db, () => {
        const user = createUser(db, {
          username: body.username,
          password: initialPassword,
          displayName: body.displayName,
          role: body.role === "admin" ? "admin" : "user"
        });
        let entitlement = getEntitlement(db, user.id);
        if (body.plan && PLANS[body.plan]) {
          entitlement = grantSubscription(db, { userId: user.id, plan: body.plan, note: "管理员创建时赠送" });
        }
        return { user, entitlement };
      });
      adminAudit(ctx, "user_create", "user", result.user.id, {
        username: result.user.username,
        role: result.user.role,
        plan: body.plan || null
      });
      sendJson(res, 201, {
        user: publicUser(result.user),
        entitlement: result.entitlement,
        initialPassword: body.password ? undefined : initialPassword
      });
      return;
    }

    const studyMatch = /^\/api\/admin\/users\/(\d+)\/study$/.exec(pathname);
    if (method === "GET" && studyMatch) {
      const userId = Number(studyMatch[1]);
      if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId)) throw notFound("用户不存在", "user_not_found");
      const days = clampInt(ctx.url.searchParams.get("days"), 1, 90, 30);
      sendJson(res, 200, adminUserStudy(db, userId, { days, timezone: config.timezone }));
      return;
    }

    const subMatch = /^\/api\/admin\/users\/(\d+)\/subscription$/.exec(pathname);
    if (method === "POST" && subMatch) {
      const userId = Number(subMatch[1]);
      if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId)) throw notFound("用户不存在", "user_not_found");
      const body = await readJson(req);
      const action = body.action === "revoke" ? "revoke" : "grant";
      let entitlement;
      if (action === "revoke") {
        transaction(db, () => {
          db.prepare("DELETE FROM subscriptions WHERE user_id = ?").run(userId);
        });
        entitlement = getEntitlement(db, userId);
      } else {
        const plan = body.plan;
        if (!PLANS[plan]) throw badRequest("未知套餐", "bad_plan");
        entitlement = transaction(db, () => grantSubscription(db, { userId, plan, note: "管理员手动开通" }));
      }
      adminAudit(ctx, `subscription_${action}`, "user", userId, { plan: body.plan || null });
      sendJson(res, 200, { entitlement });
      return;
    }

    const userMatch = /^\/api\/admin\/users\/(\d+)$/.exec(pathname);
    if (method === "GET" && userMatch) {
      const userId = Number(userMatch[1]);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      if (!user) throw notFound("用户不存在", "user_not_found");
      const subscriptions = db
        .prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC")
        .all(userId)
        .map(subscriptionPublic);
      const orders = db
        .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
        .all(userId)
        .map(orderPublic);
      sendJson(res, 200, {
        user: publicUser(user),
        entitlement: getEntitlement(db, userId),
        subscriptions,
        orders,
        study: studySummary(db, userId, { days: 30, timezone: config.timezone }),
        data: userDataSummary(db, userId)
      });
      return;
    }

    if (method === "PATCH" && userMatch) {
      const userId = Number(userMatch[1]);
      const body = await readJson(req);
      if (userId === ctx.auth.user.id) {
        if (body.role && body.role !== "admin") throw forbidden("不能取消自己的管理员权限", "self_demote");
        if (body.status && body.status !== "active") throw forbidden("不能停用自己的账号", "self_disable");
      }
      const { user } = updateUser(db, userId, {
        displayName: body.displayName,
        role: body.role,
        status: body.status,
        username: body.username,
        password: body.password
      });
      adminAudit(ctx, "user_update", "user", userId, {
        fields: Object.keys(body).filter((key) => key !== "password"),
        passwordReset: Boolean(body.password)
      });
      sendJson(res, 200, {
        user: publicUser(user),
        entitlement: getEntitlement(db, userId)
      });
      return;
    }

    if (method === "DELETE" && userMatch) {
      const userId = Number(userMatch[1]);
      if (userId === ctx.auth.user.id) throw forbidden("不能删除自己的账号", "self_delete");
      const body = await readJson(req);
      const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      if (!target) throw notFound("用户不存在", "user_not_found");
      if (body.confirmUsername && String(body.confirmUsername).toLowerCase() !== String(target.username).toLowerCase()) {
        throw badRequest("确认用户名不匹配", "confirm_mismatch");
      }
      deleteUser(db, userId);
      adminAudit(ctx, "user_delete", "user", userId, { username: target.username, role: target.role });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && pathname === "/api/admin/orders") {
      const params = ctx.url.searchParams;
      const page = Math.max(1, Number(params.get("page")) || 1);
      const pageSize = clampInt(params.get("pageSize"), 1, 100, 20);
      const status = params.get("status") || "";
      const q = String(params.get("q") || "").trim();
      const where = [];
      const args = [];
      if (status) {
        where.push("o.status = ?");
        args.push(status);
      }
      if (q) {
        where.push("(u.username LIKE ? COLLATE NOCASE OR u.display_name LIKE ? OR CAST(o.id AS TEXT) = ?)");
        args.push(`%${q}%`, `%${q}%`, q);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const total = Number(
        db.prepare(`SELECT COUNT(*) AS n FROM orders o JOIN users u ON u.id = o.user_id ${whereSql}`).get(...args)?.n ?? 0
      );
      const rows = db
        .prepare(
          `SELECT o.*, u.username, u.display_name FROM orders o JOIN users u ON u.id = o.user_id
           ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
        )
        .all(...args, pageSize, (page - 1) * pageSize);
      sendJson(res, 200, {
        total,
        page,
        pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
        items: rows.map((row) => ({
          ...orderPublic(row),
          username: row.username,
          displayName: row.display_name || row.username
        }))
      });
      return;
    }

    const orderConfirm = /^\/api\/admin\/orders\/(\d+)\/confirm$/.exec(pathname);
    if (method === "POST" && orderConfirm) {
      const orderId = Number(orderConfirm[1]);
      const body = await readJson(req);
      const result = transaction(db, () =>
        confirmOrder(db, orderId, {
          actorId: ctx.auth.user.id,
          providerRef: body.providerRef || null,
          note: body.note || "管理员确认收款"
        })
      );
      adminAudit(ctx, "order_confirm", "order", orderId, {
        plan: result.order.plan,
        amountCents: result.order.amount_cents
      });
      sendJson(res, 200, {
        order: orderPublic(result.order),
        entitlement: result.entitlement
      });
      return;
    }

    const orderCancel = /^\/api\/admin\/orders\/(\d+)\/cancel$/.exec(pathname);
    if (method === "POST" && orderCancel) {
      const orderId = Number(orderCancel[1]);
      const body = await readJson(req);
      const order = transaction(db, () => cancelOrder(db, orderId, { actorId: ctx.auth.user.id, note: body.note || "管理员取消" }));
      adminAudit(ctx, "order_cancel", "order", orderId, {});
      sendJson(res, 200, { order: orderPublic(order) });
      return;
    }

    if (method === "GET" && pathname === "/api/admin/redeem-codes") {
      const params = ctx.url.searchParams;
      const page = Math.max(1, Number(params.get("page")) || 1);
      const pageSize = clampInt(params.get("pageSize"), 1, 100, 30);
      const status = params.get("status") || "";
      const where = [];
      const args = [];
      if (status === "unused") where.push("r.used_at IS NULL");
      if (status === "used") where.push("r.used_at IS NOT NULL");
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM redeem_codes r ${whereSql}`).get(...args)?.n ?? 0);
      const rows = db
        .prepare(
          `SELECT r.*, u.username AS used_username, u.display_name AS used_display_name
           FROM redeem_codes r LEFT JOIN users u ON u.id = r.used_by
           ${whereSql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
        )
        .all(...args, pageSize, (page - 1) * pageSize);
      sendJson(res, 200, {
        total,
        page,
        pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
        items: rows.map((row) => ({
          code: row.code,
          plan: row.plan,
          planName: PLANS[row.plan]?.name || row.plan,
          createdAt: row.created_at,
          usedAt: row.used_at || null,
          usedBy: row.used_by ? Number(row.used_by) : null,
          usedUsername: row.used_username || null,
          usedDisplayName: row.used_display_name || null,
          note: row.note || null
        }))
      });
      return;
    }

    if (method === "POST" && pathname === "/api/admin/redeem-codes") {
      const body = await readJson(req);
      const plan = body.plan;
      if (!PLANS[plan]) throw badRequest("未知套餐", "bad_plan");
      const count = clampInt(body.count, 1, 100, 1);
      const codes = transaction(db, () =>
        createRedeemCodes(db, { plan, count, actorId: ctx.auth.user.id, note: body.note || null })
      );
      adminAudit(ctx, "redeem_code_create", "redeem_code", null, { plan, count });
      sendJson(res, 201, { codes, plan, planName: PLANS[plan].name });
      return;
    }

    if (method === "GET" && pathname === "/api/admin/audit") {
      const params = ctx.url.searchParams;
      const page = Math.max(1, Number(params.get("page")) || 1);
      const pageSize = clampInt(params.get("pageSize"), 1, 100, 30);
      const total = Number(db.prepare("SELECT COUNT(*) AS n FROM audit_log").get()?.n ?? 0);
      const rows = db
        .prepare(
          `SELECT a.*, u.username, u.display_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
           ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`
        )
        .all(pageSize, (page - 1) * pageSize);
      let items = rows.map((row) => {
        let detail = null;
        if (row.detail) {
          try {
            detail = JSON.parse(row.detail);
          } catch {
            detail = row.detail;
          }
        }
        return {
          id: Number(row.id),
          actorId: row.actor_id ? Number(row.actor_id) : null,
          actorUsername: row.username || null,
          actorDisplayName: row.display_name || null,
          action: row.action,
          targetType: row.target_type || null,
          targetId: row.target_id || null,
          detail,
          ip: row.ip || null,
          createdAt: row.created_at
        };
      });
      sendJson(res, 200, {
        total,
        page,
        pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
        items
      });
      return;
    }

    throw notFound("接口不存在", "not_found");
  }

  throw notFound("接口不存在", "not_found");
}
