#!/data/data/com.termux/files/usr/bin/sh
# Запуск: ./start.sh [ник]. Каждый раз забирает свежую версию с GitHub, ставит пакеты при необходимости
# и перезапускает мост, если он упал. Ctrl+C останавливает всё.
# Всё внутри функции: скрипт читается целиком до запуска, и обновление самого start.sh посреди работы ему не мешает
DIR="$(cd "$(dirname "$0")" && pwd)"
main() {
cd "$DIR" || exit 1
NICK="${1:-${COIN_NICK:-c137mp3}}"
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock   # не давать планшету уснуть вместе с Termux
echo "обновляю с GitHub..."
if git fetch -q origin 2>/dev/null; then
  git reset -q --hard origin/main && echo "версия: $(git log -1 --format='%h %s' | cut -c1-70)"
else
  echo "нет интернета, запускаю как есть"
fi
[ -d node_modules/ws ] && [ -d node_modules/tiktok-live-connector ] || npm install
while true; do
  node bridge.js "$NICK"
  code=$?
  [ "$code" -ge 128 ] && exit "$code"   # остановили вручную
  echo "мост остановился (код $code), перезапуск через 3 секунды..."
  sleep 3
done
}
main "$@"
exit $?
