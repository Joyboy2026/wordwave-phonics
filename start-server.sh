#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8765}"
if ! command -v python3 >/dev/null 2>&1; then
  echo "需要 Python 3。请先安装 python3（Windows 可用 py -3）。" >&2
  exit 1
fi
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "${LAN_IP}" ] && command -v ipconfig >/dev/null 2>&1; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
echo "WORDWAVE 单词声波站"
echo "电脑本机: http://127.0.0.1:${PORT}/"
if [ -n "${LAN_IP}" ]; then
  echo "手机同 Wi-Fi: http://${LAN_IP}:${PORT}/"
fi
echo "按 Ctrl+C 停止。"
echo "提示：这个 HTTP 地址可直接浏览；安装到手机主屏幕需要 HTTPS 部署。"
exec python3 -m http.server "${PORT}" --bind 0.0.0.0
