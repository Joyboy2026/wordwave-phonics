/* WORDWAVE account gate, paywall, account panel and per-user sync.
 * Loaded before the main app script so the app reads a user-scoped namespace.
 * This is a UX gate + server-side API protection; static assets themselves
 * cannot be made secret in a browser-only deployment.
 */
(() => {
  "use strict";

  const API = "/api";
  const CACHE_KEY = "wordwave.account.cache.v1";
  const BOOT_USER_KEY = "wordwave.boot.user";
  const HYDRATE_RELOAD_KEY = "wordwave.hydrate.reloaded";
  const DATA_KEYS = [
    "wordwave.progress.v1",
    "wordwave.wordlab.v1",
    "wordwave.ipa.v1",
    "wordwave.browse.v1",
    "wordwave.ocr.v1",
    "wordwave.ocr.history.v1"
  ];
  const ORDER_STATUS = { pending: "待支付", paid: "已支付", cancelled: "已取消", refunded: "已退款" };
  const STATIC_PAGE = /\.github\.io$/i.test(location.hostname);
  const STATIC_MODE = STATIC_PAGE || new URLSearchParams(location.search).has("static");
  const DEPLOY_DOC = "https://github.com/Joyboy2026/wordwave-phonics/blob/main/DEPLOY.md";
  const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
  const HEARTBEAT_MS = 45000;
  const SYNC_DEBOUNCE_MS = 900;

  const state = {
    user: null,
    entitlement: null,
    csrf: "",
    plans: [],
    paymentMode: "manual",
    study: null,
    orders: [],
    order: null,
    payment: null,
    mode: "loading",
    error: "",
    notice: "",
    busy: false,
    appOpen: false,
    offline: false,
    syncing: false,
    syncError: false,
    overviewLoaded: false,
    overviewLoading: false
  };

  function readCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (raw && raw.user && Number.isFinite(Number(raw.user.id))) return raw;
    } catch {
      /* ignore */
    }
    return null;
  }

  function writeCache() {
    if (!state.user) return;
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          user: state.user,
          entitlement: state.entitlement,
          at: Date.now()
        })
      );
    } catch {
      /* private mode */
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(BOOT_USER_KEY);
      sessionStorage.removeItem(HYDRATE_RELOAD_KEY);
    } catch {
      /* ignore */
    }
  }

  const cached = STATIC_MODE ? null : readCache();
  if (cached) {
    state.user = cached.user;
    state.entitlement = cached.entitlement || null;
  }

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      if (char === '"') return "&quot;";
      return "&#39;";
    });

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total < 60) return `${total} 秒`;
    const minutes = Math.floor(total / 60);
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function scopedKey(key) {
    return state.user ? `ww.u${state.user.id}.${key}` : key;
  }

  const SYNC_META_KEY = "wordwave.sync.meta.v1";

  function readSyncMeta() {
    try {
      const raw = JSON.parse(localStorage.getItem(scopedKey(SYNC_META_KEY)) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeSyncMeta(meta) {
    try {
      localStorage.setItem(scopedKey(SYNC_META_KEY), JSON.stringify(meta));
    } catch {
      /* quota / private mode */
    }
  }

  function stampSync(key, at = Date.now()) {
    if (!state.user) return;
    const meta = readSyncMeta();
    // Never move a key's stamp backwards: a PUT response can arrive after a
    // newer local edit, and lowering the stamp would let the older server
    // value win on the next hydrate.
    meta[key] = Math.max(Number(meta[key]) || 0, Number(at) || Date.now());
    writeSyncMeta(meta);
  }

  function clearSyncStamp(key) {
    if (!state.user) return;
    const meta = readSyncMeta();
    delete meta[key];
    writeSyncMeta(meta);
  }

  function isEntitled() {
    if (!state.user) return false;
    if (state.user.role === "admin") return true;
    return Boolean(state.entitlement && state.entitlement.active);
  }

  async function api(pathname, { method = "GET", body, csrf = false } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (csrf) headers["x-csrf-token"] = state.csrf;
    const response = await fetch(API + pathname, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { response, data, status: response.status, ok: response.ok };
  }

  function errorMessage(result, fallback) {
    if (result && result.data && result.data.message) return result.data.message;
    if (result && result.status === 429) return "操作太频繁，请稍后再试。";
    if (result && result.status === 0) return "无法连接服务器，请检查网络。";
    return fallback || "操作失败，请稍后再试。";
  }

  // ---------- DOM shell ----------

  const gate = document.createElement("div");
  gate.className = "ww-gate";
  gate.id = "ww-gate";
  gate.hidden = true;
  gate.innerHTML = `
    <div class="ww-gate-card" role="dialog" aria-modal="true" aria-labelledby="ww-title">
      <aside class="ww-side">
        <div class="ww-logo">
          <span class="ww-logo-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span><strong>WORDWAVE</strong><small>单词声波站 · ACCOUNT</small></span>
        </div>
        <div class="ww-side-copy">
          <h1>先登录，<br>再让单词<em>发声</em>。</h1>
          <p>账号用来保存每个成员自己的学习进度、音标练习和拍照记录。会员有效期内可无限学习。</p>
        </div>
        <ul class="ww-side-points">
          <li><b>01</b><span>一人一个学习空间</span></li>
          <li><b>02</b><span>月卡 ¥5 / 买断 ¥39</span></li>
          <li><b>03</b><span>管理员可查看学习时长</span></li>
        </ul>
      </aside>
      <section class="ww-main" id="ww-main" aria-busy="false"></section>
    </div>
  `;
  document.body.appendChild(gate);
  document.body.classList.add("ww-locked");

  const fab = document.createElement("button");
  fab.className = "ww-fab";
  fab.type = "button";
  fab.hidden = true;
  fab.innerHTML = '<span class="ww-fab-dot" aria-hidden="true"></span><span id="ww-fab-label">账号 · 今日 0 分钟</span>';
  fab.addEventListener("click", () => openAccount());
  document.body.appendChild(fab);

  const toastEl = document.createElement("div");
  toastEl.className = "ww-toast";
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  document.body.appendChild(toastEl);

  let toastTimer = 0;
  function toast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.classList.toggle("is-error", Boolean(isError));
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("is-show"), 3200);
  }

  const main = () => document.getElementById("ww-main");

  function updateFab() {
    if (!state.user) {
      fab.hidden = true;
      return;
    }
    fab.hidden = !state.appOpen;
    fab.classList.toggle("is-syncing", state.syncing);
    fab.classList.toggle("is-error", state.syncError);
    const today = state.study && Number(state.study.todaySeconds || 0);
    const label = document.getElementById("ww-fab-label");
    if (label) {
      const name = state.user.displayName || state.user.username;
      label.textContent = `${name} · 今日 ${Math.floor(today / 60)} 分钟`;
    }
  }

  function openGate(mode) {
    state.mode = mode || state.mode;
    document.body.classList.add("ww-locked");
    gate.hidden = false;
    fab.hidden = true;
    render();
    window.setTimeout(() => {
      const focusable = gate.querySelector("input, button, a");
      if (focusable) focusable.focus({ preventScroll: true });
    }, 30);
  }

  function closeGate() {
    gate.hidden = true;
    document.body.classList.remove("ww-locked");
    updateFab();
  }

  function openApp({ offline = false } = {}) {
    state.appOpen = true;
    state.offline = Boolean(offline);
    closeGate();
    startHeartbeat();
    if (offline) toast("当前离线：使用最近一次已验证的会员状态，记录会在联网后同步。");
    else if (state.syncError) toast("同步暂时失败，稍后会自动重试。", true);
  }

  function lockToLogin(message) {
    state.appOpen = false;
    stopHeartbeat();
    state.error = message || "";
    state.mode = "login";
    state.order = null;
    state.payment = null;
    openGate("login");
  }

  function lockToPaywall(message) {
    state.appOpen = false;
    stopHeartbeat();
    state.error = message || "";
    state.mode = "paywall";
    openGate("paywall");
  }

  function render() {
    if (!main()) return;
    if (state.mode === "login") renderLogin();
    else if (state.mode === "register") renderRegister();
    else if (state.mode === "paywall") renderPaywall();
    else if (state.mode === "account") renderAccount();
    else if (state.mode === "error") renderError();
    else renderLoading();
  }

  function setMain(html, { busy = false } = {}) {
    const node = main();
    node.innerHTML = html;
    node.setAttribute("aria-busy", busy ? "true" : "false");
  }

  // ---------- boot ----------

  async function boot() {
    if (STATIC_MODE) {
      enterStaticMode();
      return;
    }
    state.mode = "loading";
    state.error = "";
    openGate("loading");
    try {
      const result = await api("/auth/me");
      if (result.status === 401) {
        clearCache();
        state.user = null;
        state.entitlement = null;
        state.appOpen = false;
        state.mode = "login";
        render();
        return;
      }
      if (!result.ok || !result.data) {
        throw new Error(errorMessage(result, "无法验证登录状态"));
      }
      const data = result.data;
      const previousId = state.user ? Number(state.user.id) : null;
      const bootUser = (() => {
        try {
          return sessionStorage.getItem(BOOT_USER_KEY);
        } catch {
          return null;
        }
      })();
      state.user = data.user;
      state.entitlement = data.entitlement;
      state.csrf = data.csrfToken;
      state.plans = data.plans || [];
      state.paymentMode = data.paymentMode || "manual";
      state.study = data.study || null;
      writeCache();

      const expected = String(data.user.id);
      if (previousId !== Number(data.user.id) || bootUser !== expected) {
        try {
          sessionStorage.setItem(BOOT_USER_KEY, expected);
        } catch {
          /* ignore */
        }
        // The app script already read a different (or unscoped) namespace.
        // Reload before showing any learning data.
        window.location.reload();
        return;
      }

      if (isEntitled()) {
        const changed = await hydrateFromServer();
        if (changed) {
          let already = false;
          try {
            already = sessionStorage.getItem(HYDRATE_RELOAD_KEY) === "1";
          } catch {
            /* ignore */
          }
          if (!already) {
            try {
              sessionStorage.setItem(HYDRATE_RELOAD_KEY, "1");
            } catch {
              /* ignore */
            }
            window.location.reload();
            return;
          }
        }
        openApp();
      } else {
        state.appOpen = false;
        state.mode = "paywall";
        render();
      }
    } catch (error) {
      const grace = cached && cached.entitlement && cached.entitlement.active && Date.now() - Number(cached.at || 0) < OFFLINE_GRACE_MS;
      if (grace) {
        state.user = cached.user;
        state.entitlement = cached.entitlement;
        state.offline = true;
        openApp({ offline: true });
        return;
      }
      state.error = "无法连接服务器。请检查网络后重试；首次登录和付费需要联网。";
      state.mode = "error";
      render();
    }
  }

  async function hydrateFromServer() {
    const result = await api("/me/data");
    if (!result.ok || !result.data) return false;
    const rows = result.data.data || {};
    const serverStamps = result.data.updatedAt || {};
    const meta = readSyncMeta();
    let changed = false;
    const missing = [];
    for (const key of DATA_KEYS) {
      const localKey = scopedKey(key);
      let local = null;
      try {
        local = localStorage.getItem(localKey);
      } catch {
        /* ignore */
      }
      if (Object.prototype.hasOwnProperty.call(rows, key)) {
        const value = String(rows[key]);
        const serverStamp = Date.parse(serverStamps[key] || "") || 0;
        const localStamp = Number(meta[key]) || 0;
        // A local write made after the server copy wins, so offline progress
        // is not silently replaced by an older server snapshot.
        if (local !== null && localStamp > serverStamp) {
          queueSync(key, "put");
          continue;
        }
        if (local !== value) {
          try {
            localStorage.setItem(localKey, value);
            changed = true;
          } catch {
            /* quota */
          }
        }
        meta[key] = Math.max(localStamp, serverStamp);
      } else if (local !== null) {
        missing.push(key);
      }
    }
    writeSyncMeta(meta);
    for (const key of missing) queueSync(key, "put");
    return changed;
  }

  async function refreshMe({ silent = false } = {}) {
    const result = await api("/auth/me");
    if (result.status === 401) {
      lockToLogin("登录已过期，请重新登录。");
      return false;
    }
    if (!result.ok || !result.data) {
      if (!silent) toast(errorMessage(result, "刷新失败"), true);
      return false;
    }
    state.user = result.data.user;
    state.entitlement = result.data.entitlement;
    state.csrf = result.data.csrfToken;
    state.plans = result.data.plans || state.plans;
    state.paymentMode = result.data.paymentMode || state.paymentMode;
    state.study = result.data.study || state.study;
    writeCache();
    return true;
  }

  // ---------- login / register ----------

  function renderLoading() {
    setMain(`
      <p class="ww-kicker">WORDWAVE ACCOUNT</p>
      <h2 id="ww-title">正在验证登录…</h2>
      <div class="ww-spinner" aria-hidden="true"></div>
      <p class="ww-sub" style="text-align:center;">正在确认账号与会员状态，请稍候。</p>
      <div class="ww-foot"><span>学习数据按成员隔离</span><span>v1</span></div>
    `);
  }

  function enterStaticMode() {
    state.mode = "static";
    state.appOpen = true;
    document.body.classList.remove("ww-locked");
    gate.hidden = true;
    fab.hidden = true;
    if (document.getElementById("ww-static-pill")) return;
    const pill = document.createElement("div");
    pill.id = "ww-static-pill";
    pill.className = "ww-static-pill";
    pill.innerHTML =
      '<span>静态演示 · 学习记录仅存本机</span>' +
      '<a href="' + DEPLOY_DOC + '" target="_blank" rel="noopener">账号部署</a>' +
      '<button type="button" class="ww-static-pill-close" aria-label="关闭静态演示提示">×</button>';
    const close = pill.querySelector(".ww-static-pill-close");
    if (close) close.addEventListener("click", () => pill.remove());
    document.body.appendChild(pill);
  }

  function renderError() {
    setMain(`
      <p class="ww-kicker">CONNECTION</p>
      <h2 id="ww-title">暂时连接不上</h2>
      <p class="ww-sub">会员验证、登录和学习记录同步都需要服务器。请确认网络或让管理员检查服务是否启动。</p>
      ${state.error ? `<p class="ww-error">${esc(state.error)}</p>` : ""}
      <button class="ww-btn ww-btn-primary ww-btn-block" type="button" id="ww-retry">重新连接</button>
      <p class="ww-switch"><button class="ww-link" type="button" id="ww-clear">清除本机账号缓存</button></p>
    `);
    document.getElementById("ww-retry").addEventListener("click", () => boot());
    document.getElementById("ww-clear").addEventListener("click", () => {
      clearCache();
      window.location.reload();
    });
  }

  function renderLogin() {
    setMain(`
      <p class="ww-kicker">MEMBER SIGN IN</p>
      <h2 id="ww-title">登录后继续学习</h2>
      <p class="ww-sub">用你的 WORDWAVE 账号登录。会员有效期内可不限次使用全部学习模块。</p>
      ${state.error ? `<p class="ww-error" role="alert">${esc(state.error)}</p>` : ""}
      ${state.notice ? `<p class="ww-notice">${esc(state.notice)}</p>` : ""}
      <form id="ww-login-form" novalidate>
        <div class="ww-field">
          <label for="ww-login-user">用户名</label>
          <input id="ww-login-user" name="username" autocomplete="username" required maxlength="24" placeholder="2–24 位用户名">
        </div>
        <div class="ww-field">
          <label for="ww-login-pass">密码</label>
          <input id="ww-login-pass" name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="至少 8 位">
        </div>
        <button class="ww-btn ww-btn-primary ww-btn-block" type="submit" id="ww-login-submit">登录</button>
      </form>
      <p class="ww-switch">还没有账号？<button class="ww-link" type="button" id="ww-go-register">注册新成员</button></p>
      <p class="ww-switch"><button class="ww-link" type="button" id="ww-forgot">忘记密码？</button></p>
      <div class="ww-foot"><span>登录即表示同意仅将数据用于本平台学习</span><span>v1</span></div>
    `);
    const form = document.getElementById("ww-login-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.busy) return;
      const data = new FormData(form);
      state.busy = true;
      state.error = "";
      setMain(main().innerHTML, { busy: true });
      try {
        const result = await api("/auth/login", {
          method: "POST",
          body: { username: data.get("username"), password: data.get("password") }
        });
        if (!result.ok) {
          state.error = errorMessage(result, "登录失败");
          state.mode = "login";
          render();
          return;
        }
        acceptAuth(result.data, { reload: true });
      } catch {
        state.error = "无法连接服务器，请稍后再试。";
        state.mode = "login";
        render();
      } finally {
        state.busy = false;
      }
    });
    document.getElementById("ww-go-register").addEventListener("click", () => {
      state.error = "";
      state.notice = "";
      state.mode = "register";
      render();
    });
    document.getElementById("ww-forgot").addEventListener("click", () => {
      state.notice = "请联系管理员重置密码；管理员可在后台直接设置新密码。";
      state.error = "";
      render();
    });
  }

  function renderRegister() {
    setMain(`
      <p class="ww-kicker">NEW MEMBER</p>
      <h2 id="ww-title">创建学习账号</h2>
      <p class="ww-sub">注册后需要开通会员才能进入学习平台。每个账号的学习进度互相独立。</p>
      ${state.error ? `<p class="ww-error" role="alert">${esc(state.error)}</p>` : ""}
      <form id="ww-register-form" novalidate>
        <div class="ww-field">
          <label for="ww-reg-user">用户名</label>
          <input id="ww-reg-user" name="username" autocomplete="username" required maxlength="24" placeholder="2–24 位中文、字母、数字、_ 或 -">
          <span class="ww-hint">登录用，注册后管理员可协助修改。</span>
        </div>
        <div class="ww-field">
          <label for="ww-reg-name">昵称（可选）</label>
          <input id="ww-reg-name" name="displayName" maxlength="40" placeholder="显示在账号面板里">
        </div>
        <div class="ww-field">
          <label for="ww-reg-pass">密码</label>
          <input id="ww-reg-pass" name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="至少 8 位">
        </div>
        <div class="ww-field">
          <label for="ww-reg-pass2">确认密码</label>
          <input id="ww-reg-pass2" name="password2" type="password" autocomplete="new-password" required minlength="8" placeholder="再输入一次">
        </div>
        <button class="ww-btn ww-btn-primary ww-btn-block" type="submit">注册并查看会员方案</button>
      </form>
      <p class="ww-switch">已经有账号？<button class="ww-link" type="button" id="ww-go-login">返回登录</button></p>
      <div class="ww-foot"><span>注册不需要付费，开通会员后才可学习</span><span>v1</span></div>
    `);
    const form = document.getElementById("ww-register-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.busy) return;
      const data = new FormData(form);
      const password = String(data.get("password") || "");
      if (password !== String(data.get("password2") || "")) {
        state.error = "两次输入的密码不一致。";
        render();
        return;
      }
      state.busy = true;
      state.error = "";
      setMain(main().innerHTML, { busy: true });
      try {
        const result = await api("/auth/register", {
          method: "POST",
          body: {
            username: data.get("username"),
            displayName: data.get("displayName"),
            password
          }
        });
        if (!result.ok) {
          state.error = errorMessage(result, "注册失败");
          state.mode = "register";
          render();
          return;
        }
        acceptAuth(result.data, { reload: true });
      } catch {
        state.error = "无法连接服务器，请稍后再试。";
        state.mode = "register";
        render();
      } finally {
        state.busy = false;
      }
    });
    document.getElementById("ww-go-login").addEventListener("click", () => {
      state.error = "";
      state.mode = "login";
      render();
    });
  }

  function acceptAuth(data, { reload = false } = {}) {
    state.user = data.user;
    state.entitlement = data.entitlement;
    state.csrf = data.csrfToken;
    state.plans = data.plans || state.plans;
    state.paymentMode = data.paymentMode || state.paymentMode;
    state.study = data.study || null;
    state.error = "";
    state.notice = "";
    writeCache();
    try {
      sessionStorage.setItem(BOOT_USER_KEY, String(data.user.id));
    } catch {
      /* ignore */
    }
    if (reload && isEntitled()) {
      window.location.reload();
      return;
    }
    if (isEntitled()) {
      openApp();
      return;
    }
    state.mode = "paywall";
    render();
  }

  // ---------- paywall ----------

  function planCard(plan) {
    const best = plan.id === "lifetime";
    return `
      <div class="ww-plan${best ? " is-best" : ""}">
        ${plan.badge ? `<span class="ww-plan-badge">${esc(plan.badge)}</span>` : ""}
        <span class="ww-plan-name">${esc(plan.name)}</span>
        <span class="ww-plan-price">${esc(plan.priceText)}<small>${plan.periodDays ? ` / ${plan.periodDays} 天` : " / 永久"}</small></span>
        <span class="ww-plan-desc">${esc(plan.subtitle || "")}</span>
        <button class="ww-btn ${best ? "ww-btn-lime" : "ww-btn-dark"}" type="button" data-plan="${esc(plan.id)}">选择${esc(plan.name)}</button>
      </div>
    `;
  }

  function paymentBlock() {
    if (!state.order || !state.payment) return "";
    const order = state.order;
    const lines = (state.payment.lines || []).map((line) => `<li>${esc(line)}</li>`).join("");
    const mock = state.paymentMode === "mock";
    return `
      <div class="ww-order" aria-live="polite">
        <div class="ww-order-head"><span>订单 #${esc(order.id)} · ${esc(order.planName || order.plan)}</span><span>${esc(order.amountText)}</span></div>
        <ul class="ww-order-lines">${lines}</ul>
        <div class="ww-actions">
          ${
            mock
              ? `<button class="ww-btn ww-btn-primary" type="button" id="ww-mock-pay">模拟支付并开通</button>`
              : `<button class="ww-btn ww-btn-primary" type="button" id="ww-refresh-pay">我已转账，刷新状态</button>`
          }
          <button class="ww-btn" type="button" id="ww-cancel-order">取消订单</button>
        </div>
      </div>
    `;
  }

  function renderPaywall() {
    const user = state.user;
    if (!user) {
      state.mode = "login";
      renderLogin();
      return;
    }
    const plans = (state.plans && state.plans.length ? state.plans : [
      { id: "monthly", name: "月卡", subtitle: "30 天不限次学习", priceText: "¥5", periodDays: 30, badge: "先试一个月" },
      { id: "lifetime", name: "买断", subtitle: "一次付费，永久学习", priceText: "¥39", periodDays: null, badge: "最划算" }
    ]);
    const lifetime = state.entitlement && state.entitlement.lifetime;
    setMain(`
      <p class="ww-kicker">MEMBERSHIP</p>
      <h2 id="ww-title">开通会员，开始调频</h2>
      <p class="ww-sub">${esc(user.displayName || user.username)}，你的账号已创建。选择月卡或买断后即可进入学习平台；学习记录只属于你。</p>
      ${state.error ? `<p class="ww-error" role="alert">${esc(state.error)}</p>` : ""}
      ${state.notice ? `<p class="ww-notice">${esc(state.notice)}</p>` : ""}
      ${
        lifetime
          ? `<p class="ww-notice">你已买断，无需再次购买。刷新即可进入平台。</p>`
          : `<div class="ww-plans">${plans.map(planCard).join("")}</div>`
      }
      ${paymentBlock()}
      <div class="ww-section-title">有兑换码？</div>
      <form class="ww-inline" id="ww-redeem-form">
        <input name="code" placeholder="WW-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" maxlength="20" aria-label="兑换码">
        <button class="ww-btn" type="submit"${lifetime ? " disabled" : ""}>兑换</button>
      </form>
      <div class="ww-actions">
        <button class="ww-btn ww-btn-sm" type="button" id="ww-pay-refresh">刷新会员状态</button>
        <button class="ww-btn ww-btn-sm" type="button" id="ww-pay-logout">退出登录</button>
      </div>
      <p class="ww-hint" style="margin-top:10px;">${state.paymentMode === "mock" ? "当前为测试支付模式，仅用于本地验证。" : "当前为人工收款模式：转账后联系管理员，在后台确认订单即可开通。"}</p>
      <div class="ww-foot"><span>¥5 / 月 · ¥39 买断</span><span>一人一号，记录隔离</span></div>
    `);
    main()
      .querySelectorAll("[data-plan]")
      .forEach((button) => button.addEventListener("click", () => createOrder(button.getAttribute("data-plan"))));
    if (state.order && state.payment) {
      const mock = document.getElementById("ww-mock-pay");
      if (mock) mock.addEventListener("click", payMock);
      const refresh = document.getElementById("ww-refresh-pay");
      if (refresh) refresh.addEventListener("click", refreshPayment);
      const cancel = document.getElementById("ww-cancel-order");
      if (cancel) cancel.addEventListener("click", cancelOrder);
    }
    document.getElementById("ww-pay-refresh").addEventListener("click", refreshPayment);
    document.getElementById("ww-pay-logout").addEventListener("click", logout);
    const redeem = document.getElementById("ww-redeem-form");
    redeem.addEventListener("submit", redeemCode);
  }

  async function createOrder(plan) {
    if (state.busy) return;
    state.busy = true;
    state.error = "";
    try {
      const result = await api("/orders", { method: "POST", body: { plan }, csrf: true });
      if (!result.ok) {
        state.error = errorMessage(result, "创建订单失败");
        render();
        return;
      }
      state.order = result.data.order;
      state.payment = result.data.payment;
      state.paymentMode = result.data.paymentMode || state.paymentMode;
      render();
    } catch {
      state.error = "无法连接服务器，请稍后再试。";
      render();
    } finally {
      state.busy = false;
    }
  }

  async function payMock() {
    if (!state.order || state.busy) return;
    state.busy = true;
    state.error = "";
    try {
      const result = await api(`/orders/${encodeURIComponent(state.order.id)}/pay`, { method: "POST", csrf: true });
      if (!result.ok) {
        state.error = errorMessage(result, "支付失败");
        render();
        return;
      }
      state.entitlement = result.data.entitlement;
      writeCache();
      toast("支付成功，正在进入学习平台…");
      window.setTimeout(() => window.location.reload(), 650);
    } catch {
      state.error = "无法连接服务器，请稍后再试。";
      render();
    } finally {
      state.busy = false;
    }
  }

  async function refreshPayment() {
    const ok = await refreshMe({ silent: true });
    if (!ok) {
      render();
      return;
    }
    if (isEntitled()) {
      toast("会员已开通，正在进入学习平台…");
      window.setTimeout(() => window.location.reload(), 650);
      return;
    }
    state.notice = "暂未查到已确认的会员。若刚转账，请把订单号发给管理员确认。";
    render();
  }

  async function cancelOrder() {
    if (!state.order || state.busy) return;
    state.busy = true;
    try {
      const result = await api(`/orders/${encodeURIComponent(state.order.id)}/cancel`, { method: "POST", csrf: true });
      if (!result.ok) {
        state.error = errorMessage(result, "取消订单失败");
      } else {
        state.order = null;
        state.payment = null;
        state.notice = "订单已取消。";
      }
      render();
    } catch {
      state.error = "无法连接服务器，请稍后再试。";
      render();
    } finally {
      state.busy = false;
    }
  }

  async function redeemCode(event) {
    event.preventDefault();
    if (state.busy) return;
    const form = event.currentTarget;
    const code = String(new FormData(form).get("code") || "").trim();
    if (!code) return;
    state.busy = true;
    state.error = "";
    try {
      const result = await api("/redeem", { method: "POST", body: { code }, csrf: true });
      if (!result.ok) {
        state.error = errorMessage(result, "兑换失败");
        render();
        return;
      }
      state.entitlement = result.data.entitlement;
      state.order = null;
      state.payment = null;
      writeCache();
      toast("兑换成功，正在进入学习平台…");
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      state.error = "无法连接服务器，请稍后再试。";
      render();
    } finally {
      state.busy = false;
    }
  }

  // ---------- account panel ----------

  function renderAccount() {
    const user = state.user;
    if (!user) {
      lockToLogin();
      return;
    }
    const entitlement = state.entitlement || { active: false };
    const study = state.study || { todaySeconds: 0, totalSeconds: 0, sevenDaySeconds: 0, daily: [] };
    const orders = state.orders || [];
    const admin = user.role === "admin";
    setMain(`
      <div class="ww-account-head">
        <div class="ww-account-user">
          <span class="ww-avatar" aria-hidden="true">${esc(String(user.displayName || user.username).slice(0, 1).toUpperCase())}</span>
          <div><strong>${esc(user.displayName || user.username)}</strong><span>@${esc(user.username)}${admin ? " · 管理员" : ""}</span></div>
        </div>
        <span class="ww-pill${entitlement.active || admin ? "" : " is-off"}">${admin ? "管理员" : entitlement.lifetime ? "已买断" : entitlement.active ? "会员有效" : "未开通"}</span>
      </div>
      <p class="ww-sub">${admin ? "管理员账号可直接进入平台，并可查看成员学习统计。" : entitlement.lifetime ? "永久有效，学习记录会一直保留。" : entitlement.active ? `有效期至 ${esc(formatDate(entitlement.expiresAt))}。` : "会员已到期，续费后可继续学习。"}</p>
      <div class="ww-stats">
        <div class="ww-stat"><b>${esc(formatDuration(study.todaySeconds))}</b><span>今日学习</span></div>
        <div class="ww-stat"><b>${esc(formatDuration(study.sevenDaySeconds || 0))}</b><span>近 7 天</span></div>
        <div class="ww-stat"><b>${esc(formatDuration(study.totalSeconds))}</b><span>累计学习</span></div>
      </div>
      ${state.error ? `<p class="ww-error" role="alert">${esc(state.error)}</p>` : ""}
      ${state.notice ? `<p class="ww-notice">${esc(state.notice)}</p>` : ""}
      ${
        !isEntitled()
          ? `<button class="ww-btn ww-btn-primary ww-btn-block" type="button" id="ww-renew">${entitlement.active ? "查看会员" : "开通会员"}</button>`
          : ""
      }
      <div class="ww-section-title">最近订单</div>
      ${
        orders.length
          ? `<ul class="ww-list">${orders
              .slice(0, 5)
              .map(
                (order) =>
                  `<li><span>#${esc(order.id)} · ${esc(order.planName || order.plan)}</span><span>${esc(order.amountText)} · ${esc(ORDER_STATUS[order.status] || order.status)}<br><small>${esc(formatDate(order.createdAt))}</small></span></li>`
              )
              .join("")}</ul>`
          : `<p class="ww-hint">还没有订单。开通会员后，订单会显示在这里。</p>`
      }
      <div class="ww-section-title">修改密码</div>
      <form id="ww-password-form">
        <div class="ww-field"><label for="ww-cur-pass">当前密码</label><input id="ww-cur-pass" name="currentPassword" type="password" autocomplete="current-password" required minlength="8"></div>
        <div class="ww-field"><label for="ww-new-pass">新密码</label><input id="ww-new-pass" name="newPassword" type="password" autocomplete="new-password" required minlength="8"></div>
        <div class="ww-field"><label for="ww-new-pass2">确认新密码</label><input id="ww-new-pass2" name="newPassword2" type="password" autocomplete="new-password" required minlength="8"></div>
        <button class="ww-btn" type="submit">保存新密码</button>
      </form>
      <div class="ww-actions">
        <button class="ww-btn ww-btn-primary" type="button" id="ww-back-app">返回学习</button>
        ${admin ? `<a class="ww-btn" href="/admin">管理后台</a>` : ""}
        <button class="ww-btn" type="button" id="ww-account-logout">退出登录</button>
      </div>
      <div class="ww-foot"><span>数据仅属于 @${esc(user.username)}</span><span>${state.offline ? "离线" : "已同步"}</span></div>
    `);
    const renew = document.getElementById("ww-renew");
    if (renew) {
      renew.addEventListener("click", () => {
        state.mode = "paywall";
        state.error = "";
        render();
      });
    }
    document.getElementById("ww-back-app").addEventListener("click", () => {
      if (!isEntitled()) {
        lockToPaywall("会员已到期，请先续费。");
        return;
      }
      closeGate();
    });
    document.getElementById("ww-account-logout").addEventListener("click", logout);
    document.getElementById("ww-password-form").addEventListener("submit", changePassword);
    if (!state.overviewLoaded && !state.overviewLoading) loadOverview();
  }

  async function loadOverview() {
    if (state.overviewLoading) return;
    state.overviewLoading = true;
    const result = await api("/me/overview");
    state.overviewLoading = false;
    if (!result.ok || !result.data) return;
    state.overviewLoaded = true;
    state.user = result.data.user;
    state.entitlement = result.data.entitlement;
    state.study = result.data.study;
    state.orders = result.data.orders || [];
    state.csrf = result.data.csrfToken || state.csrf;
    state.plans = result.data.plans || state.plans;
    state.paymentMode = result.data.paymentMode || state.paymentMode;
    writeCache();
    if (state.mode === "account") render();
    if (!isEntitled() && state.mode === "account") {
      state.mode = "paywall";
      render();
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (state.busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (String(data.get("newPassword")) !== String(data.get("newPassword2"))) {
      state.error = "两次输入的新密码不一致。";
      render();
      return;
    }
    state.busy = true;
    state.error = "";
    try {
      const result = await api("/me/password", {
        method: "POST",
        csrf: true,
        body: {
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword")
        }
      });
      if (!result.ok) {
        state.error = errorMessage(result, "修改密码失败");
        render();
        return;
      }
      state.csrf = result.data.csrfToken;
      state.user = result.data.user;
      state.entitlement = result.data.entitlement;
      writeCache();
      state.notice = "密码已更新，其他设备上的登录已失效。";
      toast("密码已更新");
      render();
    } catch {
      state.error = "无法连接服务器，请稍后再试。";
      render();
    } finally {
      state.busy = false;
    }
  }

  async function openAccount() {
    if (!state.user) {
      state.mode = "login";
      openGate("login");
      return;
    }
    if (!isEntitled()) {
      state.mode = "paywall";
      openGate("paywall");
      return;
    }
    state.error = "";
    state.notice = "";
    state.mode = "account";
    state.overviewLoaded = false;
    openGate("account");
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", csrf: true });
    } catch {
      /* clearing local view still helps, but session may remain until expiry */
    }
    clearCache();
    state.user = null;
    state.entitlement = null;
    state.csrf = "";
    state.orders = [];
    state.study = null;
    window.location.reload();
  }

  // ---------- study heartbeat ----------

  let heartbeatTimer = 0;
  let lastBeatAt = Date.now();

  function currentModule() {
    const hash = window.location.hash || "#/";
    if (hash.startsWith("#/words")) return "wordlab";
    if (hash.startsWith("#/ipa")) return "ipa";
    if (hash.startsWith("#/ocr")) return "ocr";
    if (hash === "#/" || hash.startsWith("#/group/") || hash.startsWith("#/quiz")) return "phonics";
    return "other";
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    lastBeatAt = Date.now();
    heartbeatTimer = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    updateFab();
  }

  function stopHeartbeat() {
    if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
    document.removeEventListener("visibilitychange", onVisibility);
  }

  function onVisibility() {
    if (document.visibilityState === "visible") {
      lastBeatAt = Date.now();
    } else {
      flushSync();
    }
  }

  async function beat() {
    if (!state.appOpen || !isEntitled()) return;
    if (document.visibilityState !== "visible") {
      lastBeatAt = Date.now();
      return;
    }
    const seconds = Math.max(0, Math.min(120, Math.round((Date.now() - lastBeatAt) / 1000)));
    lastBeatAt = Date.now();
    if (seconds < 15) return;
    try {
      const result = await api("/me/heartbeat", {
        method: "POST",
        csrf: true,
        body: { seconds, module: currentModule() }
      });
      if (result.status === 401) {
        lockToLogin("登录已过期，请重新登录。");
        return;
      }
      if (result.status === 402) {
        lockToPaywall("会员已到期，请续费后继续学习。");
        return;
      }
      if (result.ok && result.data) {
        state.study = {
          ...(state.study || {}),
          todaySeconds: result.data.todaySeconds
        };
        updateFab();
      }
    } catch {
      // Offline: keep studying locally; sync will retry when online.
    }
  }

  // ---------- per-key sync ----------

  const syncQueue = new Map();
  let syncTimer = 0;
  let flushing = false;

  function updateSyncState() {
    state.syncing = syncQueue.size > 0 || flushing;
    if (!state.syncing && !state.syncError) updateFab();
    else updateFab();
  }

  function queueSync(key, action) {
    if (!DATA_KEYS.includes(key)) return;
    if (!state.user || !isEntitled()) return;
    syncQueue.set(key, action);
    state.syncing = true;
    updateFab();
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(flushSync, SYNC_DEBOUNCE_MS);
  }

  function touch(key) {
    if (!DATA_KEYS.includes(key)) return;
    if (!state.user || !isEntitled()) return;
    stampSync(key);
    queueSync(key, "put");
  }

  function removeKey(key) {
    if (!DATA_KEYS.includes(key)) return;
    if (!state.user || !isEntitled()) return;
    clearSyncStamp(key);
    syncQueue.set(key, "delete");
    state.syncing = true;
    updateFab();
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(flushSync, SYNC_DEBOUNCE_MS);
  }

  async function flushSync({ keepalive = false } = {}) {
    if (flushing || !state.user || !isEntitled() || !syncQueue.size) return;
    flushing = true;
    state.syncing = true;
    updateFab();
    const entries = Array.from(syncQueue.entries());
    syncQueue.clear();
    let requeue = false;
    for (const [key, action] of entries) {
      try {
        let result;
        if (action === "delete") {
          result = await api(`/me/data/${encodeURIComponent(key)}`, { method: "DELETE", csrf: true });
        } else {
          let value = null;
          try {
            value = localStorage.getItem(scopedKey(key));
          } catch {
            value = null;
          }
          if (value === null) continue;
          result = await api(`/me/data/${encodeURIComponent(key)}`, {
            method: "PUT",
            csrf: true,
            body: { value }
          });
          if (result.ok && result.data && result.data.updatedAt) {
            stampSync(key, Date.parse(result.data.updatedAt) || Date.now());
          }
        }
        if (result.status === 401) {
          lockToLogin("登录已过期，请重新登录。");
          return;
        }
        if (result.status === 402) {
          lockToPaywall("会员已到期，请续费后继续学习。");
          return;
        }
        if (!result.ok) {
          if (result.status === 413) {
            state.syncError = true;
            toast("学习记录超过服务器容量限制，部分内容未同步。", true);
          }
          requeue = true;
        }
      } catch {
        requeue = true;
      }
    }
    if (requeue) {
      for (const [key, action] of entries) if (!syncQueue.has(key)) syncQueue.set(key, action);
      state.syncError = true;
    } else {
      state.syncError = false;
    }
    flushing = false;
    state.syncing = false;
    updateFab();
    if (syncQueue.size) {
      clearTimeout(syncTimer);
      syncTimer = window.setTimeout(flushSync, 4000);
    } else if (!keepalive && !state.offline) {
      updateFab();
    }
  }

  function flushForUnload() {
    if (flushing || !syncQueue.size) return;
    for (const [key, action] of syncQueue.entries()) {
      const url = `${API}/me/data/${encodeURIComponent(key)}`;
      try {
        if (action === "delete") {
          fetch(url, {
            method: "DELETE",
            credentials: "same-origin",
            keepalive: true,
            headers: { "x-csrf-token": state.csrf }
          });
        } else {
          const value = localStorage.getItem(scopedKey(key));
          if (value === null) continue;
          fetch(url, {
            method: "PUT",
            credentials: "same-origin",
            keepalive: true,
            headers: { "Content-Type": "application/json", "x-csrf-token": state.csrf },
            body: JSON.stringify({ value })
          });
        }
      } catch {
        /* ignore */
      }
    }
    syncQueue.clear();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSync();
  });
  window.addEventListener("pagehide", flushForUnload);

  // ---------- public bridge for the main app ----------

  window.WWCloud = {
    key: scopedKey,
    touch,
    remove: removeKey,
    flush: () => flushSync(),
    user: () => state.user,
    isEntitled,
    openAccount
  };

  // Escape closes the account panel back to the app.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.mode === "account" && isEntitled() && !gate.hidden) {
      closeGate();
    }
  });

  // A safe fallback if boot never resolves (e.g. a hung request).
  window.setTimeout(() => {
    if (state.mode === "loading") {
      state.mode = "error";
      state.error = "验证登录超时。请检查服务器是否已启动。";
      render();
    }
  }, 15000);

  boot();
})();
