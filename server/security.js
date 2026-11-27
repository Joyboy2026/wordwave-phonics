import crypto from "node:crypto";

const SCRYPT = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64 });

export function scryptHash(password, salt = crypto.randomBytes(16)) {
  const derived = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 64 * 1024 * 1024
  });
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    derived.toString("base64")
  ].join("$");
}

export function verifyPassword(password, stored) {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = crypto.scryptSync(String(password), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export function addDaysIso(iso, days) {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
}

export function dayKey(date = new Date(), timeZone = "Asia/Shanghai") {
  // en-CA gives YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function daysBackKeys(days, timeZone = "Asia/Shanghai") {
  const out = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(dayKey(new Date(now - i * 86400000), timeZone));
  }
  return out;
}

export function normalizeUsername(value) {
  return String(value ?? "").trim();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,24}$/.test(username)) {
    return { ok: false, message: "用户名需为 2–24 位中文、字母、数字、下划线或短横线" };
  }
  return { ok: true, username };
}

export function validatePassword(value) {
  const password = String(value ?? "");
  if (password.length < 8 || password.length > 128) {
    return { ok: false, message: "密码需为 8–128 位" };
  }
  return { ok: true, password };
}

export function validateDisplayName(value, fallback = "") {
  const name = String(value ?? "").trim().slice(0, 40);
  return name || fallback;
}

export function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function formatCents(cents) {
  return `¥${(Number(cents || 0) / 100).toFixed(2).replace(/\.00$/, "")}`;
}
