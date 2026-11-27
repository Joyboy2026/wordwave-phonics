import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env loader: existing process env always wins. */
export function loadDotEnv(file = path.join(ROOT, ".env")) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function asInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

export function createConfig(overrides = {}) {
  loadDotEnv();

  const dataDir = path.resolve(ROOT, overrides.dataDir ?? process.env.DATA_DIR ?? "data");
  const paymentModeRaw = String(overrides.paymentMode ?? process.env.PAYMENT_MODE ?? "manual").toLowerCase();
  const paymentMode = paymentModeRaw === "mock" ? "mock" : "manual";

  return {
    root: ROOT,
    dataDir,
    dbFile: path.resolve(overrides.dbFile ?? path.join(dataDir, "wordwave.db")),
    host: overrides.host ?? process.env.HOST ?? "0.0.0.0",
    port: asInt(overrides.port ?? process.env.PORT, 8787),
    sessionDays: Math.max(1, asInt(overrides.sessionDays ?? process.env.SESSION_DAYS, 30)),
    cookieName: "ww_session",
    cookieSecure: asBool(overrides.cookieSecure ?? process.env.COOKIE_SECURE, false),
    trustProxy: asBool(overrides.trustProxy ?? process.env.TRUST_PROXY, false),
    paymentMode,
    timezone: overrides.timezone ?? process.env.APP_TIMEZONE ?? "Asia/Shanghai",
    dailyCapSeconds:
      Math.max(1, asInt(overrides.studyDailyCapMinutes ?? process.env.STUDY_DAILY_CAP_MINUTES, 720)) * 60,
    adminUsername: overrides.adminUsername ?? process.env.ADMIN_USERNAME ?? "admin",
    adminPassword: overrides.adminPassword ?? process.env.ADMIN_PASSWORD ?? "",
    logRequests: Boolean(overrides.logRequests),
    ...overrides,
    // Keep critical resolved paths authoritative even if a caller passes partials.
    dataDir,
    dbFile: path.resolve(overrides.dbFile ?? path.join(dataDir, "wordwave.db"))
  };
}

export const PLANS = Object.freeze({
  monthly: {
    id: "monthly",
    name: "月卡",
    subtitle: "30 天不限次学习",
    priceCents: 500,
    priceText: "¥5",
    periodDays: 30,
    badge: "先试一个月"
  },
  lifetime: {
    id: "lifetime",
    name: "买断",
    subtitle: "一次付费，永久学习",
    priceCents: 3900,
    priceText: "¥39",
    periodDays: null,
    badge: "最划算"
  }
});

export function planList() {
  return Object.values(PLANS).map((plan) => ({ ...plan }));
}
