# WORDWAVE 移植与部署

这是一个**纯静态站点**：HTML + JS + 本地音频 / 字体，没有后端、数据库、npm 依赖或构建步骤。把整个目录复制到另一台机器即可运行。

## 1. 最短路径

在源机器上，把 `phonics-station` 整个目录复制走：

```bash
# 局域网 scp（示例）
scp -r phonics-station user@目标机器:/目标/路径/

# 或在源机器打包
tar -czf wordwave-static.tar.gz -C phonics-station .
```

目标机器只需要 **Python 3**（Linux/macOS 通常自带；Windows 从 python.org 安装，或用 `py -3`）。

```bash
cd /目标/路径/phonics-station
./start-server.sh 8765
```

脚本会打印：

- 本机：`http://127.0.0.1:8765/`
- 局域网：`http://<目标机器局域网IP>:8765/`

手机与目标机器连同一个 Wi-Fi，打开局域网地址即可。

## 2. 给另一台机器的 DSH 智能体

把下面这段直接交给目标机器上的 DSH 智能体，或让它阅读本文件：

```text
请把当前目录作为纯静态站点部署，不要改 data.js、lab.js、audio/ 或 index.html 的内容。

1. 确认存在 index.html、data.js、lab.js、audio/、fonts/。
2. 确认 python3 可用。
3. 在 phonics-station 目录后台启动：
   python3 -m http.server 8765 --bind 0.0.0.0
4. 验证：
   - curl -fsS http://127.0.0.1:8765/ >/dev/null
   - find audio/words -type f | wc -l        # 应为 840
   - find audio/lab/sentences -type f | wc -l # 应为 80
   - curl -fsS http://127.0.0.1:8765/audio/words/unhappy.mp3 -o /dev/null
   - curl -fsS http://127.0.0.1:8765/audio/lab/sentences/unhappy.mp3 -o /dev/null
5. 输出本机和局域网访问 URL；不要占用或替换 DSH Web GUI 的端口。
6. 不执行 npm install / build；本项目没有构建步骤。
```

如果目标机器已有服务占用 8765，把命令改成 `./start-server.sh 9000`，并同步使用新端口。

## 3. 手工启动（不使用脚本）

```bash
cd phonics-station
python3 -m http.server 8765 --bind 0.0.0.0
```

Windows PowerShell：

```powershell
cd phonics-station
py -3 -m http.server 8765 --bind 0.0.0.0
```

如果只想本机访问，把 `--bind 0.0.0.0` 改成 `--bind 127.0.0.1`。

## 4. 手机访问

1. 确保手机和电脑在同一 Wi-Fi。
2. 查目标机器 IP：
   - Linux：`hostname -I`
   - macOS：`ipconfig getifaddr en0`
   - Windows：`ipconfig`，看无线网卡的 IPv4
3. 打开 `http://<IP>:8765/`。
4. 如果打不开，检查系统防火墙是否允许该端口；不要只把地址发给手机而忽略防火墙。

## 5. PWA：安装到手机主屏幕

发布包已包含：

- `manifest.json`
- `sw.js`
- `icons/`（192 / 512 / maskable / apple-touch）

安装条件：

1. 必须通过 **HTTPS** 打开（或在本机用 `http://localhost` / `http://127.0.0.1` 测试）。
2. 局域网 `http://IP:8765` 可以浏览，但**不能注册 Service Worker，也不能安装**。
3. 首次打开需要联网；页面外壳和 UI 音频会预缓存，单词/例句音频在第一次播放后缓存。

安装：

- **Android Chrome**：菜单 → “安装应用”或“添加到主屏幕”。
- **iPhone Safari**：分享 → “添加到主屏幕”。
- 首页页脚也会出现“安装到手机”按钮（Android 浏览器支持安装提示时；iPhone 上点击会提示分享路径）。

部署到 HTTPS 的最简单方式：

- GitHub Pages：把 `phonics-station` 目录内容推到仓库，Settings → Pages 选择分支；得到 `https://用户名.github.io/仓库名/`。
- Cloudflare Pages / Netlify：把整个目录拖到静态站点部署面板；得到 HTTPS 地址。
- 反向代理：已有 HTTPS 域名时，把根路径代理到 `127.0.0.1:8765`。

> Service Worker 使用相对路径，部署在子路径（例如 `/wordwave/`）也可以正常工作。

## 6. 文件与数据

- `index.html`：页面、样式、交互
- `data.js`：42 组 / 840 个拼读词
- `lab.js`：WORD LAB 80 个重点词、例句、语法提示
- `audio/words/`：840 个单词发音
- `audio/lab/sentences/`：80 个例句朗读
- `audio/ui/`：答对、批次、频道结尾等鼓励语音
- `fonts/fredoka-latin.woff2`：本地字体
- `start-server.sh`：启动脚本
- `dsh-deploy.json`：给智能体读的部署清单
- `manifest.json` / `sw.js` / `icons/`：PWA 安装与离线缓存
- `qr-lan.png`：**本机生成的可选二维码，换机后 IP 会变；发布包不包含它，请按新 IP 重新生成或直接发 URL**

所有资源都是相对路径；不需要改配置里的域名或端口。

## 7. 不要复制/不要依赖

- 不要复制 `.oil-ui/`、`work/`、`shots/`、`reviews/`：那些是制作过程、截图和测试脚本，不是运行依赖。
- 不需要 `node_modules`，不需要 npm。
- 页码、音频文件名和 `data.js`/`lab.js` 已经预生成；不要重新“构建数据”，否则可能破坏计数或音频映射。

## 8. 进度与隐私

- 拼读进度：`localStorage["wordwave.progress.v1"]`
- WORD LAB 进度：`localStorage["wordwave.wordlab.v1"]`
- 进度只存在当前浏览器，不跨设备同步；换手机会从 0 开始。
- 页面没有账号、没有后端、没有上传；但静态服务本身没有登录保护，**不要直接暴露到公网**。如需公网访问，应在前面加反向代理和认证，或使用受控的内网穿透。

## 9. 常见问题

**手机打不开，但电脑能打开**
- 服务是否绑定 `0.0.0.0`；
- 两台设备是否同一网段；
- 防火墙是否放行端口；
- 是否用了旧 IP（DHCP 会变）。

**声音不响 / 还是旧音量**
- 刷新页面，或强制刷新缓存；
- iOS 需要先点一下页面/喇叭，浏览器才允许播放；
- 本页音频是本地 mp3，不依赖网络 TTS。

**二维码不对**
- `qr-lan.png` 是旧机器地址；发布包未包含它。用新 IP 重新生成，或直接发 URL。

## 10. 兼容性

- 现代 Chrome / Safari / Edge / Firefox；
- 需要 JavaScript 和 `localStorage`；
- 支持 `prefers-reduced-motion`；
- 不含任何第三方 CDN 请求，断网也能用（前提是资源已复制完整）。
