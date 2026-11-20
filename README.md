> 在线版：<https://joyboy2026.github.io/wordwave-phonics/>
>
> 手机安装：Android Chrome 菜单 → “安装应用”；iPhone Safari → 分享 → “添加到主屏幕”。

# WORDWAVE 单词声波站

给五年级孩子的手机端自然拼读练习页。42 个频道、840 个词，按前缀 / 后缀 / 字母组合分组，每组 20 词、每 5 词一批；含外研社五上/五下核心词和拓展词。

## 打开

```bash
cd phonics-station
python3 -m http.server 8765 --bind 0.0.0.0
```

- 电脑本机：<http://127.0.0.1:8765/>
- 手机（同一 Wi-Fi）：`http://<目标机器局域网IP>:8765/`（IP 可能随网络变化，以 `hostname -I` 或 `ipconfig` 为准）
- 也可以直接运行 `./start-server.sh`，脚本会打印当前地址。

> 换机器/换网络请先看 [DEPLOY.md](DEPLOY.md)；`dsh-deploy.json` 是给其他 DSH 智能体读取的部署清单。

## 安装到手机（PWA）

已加入 `manifest.json`、`sw.js` 和全套图标，可以像 App 一样安装到主屏幕：

- **Android Chrome**：打开 HTTPS 地址 → 菜单 → “安装应用”/“添加到主屏幕”。
- **iPhone Safari**：打开 HTTPS 地址 → 分享 → “添加到主屏幕”。
- 首次打开需联网；加载过的页面、UI 音频会进入缓存，之后断网也能打开；单词/例句音频在第一次播放后缓存。
- **安装只支持 HTTPS**（或本机 `localhost`）。用局域网 `http://IP:8765` 只能浏览，不能注册 Service Worker/安装。
- 安装后可全屏运行；进度仍保存在本机浏览器。

## 学习流程：自然拼读

1. 首页选一个频道（或点“开始调频”从第一个未完成频道开始）；可用“课本词”只看含外研课本词的频道。
2. 逐词听发音，看音标、汉译、意思图和“拼一拼”拆解；支持 0.7× 慢速。
3. 每 5 个词看完后进入 3 道听音选择题；答错会显示正确答案并重播。
4. 一组 4 批都完成后播放中文鼓励语音，配合星星与 confetti 动画；进度保存在浏览器本地。
5. 每次答对会随机播放 6 种中文鼓励语音之一，并从选项位置喷出彩带礼花；答错仍重播正确单词。

## WORD LAB 学单词

独立的输出练习模块：认读 → 拼写 → 造句。

- 首批 80 个重点词，全部来自已有的 840 词：44 个外研五上/五下核心词 + 36 个拓展词。
- 每 5 个词一组，共 16 组；每个词三步完成后计入“已掌握”。
- 造句使用适当从句和简单时态；拼句前会显示中文意思，完成后显示“句型 / 时态”。
- 认读页的英文例句有独立的“例句”朗读按钮，使用本地音频。
- 支持全部 / 课本 / 拓展筛选、随机 5 个、单字练习；进度存在 `wordwave.wordlab.v1`。

## 文件

- `index.html` — 页面、样式、交互
- `data.js` — 42 组 / 840 词数据（其中 44 个外研核心词）
- `lab.js` — WORD LAB 80 个重点词、例句与语法提示
- `audio/words/` — 840 个单词发音（en-GB）
- `audio/ui/` — 6 种随机答对提示、每批鼓励、频道完成鼓励、全对鼓励
- `audio/lab/sentences/` — 80 个 WORD LAB 例句朗读（en-GB）
- `fonts/fredoka-latin.woff2` — 本地字体
- `favicon.svg` — 站点图标
- `manifest.json` — PWA 清单（名称、图标、独立窗口）
- `sw.js` — Service Worker，离线缓存
- `icons/` — PWA / 主屏幕图标
- `qr-lan.png` — 本机生成的可选二维码；换机后 IP 会变，需要重新生成或直接发 URL（发布包未包含）
- `start-server.sh` — 本地静态服务启动脚本
- `DEPLOY.md` — 移植、手机访问、DSH 智能体部署说明
- `dsh-deploy.json` — 机器可读的部署清单

## 说明

- 发音为本地音频，不依赖浏览器 TTS；播放失败时会回退到 `speechSynthesis`。
- 含义图采用大号 emoji + 设计舞台，保证离线可用，不依赖外部图片。
- “课本词”筛选标记的是 44 个外研社（三起）五上/五下核心词，按拼读规则能自然分组的词收录；**不是完整教材词表**，后续可按单元继续补全。
- 拼读进度保存在 `localStorage` 的 `wordwave.progress.v1`；WORD LAB 进度保存在 `wordwave.wordlab.v1`。页面底部重置会同时清空两者（需点两次确认）。
- 支持键盘左右方向键切词、Esc 关闭弹层、`prefers-reduced-motion` 下关闭 confetti。
- 教材词表仅用于核对：五上 <https://yyld.51jiaoxi.com/wushang/wybsq_danci.html>；五下 <https://yyld.51jiaoxi.com/wuxia/wybsq_danci.html>。
