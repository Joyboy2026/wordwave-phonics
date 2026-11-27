#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PORT="${1:-8765}"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "${LAN_IP}" ] && command -v ipconfig >/dev/null 2>&1; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "需要 Python 3 做静态预览。完整账号模式请改用：npm start" >&2
  exit 1
fi

echo "WORDWAVE 单词声波站 · 静态预览"
echo "本机：http://127.0.0.1:${PORT}/?static=1"
if [ -n "${LAN_IP}" ]; then
  echo "手机同 Wi-Fi：http://${LAN_IP}:${PORT}/?static=1"
fi
echo "静态模式不登录、不收费、不云同步，学习记录只存本机。"
echo "完整账号 / 付费 / 管理后台：npm start（默认 8787）"
echo "按 Ctrl+C 停止。安装到手机主屏幕需要 HTTPS。"
exec python3 -m http.server "${PORT}" --bind 0.0.0.0
