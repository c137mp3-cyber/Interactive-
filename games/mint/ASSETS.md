# Графика Монетного двора

Положите PNG с этим именем в `games/mint/assets/`, и заглушка заменится сама. Все файлы необязательные. Кроме `bg`, нужен прозрачный фон.

| Файл | Размер | Запрос для генерации |
|---|---|---|
| `bg.png` | 1080×1920 | Cozy medieval mint workshop interior, glowing furnace, stone walls, cartoon game art, no text. |
| `press_frame.png` | 960×1000 | Wooden and iron coin press frame with an empty centre, front view, cartoon game art. |
| `press_head.png` | 680×430 | Heavy iron coin stamp hanging from a piston, front view, cartoon game art. |
| `chest_back.png` | 689×454 | Открытый пустой сундук без крышки, вид сверху спереди. Целиком. |
| `chest_front.png` | 689×218 | Нижняя часть того же сундука (передняя стенка), та же ширина, обрезана по верхней кромке стенки. |
| `legend.png` | 1960×208 | Long empty wooden sign with brass corners, cartoon game art, no text. |
| `anvil.png` | 621×367 | Наковальня сбоку без пня, плоская верхняя грань. |
| `wall.png` | 2040×96 | Long horizontal brass rail, cartoon game art. |
| `belt.png` | 1286×118 | Нарисованная лента подачи, бесшовная по горизонтали (едет вместе с монетой). |
| `rope.png` | 218×93 | Один виток верёвки, повторяется вдоль подвеса бронзовой монеты. |
| `coin_bronze.png` | 640×640 | Round bronze coin frame with an empty transparent centre, top view, cartoon game art. |
| `coin_silver.png` | 640×640 | То же, silver. |
| `coin_gold.png` | 640×640 | То же, gold. |
| `coin_ruby.png` | 640×640 | То же, ruby-red. |
| `coin_diamond.png` | 640×640 | То же, icy blue diamond. |

Отверстие монеты: по центру, 70% диаметра (константа `HOLE` в `game.js`). Туда встаёт аватарка.

Если генератор не даёт прозрачный фон, просите зелёный: я уберу его при загрузке.

Готовы: bg, chest_back, chest_front, press_frame, press_head, anvil, legend, wall, belt, rope, пять монет. Всё остальное рисуется кодом.
