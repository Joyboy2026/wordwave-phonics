# 部署与上线

本项目已经不是纯静态站点：学习页、`/admin` 和 `/api` 都由同一个 Node 进程提供。请部署到能运行 **Node.js >= 22.5** 的 Linux / macOS / Windows 机器。

> 只想看看页面？可以用 `python3 -m http.server` 打开静态学习页，但**没有登录、付费和统计**，不要用于正式收费。

---

## 1. 最低配置

- 1 核 CPU / 512MB 内存 / 1GB 磁盘（音频和 OCR 资源约 30MB，加上数据库和备份）。
- Node.js 22.5+（推荐 22 LTS 或 24）。
- 一个域名（PWA 安装和 `Secure` Cookie 需要 HTTPS）。
- 不需要 MySQL / Redis / Nginx（Nginx 可选，用于 HTTPS 和反向代理）。

检查版本：

```bash
node -v
# v22.5.0 或更高
```

---

## 2. 上传与初始化

假设部署到 `/opt/wordwave`，运行用户为 `wordwave`：

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin wordwave
sudo mkdir -p /opt/wordwave
sudo chown wordwave:wordwave /opt/wordwave
# 把仓库文件传到 /opt/wordwave（git clone / rsync / scp 均可）
sudo -u wordwave git clone <你的仓库地址> /opt/wordwave
cd /opt/wordwave
sudo -u wordwave cp .env.example .env
sudo -u wordwave chmod 600 .env
```

编辑 `.env`：

```dotenv
HOST=127.0.0.1
PORT=8787
DATA_DIR=data
APP_TIMEZONE=Asia/Shanghai
STUDY_DAILY_CAP_MINUTES=720
PAYMENT_MODE=manual
ADMIN_USERNAME=admin
ADMIN_PASSWORD=换成一个至少12位的强密码
SESSION_DAYS=30
COOKIE_SECURE=true
TRUST_PROXY=true
```

- 前面有 Nginx / Caddy 时，`HOST=127.0.0.1`，只让本机反代访问。
- 直接对外暴露 8787 时，`HOST=0.0.0.0`，并配置防火墙。
- `PAYMENT_MODE` 正式环境必须是 `manual`；`mock` 只用于本地测试。
- `COOKIE_SECURE=true` 需要 HTTPS；本地 HTTP 调试设 `false`。
- `TRUST_PROXY=true` 只在你确实有反向代理时开启，否则客户端可伪造 IP。

创建管理员（也可以在首次启动时由 `ADMIN_PASSWORD` 自动创建）：

```bash
sudo -u wordwave npm run create-admin -- \
  --username admin \
  --password '换成一个至少12位的强密码' \
  --display-name '平台管理员'
```

首次启动：

```bash
sudo -u wordwave npm start
```

看到 `学习平台 http://...`、`管理后台 http://.../admin` 即成功。按 `Ctrl+C` 停止。

> 如果数据库里没有任何管理员，且 `.env` 没填 `ADMIN_PASSWORD`，服务会随机生成密码并写到 `data/initial-admin.txt`（0600）。登录后请立刻改密码并删除该文件。

---

## 3. 用 systemd 常驻

`/etc/systemd/system/wordwave.service`：

```ini
[Unit]
Description=WORDWAVE Phonics
After=network.target

[Service]
Type=simple
User=wordwave
Group=wordwave
WorkingDirectory=/opt/wordwave
EnvironmentFile=/opt/wordwave/.env
ExecStart=/usr/bin/node /opt/wordwave/server/index.js
Restart=on-failure
RestartSec=3

# 基础加固；如果 Node 不在 /usr/bin，请把 ExecStart 改成 `command -v node` 的结果
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/wordwave/data

[Install]
WantedBy=multi-user.target
```

注意：

- `ExecStart` 必须是绝对路径。用 nvm 安装的 Node 通常不在 `/usr/bin/node`，请填 `command -v node` 的实际路径；系统升级 Node 后路径可能变化。
- `ProtectSystem=strict` 下只有 `ReadWritePaths` 可写；`data/` 必须可写。
- `.env` 里不要有 `export`，systemd 的 `EnvironmentFile` 只接受 `KEY=VALUE`。

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wordwave
sudo systemctl status wordwave --no-pager
sudo journalctl -u wordwave -f
```

---

## 4. HTTPS 与反向代理

### 方案 A：Nginx + Let's Encrypt（推荐）

安装 Nginx 和 certbot 后，先建 HTTP 配置：

```nginx
server {
    listen 80;
    server_name learn.example.com;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }
}
```

启用后签发证书：

```bash
sudo ln -s /etc/nginx/sites-available/wordwave /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d learn.example.com
```

certbot 会自动加 443 和跳转。确认 `.env` 里 `COOKIE_SECURE=true`、`TRUST_PROXY=true` 后重启：

```bash
sudo systemctl restart wordwave
```

### 方案 B：Caddy

```caddyfile
learn.example.com {
    reverse_proxy 127.0.0.1:8787
    request_body {
        max_size 2MB
    }
}
```

Caddy 自动申请证书；同样设置 `COOKIE_SECURE=true`、`TRUST_PROXY=true`。

### 方案 C：直接暴露端口

只建议内网 / 临时测试：

```bash
HOST=0.0.0.0 PORT=8787 npm start
```

然后 `http://服务器IP:8787/`。此时 `COOKIE_SECURE=false`，且浏览器不会允许 PWA 安装（非 HTTPS）。

---

## 5. 防火墙

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

如果 Node 直接对外，再加 `8787/tcp`。用 Nginx 反代时不要暴露 8787。

云服务器还要在安全组放行 80/443（以及 SSH）。

---

## 6. 备份与恢复

### 备份

```bash
cd /opt/wordwave
sudo -u wordwave node server/cli.js backup
# 默认写到 data/backups/wordwave-<时间>.db
```

`VACUUM INTO` 会生成一致性快照，服务运行中也可执行。备份包含密码哈希、订单、学习记录，按敏感数据保管。

每天自动备份（crontab）：

```cron
15 3 * * * cd /opt/wordwave && /usr/bin/node server/cli.js backup >> data/backup.log 2>&1
```

建议再用 `rclone` / `rsync` 把 `data/backups/` 同步到另一台机器或对象存储；不要把备份提交到 Git。

### 恢复

```bash
sudo systemctl stop wordwave
cd /opt/wordwave
sudo -u wordwave cp data/wordwave.db data/wordwave.db.before-restore
sudo -u wordwave cp data/backups/wordwave-YYYY-MM-DD....db data/wordwave.db
sudo -u wordwave rm -f data/wordwave.db-wal data/wordwave.db-shm
sudo systemctl start wordwave
```

如果备份文件名不同，按实际路径替换。恢复后登录后台抽查用户、订单和学习统计。

### 迁移到新机器

1. 旧机执行备份。
2. 新机部署代码、`.env`，停服务。
3. 把备份文件放到新机 `data/wordwave.db`，确认属主为 `wordwave`。
4. 启动，检查 `/api/health`、登录、后台。

---

## 7. 升级

```bash
cd /opt/wordwave
sudo -u wordwave git pull
sudo -u wordwave npm run backup
sudo systemctl restart wordwave
```

本项目没有 npm 依赖，通常不需要 `npm install`；如果以后加了依赖，再执行 `npm install --omit=dev`。

发布前本地验证：

```bash
npm test
```

缓存策略：`index.html`、`admin.html`、`account.js` / `account.css`、`admin.js` / `admin.css` 和 `sw.js` 都是 `no-cache`（带 ETag 协商，未修改时返回 304）；音频 / 字体 / 图标 / vendor 缓存 1 天；其余 JS/CSS/JSON 缓存 1 小时。这样部署后不会把用户卡在旧登录页或旧后台。

---

## 8. 支付上线检查

1. `.env` 中 `PAYMENT_MODE=manual`。
2. 在付费墙文案或群公告里放你的微信 / 支付宝收款方式。
3. 用户下单后，在 `/admin` → 订单确认核对用户名、套餐、金额，再点确认。
4. 兑换码适合批量收费：后台生成 → 发给家长 → 用户自己兑换。
5. 退款：目前没有自动退款接口。线下退款后，可在后台“撤销会员”；已支付订单保留审计记录。

如果要接微信支付 / 支付宝：

- 需要商户号、API 密钥、回调域名和 HTTPS。
- 只在服务端创建订单、验签、按服务端金额开通；不要把金额或 `paid` 状态交给前端。
- 回调必须幂等（同一订单重复通知不能重复加时长）。
- 建议保留人工确认作为兜底。

---

## 9. 安全清单

- [ ] 已改默认管理员密码，删除 `data/initial-admin.txt`。
- [ ] `.env` 权限 600，未提交 Git。
- [ ] 全站 HTTPS，`COOKIE_SECURE=true`。
- [ ] 反代后设 `TRUST_PROXY=true`，直连时设 `false`。
- [ ] `PAYMENT_MODE=manual`。
- [ ] 防火墙只开 22/80/443；Node 端口不公网暴露。
- [ ] 每天备份，并定期做恢复演练。
- [ ] 定期 `npm test`，关注 Node 安全更新。
- [ ] 停用离职 / 毕业成员时，确认其会话已撤销（停用即撤销）。
- [ ] 不要把 `data/`、备份、`.env` 放进静态目录或 Git。

---

## 10. 已知边界

- **静态内容不能做到绝对防抓取。** 登录墙和会员校验保护的是 API 与界面；`index.html`、词库、音频仍会被浏览器下载。需要强版权保护时，应改为服务端渲染 / 加密资源。
- **PWA 离线宽限 72 小时。** 已付费设备断网可继续用缓存会员状态；这是离线体验的取舍。
- **没有邮件 / 短信找回密码。** 由管理员重置。
- **GitHub Pages 不能跑这套后端。** 静态托管只能预览学习页。
- **单机 SQLite。** 适合家庭 / 小班 / 单校规模；多机横向扩展需要换 PostgreSQL 或做共享存储，当前不包含。
- **时区。** 学习日按 `APP_TIMEZONE` 计算，默认中国时区；改时区不会重算历史数据。

---

## 11. 从旧静态版迁移

旧版的进度只存在每个浏览器自己的 localStorage（`wordwave.progress.v1` 等），没有账号，也没有服务端数据。升级后：

- 旧数据不会自动归属到新账号。
- 用户注册 / 登录后，学习页使用新的 `ww.u<用户ID>.` 命名空间，从零开始记录。
- 如果需要保留某个孩子的旧进度，可在浏览器控制台把旧 key 的值复制到新命名空间，或让管理员手工导入（当前没有批量导入工具）。
- 旧的纯静态部署可以保留为“无需登录的演示站”，但不要和收费站混用同一个域名。
