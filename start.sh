#!/data/data/com.termux/files/usr/bin/sh
cd "$(dirname "$0")"
git pull --ff-only
[ -d node_modules/ws ] && [ -d node_modules/tiktok-live-connector ] || npm install
node bridge.js "$@"
