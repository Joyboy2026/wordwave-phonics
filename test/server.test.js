import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConfig } from "../server/config.js";
import { openDatabase } from "../server/db.js";
import { createWordwaveServer } from "../server/app.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wordwave-test-"));
const config = createConfig({
  dataDir: tmp,
  port: 0,
  host: "127.0.0.1",
  paymentMode: "mock",
  timezone: "Asia/Shanghai",
  adminUsername: "admin",
  adminPassword: "AdminPass123",
  studyDailyCapMinutes: 12
});
const db = openDatabase(config.dbFile);
const app = createWordwaveServer({ config, db, logger: { log() {}, error() {} } });
let base = "";

function cookieOf(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const first = raw[0] || res.headers.get("set-cookie") || "";
  return first.split(";")[0];
}

async function api(pathname, { method = "GET", body, cookie, csrf, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (cookie) h.cookie = cookie;
  if (csrf) h["x-csrf-token"] = csrf;
  const res = await fetch(base + pathname, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, headers: res.headers, json, text, cookie: cookieOf(res) };
}

async function login(username, password) {
  const res = await api("/api/auth/login", { method: "POST", body: { username, password } });
  assert.equal(res.status, 200, res.text);
  return { cookie: res.cookie, csrf: res.json.csrfToken, user: res.json.user, body: res.json };
}

test.before(async () => {
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

test.after(() => {
  app.server.close();
  clearInterval(app.cleanupInterval);
  try {
    db.close();
  } catch {
    // ignore
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("health and plans are public", async () => {
  const health = await api("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.json.ok, true);

  const plans = await api("/api/plans");
  assert.equal(plans.status, 200);
  assert.equal(plans.json.plans.length, 2);
  const monthly = plans.json.plans.find((plan) => plan.id === "monthly");
  assert.equal(monthly.priceCents, 500);
  assert.equal(plans.json.plans.find((plan) => plan.id === "lifetime").priceCents, 3900);
});

test("register, me, logout", async () => {
  const short = await api("/api/auth/register", { method: "POST", body: { username: "x", password: "short" } });
  assert.equal(short.status, 400);

  const res = await api("/api/auth/register", {
    method: "POST",
    body: { username: "alice", password: "AlicePass123", displayName: "Alice" }
  });
  assert.equal(res.status, 201, res.text);
  assert.equal(res.json.user.username, "alice");
  assert.equal(res.json.user.role, "user");
  assert.ok(res.json.csrfToken);
  assert.ok(res.cookie.startsWith("ww_session="));

  const me = await api("/api/auth/me", { cookie: res.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.entitlement.active, false);

  const out = await api("/api/auth/logout", { method: "POST", cookie: res.cookie, csrf: res.json.csrfToken });
  assert.equal(out.status, 200);

  const after = await api("/api/auth/me", { cookie: res.cookie });
  assert.equal(after.status, 401);
});

test("paywall, CSRF and origin protection", async () => {
  const alice = await login("alice", "AlicePass123");

  const data = await api("/api/me/data", { cookie: alice.cookie });
  assert.equal(data.status, 402);
  assert.equal(data.json.error, "subscription_required");

  const noCsrf = await api("/api/me/heartbeat", { method: "POST", cookie: alice.cookie, body: { seconds: 30 } });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.json.error, "bad_csrf");

  const badOrigin = await api("/api/me/heartbeat", {
    method: "POST",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { seconds: 30 },
    headers: { origin: "https://evil.example" }
  });
  assert.equal(badOrigin.status, 403);
  assert.equal(badOrigin.json.error, "bad_origin");
});

test("mock payment grants monthly and unlocks sync", async () => {
  const alice = await login("alice", "AlicePass123");
  const created = await api("/api/orders", {
    method: "POST",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { plan: "monthly" }
  });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.json.order.amountCents, 500);
  assert.equal(created.json.order.status, "pending");

  const paid = await api(`/api/orders/${created.json.order.id}/pay`, {
    method: "POST",
    cookie: alice.cookie,
    csrf: alice.csrf
  });
  assert.equal(paid.status, 200, paid.text);
  assert.equal(paid.json.entitlement.active, true);
  assert.equal(paid.json.entitlement.plan, "monthly");

  const put = await api("/api/me/data/wordwave.progress.v1", {
    method: "PUT",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { value: JSON.stringify({ stage: 3, stars: 12 }) }
  });
  assert.equal(put.status, 200, put.text);

  const got = await api("/api/me/data", { cookie: alice.cookie });
  assert.equal(got.status, 200);
  assert.deepEqual(JSON.parse(got.json.data["wordwave.progress.v1"]), { stage: 3, stars: 12 });
  assert.ok(Number.isFinite(Date.parse(got.json.updatedAt["wordwave.progress.v1"])));

  const badKey = await api("/api/me/data/evil.key", {
    method: "PUT",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { value: "{}" }
  });
  assert.equal(badKey.status, 400);
});

test("user data is isolated between members", async () => {
  const bob = await api("/api/auth/register", {
    method: "POST",
    body: { username: "bob", password: "BobPass123", displayName: "Bob" }
  });
  assert.equal(bob.status, 201, bob.text);
  const bobLogin = await login("bob", "BobPass123");

  const create = await api("/api/orders", {
    method: "POST",
    cookie: bobLogin.cookie,
    csrf: bobLogin.csrf,
    body: { plan: "lifetime" }
  });
  await api(`/api/orders/${create.json.order.id}/pay`, {
    method: "POST",
    cookie: bobLogin.cookie,
    csrf: bobLogin.csrf
  });

  const bobData = await api("/api/me/data", { cookie: bobLogin.cookie });
  assert.equal(bobData.status, 200);
  assert.equal(bobData.json.data["wordwave.progress.v1"], undefined);

  const bobPut = await api("/api/me/data/wordwave.progress.v1", {
    method: "PUT",
    cookie: bobLogin.cookie,
    csrf: bobLogin.csrf,
    body: { value: JSON.stringify({ stage: 99 }) }
  });
  assert.equal(bobPut.status, 200);

  const alice = await login("alice", "AlicePass123");
  const aliceData = await api("/api/me/data", { cookie: alice.cookie });
  assert.deepEqual(JSON.parse(aliceData.json.data["wordwave.progress.v1"]), { stage: 3, stars: 12 });
});

test("study heartbeat caps each beat and the daily total", async () => {
  const alice = await login("alice", "AlicePass123");
  const first = await api("/api/me/heartbeat", {
    method: "POST",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { seconds: 5000, module: "phonics" }
  });
  assert.equal(first.status, 200, first.text);
  assert.equal(first.json.addedSeconds, 120);
  assert.equal(first.json.todaySeconds, 120);

  for (let i = 0; i < 5; i += 1) {
    await api("/api/me/heartbeat", {
      method: "POST",
      cookie: alice.cookie,
      csrf: alice.csrf,
      body: { seconds: 120, module: i % 2 ? "ipa" : "phonics" }
    });
  }
  const capped = await api("/api/me/heartbeat", {
    method: "POST",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { seconds: 120, module: "ocr" }
  });
  assert.equal(capped.status, 200);
  assert.equal(capped.json.addedSeconds, 0);
  assert.equal(capped.json.todaySeconds, 720);

  const overview = await api("/api/me/overview", { cookie: alice.cookie });
  assert.equal(overview.status, 200);
  assert.equal(overview.json.study.todaySeconds, 720);
  assert.ok(overview.json.study.modules.some((item) => item.module === "phonics"));
});

test("admin can manage users and see study statistics", async () => {
  const admin = await login("admin", "AdminPass123");
  assert.equal(admin.user.role, "admin");

  const list = await api("/api/admin/users?q=alice", { cookie: admin.cookie });
  assert.equal(list.status, 200);
  assert.equal(list.json.total, 1);
  assert.equal(list.json.items[0].study.todaySeconds, 720);

  const created = await api("/api/admin/users", {
    method: "POST",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { username: "carol", displayName: "Carol" }
  });
  assert.equal(created.status, 201, created.text);
  assert.ok(created.json.initialPassword);
  assert.equal(created.json.user.role, "user");

  const carolLogin = await login("carol", created.json.initialPassword);
  assert.equal(carolLogin.user.username, "carol");

  const detail = await api(`/api/admin/users/${created.json.user.id}`, { cookie: admin.cookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.user.username, "carol");
  assert.equal(detail.json.entitlement.active, false);

  const grant = await api(`/api/admin/users/${created.json.user.id}/subscription`, {
    method: "POST",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { action: "grant", plan: "monthly" }
  });
  assert.equal(grant.status, 200, grant.text);
  assert.equal(grant.json.entitlement.active, true);

  const study = await api(`/api/admin/users/${created.json.user.id}/study?days=7`, { cookie: admin.cookie });
  assert.equal(study.status, 200);
  assert.equal(study.json.daily.length, 7);

  const patch = await api(`/api/admin/users/${created.json.user.id}`, {
    method: "PATCH",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { displayName: "Carol C", status: "disabled" }
  });
  assert.equal(patch.status, 200, patch.text);
  assert.equal(patch.json.user.status, "disabled");

  const disabledLogin = await api("/api/auth/login", {
    method: "POST",
    body: { username: "carol", password: created.json.initialPassword }
  });
  assert.equal(disabledLogin.status, 403);
  assert.equal(disabledLogin.json.error, "account_disabled");

  const remove = await api(`/api/admin/users/${created.json.user.id}`, {
    method: "DELETE",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { confirmUsername: "carol" }
  });
  assert.equal(remove.status, 200, remove.text);

  const gone = await api("/api/admin/users?q=carol", { cookie: admin.cookie });
  assert.equal(gone.json.total, 0);
});

test("admin order confirmation is idempotent and immutable amounts", async () => {
  const admin = await login("admin", "AdminPass123");
  const alice = await login("alice", "AlicePass123");

  const created = await api("/api/orders", {
    method: "POST",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { plan: "monthly", amountCents: 1 }
  });
  assert.equal(created.json.order.amountCents, 500);

  const confirmed = await api(`/api/admin/orders/${created.json.order.id}/confirm`, {
    method: "POST",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: {}
  });
  assert.equal(confirmed.status, 200, confirmed.text);
  assert.equal(confirmed.json.order.status, "paid");

  const again = await api(`/api/admin/orders/${created.json.order.id}/confirm`, {
    method: "POST",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: {}
  });
  assert.equal(again.status, 200);
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = (SELECT user_id FROM orders WHERE id = ?)")
    .get(created.json.order.id);
  assert.ok(Number(count.n) >= 1);
});

test("redeem codes grant access and lifetime blocks further purchases", async () => {
  const admin = await login("admin", "AdminPass123");
  const dave = await api("/api/auth/register", {
    method: "POST",
    body: { username: "dave", password: "DavePass123", displayName: "Dave" }
  });
  assert.equal(dave.status, 201, dave.text);
  const codes = await api("/api/admin/redeem-codes", {
    method: "POST",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { plan: "lifetime", count: 2, note: "test" }
  });
  assert.equal(codes.status, 201, codes.text);
  assert.equal(codes.json.codes.length, 2);

  const daveLogin = await login("dave", "DavePass123");
  const redeemed = await api("/api/redeem", {
    method: "POST",
    cookie: daveLogin.cookie,
    csrf: daveLogin.csrf,
    body: { code: codes.json.codes[0] }
  });
  assert.equal(redeemed.status, 200, redeemed.text);

  const reused = await api("/api/redeem", {
    method: "POST",
    cookie: daveLogin.cookie,
    csrf: daveLogin.csrf,
    body: { code: codes.json.codes[0] }
  });
  assert.equal(reused.status, 409);

  const buy = await api("/api/orders", {
    method: "POST",
    cookie: daveLogin.cookie,
    csrf: daveLogin.csrf,
    body: { plan: "monthly" }
  });
  assert.equal(buy.status, 409, buy.text);
  assert.equal(buy.json.error, "already_lifetime");

  const list = await api("/api/admin/redeem-codes?status=used", { cookie: admin.cookie });
  assert.equal(list.status, 200);
  assert.equal(list.json.total, 1);
  assert.equal(list.json.items[0].usedUsername, "dave");
});

test("password change revokes previous sessions", async () => {
  const alice = await login("alice", "AlicePass123");
  const changed = await api("/api/me/password", {
    method: "POST",
    cookie: alice.cookie,
    csrf: alice.csrf,
    body: { currentPassword: "AlicePass123", newPassword: "AlicePass456" }
  });
  assert.equal(changed.status, 200, changed.text);
  assert.ok(changed.cookie);

  const oldSession = await api("/api/auth/me", { cookie: alice.cookie });
  assert.equal(oldSession.status, 401);

  const newSession = await api("/api/auth/me", { cookie: changed.cookie });
  assert.equal(newSession.status, 200);
});

test("admin self-protection and RBAC", async () => {
  const admin = await login("admin", "AdminPass123");
  const demote = await api(`/api/admin/users/${admin.user.id}`, {
    method: "PATCH",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { role: "user" }
  });
  assert.equal(demote.status, 403);
  assert.equal(demote.json.error, "self_demote");

  const remove = await api(`/api/admin/users/${admin.user.id}`, {
    method: "DELETE",
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { confirmUsername: "admin" }
  });
  assert.equal(remove.status, 403);
  assert.equal(remove.json.error, "self_delete");

  const alice = await login("alice", "AlicePass456");
  const forbidden = await api("/api/admin/overview", { cookie: alice.cookie });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.json.error, "admin_required");
});

test("overview includes learning totals and audit log records admin actions", async () => {
  const admin = await login("admin", "AdminPass123");
  const overview = await api("/api/admin/overview?days=7", { cookie: admin.cookie });
  assert.equal(overview.status, 200);
  assert.ok(overview.json.totals.users >= 3);
  assert.equal(overview.json.daily.length, 7);
  assert.ok(overview.json.topLearners.length >= 1);

  const audit = await api("/api/admin/audit?pageSize=100", { cookie: admin.cookie });
  assert.equal(audit.status, 200);
  assert.ok(audit.json.items.some((item) => item.action === "user_create"));
  assert.ok(audit.json.items.some((item) => item.action === "order_confirm"));
});

test("static files are served and server internals are blocked", async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /WordWave|WORDWAVE/i);

  const blocked = await fetch(`${base}/server/app.js`);
  assert.equal(blocked.status, 404);

  const blocked2 = await fetch(`${base}/data/wordwave.db`);
  assert.equal(blocked2.status, 404);
});
