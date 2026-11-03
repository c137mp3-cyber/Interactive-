#!/data/data/com.termux/files/usr/bin/sh
# Один раз: создаёт команду coin. После этого в Termux достаточно написать: coin
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="${PREFIX:-/data/data/com.termux/files/usr}/bin/coin"
cat > "$BIN" <<EOT
#!/data/data/com.termux/files/usr/bin/sh
# coin [ник]: обновиться с GitHub и запустить мост. Адрес игры: http://localhost:8080
exec sh "$DIR/start.sh" "\$@"
EOT
chmod +x "$BIN" "$DIR/start.sh"
echo "Готово. Теперь пиши в Termux: coin"
echo "Другой ник: coin ник"
