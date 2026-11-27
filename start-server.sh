#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js >= 22.5。请先安装 Node，再运行本脚本。" >&2
  exit 1
fi

if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); if (a < 22 || (a === 22 && b < 5)) process.exit(1)' >/dev/null 2>&1; then
  echo "当前 Node 版本：$(node -v)，需要 >= 22.5（内置 node:sqlite）。" >&2
  exit 1
fi

# 可选：./start-server.sh 8790 覆盖 .env 里的 PORT
if [ "${1:-}" != "" ]; then
  export PORT="$1"
fi
PORT_DISPLAY="${PORT:-$(node --input-type=module -e 'import("./server/config.js").then((m) => console.log(m.createConfig().port))' 2>/dev/null || echo 8787)}"

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "${LAN_IP}" ] && command -v ipconfig >/dev/null 2>&1; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi

echo "WORDWAVE 单词声波站"
echo "学习端：http://127.0.0.1:${PORT_DISPLAY}/"
echo "管理后台：http://127.0.0.1:${PORT_DISPLAY}/admin"
if [ -n "${LAN_IP}" ]; then
  echo "手机同 Wi-Fi：http://${LAN_IP}:${PORT_DISPLAY}/"
fi
echo "首次使用请先创建管理员：npm run create-admin -- --username admin --password '至少8位密码'"
echo "按 Ctrl+C 停止。安装到手机主屏幕需要 HTTPS。"
exec node server/index.js
