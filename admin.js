/* WORDWAVE admin console.
 * All dynamic values are escaped before entering HTML. The server enforces
 * admin role, CSRF and session checks; this UI is not the security boundary.
 */
(() => {
  "use strict";

  const API = "/api";
  const VIEWS = ["overview", "users", "orders", "redeem", "audit"];
  const VIEW_TITLES = {
    overview: "概览",
    users: "用户管理",
    orders: "订单确认",
    redeem: "兑换码",
    audit: "审计日志"
  };
  const MODULE_LABELS = {
    phonics: "自然拼读",
    wordlab: "单词实验室",
    ipa: "音标",
    ocr: "拍照朗读",
    other: "其他"
  };
  const STATUS_LABELS = {
    active: "正常",
    disabled: "已停用",
    pending: "待确认",
    paid: "已支付",
    cancelled: "已取消",
    refunded: "已退款"
  };
  const ACTION_LABELS = {
    login: "登录",
    login_failed: "登录失败",
    logout: "退出",
    register: "注册",
    password_change: "修改密码",
    user_create: "创建用户",
    user_update: "更新用户",
    user_delete: "删除用户",
    subscription_grant: "开通会员",
    subscription_revoke: "撤销会员",
    order_create: "创建订单",
    order_pay_mock: "模拟支付",
    order_confirm: "确认订单",
    order_cancel: "取消订单",
    redeem_code_create: "生成兑换码",
    redeem: "兑换",
    heartbeat: "学习心跳"
  };

  const state = {
    user: null,
    csrf: "",
    plans: [],
    view: "overview",
    overview: { days: 7, data: null, loading: false, error: "" },
    users: { data: null, loading: false, error: "", q: "", role: "", status: "", paid: "", page: 1 },
    orders: { data: null, loading: false, error: "", q: "", status: "", page: 1 },
    redeem: { data: null, loading: false, error: "", status: "", page: 1 },
    audit: { data: null, loading: false, error: "", page: 1 },
    modalUserId: null,
    lastCodes: [],
    tempPassword: ""
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      if (char === '"') return "&quot;";
      return "&#39;";
    });
  }

  function fmtDate(value) {
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

  function fmtDay(value) {
    if (!value) return "";
    const parts = String(value).split("-");
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : String(value);
  }

  function duration(seconds, compact = false) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total < 60) return compact ? `${total}s` : `${total} 秒`;
    const minutes = Math.floor(total / 60);
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (compact) return rest ? `${hours}h${rest}m` : `${hours}h`;
    return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
  }

  function planName(plan) {
    return plan === "lifetime" ? "买断" : plan === "monthly" ? "月卡" : plan || "—";
  }

  function toast(message, isError = false) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.toggle("is-error", Boolean(isError));
    node.classList.add("is-show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("is-show"), 3200);
  }

  async function api(pathname, { method = "GET", body } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET" && state.csrf) headers["x-csrf-token"] = state.csrf;
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
    if (response.status === 401 && pathname !== "/auth/login" && pathname !== "/auth/me") {
      showLogin("登录已过期，请重新登录。");
    }
    return { ok: response.ok, status: response.status, data };
  }

  function messageOf(result, fallback) {
    return (result && result.data && result.data.message) || fallback;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("已复制到剪贴板");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        toast("已复制到剪贴板");
      } catch {
        toast("复制失败，请手动选择", true);
      }
      area.remove();
    }
  }

  // ---------- auth / shell ----------

  function showLogin(message) {
    state.user = null;
    $("#admin-app").hidden = true;
    $("#forbidden-view").hidden = true;
    $("#login-view").hidden = false;
    $("#login-error").textContent = message || "";
    const input = $('#login-view input[name="username"]');
    if (input) input.focus();
  }

  function showForbidden(data) {
    // The forbidden screen offers "退出并重新登录"; without a CSRF token that POST is rejected.
    state.csrf = (data && data.csrfToken) || state.csrf || "";
    $("#login-view").hidden = true;
    $("#admin-app").hidden = true;
    $("#forbidden-view").hidden = false;
    const who = data && data.user ? data.user.username : "";
    $("#forbidden-text").textContent = who
      ? `账号 @${who} 不是管理员。管理后台只接受管理员账号，请退出后换用管理员账号。`
      : "管理后台只接受管理员账号登录。请退出后换用管理员账号。";
  }

  function showApp(data) {
    state.user = data.user;
    state.csrf = data.csrfToken || "";
    state.plans = data.plans || [];
    $("#login-view").hidden = true;
    $("#forbidden-view").hidden = true;
    $("#admin-app").hidden = false;
    $("#side-name").textContent = state.user.displayName || state.user.username;
    $("#side-meta").textContent = `@${state.user.username}`;
    $("#side-avatar").textContent = String(state.user.displayName || state.user.username).slice(0, 1).toUpperCase();
  }

  async function boot() {
    try {
      const result = await api("/auth/me");
      if (result.status === 401 || !result.data || !result.data.user) {
        showLogin("");
        return;
      }
      if (result.data.user.role !== "admin") {
        showForbidden(result.data);
        return;
      }
      showApp(result.data);
      initNavigation();
    } catch {
      showLogin("无法连接服务器，请确认服务已经启动。");
    }
  }

  async function onLogin(event, form) {
    event.preventDefault();
    const data = new FormData(form);
    const errorNode = $("#login-error");
    const button = $("#login-submit");
    errorNode.textContent = "";
    button.disabled = true;
    button.textContent = "登录中…";
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: { username: data.get("username"), password: data.get("password") }
      });
      if (!result.ok || !result.data) {
        errorNode.textContent = messageOf(result, "登录失败，请检查用户名和密码。");
        return;
      }
      if (result.data.user.role !== "admin") {
        showForbidden(result.data);
        return;
      }
      showApp(result.data);
      initNavigation();
      toast("已登录管理后台");
    } catch {
      errorNode.textContent = "无法连接服务器，请稍后再试。";
    } finally {
      button.disabled = false;
      button.textContent = "登录管理后台";
    }
  }

  function initNavigation() {
    if (initNavigation.done) {
      loadView();
      return;
    }
    initNavigation.done = true;
    if (!location.hash || !VIEWS.includes(location.hash.replace(/^#\/?/, ""))) {
      history.replaceState(null, "", "#/overview");
    }
    window.addEventListener("hashchange", loadView);
    loadView();
  }

  function currentView() {
    const view = location.hash.replace(/^#\/?/, "");
    return VIEWS.includes(view) ? view : "overview";
  }

  function loadView() {
    if ($("#admin-app").hidden) return;
    state.view = currentView();
    $$("[data-nav]").forEach((link) => link.classList.toggle("is-active", link.dataset.nav === state.view));
    $("#topbar-title").textContent = VIEW_TITLES[state.view] || "概览";
    $("#admin-app").classList.remove("nav-open");
    if (state.view === "overview") renderOverview();
    else if (state.view === "users") renderUsers();
    else if (state.view === "orders") renderOrders();
    else if (state.view === "redeem") renderRedeem();
    else renderAudit();
  }

  function setView(html) {
    $("#view-root").innerHTML = html;
    wireChartHeights();
  }

  function wireChartHeights() {
    $$("[data-height]").forEach((node) => {
      node.style.setProperty("--h", `${node.dataset.height}%`);
    });
    $$("[data-width]").forEach((node) => {
      node.style.setProperty("--w", `${node.dataset.width}%`);
    });
  }

  function retryPanel(message, kind) {
    return `
      <div class="panel">
        <div class="empty">
          <b>数据加载失败</b>
          <p>${esc(message || "请稍后再试。")}</p>
          <button class="btn btn-sm" type="button" data-action="retry" data-kind="${esc(kind)}">重试</button>
        </div>
      </div>
    `;
  }

  function skeletonCards(count = 5) {
    return `<div class="metric-grid">${Array.from({ length: count }, () => '<div class="skeleton card"></div>').join("")}</div>
      <div class="panel"><div class="skeleton skeleton-chart"></div></div>`;
  }

  function pager(data, kind) {
    const page = Number(data.page || 1);
    const pages = Number(data.pages || 1);
    const total = Number(data.total || 0);
    return `
      <div class="pager">
        <span>共 ${total} 条 · 第 ${page}/${pages} 页</span>
        <button class="btn btn-sm" type="button" data-action="page" data-kind="${kind}" data-page="${page - 1}"${page <= 1 ? " disabled" : ""}>上一页</button>
        <button class="btn btn-sm" type="button" data-action="page" data-kind="${kind}" data-page="${page + 1}"${page >= pages ? " disabled" : ""}>下一页</button>
      </div>
    `;
  }

  function statusBadge(status, labelOverride) {
    const cls =
      status === "active" || status === "paid"
        ? "is-active"
        : status === "pending"
        ? "is-pending"
        : status === "disabled" || status === "cancelled" || status === "refunded"
        ? "is-off"
        : "";
    return `<span class="status ${cls}">${esc(labelOverride || STATUS_LABELS[status] || status)}</span>`;
  }

  function memberBadge(entitlement) {
    if (!entitlement || !entitlement.active) return '<span class="status is-off">未开通</span>';
    if (entitlement.lifetime) return '<span class="status is-lifetime">买断</span>';
    return `<span class="status is-paid">月卡 · ${Math.max(0, Number(entitlement.remainingDays) || 0)} 天</span>`;
  }

  function userCell(user) {
    const name = user.displayName || user.username;
    return `<div class="cell-user"><span class="avatar">${esc(String(name).slice(0, 1).toUpperCase())}</span><span><strong>${esc(name)}</strong><small>@${esc(user.username)}</small></span></div>`;
  }

  // ---------- overview ----------

  function renderOverview() {
    const box = state.overview;
    if (!box.data) {
      if (box.error) {
        setView(`<div class="page-head"><div><h1>学习运营概览</h1><p>账号、付费与学习时长总览。</p></div></div>${retryPanel(box.error, "overview")}`);
        return;
      }
      setView(
        `<div class="page-head"><div><h1>学习运营概览</h1><p>账号、付费与学习时长总览。</p></div></div>${skeletonCards(6)}`
      );
      loadOverview();
      return;
    }
    const data = box.data;
    const t = data.totals || {};
    const daily = data.daily || [];
    const maxSeconds = Math.max(1, ...daily.map((item) => Number(item.seconds) || 0));
    const modules = data.modules || [];
    const moduleTotal = modules.reduce((sum, item) => sum + Number(item.seconds || 0), 0);
    const top = data.topLearners || [];
    const recent = data.recentOrders || [];

    const bars = daily
      .map((item, index) => {
        const height = item.seconds > 0 ? Math.max(3, Math.round((item.seconds / maxSeconds) * 100)) : 2;
        const showLabel = daily.length <= 7 || (daily.length <= 14 ? index % 2 === 0 : index % 5 === 0);
        return `<div class="chart-col" title="${esc(item.day)} · ${esc(duration(item.seconds))} · ${Number(item.learners) || 0} 人">
          <span class="chart-value">${item.seconds >= 60 ? `${Math.round(item.seconds / 60)}m` : item.seconds ? "<1m" : ""}</span>
          <div class="chart-bar" data-height="${height}"></div>
          <span class="chart-label">${showLabel ? esc(fmtDay(item.day)) : ""}</span>
        </div>`;
      })
      .join("");

    const moduleRows = modules.length
      ? modules
          .map((item) => {
            const width = moduleTotal ? Math.round((Number(item.seconds) / moduleTotal) * 100) : 0;
            return `<div class="module-row"><span>${esc(MODULE_LABELS[item.module] || item.module)}</span>
              <span class="module-track"><i class="module-fill" data-width="${width}"></i></span>
              <span class="module-time">${esc(duration(item.seconds, true))}</span></div>`;
          })
          .join("")
      : '<p class="empty">所选时间段还没有学习记录。</p>';

    const topRows = top.length
      ? top
          .map(
            (item) =>
              `<li><span class="rank-index">${String(top.indexOf(item) + 1).padStart(2, "0")}</span>
                <span class="rank-name">${esc(item.displayName || item.username)}<small>@${esc(item.username)}</small></span>
                <span class="rank-time">${esc(duration(item.seconds))}</span></li>`
          )
          .join("")
      : '<li><span></span><span class="muted">暂无学习记录</span><span></span></li>';

    const recentRows = recent.length
      ? recent
          .map(
            (item) =>
              `<tr><td class="mono">#${esc(item.id)}</td><td>${userCell({ displayName: item.displayName, username: item.username })}</td>
                <td>${esc(planName(item.plan))}</td><td class="num">¥${(Number(item.amountCents) / 100).toFixed(2).replace(/\.00$/, "")}</td>
                <td>${statusBadge(item.status)}</td><td class="muted small">${esc(fmtDate(item.createdAt))}</td></tr>`
          )
          .join("")
      : '<tr><td colspan="6" class="empty">还没有订单。</td></tr>';

    setView(`
      <div class="page-head">
        <div><p class="kicker">OPERATIONS</p><h1>学习运营概览</h1><p>账号、付费与学习时长总览。所有时长按成员分别统计。</p></div>
        <div class="page-actions">
          <div class="segmented" aria-label="统计天数">
            ${[7, 14, 30].map((days) => `<button type="button" class="${box.days === days ? "is-active" : ""}" data-action="overview-days" data-days="${days}">${days} 天</button>`).join("")}
          </div>
          <button class="btn" type="button" data-action="refresh">刷新</button>
        </div>
      </div>
      <div class="metric-grid">
        <div class="metric accent-lime"><span>总成员</span><b>${esc(t.users)}</b><small>${esc(t.activeUsers)} 个正常账号</small></div>
        <div class="metric accent-blue"><span>有效付费</span><b>${esc(t.paidUsers)}</b><small>含买断与未到期月卡</small></div>
        <div class="metric accent-coral"><span>今日学习</span><b>${esc(duration(t.todaySeconds).replace(" ", ""))}</b><small>${esc(t.todayLearners)} 人今天学习过</small></div>
        <div class="metric"><span>累计学习</span><b>${esc(duration(t.totalSeconds).replace(" ", ""))}</b><small>全部成员累计</small></div>
        <div class="metric"><span>待确认订单</span><b>${esc(t.pendingOrders)}</b><small>人工收款需逐笔确认</small></div>
        <div class="metric"><span>7 日新增</span><b>${esc(t.newUsers7d)}</b><small>新注册成员</small></div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><div><h2>每日学习时长</h2><p>${box.days} 天内每天的总学习秒数</p></div><span class="tag">分钟</span></div>
          <div class="chart">${bars}</div>
          <div class="chart-foot"><span>每天由客户端心跳累计，单次上限 120 秒</span><span>最高 ${esc(duration(maxSeconds))}</span></div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>模块分布</h2><p>按学习模块拆分</p></div></div>
          <div class="module-list">${moduleRows}</div>
        </section>
      </div>
      <div class="grid-2 grid-2-even">
        <section class="panel">
          <div class="panel-head"><div><h2>近 7 日学习榜</h2><p>按累计学习时长排序</p></div></div>
          <ul class="rank-list">${topRows}</ul>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h2>最近订单</h2><p>创建时间倒序</p></div><a class="btn btn-sm" href="#/orders">全部订单</a></div>
          <div class="table-wrap"><table><thead><tr><th>订单</th><th>成员</th><th>套餐</th><th class="num">金额</th><th>状态</th><th>时间</th></tr></thead><tbody>${recentRows}</tbody></table></div>
        </section>
      </div>
    `);
  }

  async function loadOverview() {
    const box = state.overview;
    if (box.loading) return;
    box.loading = true;
    box.error = "";
    try {
      const result = await api(`/admin/overview?days=${box.days}`);
      if (!result.ok || !result.data) {
        box.error = messageOf(result, "无法加载概览数据。");
      } else {
        box.data = { ...result.data, days: box.days };
      }
    } catch {
      box.error = "无法连接服务器。";
    } finally {
      box.loading = false;
      if (state.view === "overview") renderOverview();
    }
  }

  function setOverviewDays(days) {
    const parsed = [7, 14, 30].includes(Number(days)) ? Number(days) : 7;
    if (state.overview.days === parsed) return;
    state.overview.days = parsed;
    state.overview.data = null;
    state.overview.error = "";
    renderOverview();
  }

  // ---------- users ----------

  function renderUsers() {
    const box = state.users;
    const head = `
      <div class="page-head">
        <div><p class="kicker">MEMBERS</p><h1>用户管理</h1><p>查看成员、重置密码、开通会员并核对学习时长。</p></div>
        <div class="page-actions"><button class="btn btn-primary" type="button" data-action="create-user">＋ 新建用户</button></div>
      </div>
      <form class="toolbar" data-form="user-filters">
        <label class="field search"><span>搜索</span><input name="q" value="${esc(box.q)}" placeholder="用户名或昵称" maxlength="40"></label>
        <label class="field"><span>角色</span><select name="role">
          <option value="">全部</option><option value="user"${box.role === "user" ? " selected" : ""}>成员</option><option value="admin"${box.role === "admin" ? " selected" : ""}>管理员</option>
        </select></label>
        <label class="field"><span>状态</span><select name="status">
          <option value="">全部</option><option value="active"${box.status === "active" ? " selected" : ""}>正常</option><option value="disabled"${box.status === "disabled" ? " selected" : ""}>已停用</option>
        </select></label>
        <label class="field"><span>会员</span><select name="paid">
          <option value="">全部</option><option value="1"${box.paid === "1" ? " selected" : ""}>有效付费</option>
        </select></label>
        <button class="btn" type="submit">筛选</button>
        <button class="btn btn-ghost" type="button" data-action="clear-user-filters">清空</button>
      </form>
    `;
    if (!box.data) {
      if (box.error) {
        setView(head + retryPanel(box.error, "users"));
        return;
      }
      setView(head + skeletonCards(4));
      loadUsers();
      return;
    }
    const items = box.data.items || [];
    const rows = items.length
      ? items
          .map((user) => {
            const study = user.study || {};
            return `<tr>
              <td>${userCell(user)}</td>
              <td>${user.role === "admin" ? '<span class="tag">管理员</span>' : '<span class="tag">成员</span>'}</td>
              <td>${statusBadge(user.status, user.status === "active" ? "正常" : "已停用")}</td>
              <td>${memberBadge(user.entitlement)}${user.pendingOrders ? ` <span class="tag">${user.pendingOrders} 待确认</span>` : ""}</td>
              <td class="num">${esc(duration(study.todaySeconds, true))}</td>
              <td class="num">${esc(duration(study.sevenDaySeconds, true))}</td>
              <td class="num">${esc(duration(study.totalSeconds, true))}</td>
              <td class="muted small">${esc(fmtDate(user.createdAt))}</td>
              <td><button class="btn btn-sm" type="button" data-action="user-detail" data-id="${Number(user.id)}">详情</button></td>
            </tr>`;
          })
          .join("")
      : '<tr><td colspan="9" class="empty">没有符合条件的用户。</td></tr>';

    setView(`
      ${head}
      <section class="panel">
        <div class="table-wrap"><table>
          <thead><tr><th>用户</th><th>角色</th><th>状态</th><th>会员</th><th class="num">今日</th><th class="num">7 日</th><th class="num">累计</th><th>注册时间</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${pager(box.data, "users")}
      </section>
    `);
  }

  async function loadUsers() {
    const box = state.users;
    if (box.loading) return;
    box.loading = true;
    box.error = "";
    const params = new URLSearchParams({
      q: box.q,
      role: box.role,
      status: box.status,
      paid: box.paid,
      page: String(box.page),
      pageSize: "20"
    });
    try {
      const result = await api(`/admin/users?${params}`);
      if (!result.ok || !result.data) box.error = messageOf(result, "无法加载用户列表。");
      else box.data = result.data;
    } catch {
      box.error = "无法连接服务器。";
    } finally {
      box.loading = false;
      if (state.view === "users") renderUsers();
    }
  }

  function applyUserFilters(form) {
    const data = new FormData(form);
    state.users.q = String(data.get("q") || "").trim();
    state.users.role = String(data.get("role") || "");
    state.users.status = String(data.get("status") || "");
    state.users.paid = String(data.get("paid") || "");
    state.users.page = 1;
    state.users.data = null;
    state.users.error = "";
    renderUsers();
  }

  function clearUserFilters() {
    Object.assign(state.users, { q: "", role: "", status: "", paid: "", page: 1, data: null, error: "" });
    renderUsers();
  }

  // ---------- user detail ----------

  async function openUser(id) {
    state.modalUserId = Number(id);
    openModal(
      `<div class="modal-head"><div><h2>成员详情</h2><p>正在加载账号与学习数据…</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div><div class="modal-body"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-block"></div></div>`,
      { wide: true }
    );
    try {
      const result = await api(`/admin/users/${Number(id)}`);
      if (state.modalUserId !== Number(id)) return;
      if (!result.ok || !result.data) {
        openModal(
          `<div class="modal-head"><div><h2>成员详情</h2><p>加载失败</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div><div class="modal-body"><p class="form-error">${esc(messageOf(result, "无法加载成员详情。"))}</p><button class="btn" type="button" data-action="user-detail" data-id="${Number(id)}">重试</button></div>`,
          { wide: true }
        );
        return;
      }
      renderUserModal(result.data);
    } catch {
      if (state.modalUserId !== Number(id)) return;
      openModal(
        `<div class="modal-head"><div><h2>成员详情</h2><p>网络错误</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div><div class="modal-body"><p class="form-error">无法连接服务器。</p></div>`,
        { wide: true }
      );
    }
  }

  function renderUserModal(data) {
    const user = data.user;
    const ent = data.entitlement || { active: false };
    const study = data.study || {};
    const daily = study.daily || [];
    const modules = study.modules || [];
    const subs = ent.subscriptions || [];
    const orders = data.orders || [];
    const dataSummary = data.data || [];
    const maxSeconds = Math.max(1, ...daily.map((item) => Number(item.seconds) || 0));
    const moduleTotal = modules.reduce((sum, item) => sum + Number(item.seconds || 0), 0);
    const bars = daily
      .map((item, index) => {
        const height = item.seconds > 0 ? Math.max(3, Math.round((item.seconds / maxSeconds) * 100)) : 2;
        return `<div class="chart-col" title="${esc(item.day)} · ${esc(duration(item.seconds))}"><div class="chart-bar" data-height="${height}"></div>
          <span class="chart-label">${daily.length <= 14 || index % 5 === 0 ? esc(fmtDay(item.day)) : ""}</span></div>`;
      })
      .join("");
    const moduleRows = modules.length
      ? modules
          .map((item) => {
            const width = moduleTotal ? Math.round((Number(item.seconds) / moduleTotal) * 100) : 0;
            return `<div class="module-row"><span>${esc(MODULE_LABELS[item.module] || item.module)}</span><span class="module-track"><i class="module-fill" data-width="${width}"></i></span><span class="module-time">${esc(duration(item.seconds, true))}</span></div>`;
          })
          .join("")
      : '<p class="muted small">最近 30 天没有学习记录。</p>';
    const subRows = subs.length
      ? subs
          .map(
            (sub) =>
              `<tr><td>${esc(planName(sub.plan))}</td><td>${esc(fmtDate(sub.startsAt))}</td><td>${sub.expiresAt ? esc(fmtDate(sub.expiresAt)) : "永久"}</td><td class="small muted">${esc(sub.note || "")}</td></tr>`
          )
          .join("")
      : '<tr><td colspan="4" class="empty">没有有效订阅。</td></tr>';
    const orderRows = orders.length
      ? orders
          .map(
            (order) =>
              `<tr><td class="mono">#${esc(order.id)}</td><td>${esc(planName(order.plan))}</td><td class="num">${esc(order.amountText)}</td><td>${statusBadge(order.status)}</td><td class="muted small">${esc(fmtDate(order.createdAt))}</td></tr>`
          )
          .join("")
      : '<tr><td colspan="5" class="empty">没有订单。</td></tr>';

    openModal(
      `<div class="modal-head">
        <div><h2>${esc(user.displayName || user.username)}</h2><p>@${esc(user.username)} · ID ${Number(user.id)}</p></div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <div class="detail-head">
          <span class="avatar">${esc(String(user.displayName || user.username).slice(0, 1).toUpperCase())}</span>
          <div><h3>${esc(user.displayName || user.username)}</h3><p>${esc(user.role === "admin" ? "管理员" : "普通成员")} · ${statusBadge(user.status)} ${memberBadge(ent)}</p></div>
        </div>
        <div class="detail-grid">
          <div class="detail-stat"><span>今日学习</span><b>${esc(duration(study.todaySeconds))}</b></div>
          <div class="detail-stat"><span>近 7 天</span><b>${esc(duration(study.sevenDaySeconds))}</b></div>
          <div class="detail-stat"><span>近 30 天</span><b>${esc(duration(study.thirtyDaySeconds))}</b></div>
          <div class="detail-stat"><span>累计</span><b>${esc(duration(study.totalSeconds))}</b></div>
        </div>
        <div class="detail-section">
          <h4>账号信息</h4>
          <div class="table-wrap"><table><tbody>
            <tr><th>注册时间</th><td>${esc(fmtDate(user.createdAt))}</td><th>最后登录</th><td>${esc(fmtDate(user.lastLoginAt))}</td></tr>
            <tr><th>最近学习</th><td>${esc(fmtDate(user.lastSeenAt))}</td><th>会员到期</th><td>${ent.lifetime ? "永久" : esc(fmtDate(ent.expiresAt))}</td></tr>
          </tbody></table></div>
        </div>
        <div class="detail-section">
          <h4>30 天学习时长</h4>
          <div class="chart is-mini">${bars || '<p class="empty">暂无数据</p>'}</div>
          <div class="chart-foot"><span>按天统计 · 单日最高 ${esc(duration(maxSeconds))}</span><span>合计 ${esc(duration(study.thirtyDaySeconds))}</span></div>
        </div>
        <div class="detail-section">
          <h4>模块分布</h4>
          <div class="module-list">${moduleRows}</div>
        </div>
        <div class="detail-section">
          <h4>会员记录</h4>
          <div class="table-wrap"><table><thead><tr><th>套餐</th><th>开始</th><th>到期</th><th>备注</th></tr></thead><tbody>${subRows}</tbody></table></div>
        </div>
        <div class="detail-section">
          <h4>订单</h4>
          <div class="table-wrap"><table><thead><tr><th>订单</th><th>套餐</th><th class="num">金额</th><th>状态</th><th>时间</th></tr></thead><tbody>${orderRows}</tbody></table></div>
        </div>
        <div class="detail-section">
          <h4>云端学习数据</h4>
          ${
            dataSummary.length
              ? `<div class="table-wrap"><table><thead><tr><th>键</th><th class="num">大小</th><th>更新时间</th></tr></thead><tbody>${dataSummary
                  .map(
                    (item) =>
                      `<tr><td class="mono small">${esc(item.key)}</td><td class="num">${Math.ceil(Number(item.bytes) / 1024)} KB</td><td class="muted small">${esc(fmtDate(item.updatedAt))}</td></tr>`
                  )
                  .join("")}</tbody></table></div>`
              : '<p class="muted small">该成员还没有同步过学习数据。</p>'
          }
        </div>
        <div class="detail-actions">
          <button class="btn btn-sm" type="button" data-action="edit-user" data-id="${Number(user.id)}">编辑资料</button>
          <button class="btn btn-sm" type="button" data-action="reset-password" data-id="${Number(user.id)}">重置密码</button>
          <button class="btn btn-sm" type="button" data-action="grant" data-id="${Number(user.id)}" data-plan="monthly"${ent.lifetime ? " disabled" : ""}>开通月卡 +30 天</button>
          <button class="btn btn-sm" type="button" data-action="grant" data-id="${Number(user.id)}" data-plan="lifetime"${ent.lifetime ? " disabled" : ""}>开通买断</button>
          ${ent.active ? `<button class="btn btn-sm btn-danger" type="button" data-action="revoke" data-id="${Number(user.id)}">撤销会员</button>` : ""}
          <button class="btn btn-sm" type="button" data-action="toggle-status" data-id="${Number(user.id)}" data-username="${esc(user.username)}" data-status="${user.status === "active" ? "disabled" : "active"}">${user.status === "active" ? "停用账号" : "启用账号"}</button>
          <button class="btn btn-sm btn-danger" type="button" data-action="delete-user" data-id="${Number(user.id)}" data-username="${esc(user.username)}">删除账号</button>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" data-action="close-modal">关闭</button></div>`,
      { wide: true }
    );
  }

  function openCreateUser() {
    openModal(`
      <div class="modal-head"><div><h2>新建用户</h2><p>创建后可立即赠送会员，也可以留空密码自动生成。</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div>
      <form data-form="create-user">
        <div class="modal-body">
          <div class="form-row">
            <label class="field"><span>用户名</span><input name="username" required maxlength="24" placeholder="2–24 位"></label>
            <label class="field"><span>昵称（可选）</span><input name="displayName" maxlength="40" placeholder="显示名称"></label>
          </div>
          <div class="form-row">
            <label class="field"><span>初始密码</span><input name="password" type="password" minlength="8" placeholder="留空自动生成"></label>
            <label class="field"><span>角色</span><select name="role"><option value="user">普通成员</option><option value="admin">管理员</option></select></label>
          </div>
          <label class="field"><span>赠送会员</span><select name="plan"><option value="">不赠送</option><option value="monthly">月卡（30 天）</option><option value="lifetime">买断（永久）</option></select></label>
          <p class="form-error" data-error></p>
        </div>
        <div class="modal-foot"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">创建</button></div>
      </form>
    `);
  }

  function openEditUser(user) {
    openModal(`
      <div class="modal-head"><div><h2>编辑资料</h2><p>@${esc(user.username)} · ID ${Number(user.id)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div>
      <form data-form="edit-user">
        <input type="hidden" name="id" value="${Number(user.id)}">
        <div class="modal-body">
          <div class="form-row">
            <label class="field"><span>用户名</span><input name="username" value="${esc(user.username)}" required maxlength="24"></label>
            <label class="field"><span>昵称</span><input name="displayName" value="${esc(user.displayName || "")}" maxlength="40"></label>
          </div>
          <div class="form-row">
            <label class="field"><span>角色</span><select name="role"><option value="user"${user.role === "user" ? " selected" : ""}>普通成员</option><option value="admin"${user.role === "admin" ? " selected" : ""}>管理员</option></select></label>
            <label class="field"><span>状态</span><select name="status"><option value="active"${user.status === "active" ? " selected" : ""}>正常</option><option value="disabled"${user.status === "disabled" ? " selected" : ""}>停用</option></select></label>
          </div>
          <p class="form-error" data-error></p>
        </div>
        <div class="modal-foot"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存</button></div>
      </form>
    `);
  }

  function openResetPassword(user) {
    openModal(`
      <div class="modal-head"><div><h2>重置密码</h2><p>@${esc(user.username)} · 保存后该成员所有设备上的登录会失效。</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div>
      <form data-form="reset-password">
        <input type="hidden" name="id" value="${Number(user.id)}">
        <div class="modal-body">
          <label class="field"><span>新密码</span><input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="至少 8 位"><span class="hint">请通过安全渠道把新密码交给成员。</span></label>
          <p class="form-error" data-error></p>
        </div>
        <div class="modal-foot"><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">确认重置</button></div>
      </form>
    `);
  }

  function showCreatedCredentials(username, password) {
    state.tempPassword = password;
    openModal(`
      <div class="modal-head"><div><h2>用户已创建</h2><p>请立即把初始密码交给成员。</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div>
      <div class="modal-body">
        <p class="sub">密码只在此处显示一次，不会以明文保存在服务器。</p>
        <div class="code-box">
          <div class="small muted">用户名</div><div class="mono">${esc(username)}</div>
          <div class="small muted mt-8">初始密码</div><div class="mono" id="temp-password">${esc(password)}</div>
          <button class="btn btn-sm" type="button" data-action="copy-temp">复制密码</button>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" type="button" data-action="close-modal">完成</button></div>
    `);
  }

  // ---------- orders ----------

  function renderOrders() {
    const box = state.orders;
    const head = `
      <div class="page-head">
        <div><p class="kicker">PAYMENTS</p><h1>订单确认</h1><p>人工收款模式下，转账到账后在这里确认并开通会员。</p></div>
      </div>
      <form class="toolbar" data-form="order-filters">
        <label class="field search"><span>搜索</span><input name="q" value="${esc(box.q)}" placeholder="用户名、昵称或订单号"></label>
        <label class="field"><span>状态</span><select name="status">
          <option value="">全部</option>
          ${["pending", "paid", "cancelled"]
            .map((status) => `<option value="${status}"${box.status === status ? " selected" : ""}>${STATUS_LABELS[status]}</option>`)
            .join("")}
        </select></label>
        <button class="btn" type="submit">筛选</button>
        <button class="btn btn-ghost" type="button" data-action="clear-order-filters">清空</button>
      </form>
    `;
    if (!box.data) {
      if (box.error) {
        setView(head + retryPanel(box.error, "orders"));
        return;
      }
      setView(head + skeletonCards(3));
      loadOrders();
      return;
    }
    const rows = (box.data.items || []).length
      ? box.data.items
          .map(
            (order) => `<tr>
          <td class="mono">#${esc(order.id)}</td>
          <td>${userCell({ displayName: order.displayName, username: order.username })}</td>
          <td>${esc(planName(order.plan))}</td>
          <td class="num">${esc(order.amountText)}</td>
          <td>${statusBadge(order.status)}</td>
          <td class="muted small">${esc(order.provider || "manual")}${order.providerRef ? `<br>${esc(order.providerRef)}` : ""}</td>
          <td class="muted small">${esc(fmtDate(order.createdAt))}</td>
          <td>${
            order.status === "pending"
              ? `<button class="btn btn-sm btn-primary" type="button" data-action="confirm-order" data-id="${Number(order.id)}">确认收款</button>
                 <button class="btn btn-sm btn-danger" type="button" data-action="cancel-order" data-id="${Number(order.id)}">取消</button>`
              : ""
          }</td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="8" class="empty">没有符合条件的订单。</td></tr>';
    setView(`
      ${head}
      <section class="panel">
        <div class="table-wrap"><table>
          <thead><tr><th>订单</th><th>成员</th><th>套餐</th><th class="num">金额</th><th>状态</th><th>支付渠道</th><th>创建时间</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${pager(box.data, "orders")}
      </section>
    `);
  }

  async function loadOrders() {
    const box = state.orders;
    if (box.loading) return;
    box.loading = true;
    box.error = "";
    const params = new URLSearchParams({
      q: box.q,
      status: box.status,
      page: String(box.page),
      pageSize: "20"
    });
    try {
      const result = await api(`/admin/orders?${params}`);
      if (!result.ok || !result.data) box.error = messageOf(result, "无法加载订单。");
      else box.data = result.data;
    } catch {
      box.error = "无法连接服务器。";
    } finally {
      box.loading = false;
      if (state.view === "orders") renderOrders();
    }
  }

  // ---------- redeem codes ----------

  function renderRedeem() {
    const box = state.redeem;
    const head = `
      <div class="page-head">
        <div><p class="kicker">ACCESS CODES</p><h1>兑换码</h1><p>生成月卡或买断兑换码，适合线下收款、活动赠送。</p></div>
      </div>
      <section class="panel mb-14">
        <div class="panel-head"><div><h2>生成兑换码</h2><p>一次最多 100 个，每个码只能使用一次。</p></div></div>
        <form class="toolbar mb-0" data-form="generate-codes">
          <label class="field"><span>套餐</span><select name="plan"><option value="monthly">月卡（30 天）</option><option value="lifetime">买断（永久）</option></select></label>
          <label class="field"><span>数量</span><input name="count" type="number" min="1" max="100" value="1"></label>
          <label class="field search"><span>备注</span><input name="note" maxlength="80" placeholder="例如：线下收款 / 活动"></label>
          <button class="btn btn-primary" type="submit">生成</button>
        </form>
        <div class="code-box" id="new-codes"${state.lastCodes.length ? "" : " hidden"}>
          <div class="panel-head"><div><h2>刚生成的兑换码</h2><p>请复制保存，页面刷新后仍可在下方列表查看。</p></div><button class="btn btn-sm" type="button" data-action="copy-last-codes">复制全部</button></div>
          <div class="code-list">${state.lastCodes.map((code) => `<code>${esc(code)}</code>`).join("")}</div>
        </div>
      </section>
      <form class="toolbar" data-form="redeem-filters">
        <label class="field"><span>状态</span><select name="status"><option value="">全部</option><option value="unused"${box.status === "unused" ? " selected" : ""}>未使用</option><option value="used"${box.status === "used" ? " selected" : ""}>已使用</option></select></label>
        <button class="btn" type="submit">筛选</button>
      </form>
    `;
    if (!box.data) {
      if (box.error) {
        setView(head + retryPanel(box.error, "redeem"));
        return;
      }
      setView(head + skeletonCards(3));
      loadRedeem();
      return;
    }
    const rows = (box.data.items || []).length
      ? box.data.items
          .map(
            (item) => `<tr>
          <td><code class="mono">${esc(item.code)}</code></td>
          <td>${esc(planName(item.plan))}</td>
          <td>${item.usedAt ? statusBadge("paid", "已使用") : statusBadge("active", "未使用")}</td>
          <td>${item.usedUsername ? `@${esc(item.usedUsername)}` : '<span class="muted">—</span>'}</td>
          <td class="muted small">${esc(fmtDate(item.createdAt))}</td>
          <td class="muted small">${esc(item.note || "")}</td>
          <td><button class="btn btn-sm" type="button" data-action="copy-code" data-code="${esc(item.code)}">复制</button></td>
        </tr>`
          )
          .join("")
      : '<tr><td colspan="7" class="empty">还没有兑换码。</td></tr>';
    setView(`
      ${head}
      <section class="panel">
        <div class="table-wrap"><table>
          <thead><tr><th>兑换码</th><th>套餐</th><th>状态</th><th>使用人</th><th>创建时间</th><th>备注</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${pager(box.data, "redeem")}
      </section>
    `);
  }

  async function loadRedeem() {
    const box = state.redeem;
    if (box.loading) return;
    box.loading = true;
    box.error = "";
    const params = new URLSearchParams({ status: box.status, page: String(box.page), pageSize: "30" });
    try {
      const result = await api(`/admin/redeem-codes?${params}`);
      if (!result.ok || !result.data) box.error = messageOf(result, "无法加载兑换码。");
      else box.data = result.data;
    } catch {
      box.error = "无法连接服务器。";
    } finally {
      box.loading = false;
      if (state.view === "redeem") renderRedeem();
    }
  }

  // ---------- audit ----------

  function renderAudit() {
    const box = state.audit;
    const head = `<div class="page-head"><div><p class="kicker">AUDIT LOG</p><h1>审计日志</h1><p>管理员操作、登录、支付与兑换记录。</p></div></div>`;
    if (!box.data) {
      if (box.error) {
        setView(head + retryPanel(box.error, "audit"));
        return;
      }
      setView(head + skeletonCards(3));
      loadAudit();
      return;
    }
    const rows = (box.data.items || []).length
      ? box.data.items
          .map((item) => {
            const detail =
              item.detail && typeof item.detail === "object"
                ? Object.entries(item.detail)
                    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : value}`)
                    .join(" · ")
                : item.detail || "";
            return `<tr>
              <td class="muted small">${esc(fmtDate(item.createdAt))}</td>
              <td>${item.actorUsername ? `@${esc(item.actorUsername)}` : '<span class="muted">系统/访客</span>'}</td>
              <td><span class="tag">${esc(ACTION_LABELS[item.action] || item.action)}</span></td>
              <td class="small">${esc(item.targetType || "—")}${item.targetId ? ` #${esc(item.targetId)}` : ""}</td>
              <td class="is-wrap small muted">${esc(detail)}</td>
              <td class="muted small">${esc(item.ip || "—")}</td>
            </tr>`;
          })
          .join("")
      : '<tr><td colspan="6" class="empty">还没有审计记录。</td></tr>';
    setView(`
      ${head}
      <section class="panel">
        <div class="table-wrap"><table>
          <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th><th>IP</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${pager(box.data, "audit")}
      </section>
    `);
  }

  async function loadAudit() {
    const box = state.audit;
    if (box.loading) return;
    box.loading = true;
    box.error = "";
    const params = new URLSearchParams({ page: String(box.page), pageSize: "30" });
    try {
      const result = await api(`/admin/audit?${params}`);
      if (!result.ok || !result.data) box.error = messageOf(result, "无法加载审计日志。");
      else box.data = result.data;
    } catch {
      box.error = "无法连接服务器。";
    } finally {
      box.loading = false;
      if (state.view === "audit") renderAudit();
    }
  }

  // ---------- modal ----------

  function openModal(html, { wide = false } = {}) {
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-backdrop" data-backdrop><div class="modal${wide ? " is-wide" : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
    wireChartHeights();
    const close = $(".modal-close", root);
    if (close) close.focus();
  }

  function closeModal() {
    $("#modal-root").innerHTML = "";
    state.modalUserId = null;
    state.tempPassword = "";
  }

  function formError(form, message) {
    const node = $("[data-error]", form);
    if (node) node.textContent = message;
    else toast(message, true);
  }

  function invalidateAll() {
    state.overview.data = null;
    state.overview.error = "";
    state.users.data = null;
    state.users.error = "";
    state.orders.data = null;
    state.orders.error = "";
    state.redeem.data = null;
    state.redeem.error = "";
    state.audit.data = null;
    state.audit.error = "";
  }

  async function refreshCurrent() {
    if (state.view === "overview") {
      state.overview.data = null;
      state.overview.error = "";
      renderOverview();
    } else if (state.view === "users") {
      state.users.data = null;
      state.users.error = "";
      renderUsers();
    } else if (state.view === "orders") {
      state.orders.data = null;
      state.orders.error = "";
      renderOrders();
    } else if (state.view === "redeem") {
      state.redeem.data = null;
      state.redeem.error = "";
      renderRedeem();
    } else {
      state.audit.data = null;
      state.audit.error = "";
      renderAudit();
    }
  }

  // ---------- mutations ----------

  async function submitCreateUser(form) {
    const data = new FormData(form);
    const body = {
      username: data.get("username"),
      displayName: data.get("displayName"),
      role: data.get("role") === "admin" ? "admin" : "user"
    };
    if (String(data.get("password") || "")) body.password = String(data.get("password"));
    if (String(data.get("plan") || "")) body.plan = String(data.get("plan"));
    const result = await api("/admin/users", { method: "POST", body });
    if (!result.ok || !result.data) {
      formError(form, messageOf(result, "创建失败。"));
      return;
    }
    invalidateAll();
    if (state.view === "users") {
      state.users.data = null;
      renderUsers();
    }
    if (result.data.initialPassword) showCreatedCredentials(result.data.user.username, result.data.initialPassword);
    else {
      closeModal();
      toast("用户已创建");
      if (state.view === "users") renderUsers();
    }
  }

  async function submitEditUser(form) {
    const data = new FormData(form);
    const id = Number(data.get("id"));
    const result = await api(`/admin/users/${id}`, {
      method: "PATCH",
      body: {
        username: String(data.get("username") || ""),
        displayName: String(data.get("displayName") || ""),
        role: String(data.get("role") || "user"),
        status: String(data.get("status") || "active")
      }
    });
    if (!result.ok || !result.data) {
      formError(form, messageOf(result, "保存失败。"));
      return;
    }
    invalidateAll();
    toast("资料已保存");
    closeModal();
    if (state.view === "users") {
      state.users.data = null;
      renderUsers();
    }
  }

  async function submitResetPassword(form) {
    const data = new FormData(form);
    const id = Number(data.get("id"));
    const result = await api(`/admin/users/${id}`, {
      method: "PATCH",
      body: { password: String(data.get("password") || "") }
    });
    if (!result.ok || !result.data) {
      formError(form, messageOf(result, "重置失败。"));
      return;
    }
    closeModal();
    toast("密码已重置，该成员的其他登录已失效");
    if (id === Number(state.user.id)) {
      showLogin("你已重置自己的密码，请用新密码重新登录。");
      return;
    }
    if (state.view === "users") {
      state.users.data = null;
      renderUsers();
    }
  }

  async function grantSubscription(id, plan) {
    if (!window.confirm(`确认为该成员开通${plan === "lifetime" ? "永久买断" : "月卡（+30 天）"}？`)) return;
    const result = await api(`/admin/users/${id}/subscription`, {
      method: "POST",
      body: { action: "grant", plan }
    });
    if (!result.ok || !result.data) {
      toast(messageOf(result, "开通失败"), true);
      return;
    }
    invalidateAll();
    toast("会员已开通");
    openUser(id);
    if (state.view === "users") {
      state.users.data = null;
      renderUsers();
    }
  }

  async function revokeSubscription(id) {
    if (!window.confirm("撤销后会立即删除该成员所有有效会员记录，确定继续？")) return;
    const result = await api(`/admin/users/${id}/subscription`, { method: "POST", body: { action: "revoke" } });
    if (!result.ok || !result.data) {
      toast(messageOf(result, "撤销失败"), true);
      return;
    }
    invalidateAll();
    toast("会员已撤销");
    openUser(id);
    if (state.view === "users") {
      state.users.data = null;
      renderUsers();
    }
  }

  async function toggleUserStatus(id, status, username) {
    if (status === "disabled" && !window.confirm(`确认停用 @${username}？停用后该账号会立即退出登录。`)) return;
    const result = await api(`/admin/users/${id}`, { method: "PATCH", body: { status } });
    if (!result.ok || !result.data) {
      toast(messageOf(result, "操作失败"), true);
      return;
    }
    invalidateAll();
    toast(status === "disabled" ? "账号已停用" : "账号已启用");
    openUser(id);
    if (state.view === "users") {
      state.users.data = null;
      renderUsers();
    }
  }

  async function deleteUser(id, username) {
    const typed = window.prompt(`删除后不可恢复。请输入用户名 “${username}” 确认：`);
    if (typed === null) return;
    if (typed.trim() !== username) {
      toast("输入的用户名不匹配，已取消。", true);
      return;
    }
    const result = await api(`/admin/users/${id}`, { method: "DELETE", body: { confirmUsername: typed.trim() } });
    if (!result.ok || !result.data) {
      toast(messageOf(result, "删除失败"), true);
      return;
    }
    invalidateAll();
    closeModal();
    toast("用户已删除");
    if (state.view === "users") {
      state.users.data = null;
      renderUsers();
    }
  }

  async function confirmOrder(id) {
    const ref = window.prompt("确认已收到该订单款项？可填写收款备注/流水号（可留空）：", "");
    if (ref === null) return;
    const result = await api(`/admin/orders/${id}/confirm`, {
      method: "POST",
      body: { providerRef: ref.trim() || null, note: "管理员确认收款" }
    });
    if (!result.ok || !result.data) {
      toast(messageOf(result, "确认失败"), true);
      return;
    }
    invalidateAll();
    toast("订单已确认，会员已开通");
    if (state.view === "orders") {
      state.orders.data = null;
      renderOrders();
    }
  }

  async function cancelOrder(id) {
    if (!window.confirm("确定取消该订单？")) return;
    const result = await api(`/admin/orders/${id}/cancel`, { method: "POST", body: {} });
    if (!result.ok || !result.data) {
      toast(messageOf(result, "取消失败"), true);
      return;
    }
    invalidateAll();
    toast("订单已取消");
    if (state.view === "orders") {
      state.orders.data = null;
      renderOrders();
    }
  }

  async function submitGenerateCodes(form) {
    const data = new FormData(form);
    const result = await api("/admin/redeem-codes", {
      method: "POST",
      body: {
        plan: String(data.get("plan") || "monthly"),
        count: Number(data.get("count") || 1),
        note: String(data.get("note") || "") || null
      }
    });
    if (!result.ok || !result.data) {
      toast(messageOf(result, "生成失败"), true);
      return;
    }
    state.lastCodes = result.data.codes || [];
    state.redeem.data = null;
    toast(`已生成 ${state.lastCodes.length} 个兑换码`);
    renderRedeem();
  }

  // ---------- events ----------

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form");
    if (!form) return;
    const kind = form.dataset.form;
    if (kind === "login") {
      onLogin(event, form);
      return;
    }
    event.preventDefault();
    if (kind === "user-filters") applyUserFilters(form);
    else if (kind === "create-user") submitCreateUser(form).catch(() => formError(form, "操作失败，请重试。"));
    else if (kind === "edit-user") submitEditUser(form).catch(() => formError(form, "操作失败，请重试。"));
    else if (kind === "reset-password") submitResetPassword(form).catch(() => formError(form, "操作失败，请重试。"));
    else if (kind === "generate-codes") submitGenerateCodes(form).catch(() => toast("操作失败，请重试。", true));
    else if (kind === "order-filters") {
      const data = new FormData(form);
      state.orders.q = String(data.get("q") || "").trim();
      state.orders.status = String(data.get("status") || "");
      state.orders.page = 1;
      state.orders.data = null;
      state.orders.error = "";
      renderOrders();
    } else if (kind === "redeem-filters") {
      const data = new FormData(form);
      state.redeem.status = String(data.get("status") || "");
      state.redeem.page = 1;
      state.redeem.data = null;
      state.redeem.error = "";
      renderRedeem();
    }
  });

  document.addEventListener("click", (event) => {
    const backdrop = event.target.closest("[data-backdrop]");
    if (backdrop && event.target === backdrop) {
      closeModal();
      return;
    }
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = Number(target.dataset.id || 0);

    if (action === "logout" || action === "logout-any") {
      api("/auth/logout", { method: "POST" }).finally(() => {
        state.user = null;
        location.reload();
      });
    } else if (action === "toggle-nav") {
      $("#admin-app").classList.toggle("nav-open");
    } else if (action === "refresh") {
      refreshCurrent();
    } else if (action === "retry") {
      const kind = target.dataset.kind;
      if (kind === "overview") {
        state.overview.data = null;
        state.overview.error = "";
        renderOverview();
      } else if (kind === "users") {
        state.users.data = null;
        state.users.error = "";
        renderUsers();
      } else if (kind === "orders") {
        state.orders.data = null;
        state.orders.error = "";
        renderOrders();
      } else if (kind === "redeem") {
        state.redeem.data = null;
        state.redeem.error = "";
        renderRedeem();
      } else {
        state.audit.data = null;
        state.audit.error = "";
        renderAudit();
      }
    } else if (action === "overview-days") {
      setOverviewDays(target.dataset.days);
    } else if (action === "create-user") {
      openCreateUser();
    } else if (action === "user-detail") {
      openUser(id);
    } else if (action === "edit-user" || action === "reset-password") {
      if (!state.modalUserId) return;
      api(`/admin/users/${state.modalUserId}`).then((result) => {
        if (!result.ok || !result.data) {
          toast("无法加载用户资料", true);
          return;
        }
        if (action === "edit-user") openEditUser(result.data.user);
        else openResetPassword(result.data.user);
      });
    } else if (action === "grant") {
      grantSubscription(id, target.dataset.plan);
    } else if (action === "revoke") {
      revokeSubscription(id);
    } else if (action === "toggle-status") {
      toggleUserStatus(id, target.dataset.status, target.dataset.username || "该用户");
    } else if (action === "delete-user") {
      deleteUser(id, target.dataset.username);
    } else if (action === "close-modal") {
      closeModal();
    } else if (action === "copy-temp") {
      copyText(state.tempPassword);
    } else if (action === "copy-code") {
      copyText(target.dataset.code || "");
    } else if (action === "copy-last-codes") {
      copyText(state.lastCodes.join("\n"));
    } else if (action === "page") {
      const kind = target.dataset.kind;
      const page = Math.max(1, Number(target.dataset.page) || 1);
      if (kind === "users") {
        state.users.page = page;
        state.users.data = null;
        state.users.error = "";
        renderUsers();
      } else if (kind === "orders") {
        state.orders.page = page;
        state.orders.data = null;
        state.orders.error = "";
        renderOrders();
      } else if (kind === "redeem") {
        state.redeem.page = page;
        state.redeem.data = null;
        state.redeem.error = "";
        renderRedeem();
      } else if (kind === "audit") {
        state.audit.page = page;
        state.audit.data = null;
        state.audit.error = "";
        renderAudit();
      }
    } else if (action === "clear-user-filters") {
      clearUserFilters();
    } else if (action === "clear-order-filters") {
      Object.assign(state.orders, { q: "", status: "", page: 1, data: null, error: "" });
      renderOrders();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("#modal-root").innerHTML) closeModal();
  });

  boot();
})();
