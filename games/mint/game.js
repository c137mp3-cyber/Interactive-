// МОНЕТНЫЙ ДВОР. Подарок -> монета с аватаркой -> сундук. Вся картинка рисуется кодом,
// пока в папке assets нет файла с нужным именем (см. ASSETS.md).
(function () {
'use strict';
const cv = document.getElementById('c'), g = cv.getContext('2d');
const TAU = Math.PI * 2, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3, easeIn = t => t * t * t, rand = (a, b) => a + Math.random() * (b - a);
const FONT = 'Rubik,system-ui,sans-serif';

// Какая цена подарка даёт какую монету
const TIERS = [
  { id: 'bronze',  min: 1,   name: 'Rose',         emoji: '🌹', c: ['#f6c594', '#b36d33', '#6b3a17'], burst: 10 },
  { id: 'silver',  min: 5,   name: 'Finger Heart', emoji: '🫰', c: ['#f8fafc', '#aab6c4', '#5f6a78'], burst: 16 },
  { id: 'gold',    min: 20,  name: 'Dombra',       emoji: '🪕', c: ['#fff3ad', '#ecbb22', '#8f640a'], burst: 26 },
  { id: 'ruby',    min: 30,  name: 'Doughnut',     emoji: '🍩', c: ['#ffb0bb', '#e0244d', '#760a24'], burst: 40 },
  { id: 'diamond', min: 199, name: 'Night Star',   emoji: '🌠', c: ['#ecfdff', '#5cdcf8', '#2868d0'], burst: 70 }
];
const tierOf = coins => { let n = 0; TIERS.forEach((t, i) => { if (coins >= t.min) n = i; }); return n; };
const VALUE_FIX = { 199: 200 };   // подарок за 199 даёт ровно 200 монет в сундук (два сундука); можно добавить свои цены
const MAX_CHESTS = 3;   // одна монета наполняет не больше стольких сундуков подряд, остальное сгорает
const GOALS = [100];   // сколько монет нужно на каждый взрыв сундука; можно задать рост: [100, 300, 700]
// Гравировка: картинка или буква зрителя переводится в цвет металла монеты с рельефом
const ENGRAVE = { on: true, color: .1, relief: 2.4, tone: .32, lines: .7 };   // color: сколько оставить родного цвета фото
// Комбо: подарки одного зрителя с паузой не больше COMBO.gap мс; на ×5 монета на ступень дороже, на ×10 ещё на ступень
const COMBO = { gap: 20000, max: 10, steps: [5, 10] };
// Бесплатные монеты: за каждые LIKES.step лайков от одного зрителя и за первую подписку в эфире. Двигают полосу на +1
const LIKES = { step: 500, odds: [.50, .35, .15] };          // бронза / серебро / золото
const FOLLOW = { odds: [0, .60, .35, .05] };                  // серебро / золото / рубин
const pickTier = odds => { let r = Math.random(); for (let i = 0; i < odds.length; i++) { if ((r -= odds[i]) < 0) return i; } return odds.length - 1; };
const curGoal = () => GOALS[Math.min(level, GOALS.length - 1)];
const TEMPO = 1.6;   // во сколько раз медленнее идёт анимация при небольшой очереди (1 = как раньше)

// Необязательная графика: файл появился в assets -> заглушка заменяется сама
const ASSETS = window.MINT_NO_ASSETS ? [] : ['bg', 'press_frame', 'press_head', 'anvil', 'chest_back', 'chest_front', 'legend', 'wall', 'belt', 'rope', 'leg', 'chest_dome', 'chest_lid', 'king_medal', 'king_crown', 'gift_0', 'gift_1', 'gift_2', 'gift_3', 'gift_4', 'wheel', 'wheel_stand', 'wheel_pointer', 'lantern',
  ...TIERS.map(t => 'coin_' + t.id)];
const BUILD = 25;   // увеличивайте при каждом обновлении: сбрасывает кэш картинок и скрипта
const art = {};
ASSETS.forEach(n => { const i = new Image(); i.onload = () => { art[n] = i; if (n.startsWith('chest')) { layoutChest(); if (!total) initMound(); } if (n.startsWith('coin_')) blanks.fill(null); }; i.src = 'assets/' + n + '.png?v=' + BUILD; });

// Экран: заполняем его целиком, без чёрных полос
const W = 1080, H = 1400;          // сцена: все координаты считаются в ней
const SAFE = { top: .13, bottom: .72 }; // TikTok закрывает верх (шапка) и низ (чат): игра живёт между ними
const HOLE = .70;                     // диаметр отверстия в рамках монет, доля от диаметра монеты
const CHEST_W = 600;
const FRAME = { w: 668, h: 848, hole: [150, 171, 514, 680], s: .55 };   // размеры press_frame.png и отверстие в нём
const ANVIL = { fx: 400, fy: 6, s: .5 };                                // точка верхней грани на картинке наковальни
let SCW = 1080, SCH = 1920, ox = 0, oy = 0, scale = 1, dpr = 1;
const L = {};
function resize() {
  const iw = innerWidth, ih = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(iw * dpr); cv.height = Math.round(ih * dpr);
  SCW = iw; SCH = ih;
  const tall = ih / iw > 1.3, top = ih * (tall ? SAFE.top : .02), bot = ih * (tall ? SAFE.bottom : .98);
  scale = Math.min(iw / W, (bot - top) / H);
  ox = (iw - W * scale) / 2; oy = top + ((bot - top) - H * scale) / 2;
  L.cx = W / 2;
  L.legendY = 70; L.rope = 170; L.heroY = 575; L.anvil = 770; L.pressTop = L.anvil - 370; L.queueTop = 420;
  L.chestTop = 1060; L.chestBot = Math.min(1390, L.chestTop + 330);
  bg = null; vig = null; layoutChest(); if (!mound) initMound();
}
// Сундук: с картинкой (задняя часть + передняя стенка) или нарисованный кодом
function layoutChest() {
  const b = art.chest_back, f = art.chest_front;
  if (b && f) {
    const cs = CHEST_W / b.width, h = b.height * cs, y = 1388 - h;
    L.art = { cs, x: L.cx - CHEST_W / 2, y, w: CHEST_W, h, fy: y + (b.height - f.height) * cs, fh: f.height * cs };
    L.rimY = L.art.fy; L.goalY = y - 36; L.mBase = L.rimY + 60; L.slotY = L.rimY - 44;
    L.capH = (L.rimY - y) * .95; L.slotHW = 170; L.pileY = L.rimY - 110;
  } else {
    L.art = null; L.goalY = L.chestTop - 132; L.mBase = L.chestBot; L.slotY = L.chestBot - 118;
    L.capH = L.chestBot - L.chestTop - 110; L.slotHW = 300; L.pileY = L.chestTop;
  }
}
addEventListener('resize', resize);

// Аватарки
const avatars = new Map();
function letterAvatar(user, uid) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); let h = 0;
  for (const ch of uid) h = (h * 31 + ch.codePointAt(0)) % 360;
  x.fillStyle = `hsl(${h} 55% 42%)`; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#fff'; x.font = `900 66px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText([...user][0] || '?', 64, 70);
  return c;
}
function avatarOf(j) {
  let a = avatars.get(j.uid);
  if (a) { if (j.pic && !a.tried) loadPic(a, j.pic); return a; }
  a = { src: letterAvatar(j.user, j.uid), v: 0 };
  avatars.set(j.uid, a);
  if (j.pic) loadPic(a, j.pic);
  return a;
}
function loadPic(a, src) { a.tried = true; const i = new Image(); i.onload = () => { a.src = i; a.v++; a.thumb = null; }; i.src = src; }
function thumb(a) {
  if (a.thumb) return a.thumb;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d'); x.beginPath(); x.arc(48, 48, 46, 0, TAU); x.clip();
  x.drawImage(a.src, 0, 0, 96, 96);
  return a.thumb = c;
}

// Монета: рамка своего металла, внутри аватарка
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function engrave(src, ti, n) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n), p = d.data, N = n * n, L0 = new Float32Array(N), Ln = new Float32Array(N);
  for (let i = 0; i < N; i++) L0[i] = (p[i * 4] * .299 + p[i * 4 + 1] * .587 + p[i * 4 + 2] * .114) / 255;
  // лёгкое размытие против шума
  for (let y = 0; y < n; y++) for (let xx = 0; xx < n; xx++) {
    let s = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xq = xx + dx; if (yy >= 0 && yy < n && xq >= 0 && xq < n) { s += L0[yy * n + xq]; k++; } }
    Ln[y * n + xx] = s / k;
  }
  // растягиваем контраст: тёмные и светлые фото выглядят одинаково
  const sorted = Float32Array.from(Ln).sort(), lo = sorted[Math.floor(N * .03)], hi = sorted[Math.floor(N * .97)], span = Math.max(.08, hi - lo);
  for (let i = 0; i < N; i++) Ln[i] = clamp((Ln[i] - lo) / span);
  // второе размытие даёт гладкий рельеф: картинка становится выпуклой, как отчеканенная
  const Hh = new Float32Array(N);
  for (let y = 0; y < n; y++) for (let xx = 0; xx < n; xx++) {
    let s2 = 0, k2 = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xq = xx + dx; if (yy >= 0 && yy < n && xq >= 0 && xq < n) { s2 += Ln[yy * n + xq]; k2++; } }
    Hh[y * n + xx] = s2 / k2;
  }
  const [cl, cm, cd] = TIERS[ti].c.map(hexRgb), half = n / 2, kr = ENGRAVE.relief * 3 * (224 / n);
  for (let y = 0; y < n; y++) for (let xx = 0; xx < n; xx++) {
    const i = y * n + xx, v = Ln[i], xr = Math.min(n - 1, xx + 1), yd = Math.min(n - 1, y + 1), xl = Math.max(0, xx - 1), yu = Math.max(0, y - 1);
    const gx = Hh[y * n + xr] - Hh[y * n + xl], gy = Hh[yd * n + xx] - Hh[yu * n + xx];
    const shade = .5 + (gx + gy) * kr;                                                   // свет сверху-слева
    const edge = Math.abs(Ln[y * n + xr] - Ln[y * n + xl]) + Math.abs(Ln[yd * n + xx] - Ln[yu * n + xx]);
    const dx = (xx - half) / half, dy = (y - half) / half, rr = Math.sqrt(dx * dx + dy * dy);
    let t = .34 + ENGRAVE.tone * (v - .5) + (shade - .5) * 1.25 - edge * ENGRAVE.lines * .5 + (Math.random() - .5) * .035;
    t *= 1 - .18 * rr * rr;                                                               // чаша: к краю темнее
    t -= .2 * clamp((rr - .84) / .16) * (dy < 0 ? 1 : .35);                              // тень от ободка сверху
    t = clamp(t);
    let m = t < .5 ? [0, 1, 2].map(k => cd[k] + (cm[k] - cd[k]) * t * 2) : [0, 1, 2].map(k => cm[k] + (cl[k] - cm[k]) * (t - .5) * 2);
    const sp = clamp((shade - .78) * 2.5); if (sp > 0) m = m.map(q => q + (255 - q) * sp * .7);   // блик на выпуклостях
    for (let k = 0; k < 3; k++) p[i * 4 + k] = m[k] + (p[i * 4 + k] - m[k]) * ENGRAVE.color;
  }
  x.putImageData(d, 0, 0);
  return c;
}
function makeCoin(a, ti, free) {
  const S = 320, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), t = TIERS[ti], R = S / 2, frame = art['coin_' + t.id];
  if (!frame) {
    const m = x.createLinearGradient(0, 0, S, S); m.addColorStop(0, t.c[0]); m.addColorStop(.5, t.c[1]); m.addColorStop(1, t.c[2]);
    x.fillStyle = m; x.beginPath();
    const teeth = 56;
    for (let i = 0; i <= teeth * 2; i++) { const r = R - (i % 2 ? 2 : 8), q = i / teeth * Math.PI; x.lineTo(R + Math.cos(q) * r, R + Math.sin(q) * r); }
    x.fill();
    x.lineWidth = 7; x.strokeStyle = t.c[2]; x.beginPath(); x.arc(R, R, R - 30, 0, TAU); x.stroke();
    x.lineWidth = 4; x.strokeStyle = t.c[0]; x.beginPath(); x.arc(R, R, R - 21, 0, TAU); x.stroke();
  }
  const hr = frame ? S * HOLE / 2 * 1.05 : R - 36;
  x.save(); x.beginPath(); x.arc(R, R, hr, 0, TAU); x.clip();
  let eng = null;
  if (ENGRAVE.on) try { eng = engrave(a.src, ti, Math.round(hr * 2)); } catch (e) { eng = null; }   // чужая картинка без доступа: обычный режим
  if (eng) x.drawImage(eng, R - hr, R - hr, hr * 2, hr * 2);
  else {
    x.drawImage(a.src, R - hr, R - hr, hr * 2, hr * 2);
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = .38; x.fillStyle = t.c[0]; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  }
  const gl = x.createLinearGradient(0, 40, S, S); gl.addColorStop(0, 'rgba(255,255,255,.30)'); gl.addColorStop(.42, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.22)');
  x.fillStyle = gl; x.fillRect(0, 0, S, S);
  x.restore();
  if (frame) x.drawImage(frame, 0, 0, S, S);
  if (free) { x.fillStyle = '#d81e45'; x.beginPath(); x.arc(S * .8, S * .8, 40, 0, TAU); x.fill(); x.lineWidth = 6; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = '#fff'; x.font = `900 44px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♥', S * .8, S * .8 + 3); }
  c.tier = ti; return c;
}
const blanks = TIERS.map(() => null);
function blankCoin(ti) {
  if (blanks[ti]) return blanks[ti];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), t = TIERS[ti], m = x.createLinearGradient(0, 0, 128, 128), frame = art['coin_' + t.id];
  m.addColorStop(0, t.c[0]); m.addColorStop(.55, t.c[1]); m.addColorStop(1, t.c[2]);
  x.fillStyle = m; x.beginPath(); x.arc(64, 64, frame ? 64 * HOLE * 1.05 : 62, 0, TAU); x.fill();
  if (frame) x.drawImage(frame, 0, 0, 128, 128);
  else { x.lineWidth = 5; x.strokeStyle = t.c[2]; x.beginPath(); x.arc(64, 64, 46, 0, TAU); x.stroke(); }
  c.tier = ti; return blanks[ti] = c;
}

// Состояние
const queue = []; let dirty = false, job = null;
const wall = [], parts = [], flyers = [], tiny = [], rings = [], spots = [], twinkles = [];
const donors = new Map(); let topDonors = [];
let carry = null, barV = 0, landedExtra = 0, chain = 0, lidT = 0, lidFly = -1, build = null, burstHold = 0, lvlBadge = 0, cine = 0, lvlT = 0, hitstop = 0, anvilKick = 0, embers = [], emberAcc = 0, shake = 0, pressShake = 0, chestPop = -1, flash = 0, flashColor = '#fff', pressY = 0, chestKick = 0, level = 0, value = 0, total = 0, connected = !Live.local, time = 0, sprites = [];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const combos = new Map(), likeAcc = new Map(), followed = new Set(), ownerWins = new Map();
let owner = null, lastLander = null;
function addGift(m) {
  const coins = Math.max(1, +m.coins || 1), count = Math.max(1, +m.count || 1), free = !!m.free, now = performance.now();
  const uid = String(m.uid || m.user || 'v');
  let tier = m.tier ?? tierOf(coins), base = tier, combo = 0;
  if (!free) {
    const c = combos.get(uid); combo = c && now - c.last <= COMBO.gap ? Math.min(COMBO.max, c.n + 1) : 1;
    combos.set(uid, { n: combo, last: now });
    tier = Math.min(4, tier + COMBO.steps.filter(s => combo >= s).length);
  }
  const j = { user: String(m.user || 'Viewer'), uid, pic: m.pic || '', coins, count, tier, base, combo, free, src: m.src || '', value: free ? 1 : (VALUE_FIX[coins] || coins) * count, at: now };
  avatarOf(j);
  queue.push(j); dirty = true;
  if (free) return;
  const d = donors.get(j.uid) || { user: j.user, uid: j.uid, pic: j.pic, sum: 0 };
  d.sum += coins * count; d.user = j.user; if (j.pic) d.pic = j.pic;
  donors.set(j.uid, d);
  topDonors = [...donors.values()].sort((a, b) => b.sum - a.sum).slice(0, 3);
}
function freeCoin(m, src, tier) { addGift({ user: m.user, uid: m.uid || m.user, pic: m.pic, coins: 1, count: 1, free: true, tier, src }); }
function onLikeUser(m) {
  if (!m.uid && !m.user) return;
  const uid = String(m.uid || m.user), n = (likeAcc.get(uid) || 0) + (+m.count || 1);
  likeAcc.set(uid, n % LIKES.step);
  for (let k = 0; k < Math.floor(n / LIKES.step) && k < 3; k++) freeCoin(m, 'like', pickTier(LIKES.odds));
}
function onFollow(m) {
  const uid = String(m.uid || m.user || ''); if (!uid || followed.has(uid)) return;   // только первая подписка за эфир
  followed.add(uid); freeCoin(m, 'follow', pickTier(FOLLOW.odds));
}
// Дорогие подарки идут раньше, но ожидание тоже поднимает зрителя: 20 секунд = одна ступень
function score(j, now) { return (j.free ? -5 : j.tier) + (now - j.at) / 20000; }   // бесплатные идут после платных
function sortQueue() { const now = performance.now(); queue.sort((a, b) => score(b, now) - score(a, now)); dirty = false; }

function startNext() {
  if (!belt.length || build || spin || burstHold > 0 || value >= curGoal()) return;
  if (lidFly >= 0 || chestPop >= 0 || flyers.length || tiny.some(p => p.spin && p.y < H + 60)) return;   // ждём, пока доиграет взрыв и осыплются монеты прошлого игрока
  const G = beltGeo(); if (belt[0].bx < G.endX - 2) return;   // монета ещё едет к упору
  const j = belt.shift(); j.x0 = j.bx; j.king = !!(owner && owner.uid === j.uid);
  j.avatar = avatarOf(j); j.sprite = makeCoin(j.avatar, j.tier, j.free); j.v = j.avatar.v;
  j.ph = 0; j.t = 0; j.dur = [.7, .15, .1, .32, .3 + j.tier * .08, .6 + j.tier * .45, .42];
  const q = queue.length + belt.length;
  const slow = lerp(TEMPO, 1, clamp((q - 2) / 20));   // чем длиннее очередь, тем меньше замедление
  j.speed = (q <= 2 ? 1 : lerp(1.25, 4, clamp((q - 2) / 40))) / slow;
  if (j.tier >= 3 && q < 30) j.speed = Math.min(j.speed, 1.3 / slow);
  job = j;
}
function nextPhase() {
  const j = job; j.ph++; j.t = 0;
  if (j.ph === 1) sfx('whoosh');
  if (j.ph === 2) strike(j);
  if (j.ph === 5) heroStart(j);
  if (j.ph === 5) { sfx('ta', j.tier); if (j.tier >= 2) burst(L.cx, L.heroY, TIERS[j.tier], TIERS[j.tier].burst, 700); if (j.tier >= 3) { flash = j.tier === 4 ? .5 : .25; flashColor = TIERS[j.tier].c[1]; } }
  if (j.ph === 6) {   // в сундук падает столько монет, сколько стоит подарок, и на каждой лицо дарителя
    j.value = Math.min(j.value, curGoal() * MAX_CHESTS);
    const n = Math.min(80, Math.max(1, j.value)), sp = j.sprite;
    const w = j.value / n; j.flyW = (n - 1) * w;
    const S = n > 1 ? pourCoins(n - 1, () => sp, L.cx, L.heroY, .08, 1, { w }) : 0; if (n > 6) sfx('pour');
    j.slot = takeSlot(); j.dur[6] = .42 + S * j.speed + .1;
    addWall(j);
  }
  if (j.ph >= j.dur.length) land(j);
}
function strike(j) {
  hitstop = .045 + j.tier * .012; anvilKick = 1;
  pressShake = Math.max(pressShake, 7 + j.tier * 3); sfx('clank', j.tier);
  burst(L.cx, L.anvil - 30, TIERS[j.tier], 14 + j.tier * 6, 560);
  ring(L.cx, L.anvil + 30, 170 + j.tier * 30, '#ffffff', .35, 12);
  if (j.avatar.v !== j.v) j.sprite = makeCoin(j.avatar, j.tier, j.free);
  puff(L.cx, L.anvil - 40, 7); sfx('steam');
}
// прибавить к сундуку; монета, которая переполнила сундук, сама же и переходит в следующий
function commitValue(v, sprite) { const goal = curGoal(); if (value < goal && value + v >= goal) carry = sprite; value += v; }
function land(j) {
  for (const f of flyers) if (f.slot) { bake(f.sprite, f.slot); } flyers.length = 0;   // докидываем мелочь, чтобы монета зрителя легла сверху
  bake(j.sprite, j.slot); sfx('clink', j.tier); chestKick = 1; total++;
  burst(j.slot.x, j.slot.y, TIERS[j.tier], 6, 260);
  ring(j.slot.x, j.slot.y, 70, TIERS[j.tier].c[0], .3, 6);
  spots.push({ x: j.slot.x, y: j.slot.y, tier: j.tier }); if (spots.length > 40) spots.shift();
  sprites.push({ s: j.sprite, tier: j.tier }); if (sprites.length > 30) sprites.shift();
  landedExtra = Math.max(0, landedExtra - (j.flyW || 0)); commitValue(j.value, j.sprite); if (!j.free) lastLander = j;
  job = null;
}
function dropMedal(it) {
  if (it.px == null) return;
  wallFall.push({ sprite: it.sprite, x: it.px, y: it.py, vx: rand(-80, 80), vy: -rand(120, 260), a: 0, va: rand(-6, 6), life: 2.2 });
}
function addWall(j) {
  const v = j.coins, old = wall.find(w => w.uid === j.uid);
  if (old) { if (v < old.value) return; }
  const it = { uid: j.uid, user: j.user, value: v, tier: j.tier, sprite: j.sprite, swing: 0, at: performance.now(), fly: { x: L.cx, y: L.heroY, r: heroR(j) * .6 } };
  const rest = wall.filter(w => w !== old).concat(it).sort((a, b) => b.value - a.value || b.at - a.at);
  if (rest.indexOf(it) >= 7) return;                        // не попала в семёрку: доска не меняется
  if (old) { it.cx = old.cx; dropMedal(old); }
  wall.length = 0; wall.push(...rest.slice(0, 7));
  rest.slice(7).forEach(dropMedal);
}
function startBuild() {
  build = { t: 0, d: chain ? .9 : 1.6, next: 0 }; lidT = 0; sfx('build');
  if (lastLander) { const b = (ownerWins.get(lastLander.uid) || 0) + 1; ownerWins.set(lastLander.uid, b); owner = { uid: lastLander.uid, user: lastLander.user, b, at: performance.now() + 1300 }; }
}
// Сундук переполнен: дрожит, светится и взрывается фонтаном монет
function doBurst() {
  value = Math.max(0, value - curGoal()); level++; barV = 0; landedExtra = 0;   // остаток целиком переходит в следующий сундук, ничего не теряется
  chain = value >= curGoal() ? chain + 1 : 0;
  lanternKick = 1; sfx('win', 4); flash = .55; flashColor = '#fff1a8'; chestPop = 0; chestKick = 0;
  const pool = chestCoins.length ? chestCoins.slice() : [blankCoin(0)];
  for (let i = 0; i < 72; i++) {
    const own = i < 30, sp = pool[Math.floor(rand(0, pool.length))], ti = sp.tier || 0;
    tiny.push({ spin: true, sprite: sp, tier: ti, x: L.cx + rand(-L.slotHW, L.slotHW), y: L.pileY + rand(0, 70),
      vx: rand(-560, 560), vy: -rand(950, 1800), r: own ? rand(40, 62) : rand(22, 38), ang: rand(0, TAU), vang: rand(-14, 14), life: rand(2.2, 3.2), grow: i % 14 === 0 ? rand(45, 80) : 0 });
  }
  ring(L.cx, L.pileY, 760, '#fff1a8', .8, 20); ring(L.cx, L.pileY, 520, '#ffb12b', .65, 14, -.12); ring(L.cx, L.pileY, 300, '#ffffff', .4, 10);
  burst(L.cx, L.pileY, TIERS[2], 100, 1300);
  lvlT = 1.6; lvlBadge = 1.9; spots.length = 0; burstHold = chain ? .55 : 1.1; lidFly = 0; chestCoins.length = 0;
  initMound();
}
function heroStart(j) {
  const t = TIERS[j.tier], r = heroR(j);
  if (j.king) { sfx('king'); kingPulse = 1; flash = Math.max(flash, .3); flashColor = '#ffd36b'; ring(L.cx, L.heroY, r * 2.6, '#ffd36b', .8, 16); }
  if (j.tier >= 2) ring(L.cx, L.heroY, r * 2.1, t.c[0], .6, 14);
  if (j.tier >= 3) { ring(L.cx, L.heroY, r * 2.8, t.c[1], .8, 10, -.18);
    for (let i = 0; i < (j.tier === 4 ? 42 : 24); i++) tiny.push({ sprite: blankCoin(j.tier), x: rand(0, W), y: rand(-420, -40), vx: rand(-60, 60), vy: rand(80, 380), r: rand(16, 30), a: rand(0, TAU), va: rand(-6, 6), life: 3.2 }); }
}
function ring(x, y, r1, color, d = .5, w = 10, t = 0) { rings.push({ x, y, r1, color, d, w, t }); }
function burst(x, y, t, n, sp) {
  n = Math.min(n, 120 - Math.min(parts.length, 100));
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(.25, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 170, life: rand(.4, .95), max: .95, size: rand(3, 9), c: t.c[i % 2] }); }
}

// Куча в сундуке запекается в отдельный холст: тысячи монет не тормозят экран.
// Монеты лежат слоями на дне сундука: сначала покрывают дно, потом слои растут горкой.
// Одна монета = одна единица прогресса, поэтому куча всегда показывает, сколько собрано.
let mound, mx, MW = 640, MH = 520, slots = [], pileN = 0;
const PILE = { r: 38, layer: 38, extra: 0 };   // радиус монеты в куче, высота слоя, сколько ещё влезает горкой сверху
function initMound() {
  mound = document.createElement('canvas'); mound.width = MW; mound.height = MH; mx = mound.getContext('2d');
  pileN = 0; buildSlots();
}
function buildSlots() {
  slots = [];
  // дно сундука в координатах картинки chest_back.png: задний край y=150 (x 135..560), передний под кромкой y=238 (x 50..640)
  const A = L.art, cs = A ? A.cs : 1, X = ix => A ? A.x + ix * cs : L.cx - 345 + ix, Y = iy => A ? A.y + iy * cs : L.chestTop + iy;
  const need = curGoal() + PILE.extra; let k = 0, seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  while (slots.length < need && k < 14) {
    const shrink = clamp((k - 1) * .2, 0, .8), lay = [];      // верхние слои уже: получается горка
    for (let iy = 152; iy <= 236; iy += 27) {
      const f = (iy - 150) / 88, x0 = lerp(135, 50, f) + 30, x1 = lerp(560, 640, f) - 30, mid = (x0 + x1) / 2, half = (x1 - x0) / 2 * (1 - shrink);
      const dy = lerp(.4, 1, 1 - shrink), yy = lerp(194, iy, dy);
      const row = Math.max(1, Math.round(half * 2 / 64)), st = (iy / 27) % 2 ? .5 : 0;
      for (let c = 0; c < row + (st ? 0 : 1); c++) {
        const ix = mid - half + (row ? (c + st) * (half * 2 / row) : 0);
        lay.push({ x: X(ix + (rnd() - .5) * 18), y: Y(yy + (rnd() - .5) * 10) - k * PILE.layer, rot: (rnd() - .5) * .9, sq: .5 + rnd() * .38, r: PILE.r * (.92 + rnd() * .14), d: Math.abs(ix - 345) / 300 });
      }
    }
    // сначала монеты ближе к центру, затем к краям; задние раньше передних, чтобы передние ложились сверху
    lay.sort((p, q) => (p.d > .55) - (q.d > .55) || p.y - q.y);
    slots.push(...lay); k++;
  }
}
function takeSlot() {
  if (pileN < slots.length) return slots[pileN++];
  pileN++; const t = slots[slots.length - 1 - Math.floor(rand(0, Math.min(30, slots.length)))];   // сверх 100: ложатся поверх, куча не растёт
  return { ...t, rot: rand(-.5, .5) };
}
const chestCoins = [];   // какие монеты лежат в сундуке сейчас: из них же летит фонтан при взрыве
function bake(sprite, s) {
  chestCoins.push(sprite); if (chestCoins.length > 400) chestCoins.splice(0, chestCoins.length - 400);
  const x = s.x - (L.cx - MW / 2), y = s.y - (L.mBase - MH);
  mx.save(); mx.translate(x, y); mx.rotate(s.rot); mx.scale(1, s.sq);
  mx.shadowColor = 'rgba(0,0,0,.5)'; mx.shadowBlur = 6; mx.shadowOffsetY = 4;
  mx.drawImage(sprite, -s.r, -s.r, s.r * 2, s.r * 2); mx.restore();
}
// n монет летят в сундук одна за другой; первая через delay секунд
function pourCoins(n, pick, fx, fy, delay = 0, spread = 1, extra = {}) {
  const S = Math.min(1.6, n * .04) * spread;
  for (let i = 0; i < n; i++) {
    const slot = takeSlot();
    flyers.push({ sprite: pick(i), x: fx + rand(-60, 60), y: fy + rand(-30, 30), t: -delay - i * S / Math.max(1, n), d: rand(.42, .55), tx: slot.x, ty: slot.y, slot, a: rand(0, TAU), r: slot.r, ...extra });
  }
  return S;
}

// Звук из браузера, без файлов
let ac = null, mute = false;
function unlock() { if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); } loadSounds(); startMusic(); if (ac && ac.state === 'suspended') ac.resume().then(startAmbient); else startAmbient(); }
addEventListener('pointerdown', unlock);
// Звуки из файлов: положите mp3 в games/mint/sounds/ и впишите имя сюда. Чего нет, то синтезируется кодом.
const SOUND_FILES = ['clank', 'build', 'belt_loop', 'amb_forge'];   // например: ['clank', 'clink', 'pour', 'reveal', 'reveal_big', 'win', 'build', 'king', 'whoosh', 'rope', 'belt_loop', 'amb_forge']
const sbuf = {}; let soundsAsked = false;
function loadSounds() {
  if (soundsAsked || !ac) return; soundsAsked = true;
  SOUND_FILES.forEach(n => fetch('sounds/' + n + '.mp3?v=' + BUILD).then(r => r.ok ? r.arrayBuffer() : null)
    .then(b => b && new Promise((ok, no) => ac.decodeAudioData(b, ok, no))).then(d => { if (d) sbuf[n] = d; }).catch(() => {}));
}
function play(n, v = 1, rate = 1, at = 0) {
  const b = sbuf[n]; if (!b) return false;
  const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = b; src.playbackRate.value = rate; gn.gain.value = v;
  src.connect(gn).connect(ac.destination); src.start(ac.currentTime + at); return true;
}
// Фоновая музыка: треки по кругу, тише во время больших моментов
const MUSIC = ['music1', 'music2', 'music3'], MUSIC_VOL = .3;
let music = null, musicOn = true, mi = Math.floor(Math.random() * MUSIC.length), musicVol = 0;
function startMusic() {
  if (music || !MUSIC.length) return;
  music = new Audio(); music.preload = 'auto'; music.volume = 0;
  const go = () => { music.src = 'sounds/' + MUSIC[mi] + '.mp3?v=' + BUILD; music.play().catch(() => {}); };
  music.addEventListener('ended', () => { mi = (mi + 1) % MUSIC.length; go(); });
  go();
}
function updateMusic(dt) {
  if (!music) return;
  const big = build || lvlT > 0 || (job && job.ph >= 4 && job.ph <= 5 && (job.tier >= 3 || job.king));
  const target = mute || !musicOn ? 0 : MUSIC_VOL * (big ? .4 : 1);
  musicVol = lerp(musicVol, target, clamp(dt * 3)); music.volume = clamp(musicVol);
}
function tone(f, d, type, v, at = 0, to) {
  const t = ac.currentTime + at, o = ac.createOscillator(), n = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  n.gain.setValueAtTime(v, t); n.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(n).connect(ac.destination); o.start(t); o.stop(t + d);
}
let noiseBuf = null;
function noise(d, f, q, v, at = 0, type = 'bandpass', to) {
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const a = noiseBuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  const t = ac.currentTime + at, src = ac.createBufferSource(), fl = ac.createBiquadFilter(), n = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d); fl.Q.value = q;
  n.gain.setValueAtTime(v, t); n.gain.exponentialRampToValueAtTime(.001, t + d);
  src.connect(fl).connect(n).connect(ac.destination); src.start(t, Math.random() * .5); src.stop(t + d);
}
function bell(f, d, v, at = 0) { tone(f, d, 'sine', v, at); tone(f * 2.76, d * .5, 'sine', v * .35, at); tone(f * 5.4, d * .25, 'sine', v * .12, at); }
function sfx(k, ti) {
  if (!ac || mute || ac.state !== 'running') return;
  const file = { whoosh: ['whoosh', .8, 1], clank: ['clank', 1, 1 - (ti || 0) * .04], clink: ['clink', .6, rand(.9, 1.15)], rope: ['rope', .6, rand(.95, 1.05)],
    ta: [(ti || 0) >= 3 ? 'reveal_big' : 'reveal', .9, 1 + (ti || 0) * .04], win: ['win', 1, 1], build: ['build', .9, 1], king: ['king', 1, 1], pour: ['pour', .8, rand(.95, 1.05)] }[k];
  if (file && play(file[0], file[1], file[2])) return;
  if (k === 'whoosh') noise(.22, 600, .8, .06, 0, 'bandpass', 2400);
  if (k === 'clank') {                                          // удар пресса по плите
    tone(170, .22, 'sine', .38, 0, 45); noise(.07, 2600, .7, .26, 0, 'highpass');
    [830, 1313, 2140, 3010].forEach((f, i) => tone(f * (1 + ti * .1), .55 - i * .1, 'sine', .07 / (i + 1) * 2, 0));
  }
  if (k === 'clink') { const r = rand(.94, 1.06) * (1 + ti * .05); [2800, 4150, 5600].forEach((f, i) => tone(f * r, .28 - i * .06, 'sine', .06 / (i + 1))); noise(.03, 5000, 1, .05, 0, 'highpass'); }
  if (k === 'rope') { tone(260, .12, 'sine', .08, 0, 150); noise(.05, 800, 1, .03); }
  if (k === 'ta') { const n = 2 + ti; for (let i = 0; i < n; i++) bell(523 * 2 ** ([0, 4, 7, 12, 16, 19][i] / 12), .55, .09, i * .08); if (ti >= 3) noise(.6, 7000, 2, .04, .1, 'highpass'); }
  if (k === 'win') { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { const f = 392 * 2 ** (s / 12); tone(f, .6, 'sawtooth', .035, i * .09); bell(f * 2, .9, .07, i * .09); }); noise(.9, 6000, 1.5, .06, .1, 'highpass'); }
  if (k === 'build') { noise(1.3, 250, 1.2, .07, 0, 'bandpass', 3200); tone(110, 1.3, 'sawtooth', .03, 0, 440); }
  if (k === 'pour') { const n = 8 + Math.floor(rand(0, 6)); for (let i = 0; i < n; i++) { const at = rand(0, .9), r = rand(.85, 1.2); [2800, 4150].forEach((f, q) => tone(f * r, .2, 'sine', .035 / (q + 1), at)); noise(.03, 5000, 1, .03, at, 'highpass'); } }
  if (k === 'king') { [[392, 0, .14], [392, .15, .14], [523, .3, .5], [659, .3, .5], [784, .3, .6]].forEach(([f, at, d]) => { tone(f, d, 'sawtooth', .045, at); tone(f, d, 'square', .02, at); bell(f * 2, d + .3, .04, at); }); }
  if (k === 'steam') { noise(.7, 4500, .6, .045, .05, 'highpass'); noise(.5, 1200, .5, .02, .05, 'bandpass'); }
  if (k === 'spark') noise(.03 + Math.random() * .03, rand(2500, 6500), 2, .035, 0, 'bandpass');
}
let crackleOn = false;
function crackle() { if (ac && !mute && ac.state === 'running') sfx('spark'); setTimeout(crackle, rand(120, 900)); }
addEventListener('pointerdown', () => { if (!crackleOn) { crackleOn = true; crackle(); } });


// Звук окружения: гул печи, пламя, мехи, далёкий молот, мотор и стук ленты. Всё синтезируется, файлов нет.
let amb = null, ambBuf = null;
function startAmbient() {
  if (amb || !ac || ac.state !== 'running') return;
  if (!ambBuf) {   // 6 секунд «коричневого» шума: мягкий гул без заметного повтора
    ambBuf = ac.createBuffer(1, ac.sampleRate * 6, ac.sampleRate); const d = ambBuf.getChannelData(0); let l = 0;
    for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  }
  const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
  const layer = (buf, type, f, q, v) => {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = buf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; gn.gain.value = v;
    s.connect(fl).connect(gn).connect(out); s.start(0, Math.random() * 3); return { fl, gn };
  };
  if (!noiseBuf) noise(.01, 1000, 1, .0001);
  const rumble = layer(ambBuf, 'lowpass', 140, .7, .5), fire = layer(ambBuf, 'bandpass', 420, .6, .5), motor = layer(noiseBuf, 'bandpass', 800, 5, 0);
  const hum = ac.createOscillator(), hl = ac.createBiquadFilter(), hg = ac.createGain();
  hum.type = 'sawtooth'; hum.frequency.value = 46; hl.type = 'lowpass'; hl.frequency.value = 150; hg.gain.value = 0; hum.connect(hl).connect(hg).connect(out); hum.start();
  amb = { out, rumble, fire, motor, hg, hammer: rand(3, 6), bellows: rand(5, 9), plate: 0, puff: 0 };
}
function updateAmbient(dt) {
  if (!amb) return;
  const t = ac.currentTime, v = clamp(beltV / BELT.vmax), p = clamp(value / curGoal());
  amb.out.gain.setTargetAtTime(mute ? 0 : 1, t, .15);
  amb.puff = Math.max(0, amb.puff - dt * .8);
  // пламя дышит, громче при заполненном сундуке и когда качают мехи
  amb.fire.gn.gain.setTargetAtTime((.2 + .26 * p + amb.puff * .5) * (.75 + .5 * Math.random()), t, .07);
  amb.fire.fl.frequency.setTargetAtTime(380 + 220 * amb.puff + 60 * Math.random(), t, .1);
  amb.rumble.gn.gain.setTargetAtTime(.3 + .14 * p + .3 * anvilKick, t, .2);
  amb.motor.gn.gain.setTargetAtTime(v * .05, t, .08); amb.motor.fl.frequency.setTargetAtTime(600 + 500 * v, t, .1);
  amb.hg.gain.setTargetAtTime(v * .06, t, .1);
  // файлы окружения, если есть: заменяют синтез
  const loop = (n, v) => { const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = sbuf[n]; src.loop = true; src.loopStart = .03; src.loopEnd = sbuf[n].duration - .03; gn.gain.value = v; src.connect(gn).connect(amb.out); src.start(); return gn; };
  if (sbuf.amb_forge && !amb.forge) amb.forge = loop('amb_forge', .55);
  if (sbuf.belt_loop && !amb.beltLoop) { amb.beltLoop = loop('belt_loop', 0); }
  if (amb.forge) { amb.fire.gn.gain.setTargetAtTime(0, t, .2); amb.rumble.gn.gain.setTargetAtTime(.12 * anvilKick, t, .2); }
  if (amb.beltLoop) { amb.beltLoop.gain.setTargetAtTime(v * .4, t, .1); amb.motor.gn.gain.setTargetAtTime(0, t, .1); amb.hg.gain.setTargetAtTime(0, t, .1); }
  if (mute) return;
  // стук пластин ленты о ролики
  const pl = Math.floor(beltScroll / 82); if (pl !== amb.plate) { amb.plate = pl; if (v > .1 && !amb.beltLoop) { noise(.035, 1500, 1.4, .02 + .03 * v, 0, 'bandpass'); tone(120, .06, 'sine', .03 * v); } }
  // далёкий молот в соседней кузнице
  if ((amb.hammer -= dt) <= 0 && !amb.forge) {
    amb.hammer = rand(7, 14); const n = 2 + Math.floor(rand(0, 3)), f = rand(620, 860);
    for (let i = 0; i < n; i++) { const at = i * rand(.38, .5); tone(f, .4, 'sine', .022, at); tone(f * 2.7, .18, 'sine', .008, at); noise(.04, 1300, .8, .018, at, 'bandpass'); }
  }
  // мехи раздувают печь
  if ((amb.bellows -= dt) <= 0) { amb.bellows = rand(10, 18); noise(1.3, 200, .7, .06, 0, 'lowpass', 650); amb.puff = .6; }
}

// Обновление
function update(dt) {
  time += dt;
  if (hitstop > 0) { hitstop -= dt; return; }   // короткая заморозка в момент удара
  anvilKick = Math.max(0, anvilKick - dt * 7);
  updateEmbers(dt);
  if (build) {
    build.t += dt; build.next -= dt;
    if (build.next <= 0) { build.next = rand(.07, .14); sfx('clink', 1); if (lidT < .25 && Math.random() < .6) tiny.push({ sprite: chestCoins.length ? chestCoins[Math.floor(rand(0, chestCoins.length))] : blankCoin(0), x: L.cx + rand(-L.slotHW, L.slotHW), y: L.pileY, vx: rand(-120, 120), vy: -rand(350, 650), r: rand(16, 26), a: rand(0, TAU), va: rand(-8, 8), life: 1.2 }); }
    if (build.t >= build.d) { build = null; doBurst(); }
  }
  if (build) { lidT += dt; if (!build.hit && lidT >= DOME.fall) {   // удар крышки о сундук
    build.hit = 1; sfx('clank', 1); chestKick = 1; pressShake = Math.max(pressShake, 6);
    ring(L.cx, L.pileY + 10, 330, '#ffe3a0', .35, 8); puff(L.cx - 260, L.pileY + 30, 4); puff(L.cx + 260, L.pileY + 30, 4);
  } }
  if (lidFly >= 0) { lidFly += dt; if (lidFly > 1.3) lidFly = -1; }
  burstHold = Math.max(0, burstHold - dt); lvlBadge = Math.max(0, lvlBadge - dt);
  // сундук закрывается только когда он реально полон монетами; в цепочке сначала досыпаем монеты того, кто переполнил
  if (!build && !job && !spin && cam < .03 && burstHold <= 0 && !flyers.length && value >= curGoal() && pileN >= curGoal() + PILE.extra) startBuild();
  else if (!build && !job && !spin && burstHold <= 0 && !flyers.length && pileN < Math.min(value, curGoal() + PILE.extra)) {
    const sp = carry || (sprites.length ? sprites[sprites.length - 1].s : blankCoin(0)), n = Math.min(100, Math.min(value, curGoal() + PILE.extra) - pileN);
    pourCoins(n, () => sp, L.cx, L.pileY - 420, 0, chain ? .45 : 1);
    if (n > 6) sfx('pour');
  }
  updateBelt(dt); updateSpin(dt); updateAmbient(dt); updateMusic(dt); updateDust(dt);
  if (!job) startNext();
  let target = 0;
  if (job) {
    const j = job; j.t += dt * j.speed;
    while (job === j && j.t >= j.dur[j.ph]) { const over = j.t - j.dur[j.ph]; nextPhase(); if (job === j) j.t = over; }
    if (job === j) {
      if (j.ph === 1) target = easeIn(clamp(j.t / j.dur[1]));
      else if (j.ph === 2) target = 1;
      else if (j.ph === 3) target = 1 - easeOut(clamp(j.t / j.dur[3]));
    }
    pressY = target;
  } else pressY = lerp(pressY, 0, clamp(dt * 8));
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += 1100 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt; if (f.t > f.d) { flyers.splice(i, 1); if (f.slot) bake(f.sprite, f.slot); if (f.w) landedExtra += f.w; if (f.commit) commitValue(f.commit, f.sprite); if (Math.random() < .35) sfx('clink', 0); chestKick = Math.max(chestKick, .5); } }
  for (let i = tiny.length - 1; i >= 0; i--) { const p = tiny[i]; p.life -= dt; if (p.life <= 0 || p.y > H + 700) { tiny.splice(i, 1); continue; } p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.spin) { p.ang += p.vang * dt; if (p.grow) p.r += p.grow * dt; } else p.a += p.va * dt; }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].d) rings.splice(i, 1); }
  for (let i = twinkles.length - 1; i >= 0; i--) { twinkles[i].t += dt; if (twinkles[i].t > twinkles[i].d) twinkles.splice(i, 1); }
  if (spots.length && Math.random() < dt * (1.2 + spots.length * .08)) { const p = spots[Math.floor(rand(0, spots.length))]; twinkles.push({ x: p.x + rand(-22, 22), y: p.y + rand(-22, 10), t: 0, d: rand(.5, .9), s: 9 + p.tier * 4, c: TIERS[p.tier].c[0] }); }
  const ct = job && (job.ph === 4 || job.ph === 5) ? [0, .12, .3, .5, .62][job.tier] : 0; cine = lerp(cine, ct, clamp(dt * 5));
  lvlT = Math.max(0, lvlT - dt);
  lanternKick = Math.max(0, lanternKick - .006); shake = 0; pressShake = Math.max(0, pressShake - dt * 60); if (chestPop >= 0) chestPop += dt; if (chestPop > 2) chestPop = -1; flash = Math.max(0, flash - dt * 1.7); chestKick = Math.max(0, chestKick - dt * 4);
  wall.forEach(w => { w.swing = Math.max(0, w.swing - dt * .55); });
  for (let i = wallFall.length - 1; i >= 0; i--) { const f = wallFall[i]; f.life -= dt; f.vy += 1300 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt; if (f.life <= 0 || f.y > H + 200) wallFall.splice(i, 1); }
}

// Печь: мерцание света и искры, привязаны к картинке фона
const FIRE = { x: 112, y: 740 };   // где в bg.png горит огонь
function fireAt() {
  const b = art.bg; if (!b) return null;
  const s = Math.max(SCW / b.width, SCH / b.height);
  return { x: SCW / 2 - b.width * s / 2 + FIRE.x * s, y: SCH / 2 - b.height * s / 2 + FIRE.y * s, s };
}
function updateEmbers(dt) {
  const f = fireAt(); if (!f) return;
  emberAcc += dt * 7;
  while (emberAcc >= 1 && embers.length < 26) { emberAcc--; embers.push({ x: f.x + rand(-26, 26) * f.s, y: f.y + rand(-10, 10) * f.s, vx: rand(-12, 18), vy: -rand(40, 110), life: rand(1.4, 2.8), max: 2.8, ph: rand(0, TAU), z: rand(1.5, 3.5) }); }
  emberAcc %= 1;
  for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.life -= dt; if (e.life <= 0) { embers.splice(i, 1); continue; } e.x += (e.vx + Math.sin(time * 3 + e.ph) * 14) * dt; e.y += e.vy * dt; }
}
function drawFire() {
  const f = fireAt(); if (!f) return;
  const k = .11 + .05 * Math.sin(time * 9) + .04 * Math.sin(time * 23.7 + 1), r = 300 * f.s;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(f.x, f.y, 10, f.x, f.y, r); gr.addColorStop(0, `rgba(255,150,50,${k})`); gr.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = gr; g.fillRect(f.x - r, f.y - r, r * 2, r * 2);
  for (const e of embers) { g.globalAlpha = clamp(e.life / 1.2) * .9; g.fillStyle = '#ffb347'; g.fillRect(e.x, e.y, e.z, e.z); }
  g.restore();
}


// Свет и тени
let vig = null;
function buildVignette() {
  vig = document.createElement('canvas'); vig.width = cv.width; vig.height = cv.height; vig.src = art.bg;
  const v = vig.getContext('2d'), w = vig.width, h = vig.height, b = art.bg, s = Math.max(w / b.width, h / b.height);
  v.imageSmoothingQuality = 'high';
  v.drawImage(b, w / 2 - b.width * s / 2, h / 2 - b.height * s / 2, b.width * s, b.height * s);
  v.fillStyle = 'rgba(12,6,10,.10)'; v.fillRect(0, 0, w, h);   // лёгкое затемнение, чтобы монеты и ники читались
  const gr = v.createRadialGradient(w / 2, h * .48, Math.min(w, h) * .3, w / 2, h * .48, Math.hypot(w, h) * .62);
  gr.addColorStop(0, 'rgba(8,3,6,0)'); gr.addColorStop(.6, 'rgba(8,3,6,.25)'); gr.addColorStop(1, 'rgba(8,3,6,.78)');
  v.fillStyle = gr; v.fillRect(0, 0, w, h);
}
const dust = [];
function updateDust(dt) {
  while (dust.length < 34) dust.push({ x: rand(140, W - 140), y: rand(140, 1100), vx: rand(-6, 6), vy: rand(-14, -4), ph: rand(0, TAU), s: rand(1.5, 3.6), life: rand(6, 14) });
  for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.life -= dt; d.x += (d.vx + Math.sin(time * .7 + d.ph) * 8) * dt; d.y += d.vy * dt; if (d.life <= 0 || d.y < 60) dust.splice(i, 1); }
}
function drawDust() {
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = '#ffcf8a';
  for (const d of dust) { g.globalAlpha = clamp(d.life / 2) * clamp((14 - d.life) / 2 + .3) * (.18 + .14 * Math.sin(time * 2 + d.ph)); g.beginPath(); g.arc(d.x, d.y, d.s, 0, TAU); g.fill(); }
  g.restore();
}
function lightSpot(x, y, r, col, a) {
  if (a <= .005) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
function drawChestShadow() {
  const y = L.chestBot - 30, w = 380;
  g.save(); g.translate(L.cx, y); g.scale(1, .16);
  const gr = g.createRadialGradient(0, 0, 20, 0, 0, w); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(-w, -w, w * 2, w * 2); g.restore();
  lightSpot(L.cx, L.chestTop + 60, 460, 'rgba(255,190,110,A)', .07 + .03 * Math.sin(time * 1.3));   // тёплый свет над сундуком
}
function drawStrikeLight() {
  // удар пресса освещает нишу и ленту
  lightSpot(L.cx, L.anvil + 10, 430, 'rgba(255,200,120,A)', anvilKick * .55);
  if (job && job.ph >= 4 && job.ph <= 5) lightSpot(L.cx, L.heroY, 520, 'rgba(255,220,160,A)', .05 + job.tier * .025);
}

// Рулетка: особый подарок крутит колесо, камера наезжает на него, выпадает бонус монет в сундук.
// WHEEL.gifts — названия подарков TikTok, которые крутят колесо; если пусто, крутит любой подарок ровно за WHEEL.coins монет.
const WHEEL = { gifts: [], coins: 99, x: 940, y: 1125, r: 100,
  prizes: [5, 25, 10, 50, 15, 100, 20, 30],          // по часовой, начиная сверху
  odds:   [20, 12, 18, 6, 16, 2, 14, 12] };          // веса: +100 редко, +5 часто
const camT = { x: 940, y: 1125, z: 1.75 }, camF = { x: 940, y: 1125, z: 1.75 };
const wheelQ = []; let spin = null, wheelAng = 0, cam = 0, wheelTick = -1;
const isWheelGift = m => WHEEL.gifts.length ? WHEEL.gifts.includes(m.name) : (+m.coins === WHEEL.coins);
function queueSpin(m) { wheelQ.push({ user: String(m.user || 'Viewer'), uid: String(m.uid || m.user || 'v'), pic: m.pic || '' }); }
function startSpin() {
  const who = wheelQ.shift(), tot = WHEEL.odds.reduce((a, b) => a + b, 0); let r = Math.random() * tot, k = 0;
  while ((r -= WHEEL.odds[k]) > 0) k++;
  const n = WHEEL.prizes.length, seg = TAU / n, cur = ((wheelAng % TAU) + TAU) % TAU;
  // колесо вращается по часовой: сектор k должен оказаться под стрелкой сверху
  const want = (TAU - k * seg) % TAU, extra = ((want - cur) % TAU + TAU) % TAU;
  spin = { who, k, t: 0, from: wheelAng, to: wheelAng + TAU * 5 + extra + rand(-.35, .35) * seg, d: 5.2, done: false, show: 0 };
  sfx('whoosh');
}
function updateSpin(dt) {
  const dia = job && job.tier === 4 && (job.ph === 4 || job.ph === 5);
  const zoomTo = spin || dia ? 1 : 0; cam = lerp(cam, zoomTo, clamp(dt * (zoomTo ? 2.4 : 3)));
  if (spin) Object.assign(camT, { x: WHEEL.x, y: WHEEL.y, z: 1.75 }); else if (dia) Object.assign(camT, { x: L.cx, y: L.heroY, z: 1.22 });
  camF.x = lerp(camF.x, camT.x, clamp(dt * 4)); camF.y = lerp(camF.y, camT.y, clamp(dt * 4)); camF.z = lerp(camF.z, camT.z, clamp(dt * 4));
  if (!spin) { wheelAng += Math.sin(time * .6) * .002; if (wheelQ.length && !job && !build && burstHold <= 0 && !flyers.length) startSpin(); return; }
  const sp = spin; sp.t += dt;
  const u = clamp((sp.t - .7) / sp.d); wheelAng = lerp(sp.from, sp.to, 1 - (1 - u) ** 4);
  const n = WHEEL.prizes.length, tick = Math.floor(wheelAng / (TAU / n) + .5);
  if (tick !== wheelTick) { wheelTick = tick; if (sp.t > .7 && u < 1) { if (ac && !mute && ac.state === 'running') tone(1800 + rand(-60, 60), .04, 'square', .03); spin.flick = 1; } }
  spin.flick = Math.max(0, (spin.flick || 0) - dt * 8);
  if (u >= 1 && !sp.done) {   // выпал приз: монеты с лицом крутившего летят в сундук
    sp.done = true; sp.show = 0.001; const amt = WHEEL.prizes[sp.k], j = { user: sp.who.user, uid: sp.who.uid, pic: sp.who.pic };
    const a = avatarOf(j), ti = tierOf(amt), sprite = makeCoin(a, ti, false);
    sfx('ta', Math.min(4, ti + 1)); burst(WHEEL.x, WHEEL.y, TIERS[ti], 40, 600); ring(WHEEL.x, WHEEL.y, 260, TIERS[ti].c[0], .6, 12);
    sp.pour = { amt, sprite, at: sp.t + 1.2 }; lastLander = { uid: j.uid, user: j.user };
  }
  if (sp.done) sp.show += dt;
  if (sp.pour && sp.t >= sp.pour.at) { const p = sp.pour; sp.pour = null; const nn = Math.min(100, p.amt); pourCoins(nn, () => p.sprite, WHEEL.x, WHEEL.y - 40, 0, .7, { commit: p.amt / nn }); if (p.amt > 6) sfx('pour'); sp.end = sp.t + 1.4; }
  if (sp.end && sp.t >= sp.end) spin = null;
}
// Камера: наезд на колесо. Возвращает [масштаб, сдвиг x, сдвиг y] в пикселях экрана.
function camMat() {
  if (cam < .002) return [1, 0, 0];
  const z = 1 + cam * (camF.z - 1), fx = ox + camF.x * scale, fy = oy + camF.y * scale;
  const tx = lerp(fx, SCW / 2, cam * .85), ty = lerp(fy, SCH * .5, cam * .85);
  // не показывать край фона: экран после наезда должен оставаться закрытым картинкой
  return [z, clamp(tx - fx * z, SCW * (1 - z), 0), clamp(ty - fy * z, SCH * (1 - z), 0)];
}
function drawWheel() {
  const X = WHEEL.x, Y = WHEEL.y, R = WHEEL.r, n = WHEEL.prizes.length, seg = TAU / n, act = spin ? 1 : 0;
  const sway = act ? 0 : Math.sin(time * 1.1) * .02;
  // подставка
  g.save(); g.translate(X, Y); g.rotate(sway * .3);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(0, R + 118, R * 1.1, 16, 0, 0, TAU); g.fill();
  const SK = R / 242;   // кольцо подставки: центр (342,440), радиус 242 в пикселях wheel_stand.png
  if (art.wheel_stand) g.drawImage(art.wheel_stand, -342 * SK, -440 * SK, art.wheel_stand.width * SK, art.wheel_stand.height * SK);
  else {
    g.fillStyle = '#4a2d18'; g.strokeStyle = '#1e1008'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-20, 0); g.lineTo(-R * .75, R + 112); g.lineTo(-R * .5, R + 112); g.lineTo(0, 20); g.lineTo(R * .5, R + 112); g.lineTo(R * .75, R + 112); g.lineTo(20, 0); g.closePath(); g.fill(); g.stroke();
    rr(-R * .95, R + 100, R * 1.9, 26, 8); g.fillStyle = '#6b4426'; g.fill(); g.stroke();
  }
  g.restore();
  // колесо
  g.save(); g.translate(X, Y); g.rotate(wheelAng + sway);
  if (art.wheel) { g.drawImage(art.wheel, -R * 1.02, -R * 1.02, R * 2.04, R * 2.04); }
  else {
    for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -Math.PI / 2 + (i - .5) * seg, -Math.PI / 2 + (i + .5) * seg); g.closePath(); g.fillStyle = i % 2 ? '#7a1a26' : '#e2b13c'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#3a2208'; g.stroke(); }
    g.lineWidth = 10; g.strokeStyle = '#b7862a'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
  }
  // надписи призов на секторах
  for (let i = 0; i < n; i++) {
    const q = -Math.PI / 2 + i * seg; g.save(); g.rotate(q + Math.PI / 2); g.translate(0, -R * .64);
    const p = WHEEL.prizes[i], big = p >= 50, win = spin && spin.done && spin.k === i;
    if (win) { g.globalAlpha = .55 + .45 * Math.sin(time * 14); }
    coinAt(blankCoin(tierOf(p)), 0, R * .2, 13); txt('+' + p, 0, -6, big ? 27 : 24, big ? '#fff1a8' : '#fff5df', 'center', 5);
    g.restore();
  }
  // лампочки по ободу: бегущий огонёк, во время вращения быстрее
  const nb = art.wheel ? 24 : 16, br = art.wheel ? R * .915 : R + 1, q0 = art.wheel ? -Math.PI / 2 + 7.5 * Math.PI / 180 : 0;
  for (let i = 0; i < nb; i++) {
    const q = q0 + i / nb * TAU, on = act ? ((Math.floor(time * 18) + i) % 3 === 0) : ((Math.floor(time * 3) + i) % 4 === 0);
    const bx = Math.cos(q) * br, by = Math.sin(q) * br;
    if (art.wheel) { if (!on) { g.fillStyle = 'rgba(30,15,5,.55)'; g.beginPath(); g.arc(bx, by, R * .045, 0, TAU); g.fill(); } }
    else { g.fillStyle = on ? '#fff3b0' : '#7a5a20'; g.beginPath(); g.arc(bx, by, 5.5, 0, TAU); g.fill(); }
    if (on) { g.globalAlpha = .35; g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(bx, by, 12, 0, TAU); g.fill(); g.globalAlpha = 1; }
  }
  if (!art.wheel) { g.fillStyle = '#c99a2e'; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = '#5a3606'; g.stroke(); }
  g.restore();
  // стрелка сверху, подпрыгивает на каждом секторе
  if (art.wheel_pointer) {
    const SK = R / 242, pw = art.wheel_pointer.width * SK, ph = art.wheel_pointer.height * SK, px = X + (277 - 342) * SK, py = Y + (42 - 440) * SK;
    g.save(); g.translate(px + pw / 2, py + 30 * SK); g.rotate(-(spin && spin.flick || 0) * .3); g.drawImage(art.wheel_pointer, -pw / 2, -30 * SK, pw, ph); g.restore();
  } else {
    g.save(); g.translate(X, Y - R - 6); g.rotate(-(spin && spin.flick || 0) * .35);
    g.beginPath(); g.moveTo(-14, -22); g.lineTo(14, -22); g.lineTo(0, 12); g.closePath(); g.fillStyle = '#e8b923'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5a3606'; g.stroke();
    g.restore();
  }
  // табличка: какой подарок крутит колесо
  if (!spin) {
    const ic = wheelIcon, y = Y + R + 62 + Math.sin(time * 2.4) * 3;
    rr(X - 58, y - 22, 116, 44, 22); g.fillStyle = 'rgba(21,12,14,.85)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d9b77a'; g.stroke();
    if (ic && ic.complete && ic.naturalWidth) g.drawImage(ic, X - 52, y - 19, 38, 38); else txt('🎁', X - 33, y + 1, 26, '#fff', 'center', 0);
    txt('= 🎡', X + 18, y + 1, 24, '#fff1a8', 'center', 0);
  }
}
let wheelIcon = null;
// Фонарь на цепи над сундуком: качается, свеча мерцает и подсвечивает кучу монет
const LANTERN = { dx: 74, dy: -198, w: 132 };   // dx: правее левой стенки арки; dy: на сколько выше ленты начинается картинка фонаря
let lanternKick = 0;
function drawLantern() {
  const im = art.lantern; if (!im) return;
  const G = beltGeo(), lx0 = G.ax + LANTERN.dx, ly0 = G.by + LANTERN.dy;   // висит над началом ленты и закрывает стык с аркой
  const top = L.rope + 18, sc = LANTERN.w / im.width, h = im.height * sc;
  const ang = Math.sin(time * .9) * .035 + Math.sin(time * 5.5) * .05 * lanternKick, len = ly0 - top;
  const fl = .75 + .15 * Math.sin(time * 11) + .1 * Math.sin(time * 23.3);
  g.save(); g.translate(lx0, top); g.rotate(ang);
  ironChain(0, 0, 0, len + 6);
  g.drawImage(im, -LANTERN.w / 2, len, LANTERN.w, h);
  const cx = (240 - im.width / 2) * sc, cy = len + 705 * sc;
  lightSpot(cx, cy, 120, 'rgba(255,190,90,A)', .35 * fl);
  g.restore();
  const lx = lx0 + Math.sin(ang) * (len + 705 * sc), ly = top + Math.cos(ang) * (len + 705 * sc);
  lightSpot(lx + 40, ly + 60, 360, 'rgba(255,180,90,A)', .08 * fl);   // тёплый свет на ленту и ножки
}

function drawSpinOverlay() {
  if (cam < .01 || camT.x !== WHEEL.x || camT.y !== WHEEL.y) return;
  g.fillStyle = `rgba(6,3,9,${cam * .55})`; g.fillRect(-ox / scale - 60, -oy / scale - 60, SCW / scale + 120, SCH / scale + 120);
  halo(WHEEL.x, WHEEL.y, 300, '#ffd36b', .3 * cam);
  drawWheel();
  if (!spin) return;
  const a = avatars.get(spin.who.uid), ps = easeBack(clamp(spin.t / .4)), y = WHEEL.y - WHEEL.r - 120;
  g.save(); g.translate(WHEEL.x, y); g.scale(ps, ps);
  rr(-110, -30, 220, 60, 30); g.fillStyle = 'rgba(21,12,14,.92)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd36b'; g.stroke();
  if (a) { g.save(); g.beginPath(); g.arc(-80, 0, 24, 0, TAU); g.clip(); g.drawImage(thumb(a), -104, -24, 48, 48); g.restore(); }
  txt(shortName(spin.who.user, 9), 18, 1, 24, '#fff5df', 'center', 4);
  g.restore();
  if (spin.done) {   // выигрыш крупно
    const p = WHEEL.prizes[spin.k], s2 = easeBack(clamp(spin.show / .4));
    g.save(); g.translate(WHEEL.x, WHEEL.y - 10); g.scale(s2, s2);
    rays(0, 0, 40, 220, 14, ['#fff1a8', '#ffb12b'], time * .8, .35);
    txt('+' + p, 0, 0, 96, '#fff1a8', 'center', 10);
    g.restore();
  }
}

// Рисование
let bg = null;
function buildBg() {
  bg = document.createElement('canvas'); bg.width = Math.ceil(SCW); bg.height = Math.ceil(SCH);
  const x = bg.getContext('2d'), v = x.createLinearGradient(0, 0, 0, SCH);
  v.addColorStop(0, '#20192c'); v.addColorStop(.55, '#33222a'); v.addColorStop(1, '#1c1219'); x.fillStyle = v; x.fillRect(0, 0, SCW, SCH);
  x.strokeStyle = 'rgba(255,220,180,.045)'; x.lineWidth = 3;
  for (let r = 0, y = 0; y < SCH; r++, y += 58) { x.beginPath(); x.moveTo(0, y); x.lineTo(SCW, y); x.stroke(); for (let c = r % 2 * 70; c < SCW; c += 140) { x.beginPath(); x.moveTo(c, y); x.lineTo(c, y + 58); x.stroke(); } }
  const ax = ox + L.cx * scale, ay = oy + L.anvil * scale, f = x.createRadialGradient(ax, ay, 40, ax, ay, 640 * scale);
  f.addColorStop(0, 'rgba(255,128,36,.40)'); f.addColorStop(1, 'rgba(255,128,36,0)'); x.fillStyle = f; x.fillRect(0, 0, SCW, SCH);
}
function stretch3(img, x, y, w, h, cap) {
  const k = h / img.height, cw = Math.min(cap * k, w / 2);
  g.drawImage(img, 0, 0, cap, img.height, x, y, cw, h);
  g.drawImage(img, cap, 0, img.width - cap * 2, img.height, x + cw, y, w - cw * 2, h);
  g.drawImage(img, img.width - cap, 0, cap, img.height, x + w - cw, y, cw, h);
}
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function shortName(s, n) { const a = [...s]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : s; }
function txt(s, x, y, size, color = '#fff5df', align = 'center', stroke = 6) {
  g.font = `900 ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (stroke) { g.lineWidth = stroke; g.strokeStyle = 'rgba(25,12,8,.9)'; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
}
function coinAt(sp, x, y, r, spin = 1, sy = 1) { g.save(); g.translate(x, y + r * (1 - sy)); g.scale(Math.max(.04, Math.abs(spin)), sy); g.drawImage(sp, -r, -r, r * 2, r * 2); g.restore(); }

const easeBack = t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const heroR = j => 190 + j.tier * 14;
// блик, пробегающий по монете (u от 0 до 1; вне этого диапазона не рисуется)
function glint(x, y, r, u, a = .55) {
  if (!(u > 0 && u < 1)) return;
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); g.translate(x, y); g.rotate(-.6);
  const bx = lerp(-r * 1.6, r * 1.6, u), gr = g.createLinearGradient(bx - r * .35, 0, bx + r * .35, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(-r * 2, -r * 2, r * 4, r * 4); g.restore();
}
function star(x, y, sz, a, c = '#fff') {
  if (a <= .01) return;
  g.save(); g.globalAlpha = Math.min(1, a); g.globalCompositeOperation = 'lighter'; g.fillStyle = c; g.translate(x, y); g.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? sz * .22 : sz, q = i / 8 * TAU; g.lineTo(Math.cos(q) * r, Math.sin(q) * r); }
  g.fill(); g.restore();
}
function halo(x, y, r, color, a) {
  if (a <= .01) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a);
  const gr = g.createRadialGradient(x, y, r * .15, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
// монета вращается, видно ребро
// переворот через верх: монету подбросили, видно ребро
function flipCoin(sp, ti, x, y, r, ang) {
  const c = Math.cos(ang), e = Math.sin(ang) * r * .09;
  g.fillStyle = TIERS[ti].c[2]; g.beginPath(); g.ellipse(x, y + e, r * .985, Math.max(2, Math.abs(c) * r), 0, 0, TAU); g.fill();
  g.save(); g.translate(x, y); g.scale(1, Math.max(.04, Math.abs(c))); g.drawImage(sp, -r, -r, r * 2, r * 2); g.restore();
}
// свежеотчеканенная монета горячая: оранжевый накал остывает до цвета металла
function heatGlow(x, y, r, h) {
  if (h <= .01) return;
  halo(x, y, r * 2, '#ff7a1a', .55 * h);
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .8 * h; g.fillStyle = '#ff5a00'; g.beginPath(); g.arc(x, y, r * .97, 0, TAU); g.fill(); g.restore();
}
const steam = [];
function puff(x, y, n) { for (let i = 0; i < n; i++) steam.push({ x: x + rand(-50, 50), y: y + rand(-20, 10), vx: rand(-15, 15), vy: -rand(50, 110), r: rand(14, 26), life: rand(.9, 1.6), max: 1.6 }); }
function drawSteam(dt) {
  for (let i = steam.length - 1; i >= 0; i--) {
    const p = steam[i]; p.life -= dt; if (p.life <= 0) { steam.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.r += 34 * dt;
    const a = clamp(p.life / p.max) * .22, gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    gr.addColorStop(0, `rgba(235,230,225,${a})`); gr.addColorStop(1, 'rgba(235,230,225,0)'); g.fillStyle = gr; g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
}
// кристаллы вокруг бриллиантовой монеты: задние рисуются до монеты, передние после
function crystals(x, y, r, a, front) {
  for (let k = 0; k < 9; k++) {
    const q = time * .9 + k / 9 * TAU, z = Math.sin(q); if ((z > 0) !== front) continue;
    const px = x + Math.cos(q) * r * 1.55, py = y + z * r * .32 - Math.cos(q * 2) * 12, s2 = (16 + z * 7) * a;
    g.save(); g.translate(px, py); g.rotate(time * 2 + k);
    const gr = g.createLinearGradient(-s2, -s2, s2, s2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, k % 2 ? '#7ff3ff' : '#ff9cf0'); gr.addColorStop(1, '#4aa9d8');
    g.beginPath(); g.moveTo(0, -s2 * 1.4); g.lineTo(s2 * .8, 0); g.lineTo(0, s2 * 1.4); g.lineTo(-s2 * .8, 0); g.closePath(); g.fillStyle = gr; g.globalAlpha = .9; g.fill();
    g.globalAlpha = 1; g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke(); g.restore();
  }
}
function spinCoin(sp, ti, x, y, r, ang) {
  const s = Math.cos(ang), e = Math.sin(ang) * r * .09;
  g.fillStyle = TIERS[ti].c[2]; g.beginPath(); g.ellipse(x + e, y, Math.max(2, Math.abs(s) * r), r * .985, 0, 0, TAU); g.fill();
  coinAt(sp, x, y, r, s);
}
function rays(x, y, r0, len, n, cols, rot, a) {
  if (len <= 1 || a <= .01) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    const gr = g.createLinearGradient(0, r0, 0, r0 + len); gr.addColorStop(0, cols[i % cols.length]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-10, r0); g.lineTo(-30 - len * .14, r0 + len); g.lineTo(30 + len * .14, r0 + len); g.lineTo(10, r0); g.fill(); g.rotate(TAU / n);
  }
  g.restore();
}
function drawRings() {
  for (const q of rings) { if (q.t < 0) continue; const k = q.t / q.d; g.save(); g.globalAlpha = (1 - k) * .9; g.globalCompositeOperation = 'lighter'; g.strokeStyle = q.color; g.lineWidth = q.w * (1 - k) + 1; g.beginPath(); g.arc(q.x, q.y, lerp(10, q.r1, easeOut(k)), 0, TAU); g.stroke(); g.restore(); }
}
function drawTwinkles() { for (const q of twinkles) star(q.x, q.y, q.s * Math.sin(q.t / q.d * Math.PI), Math.sin(q.t / q.d * Math.PI), q.c); }
function drawLevelRays() { if (lvlT > 0) rays(L.cx, L.pileY, 30, 640 * easeOut(clamp((1.6 - lvlT) / .4)), 18, ['#fff1a8', '#ffb12b'], time * .6, .45 * clamp(lvlT / .6)); }

let giftIcons = [];
function drawLegend() {
  const n = TIERS.length, w = Math.min(W - 40, 980), x0 = L.cx - w / 2, y = L.legendY, h = 104, cell = w / n;
  if (art.legend) stretch3(art.legend, x0, y - h / 2, w, h, 95);
  else { rr(x0, y - h / 2, w, h, 24); g.fillStyle = 'rgba(20,13,16,.78)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7a5a2b'; g.stroke(); }
  TIERS.forEach((t, i) => {
    const cx = x0 + cell * (i + .5), wob = Math.sin(time * 2.4 + i) * 3;
    const ic = art['gift_' + i] || giftIcons[i];
    if (ic && ic.complete && ic.naturalWidth) g.drawImage(ic, cx - 78, y - 38, 76, 76);
    else txt(t.emoji, cx - 40, y + 2, 46, '#fff', 'center', 0);
    txt('›', cx + 2, y - 3, 34, '#d9b77a', 'center', 0);
    coinAt(blankCoin(i), cx + 44, y + wob, 31); glint(cx + 44, y + wob, 30, ((time * .3 + i * .2) % 1) / .3);
  });
  if (idleA > .05 && idleLast >= 0) {   // на экране ожидания подсвечена ступень, которая сейчас показана
    const k = idleLast, cx = x0 + cell * (k + .5), pu = .7 + .3 * Math.sin(time * 5);
    halo(cx, y, 110, TIERS[k].c[1], .3 * idleA * pu);
    g.save(); g.globalAlpha = .85 * idleA * pu; g.lineWidth = 4; g.strokeStyle = TIERS[k].c[0]; rr(cx - cell / 2 + 8, y - h / 2 + 14, cell - 16, h - 28, 16); g.stroke(); g.restore();
  }
}
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
// Подвес по металлу: бронза на бечёвке, серебро и золото на цепочках, рубин с бусинами, бриллиант светится
function drawRope(x0, y0, x1, y1, ti) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  g.save(); g.translate(x0, y0); g.rotate(ang);
  if (ti === 0 && art.rope) {
    const rw = 11, th = art.rope.height * rw / art.rope.width;
    g.rotate(-Math.PI / 2);
    for (let k = 0; k * th < len; k++) g.drawImage(art.rope, -rw / 2, k * th, rw, th + .6);
  } else if (ti === 0) {
    g.lineWidth = 4; g.strokeStyle = '#a07a45'; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(55,30,12,.75)'; for (let k = 4; k < len; k += 6) { g.beginPath(); g.moveTo(k - 2, -2); g.lineTo(k + 2, 2); g.stroke(); }
  } else {
    const col = [null, ['#eef2f6', '#7f8a97'], ['#ffe27a', '#a1730c'], ['#ffd27a', '#9c6a10'], ['#d9fbff', '#4aa9d8']][ti], step = ti >= 2 ? 11 : 9, n = Math.max(2, Math.floor(len / step));
    if (ti === 4) { g.shadowColor = '#7ff3ff'; g.shadowBlur = 10; }
    for (let k = 0; k < n; k++) {
      const px = (k + .5) * len / n, face = k % 2 === 0;
      g.beginPath(); g.ellipse(px, 0, step * .62, face ? step * .42 : step * .15, 0, 0, TAU); g.lineWidth = face ? 2.6 : 3; g.strokeStyle = col[face ? 0 : 1]; g.stroke();
      if (ti === 3 && k % 4 === 2) { g.fillStyle = '#e0244d'; g.beginPath(); g.arc(px, 0, 4.5, 0, TAU); g.fill(); }
    }
  }
  g.restore();
}
// Доска почёта: на каждого зрителя одна лучшая монета, 7 крючков, дорогие левее.
// Копия монеты взлетает с показа на свой крючок, цепочка ловит её, и она раскачивается.
// Вытесненная монета срывается с крючка и падает.
const wallFall = [];
function drawHook(x, y) {
  g.lineCap = 'round'; g.strokeStyle = '#2d2a31'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y + 24); g.arc(x - 8, y + 24, 8, 0, Math.PI * .9); g.stroke();
  g.strokeStyle = '#8d8892'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 1.5, y + 6); g.lineTo(x - 1.5, y + 22); g.stroke();
  g.fillStyle = '#c9a65a'; g.beginPath(); g.arc(x, y + 2, 4.5, 0, TAU); g.fill(); g.lineCap = 'butt';
}
function drawWall() {
  const y = L.rope, n = 7, w = Math.min(W - 60, 980), x0 = L.cx - w / 2, gap = w / n, now = performance.now(), len = 56;
  if (art.wall) stretch3(art.wall, x0 - 20, y - 24, w + 40, 48, 70);
  else { g.lineWidth = 10; g.strokeStyle = '#a57a3d'; g.beginPath(); g.moveTo(x0 - 10, y); g.lineTo(x0 + w + 10, y); g.stroke(); }
  for (let i = 0; i < n; i++) if (!wall[i] || wall[i].fly) drawHook(x0 + gap * (i + .5), y + 10);
  // падающие сорванные монеты
  for (const f of wallFall) { g.save(); g.globalAlpha = clamp(f.life / .4); g.translate(f.x, f.y); g.rotate(f.a); g.drawImage(f.sprite, -50, -50, 100, 100); g.restore(); }
  for (let i = 0; i < wall.length; i++) {
    const it = wall[i], target = x0 + gap * (i + .5), t = it.tier;
    it.cx = it.cx == null ? target : lerp(it.cx, target, .08);   // при пересортировке монеты переезжают по рейке
    const cx = it.cx;
    if (it.fly) {   // полёт с показа на крючок
      const u = clamp((now - it.at) / 1000 / .9), e = easeInOut(u), tx = cx, ty = y + len + 46;
      const px = lerp(it.fly.x, tx, e), py = lerp(it.fly.y, ty, e) - Math.sin(u * Math.PI) * 160, r = lerp(it.fly.r, 56, easeOut(u));
      if (u > .7) drawRope(cx, y, cx, lerp(y, py - 46, clamp((u - .7) / .3)), t);
      halo(px, py, r * 1.8, TIERS[t].c[1], .35 * (1 - u));
      spinCoin(it.sprite, t, px, py, r, u * TAU * 2);
      it.px = px; it.py = py;
      if (u >= 1) { it.fly = null; it.hungAt = now; it.swing = 1.3; sfx('rope'); ring(cx, ty, 80, TIERS[t].c[0], .35, 6); burst(cx, y + 6, TIERS[t], 8, 220); }
      continue;
    }
    const age = (now - (it.hungAt || it.at)) / 1000;
    const sway = Math.sin(time * (1.3 - t * .12) + i * 1.1) * (.06 - t * .008);       // дорогие качаются спокойнее
    const sw = Math.sin(time * 6 + i) * it.swing * .42 + sway, bob = t === 4 ? Math.sin(time * 2 + i) * 6 : 0;
    const hx = cx + Math.sin(sw) * len, hy = y + Math.cos(sw) * len + bob, ccy = hy + 46;
    it.px = hx; it.py = ccy;
    // за монетой
    if (t === 4) rays(hx, ccy, 40, 80, 10, ['#ffffff', '#7ff3ff', '#ff9cf0', '#fff59a'], time * .6 + i, .4);
    if (t >= 3) halo(hx, ccy, 110, TIERS[t].c[1], .35 + .15 * Math.sin(time * 2.4 + i));
    else if (t === 2) halo(hx, ccy, 92, TIERS[t].c[1], .16 + .08 * Math.sin(time * 2 + i));
    else if (i === 0) halo(hx, ccy, 110, TIERS[t].c[1], .25 + .1 * Math.sin(time * 3));
    drawRope(cx, y, hx, hy, t);
    // монета: рубин и бриллиант время от времени делают оборот
    const per = t === 4 ? 4 : 6.5, sp = ((time + i * .9) % per) / .9;
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(hx + 8, ccy + 10, 53, 0, TAU); g.fill();   // тень на стене
    if (t >= 3 && sp < 1) spinCoin(it.sprite, t, hx, ccy, 56, easeInOut(sp) * TAU);
    else g.drawImage(it.sprite, hx - 56, hy - 10, 112, 112);
    // блик: чем дороже, тем чаще
    const gp = [9, 4.5, 3, 2.5, 1.8][t]; glint(hx, ccy, 54, ((time + i * .7) % gp) / .6, t >= 2 ? .6 : .45);
    // искры вокруг золота, рубина, бриллианта
    const ns = [0, 0, 2, 3, 6][t];
    for (let k = 0; k < ns; k++) { const q = k / ns * TAU + time * (.6 + t * .15), d = 64 + 6 * Math.sin(time * 3 + k); star(hx + Math.cos(q) * d, ccy + Math.sin(q) * d, 7 + t * 2.5, Math.max(0, Math.sin(time * 4 + k * 2 + i)), k % 2 ? '#ffffff' : TIERS[t].c[0]); }
    if (age < .9) for (let k = 0; k < 5; k++) { const q = k / 5 * TAU + age * 3; star(hx + Math.cos(q) * 70 * easeOut(age / .9), ccy + Math.sin(q) * 70 * easeOut(age / .9), 12, 1 - age / .9, TIERS[t].c[0]); }
    txt(shortName(it.user, 8), hx, hy + 122, 21, TIERS[t].c[0], 'center', 5);
  }
}
// Лента-накопитель: монеты выезжают из арки, едут к прессу и выстраиваются друг за другом у упора.
// Кто выйдет из арки следующим, решает очередь (дорогие подарки раньше), а на ленте порядок уже не меняется.
const BELT = { n: 3, r: 60, sp: 132, vmax: 170, acc: 230, scale: .7 };
const belt = []; let beltScroll = 0, beltV = 0, beltLayer = null;
const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
// точка фона (в пикселях bg.png) -> координаты сцены
function bgToStage(bx, by) {
  const b = art.bg; if (!b) return null;
  const s = Math.max(SCW / b.width, SCH / b.height);
  return { x: (SCW / 2 - b.width * s / 2 + bx * s - ox) / scale, y: (SCH / 2 - b.height * s / 2 + by * s - oy) / scale };
}
function beltGeo() {
  const F = FRAME, sf = F.s, hole = F.hole, cx = L.cx, plankTop = L.anvil + 66;
  const fx = cx - (hole[0] + hole[2]) / 2 * sf, px0 = fx + hole[0] * sf, post = fx + 70 * sf;
  const p = bgToStage(64, 0), bx0 = p ? p.x : 80, f = bgToStage(0, 900);
  const bh = art.belt ? art.belt.height * BELT.scale : 30, by = plankTop - 18;
  return { bx0, ax: bx0, px0, post, by, bh, endX: post - BELT.r - 6, cy: by + 5 - BELT.r, floor: f ? f.y : by + 260 };
}
function updateBelt(dt) {
  const G = beltGeo(), spawnX = G.ax - BELT.r - 12;   // монета стоит за левой стенкой арки и выезжает из-за неё сразу, без плавного проявления
  // из арки выходит следующая монета, если на ленте есть место
  if (queue.length && belt.length < BELT.n) {
    sortQueue(); const j = queue.shift(), last = belt[belt.length - 1];
    j.bx = last ? Math.min(spawnX, last.bx - BELT.sp) : spawnX; j.onBelt = performance.now(); belt.push(j);
  }
  const busy = queue.length + belt.length, vmax = BELT.vmax * (1 + Math.min(2, busy / 12));
  let moving = false;
  belt.forEach((j, i) => {
    const lim = i === 0 ? G.endX : belt[i - 1].bx - BELT.sp, d = lim - j.bx;
    if (d > .5) { moving = true; j.bx += Math.min(d, Math.min(Math.max(beltV, 40), Math.sqrt(2 * BELT.acc * d)) * dt); }
    else j.bx = Math.min(j.bx, lim);
  });
  beltV = moving ? Math.min(vmax, beltV + BELT.acc * dt) : Math.max(0, beltV - BELT.acc * 1.6 * dt);
  beltScroll += beltV * dt;
}
function drawBelt() {
  const G = beltGeo(), { bx0, ax, px0, by, bh } = G;
  // ножки до пола, с тенью
  if (art.leg) {
    const top = by + bh * .55, h = clamp(G.floor - top, 120, 460), w = h * art.leg.width / art.leg.height;
    [.5, .88].forEach((k, li) => {
      const x = lerp(bx0, G.post, k);
      const sh = g.createRadialGradient(x, top + h, 4, x, top + h, w * .9); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(0, top + h); g.scale(1, .22); g.translate(0, -(top + h)); g.fillStyle = sh; g.fillRect(x - w, top + h - w, w * 2, w * 2); g.restore();
      g.drawImage(art.leg, x - w / 2, top, w, h);
      // ближняя к арке ножка в красном отсвете печи
      if (li === 0) lightSpot(x - w * .3, top + h * .45, w * .9, 'rgba(255,80,40,A)', .12 + .04 * Math.sin(time * 7));
    });
  }
  if (art.belt) {   // лента рисуется в отдельный слой и плавно растворяется в темноте арки, без тёмного прямоугольника
    const bw = art.belt.width * BELT.scale, off = beltScroll % bw, lw = px0 + 4 - ax, lh = bh + 8, rs = scale * dpr;
    if (!beltLayer) beltLayer = document.createElement('canvas');
    const cw = Math.max(2, Math.ceil(lw * rs)), ch = Math.max(2, Math.ceil(lh * rs));
    if (beltLayer.width !== cw || beltLayer.height !== ch) { beltLayer.width = cw; beltLayer.height = ch; }
    const bc = beltLayer.getContext('2d');
    bc.setTransform(1, 0, 0, 1, 0, 0); bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, 0, cw, ch);
    bc.setTransform(rs, 0, 0, rs, -ax * rs, -(by - 4) * rs);
    for (let x = off - bw + ax - (ax % bw); x < px0 + 4; x += bw) bc.drawImage(art.belt, x, by, bw + 1, bh);
    const k = .16 + .05 * Math.sin(time * 7) + .03 * Math.sin(time * 17), gl = bc.createLinearGradient(ax, 0, ax + 300, 0);
    gl.addColorStop(0, `rgba(255,90,40,${k * 1.6})`); gl.addColorStop(1, 'rgba(255,90,40,0)');
    bc.globalCompositeOperation = 'source-atop'; bc.fillStyle = gl; bc.fillRect(ax, by - 4, 300, lh);
    const fd = bc.createLinearGradient(ax, 0, ax + 70, 0); fd.addColorStop(0, 'rgba(10,4,2,.6)'); fd.addColorStop(1, 'rgba(10,4,2,0)');   // тень от стенки арки
    bc.fillStyle = fd; bc.fillRect(ax, by - 4, 70, lh);
    g.drawImage(beltLayer, ax, by - 4, lw, lh);
  } else { g.fillStyle = '#231b20'; rr(bx0, by + 2, px0 + 4 - bx0, 20, 4); g.fill(); }
  // монеты на ленте: тень, заготовка, над ней аватарка того, чья монета
  g.save(); g.beginPath(); g.rect(ax, 0, W, H); g.clip();
  const now = performance.now();
  belt.forEach((j, i) => {
    // монета выезжает из-за левой стенки арки: рисуется целиком, обрезается краем стенки (clip), никакой прозрачности
    const al = 1, r = BELT.r, y = G.cy - (beltV > 20 ? Math.abs(Math.sin(beltScroll * .09 + i)) * 1.6 : 0), x = j.bx, t = TIERS[j.tier];
    g.globalAlpha = al * .5; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x + 4, by + 6, r * .85, 6, 0, 0, TAU); g.fill();
    g.globalAlpha = al; g.drawImage(blankCoin(j.tier), x - r, y - r, r * 2, r * 2);
    glint(x, y, r - 2, ((time * .35 + i * .3) % 1.6) / .5, .35);
    const ay = y - r - 46 + Math.sin(time * 2.6 + i * 1.3) * 4, ps = 1;
    g.save(); g.translate(x, ay); g.scale(ps, ps);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(-8, 26); g.lineTo(8, 26); g.lineTo(0, 40); g.fill();
    g.fillStyle = t.c[1]; g.beginPath(); g.moveTo(-9, 24); g.lineTo(9, 24); g.lineTo(0, 37); g.fill();
    g.beginPath(); g.arc(0, 0, 33, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = t.c[0]; g.stroke();
    g.drawImage(thumb(avatarOf(j)), -28, -28, 56, 56);
    if (owner && owner.uid === j.uid) drawCrown(0, -46, 40);
    if (j.free) txt('❤', 24, -22, 22, '#ff5b7f', 'center', 3);
    else if (j.combo >= 2) txt('×' + j.combo, 26, -24, 20, '#fff1a8', 'center', 4);
    g.restore();
    if (i === 0 && j.bx >= G.endX - 2) { g.globalAlpha = al * (.35 + .25 * Math.sin(time * 5)); g.strokeStyle = t.c[0]; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 6, 0, TAU); g.stroke(); }
  });
  g.restore(); g.globalAlpha = 1;
}
function drawPressArt() {
  const cx = L.cx, a = L.anvil, fr = art.press_frame, ph = art.press_head, F = FRAME, sf = F.s, hole = F.hole;
  // Наковальни нет: монета лежит на железной плите, настеленной на основание рамы
  const plankTop = a + 66, fx = cx - (hole[0] + hole[2]) / 2 * sf, fy = plankTop - hole[3] * sf, beamBottom = fy + hole[1] * sf;
  const px0 = fx + hole[0] * sf, px1 = fx + hole[2] * sf;
  drawBelt();
  g.save(); if (pressShake && !reduced) g.translate(rand(-1, 1) * pressShake, rand(-.4, .4) * pressShake);
  // штанга и головка: за рамой, верхняя часть прячется за балкой
  const hw = 190, hh = hw * ph.height / ph.width, hb = lerp(beamBottom + 40, a - 106, pressY), rx = cx - 16;
  g.fillStyle = '#6f6c76'; g.fillRect(rx, fy, 32, Math.max(0, hb - hh - fy));
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(rx + 6, fy, 6, Math.max(0, hb - hh - fy));
  g.drawImage(ph, cx - hw / 2, hb - hh, hw, hh);
  g.drawImage(fr, fx, fy, F.w * sf, F.h * sf);
  // железная плита
  const ty = plankTop - 20 + anvilKick * 4, pw = px1 - px0 + 14;
  rr(px0 - 7, ty, pw, 26, 5); const m = g.createLinearGradient(0, ty, 0, ty + 26); m.addColorStop(0, '#b7b4bd'); m.addColorStop(.25, '#85828c'); m.addColorStop(1, '#3d3a44');
  g.fillStyle = m; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1d1a22'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(px0 + 2, ty + 3, pw - 18, 2);
  g.fillStyle = '#c9a65a'; [px0 + 6, px1 - 6].forEach(x => { g.beginPath(); g.arc(x, ty + 15, 3.2, 0, TAU); g.fill(); });
  g.restore();
}
function drawPress() {
  if (art.press_frame && art.press_head) return drawPressArt();
  const cx = L.cx, a = L.anvil, top = L.pressTop, hw = 170;
  // наковальня
  rr(cx - 150, a + 8, 300, 34, 8); g.fillStyle = '#3f3a44'; g.fill();
  rr(cx - 86, a + 40, 172, 44, 6); g.fillStyle = '#2d2932'; g.fill();
  drawBelt();
  const hy = lerp(top + 90, a - 92, pressY);
  if (art.press_frame) g.drawImage(art.press_frame, cx - 240, top - 60, 480, a - top + 150);
  else {
    g.fillStyle = '#4a3b35'; g.fillRect(cx - 222, top - 30, 40, a - top + 74); g.fillRect(cx + 182, top - 30, 40, a - top + 74);
    rr(cx - 250, top - 62, 500, 74, 12); g.fillStyle = '#5b4739'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#2a1e18'; g.stroke();
    g.fillStyle = '#d6b36a'; [-210, 210].forEach(o => { g.beginPath(); g.arc(cx + o, top - 25, 12, 0, TAU); g.fill(); });
  }
  g.fillStyle = '#6f6c76'; g.fillRect(cx - 26, top, 52, Math.max(0, hy - top - 30));   // штанга
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(cx - 18, top, 8, Math.max(0, hy - top - 30));
  if (art.press_head) { const ph = art.press_head, w = 340, h = w * ph.height / ph.width; g.drawImage(ph, cx - w / 2, hy + 46 - h, w, h); }
  else {
    rr(cx - hw, hy - 42, hw * 2, 88, 10); const m = g.createLinearGradient(0, hy - 42, 0, hy + 46); m.addColorStop(0, '#a4a0aa'); m.addColorStop(1, '#55525c'); g.fillStyle = m; g.fill(); g.lineWidth = 5; g.strokeStyle = '#26232b'; g.stroke();
  }
}
function drawJob() {
  const j = job; if (!j) return;
  const a = L.anvil, cx = L.cx, u = clamp(j.t / j.dur[j.ph]), t = TIERS[j.tier];
  if (j.ph === 0) { const e = easeInOut(u), x = lerp(j.x0 ?? cx - 200, cx, e), r = lerp(BELT.r, 76, e), y = lerp(beltGeo().cy, a - 26, easeIn(u)) - Math.sin(u * Math.PI) * 22 + (u > .85 ? Math.sin((u - .85) / .15 * Math.PI) * -5 : 0); g.drawImage(blankCoin(j.tier), x - r, y - r, r * 2, r * 2); }
  else if (j.ph === 1) coinAt(blankCoin(j.tier), cx, a - 26, 76);
  else if (j.ph === 2) coinAt(j.sprite, cx, a - 26, 82, 1, .72 + .28 * u * u);
  else if (j.ph === 3) { coinAt(j.sprite, cx, a - 26, 82, 1, 1 + .1 * Math.sin(u * Math.PI)); heatGlow(cx, a - 26, 82, 1 - u * .25); if (Math.random() < .3) puff(cx, a - 60, 1); }
  else if (j.ph === 4) {   // горячую монету подбрасывает с плиты: кувыркается и остывает по дороге наверх
    const r = lerp(82, heroR(j), easeOut(u)), y = lerp(a - 26, L.heroY, easeBack(u)) - Math.sin(u * Math.PI) * 60;
    if (j.tier >= 2) halo(cx, y, r * 2.2, t.c[1], u * .6);
    flipCoin(j.sprite, j.tier, cx, y, r, easeOut(u) * TAU * (j.tier >= 3 ? 3 : 2));
    heatGlow(cx, y, r, (1 - u) * .75);
  } else if (j.ph === 5) {
    const r = heroR(j), y = L.heroY + Math.sin(time * 3) * 8, tt = j.t, intro = easeBack(clamp(tt / .35));
    if (j.tier >= 1) {
      const len = (150 + j.tier * 95) * intro, n = j.tier === 4 ? 18 : 10 + j.tier * 2, al = .14 + j.tier * .07;
      const cols = j.tier === 4 ? ['#ffffff', '#7ff3ff', '#ff9cf0', '#fff59a', '#9cffb3'] : [t.c[0], t.c[1]];
      rays(cx, L.heroY, r * .55, len, n, cols, time * .35, al);
      if (j.tier >= 3) rays(cx, L.heroY, r * .45, len * .7, n, cols.slice().reverse(), -time * .5, al * .8);
    }
    halo(cx, y, r * (1.8 + j.tier * .25), t.c[1], .3 + j.tier * .1);
    if (j.tier === 4) {   // бриллиант: столп света сверху, радужные кольца, кристаллы на орбите
      const pg = g.createLinearGradient(0, -400, 0, y); pg.addColorStop(0, 'rgba(180,250,255,0)'); pg.addColorStop(1, `rgba(180,250,255,${.28 * intro})`);
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = pg; g.beginPath(); g.moveTo(cx - r * .5, -400); g.lineTo(cx + r * .5, -400); g.lineTo(cx + r * 1.15, y); g.lineTo(cx - r * 1.15, y); g.fill();
      for (let k = 0; k < 3; k++) { g.strokeStyle = `hsla(${(time * 120 + k * 120) % 360},100%,70%,${.5 * intro})`; g.lineWidth = 6 - k; g.beginPath(); g.arc(cx, y, r * (1.25 + k * .13), time * (1.4 - k * .5) + k, time * (1.4 - k * .5) + k + Math.PI * 1.3); g.stroke(); }
      g.restore();
      crystals(cx, y, r, intro, false);
    }
    if (j.king) { rays(cx, L.heroY, r * .6, 330 * intro, 16, ['#fff1a8', '#ffb12b'], -time * .4, .3); halo(cx, y, r * 2.4, '#ffd36b', .4); }
    coinAt(j.sprite, cx, y, r);
    glint(cx, y, r * .97, (tt % 1.5) / .7, .5);
    if (j.tier === 4) crystals(cx, y, r, intro, true);
    if (j.king) drawCrown(cx, y - r - 52 + Math.sin(time * 3) * 6 - (1 - intro) * 200, 150 * intro);
    const ns = 4 + j.tier * 2;
    for (let i = 0; i < ns; i++) { const q = i / ns * TAU + time * .4, d = r * (1.14 + .08 * Math.sin(time * 2 + i)); star(cx + Math.cos(q) * d, y + Math.sin(q) * d, 12 + j.tier * 4, Math.max(0, Math.sin(time * 4 + i * 1.7)) * intro, i % 2 ? '#ffffff' : t.c[0]); }
    const ps = easeBack(clamp((tt - .08) / .3));
    if (ps > 0) { g.save(); g.translate(cx, L.heroY + r + 40); g.scale(ps, ps); const pw = 500; rr(-pw / 2, -34, pw, 68, 34); g.fillStyle = 'rgba(21,12,14,.9)'; g.fill(); g.lineWidth = 4; g.strokeStyle = t.c[1]; g.stroke(); txt(shortName(j.user, 15), 0, 2, 38, j.tier >= 3 ? t.c[0] : '#fff5df', 'center', 0); g.restore(); }
    if (j.combo >= 2) {   // комбо: 10 делений, на 5-м и 10-м монетки следующего металла
      const cy = L.heroY + r + 104, sp = 38, cs = easeBack(clamp((tt - .15) / .3));
      g.save(); g.translate(cx, cy); g.scale(cs, cs);
      rr(-sp * 5 - 70, -26, sp * 10 + 100, 52, 26); g.fillStyle = 'rgba(21,12,14,.85)'; g.fill();
      txt('×' + j.combo, -sp * 5 - 34, 1, 30, '#fff1a8', 'center', 0);
      for (let k = 0; k < COMBO.max; k++) {
        const x = (k - 4.5) * sp + 22, on = k < j.combo, mile = COMBO.steps.indexOf(k + 1);
        if (mile >= 0) { g.globalAlpha = on ? 1 : .35; coinAt(blankCoin(Math.min(4, j.base + mile + 1)), x, 0, 15); g.globalAlpha = 1; if (on && k + 1 === j.combo) star(x, 0, 26, Math.abs(Math.sin(time * 5)), '#fff'); }
        else { g.fillStyle = on ? t.c[0] : 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x, 0, 8, 0, TAU); g.fill(); }
      }
      g.restore();
    }
    if (j.free) txt(j.src === 'follow' ? '➕' : '👍', cx - r * .78, L.heroY - r * .7, 64, '#fff', 'center', 0);
    if (j.count > 1) { const cs = easeBack(clamp((tt - .2) / .3)); if (cs > 0) { g.save(); g.translate(cx + r * .74, L.heroY - r * .74); g.rotate(-.18); g.scale(cs, cs); txt('×' + j.count, 0, 0, 80, t.c[0], 'center', 8); g.restore(); } }
  } else if (j.ph === 6) {
    const r0 = heroR(j), tx = j.slot.x, ty = j.slot.y, r1 = j.slot.r;
    const pos = v => { const e = easeIn(v); return [lerp(cx, tx, e), lerp(L.heroY, ty, e) - Math.sin(v * Math.PI) * 90, lerp(r0, r1, e)]; };
    for (let k = 4; k >= 1; k--) { const v = u - k * .05; if (v <= 0) continue; const p = pos(v); g.globalAlpha = .12 * (5 - k) / 4; coinAt(j.sprite, p[0], p[1], p[2]); }
    g.globalAlpha = 1; const p = pos(u); spinCoin(j.sprite, j.tier, p[0], p[1], p[2], u * TAU * 1.5);
  }
}
// сколько монет ещё ждёт в арке, кроме тех, что уже на ленте
function drawQueue() {
  if (!queue.length) return;
  const G = beltGeo(), x = G.bx0 + 70, y = G.cy - BELT.r - 150, p = 1 + .06 * Math.sin(time * 4);
  g.save(); g.translate(x, y); g.scale(p, p);
  rr(-62, -30, 124, 60, 30); g.fillStyle = 'rgba(21,12,14,.85)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d9b77a'; g.stroke();
  coinAt(blankCoin(queue[0].tier), -30, 0, 20);
  txt('+' + queue.length, 18, 1, 32, '#fff1a8', 'center', 0);
  g.restore();
}
// Корона кодом: одинаково выглядит на любом телефоне, в отличие от эмодзи
function drawCrown(x, y, w, a = 1) {
  const im = art.king_crown;
  if (im) { const h = w * im.height / im.width; g.save(); g.globalAlpha *= a; g.drawImage(im, x - w / 2, y - h / 2, w, h); g.restore(); return; }
  const h = w * .62;
  g.save(); g.translate(x, y); g.globalAlpha *= a;
  g.beginPath(); g.moveTo(-w / 2, h * .5); g.lineTo(-w / 2, -h * .1); g.lineTo(-w * .27, h * .12); g.lineTo(-w * .14, -h * .5); g.lineTo(0, h * .02);
  g.lineTo(w * .14, -h * .5); g.lineTo(w * .27, h * .12); g.lineTo(w / 2, -h * .1); g.lineTo(w / 2, h * .5); g.closePath();
  const m = g.createLinearGradient(0, -h * .5, 0, h * .5); m.addColorStop(0, '#fff3a6'); m.addColorStop(.5, '#f2b829'); m.addColorStop(1, '#a8670d');
  g.fillStyle = m; g.fill(); g.lineWidth = Math.max(2, w * .05); g.strokeStyle = '#5a3606'; g.stroke();
  g.fillStyle = '#7a4a08'; g.fillRect(-w / 2, h * .32, w, h * .18);
  [[-w * .25, '#e0244d'], [0, '#3fd0ff'], [w * .25, '#e0244d']].forEach(([gx, c]) => { g.fillStyle = c; g.beginPath(); g.arc(gx, h * .41, w * .065, 0, TAU); g.fill(); });
  [-w / 2, -w * .14, w * .14, w / 2].forEach(px => { g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(px, px === -w / 2 || px === w / 2 ? -h * .1 : -h * .5, w * .055, 0, TAU); g.fill(); });
  g.restore();
}
function ironChain(x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(len / 9)), ang = Math.atan2(y1 - y0, x1 - x0);
  g.save(); g.translate(x0, y0); g.rotate(ang);
  for (let k = 0; k < n; k++) { const px = (k + .5) * len / n, f = k % 2 === 0; g.beginPath(); g.ellipse(px, 0, 6, f ? 4 : 1.4, 0, 0, TAU); g.lineWidth = f ? 2.4 : 3; g.strokeStyle = f ? '#9a96a0' : '#4c4852'; g.stroke(); }
  g.restore();
}
let kingPulse = 0;
const MED = { s: .4, hx: 221, hy: 212, hr: 127, by: 548 };   // king_medal.png (441×722): центр отверстия, его радиус и центр ленты под имя; s — масштаб на сцене
const plaqueY = new Map();
function drawTop() {
  const cx = W - 92, ty = L.queueTop + 40, now = performance.now();
  // Трон-медальон короля сундука: чья монета взорвала сундук последней
  const has = owner && now >= owner.at, age = has ? (now - owner.at) / 1000 : 0, ps = has ? easeBack(clamp(age / .45)) : 1;
  kingPulse = Math.max(0, kingPulse - .016);
  if (has) { rays(cx, ty, 50, 150 + 30 * kingPulse, 12, ['#fff1a8', '#ffb12b'], time * .3, .22 + .25 * kingPulse); halo(cx, ty, 170, '#ffd36b', .28 + .1 * Math.sin(time * 2.6) + .3 * kingPulse); }
  g.save(); g.translate(cx, ty); g.scale(ps * (1 + .06 * kingPulse), ps * (1 + .06 * kingPulse)); if (!has) g.globalAlpha = .45;
  const medal = art.king_medal;
  if (medal) {   // картинка: аватарка лежит под рамой, рама перекрывает край
    const k = MED.s, hr = MED.hr * k + 3;
    g.beginPath(); g.arc(0, 0, hr, 0, TAU); g.fillStyle = '#3a2208'; g.fill();
    const av0 = has && avatars.get(owner.uid);
    if (av0) { g.save(); g.beginPath(); g.arc(0, 0, hr, 0, TAU); g.clip(); g.drawImage(thumb(av0), -hr, -hr, hr * 2, hr * 2); g.restore(); } else txt('?', 0, 3, 64, '#fff1a8', 'center', 0);
    g.drawImage(medal, -MED.hx * k, -MED.hy * k, medal.width * k, medal.height * k);
    if (has) txt(shortName(owner.user, 9), 0, (MED.by - MED.hy) * k + 1, 20, '#fff5df', 'center', 4);
  } else {
  // плащ за медальоном
  const cl = g.createLinearGradient(0, -40, 0, 130); cl.addColorStop(0, '#b0182f'); cl.addColorStop(1, '#4e0812');
  g.beginPath(); g.moveTo(-46, -30); g.quadraticCurveTo(-104, 40, -86, 128); g.quadraticCurveTo(-43, 112, 0, 128); g.quadraticCurveTo(43, 112, 86, 128); g.quadraticCurveTo(104, 40, 46, -30); g.closePath();
  g.fillStyle = cl; g.fill(); g.lineWidth = 4; g.strokeStyle = '#e8b923'; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; [-52, 52].forEach(fx => { g.beginPath(); g.moveTo(fx * .6, 10); g.quadraticCurveTo(fx, 60, fx * 1.2, 120); g.stroke(); });
  // золотая розетка
  g.beginPath(); for (let k = 0; k < 32; k++) { const q = k / 32 * TAU + time * .15, rr2 = k % 2 ? 70 : 80; g.lineTo(Math.cos(q) * rr2, Math.sin(q) * rr2); } g.closePath();
  const gm = g.createRadialGradient(-20, -24, 10, 0, 0, 82); gm.addColorStop(0, '#fff3a6'); gm.addColorStop(.6, '#e8a91c'); gm.addColorStop(1, '#8a560a');
  g.fillStyle = gm; g.fill(); g.lineWidth = 3; g.strokeStyle = '#5a3606'; g.stroke();
  g.beginPath(); g.arc(0, 0, 63, 0, TAU); g.fillStyle = '#3a2208'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff1a8'; g.stroke();
  const av = has && avatars.get(owner.uid);
  if (av) g.drawImage(thumb(av), -57, -57, 114, 114); else txt('?', 0, 4, 70, '#fff1a8', 'center', 0);
  }
  g.restore();
  if (has) glint(cx, ty, art.king_medal ? MED.hr * MED.s : 58, ((time * .22) % 1) / .3, .5);
  // корона: падает сверху при смене короля, потом покачивается
  drawCrown(cx, ty + (art.king_medal ? -112 : -98) + Math.sin(time * 2.2) * 5 - (has ? (1 - easeOut(clamp(age / .6))) * 220 : 0), art.king_medal ? 104 : 92, has ? 1 : .4);
  // лента с ником
  if (has && art.king_medal) {   // сколько раз подряд взорвал: бейдж справа внизу медальона
    g.save(); g.translate(cx + 66, ty + 58); g.scale(ps, ps);
    rr(-30, -15, 60, 30, 15); g.fillStyle = 'rgba(21,12,14,.92)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd36b'; g.stroke();
    drawCrown(-14, 0, 22); txt('×' + owner.b, 12, 1, 20, '#fff1a8', 'center', 3);
    g.restore();
    if (age < 1.1) for (let k = 0; k < 10; k++) { const q = k / 10 * TAU + age * 2, d = 110 * easeOut(age / 1.1); star(cx + Math.cos(q) * d, ty + Math.sin(q) * d, 18, 1 - age / 1.1, '#fff1a8'); }
  } else if (has) {
    const by = ty + 106; g.save(); g.translate(cx, by); g.scale(ps, ps);
    g.fillStyle = '#7a0f1f'; [[-1], [1]].forEach(([d]) => { g.beginPath(); g.moveTo(d * 70, -14); g.lineTo(d * 98, -14); g.lineTo(d * 88, 2); g.lineTo(d * 98, 18); g.lineTo(d * 70, 18); g.fill(); });
    rr(-80, -20, 160, 40, 8); g.fillStyle = '#c21f37'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd36b'; g.stroke();
    txt(shortName(owner.user, 9), 0, 1, 22, '#fff5df', 'center', 4);
    g.restore();
    txt('💥×' + owner.b, cx, by + 38, 21, '#fff1a8', 'center', 5);
    if (age < 1.1) for (let k = 0; k < 10; k++) { const q = k / 10 * TAU + age * 2, d = 110 * easeOut(age / 1.1); star(cx + Math.cos(q) * d, ty + Math.sin(q) * d, 18, 1 - age / 1.1, '#fff1a8'); }
  }
  // Кованые таблички лидеров эфира на цепях
  const metal = [['#ffe27a', '#a1730c'], ['#eef2f6', '#7f8a97'], ['#ffc28a', '#8a4a1f']];
  const pOff = art.king_medal ? 246 : 220, pStep = art.king_medal ? 92 : 102;
  let prevY = ty + (art.king_medal ? 192 : 168), prevX = cx;
  topDonors.forEach((d, i) => {
    const target = ty + pOff + i * pStep; let py = plaqueY.get(d.uid); if (py == null) py = target - 160;
    py = lerp(py, target, .12); plaqueY.set(d.uid, py);
    const sw = Math.sin(time * 1.3 + i * 1.7) * .035, w = i === 0 ? 184 : 172, h = 78;
    ironChain(prevX - 60, prevY, cx - 60 + Math.sin(sw) * 40, py - h / 2 + 2); ironChain(prevX + 60, prevY, cx + 60 + Math.sin(sw) * 40, py - h / 2 + 2);
    g.save(); g.translate(cx, py - h / 2); g.rotate(sw); g.translate(0, h / 2);
    g.fillStyle = 'rgba(0,0,0,.3)'; rr(-w / 2 + 6, -h / 2 + 8, w, h, 12); g.fill();
    const wd = g.createLinearGradient(0, -h / 2, 0, h / 2); wd.addColorStop(0, '#7a4e2c'); wd.addColorStop(1, '#3b2213');
    rr(-w / 2, -h / 2, w, h, 12); g.fillStyle = wd; g.fill(); g.lineWidth = 5; g.strokeStyle = i === 0 ? '#c99a2e' : '#2b2830'; g.stroke();
    g.strokeStyle = 'rgba(255,220,160,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-w / 2 + 12, -h / 2 + 7); g.lineTo(w / 2 - 12, -h / 2 + 7); g.stroke();
    g.fillStyle = '#c9a65a'; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { g.beginPath(); g.arc(sx * (w / 2 - 10), sy * (h / 2 - 10), 3.6, 0, TAU); g.fill(); });
    const a = avatars.get(d.uid), m = metal[i];
    g.fillStyle = m[0]; g.beginPath(); g.arc(-w / 2 + 40, 0, 29, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = m[1]; g.stroke();
    if (a) g.drawImage(thumb(a), -w / 2 + 15, -25, 50, 50);
    const mg = g.createRadialGradient(-w / 2 + 10, -h / 2 + 6, 2, -w / 2 + 14, -h / 2 + 10, 20); mg.addColorStop(0, '#fff'); mg.addColorStop(.4, m[0]); mg.addColorStop(1, m[1]);
    g.fillStyle = mg; g.beginPath(); g.arc(-w / 2 + 14, -h / 2 + 10, 17, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = '#2b1a08'; g.stroke();
    txt(String(i + 1), -w / 2 + 14, -h / 2 + 11, 21, '#2b1a08', 'center', 0);
    txt(shortName(d.user, 8), 28, -13, 21, '#fff1d6', 'center', 4);
    coinAt(blankCoin(i === 0 ? 2 : i === 1 ? 1 : 0), -6, 16, 11); txt(String(d.sum), 34, 17, 24, m[0], 'center', 4);
    g.restore();
    if (i === 0) glint(cx, py, w / 2.4, ((time * .18 + .5) % 1) / .4, .25);
    prevY = py + h / 2 - 2; prevX = cx + Math.sin(sw) * 40;
  });
}
// Крышка: перед взрывом захлопывается на кучу монет, сундук трясётся, при взрыве крышку срывает и она улетает.
// Если есть картинка chest_lid.png, рисуется она, иначе крышка рисуется кодом.
function lidState() { if (build) { const u = clamp(lidT / .32); return [u >= 1 ? 1 : easeBack(u), 0]; } if (lidFly >= 0) return [1, lidFly]; return [0, 0]; }
const LID_T = 34;   // толщина крышки в пикселях chest_back.png
// Купол из картинки chest_dome.png: падает сверху, бьёт по сундуку, чуть подпрыгивает. Координаты в пикселях chest_back.png.
const DOME = { x: -3, top: -6, h: 248, bottom: 242, from: 470, fall: .3 };
function domeDrop() {   // на сколько купол приподнят над сундуком (px картинки)
  if (!build) return 0;
  if (lidT < DOME.fall) { const u = lidT / DOME.fall; return (1 - u * u) * DOME.from; }
  const t2 = lidT - DOME.fall; return Math.exp(-t2 * 15) * Math.abs(Math.sin(t2 * 28)) * 24;
}
function drawDome(a, fly) {
  const im = art.chest_dome, cs = a.cs, drop = fly ? 0 : domeDrop(), t2 = build ? lidT - DOME.fall : 9;
  const sq = t2 > 0 && !fly ? Math.exp(-t2 * 18) : 0;   // сплющивается при ударе
  const bx = a.x + a.w / 2, by = a.y + (DOME.bottom - drop) * cs;
  g.save();
  if (fly) { const e = fly, up = -(260 * e - 700 * e * e); g.translate(0, up * cs * 1.5); g.translate(bx, by); g.rotate(e * 2.4 * (e < 1 ? 1 : 0)); g.translate(-bx, -by); g.globalAlpha = clamp((1.3 - e) / .5); }
  else g.globalAlpha = clamp(lidT / .05);
  g.translate(bx, by); g.scale(1 + .035 * sq, 1 - .07 * sq); g.translate(-bx, -by);
  g.drawImage(im, a.x + DOME.x * cs, by - DOME.h * cs, im.width * cs, DOME.h * cs);
  g.restore();
}
function drawLid(a) {
  let [f, fly] = lidState();
  if (art.chest_dome) { if (build || fly) drawDome(a, fly); return; }
  if (f <= .02) return;
  const cs = a.cs, bx0 = 105, bx1 = 578, fx0 = 18, fx1 = 672, by = 10, fy = 246;     // углы проёма на chest_back.png
  const lerpf = (p, q) => lerp(p, q, clamp(f, 0, 1.12));
  let x0 = lerpf(bx0, fx0), x1 = lerpf(bx1, fx1), y1 = lerpf(by, fy);
  g.save();
  if (fly) { const e = fly, up = -(260 * e - 700 * e * e) * 1; g.translate(0, up * cs * 1.5); g.translate(a.x + a.w / 2, a.y + 120 * cs); g.rotate(e * 2.4 * (e < 1 ? 1 : 0)); g.translate(-(a.x + a.w / 2), -(a.y + 120 * cs)); g.globalAlpha = clamp((1.3 - e) / .5); }
  const T = LID_T * clamp(f), X = v => a.x + v * cs, Y = v => a.y + v * cs - T * cs;
  const quad = (u0, u1) => ({ l0: lerp(bx0, x0, u0), r0: lerp(bx1, x1, u0), l1: lerp(bx0, x0, u1), r1: lerp(bx1, x1, u1) });
  if (art.chest_lid) {   // картинка режется на полоски и ложится в трапецию: даёт перспективу при закрытии
    const im = art.chest_lid, N = 18, hh = Math.max(4, (y1 - by) * cs);
    for (let k = 0; k < N; k++) {
      const q = quad(k / N, (k + 1) / N), l = lerp(q.l0, q.l1, .5), r = lerp(q.r0, q.r1, .5);
      g.drawImage(im, 0, im.height * k / N, im.width, im.height / N + 1, X(l), Y(by) + hh * k / N, (r - l) * cs, hh / N + 1);
    }
  } else {
    g.beginPath(); g.moveTo(X(bx0 + 4), Y(by)); g.lineTo(X(bx1 - 4), Y(by)); g.lineTo(X(x1), Y(y1)); g.lineTo(X(x0), Y(y1)); g.closePath();
    const wd = g.createLinearGradient(0, Y(by), 0, Y(y1)); wd.addColorStop(0, '#6e4425'); wd.addColorStop(1, '#8a5a30');
    g.fillStyle = wd; g.fill(); g.lineWidth = 4; g.strokeStyle = '#2a170c'; g.stroke();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(X(lerp(bx0, bx1, k / 6)), Y(by)); g.lineTo(X(lerp(x0, x1, k / 6)), Y(y1)); g.stroke(); }
    g.fillStyle = '#c9a65a'; [.2, .8].forEach(k => { const t1 = lerp(x0, x1, k), t0 = lerp(bx0, bx1, k); g.beginPath(); g.moveTo(X(t0 - 12), Y(by)); g.lineTo(X(t0 + 12), Y(by)); g.lineTo(X(t1 + 18), Y(y1)); g.lineTo(X(t1 - 18), Y(y1)); g.fill(); });
    g.fillStyle = '#e0c070'; g.beginPath(); g.arc(X((x0 + x1) / 2), Y(y1) - 6 * cs, 7 * cs, 0, TAU); g.fill();
    g.restore();
  }
  // объём: передняя стенка крышки и боковые грани
  if (T > 1) {
    const yT = Y(y1), yB = Y(y1) + T * cs, L0 = X(x0), R0 = X(x1);
    g.fillStyle = '#3b2213'; g.beginPath(); g.moveTo(X(bx0), Y(by)); g.lineTo(L0, yT); g.lineTo(L0, yB); g.lineTo(X(bx0), Y(by) + T * cs * .4); g.fill();
    g.beginPath(); g.moveTo(X(bx1), Y(by)); g.lineTo(R0, yT); g.lineTo(R0, yB); g.lineTo(X(bx1), Y(by) + T * cs * .4); g.fill();
    if (art.chest_front) g.drawImage(art.chest_front, 0, 4, art.chest_front.width, 60, L0, yT, R0 - L0, yB - yT);
    else { g.fillStyle = '#6b4426'; g.fillRect(L0, yT, R0 - L0, yB - yT); }
    const sh = g.createLinearGradient(0, yT, 0, yB); sh.addColorStop(0, 'rgba(255,220,160,.18)'); sh.addColorStop(.2, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = sh; g.fillRect(L0, yT, R0 - L0, yB - yT);
    g.lineWidth = 3; g.strokeStyle = '#1e1008'; g.strokeRect(L0, yT, R0 - L0, yB - yT);
  }
  g.restore();
}
function drawChest() {
  const cx = L.cx, t = L.chestTop, b = L.chestBot, kick = chestKick * 12, W2 = 310;
  // прогресс
  const goal = GOALS[Math.min(level, GOALS.length - 1)], py = L.goalY, pw = 620;
  rr(cx - pw / 2, py - 19, pw, 38, 19); g.fillStyle = 'rgba(14,8,10,.85)'; g.fill();
  // полоска следует за реально упавшими монетами; в цепочке (value >= goal) за тем, сколько уже насыпано в новый сундук
  const bt = value >= goal ? Math.min(goal, Math.max(0, pileN - flyers.length)) : Math.min(goal, value + landedExtra);
  barV = lerp(barV, bt, .12); const p = clamp(barV / goal);
  if (p > .02) { rr(cx - pw / 2 + 4, py - 15, (pw - 8) * p, 30, 15); const m = g.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); m.addColorStop(0, '#ffb12b'); m.addColorStop(1, '#fff19a'); g.fillStyle = m; g.fill(); }
  txt(Math.min(Math.round(barV), goal) + ' / ' + goal, cx, py + 1, 25, '#fff', 'center', 5);
  txt('★' + (level + 1), cx - pw / 2 - 42, py + 1, 32, '#fff1a8');
  if (L.art) {
    const a = L.art, base = a.y + a.h, k = 1 + kick * .004;
    let sx = k, sy = 2 - k, dx = 0, dy = 0;
    if (build) { const b = build.t / build.d; dx = rand(-1, 1) * b * 9; dy = rand(-1, 1) * b * 3; const sq = clamp((b - .65) / .35); sx *= 1 + .08 * sq; sy *= 1 - .12 * sq; }   // дрожит и приседает перед взрывом
    if (chestPop >= 0) { const p = chestPop, e = Math.exp(-p * 4.5); sy *= 1 + .26 * e * Math.cos(p * 20); sx *= 1 - .14 * e * Math.cos(p * 20); dy = -Math.max(0, Math.sin(p * 9)) * 70 * e; }   // подпрыгивает и пружинит
    g.save(); g.translate(cx + dx, base + dy); g.scale(sx, sy); g.translate(-cx, -base);
    g.save(); g.globalAlpha = .55; g.fillStyle = '#000'; g.filter = 'blur(10px)';   // тень на полу, чтобы сундук не висел
    g.beginPath(); g.ellipse(cx + 8, base - 8, a.w * .52, 34, 0, 0, TAU); g.fill(); g.restore();
    g.drawImage(art.chest_back, a.x, a.y, a.w, a.h);
    const [lf, lfly] = lidState();
    if (art.chest_dome && build) { g.save(); g.beginPath(); g.rect(cx - MW, a.y + (DOME.bottom - domeDrop()) * a.cs, MW * 2, 2000); g.clip(); g.drawImage(mound, cx - MW / 2, L.mBase - MH); g.restore(); }
    else if (lf > .02 && !lfly) { g.save(); g.beginPath(); g.rect(cx - MW, a.y + (10 - LID_T * clamp(lf)) * a.cs + (1 - clamp(lf)) * -400, MW * 2, 2000); g.clip(); g.drawImage(mound, cx - MW / 2, L.mBase - MH); g.restore(); }
    else g.drawImage(mound, cx - MW / 2, L.mBase - MH);
    drawLid(a);
    g.drawImage(art.chest_front, a.x, a.fy, a.w, a.fh);
    g.restore(); return;
  }
  g.save(); g.translate(cx, b); const k = 1 + kick * .004; g.scale(k, 2 - k); g.translate(-cx, -b);
  if (art.chest_back) g.drawImage(art.chest_back, cx - W2 - 40, t - 110, W2 * 2 + 80, b - t + 150);
  else { rr(cx - W2, t - 88, W2 * 2, 104, [28, 28, 0, 0]); g.fillStyle = '#4b2c1c'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#21120b'; g.stroke(); rr(cx - W2 + 14, t + 8, W2 * 2 - 28, b - t - 20, 10); g.fillStyle = '#160c09'; g.fill(); }
  g.drawImage(mound, cx - MW / 2, L.mBase - MH);
  if (art.chest_front) g.drawImage(art.chest_front, cx - W2 - 40, t + 40, W2 * 2 + 80, b - t);
  else {
    const fy = b - 92; rr(cx - W2, fy, W2 * 2, 104, [6, 6, 22, 22]); const m = g.createLinearGradient(0, fy, 0, b + 12); m.addColorStop(0, '#79472a'); m.addColorStop(1, '#3d2214'); g.fillStyle = m; g.fill(); g.lineWidth = 6; g.strokeStyle = '#21120b'; g.stroke();
    g.fillStyle = '#d6b36a'; [-220, 220].forEach(o => g.fillRect(cx + o - 15, fy, 30, 104)); rr(cx - 38, fy - 8, 76, 66, 10); g.fill();
    g.fillStyle = '#21120b'; g.beginPath(); g.arc(cx, fy + 22, 11, 0, TAU); g.fill();
  }
  g.restore();
}
// Монета с настоящей толщиной: вращается вокруг вертикальной оси, виден бок (ребро), на лицевой стороне «?», на обратной звезда
function coin3D(x, y, r, ang, ti, qm = true) {
  const c = Math.cos(ang), sn = Math.sin(ang), face = Math.abs(c), T = r * .2, near = (c >= 0 ? 1 : -1) * sn * T / 2, t = TIERS[ti], N = 10;
  for (let k = 0; k <= N; k++) {   // ребро: стопка эллипсов от дальней грани к ближней, цвета чередуются, получается рубчатый обод
    g.fillStyle = k % 2 ? t.c[2] : t.c[1];
    g.beginPath(); g.ellipse(x + lerp(-near, near, k / N), y, Math.max(1.6, face * r), r * .985, 0, 0, TAU); g.fill();
  }
  g.save(); g.translate(x + near, y); g.scale(Math.max(.03, face), 1);
  g.drawImage(blankCoin(ti), -r, -r, r * 2, r * 2);
  if (c >= 0) { if (qm) txt('?', 0, r * .04, r * .95, '#fff5df', 'center', r * .07); }
  else { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(0, 0, r * .96, 0, TAU); g.fill(); star(0, 0, r * .42, .55, t.c[0]); }
  g.fillStyle = `rgba(10,4,6,${(1 - face) * .45})`; g.beginPath(); g.arc(0, 0, r * .97, 0, TAU); g.fill();   // поворачивается от света и темнеет
  if (face > .45) glint(0, 0, r - 2, ((time * .45) % 1.8) / .55, .5 * face);
  g.restore();
}
// Экран ожидания: подарки по ступеням сменяют друг друга, рядом вертится монета этой ступени
const IDLE_T = 3.8;
let idleA = 0, idleLast = -1, idleT0 = 0;
function drawIdle() {
  const busy = job || queue.length || belt.length;
  idleA = busy ? Math.max(0, idleA - frameDt * 4) : Math.min(1, idleA + frameDt * 1.5);
  if (idleA <= .01) { idleLast = -1; return; }
  if (idleLast < 0) idleT0 = time;
  const n = TIERS.length, tt = time - idleT0, i = Math.floor(tt / IDLE_T) % n, u = tt % IDLE_T, t = TIERS[i];
  const y0 = L.heroY, ix = L.cx - 262, cx2 = L.cx + 232, R = 108;
  const out = easeOut(clamp((IDLE_T - u) / .42));
  const ki = Math.min(easeBack(clamp(u / .5)), out), kc = Math.min(easeBack(clamp((u - .28) / .55)), out);
  if (i !== idleLast) {   // смена ступени: вспышка и искры на месте монеты
    if (idleLast >= 0) { ring(cx2, y0, 170, t.c[0], .5, 6); burst(cx2, y0, t, 16 + i * 4, 520); sfx('clink', 0); }
    idleLast = i;
  }
  g.save(); g.globalAlpha = idleA;
  // сцена: цветное свечение и медленные лучи за монетой, пятно света на полу
  halo(cx2, y0, 360, t.c[1], .34 * kc * idleA); halo(ix, y0, 230, t.c[1], .18 * ki * idleA);
  rays(cx2, y0, R * .8, 250, 12, [t.c[0], t.c[1]], time * .22, .2 * kc * idleA);
  g.save(); g.globalAlpha = .5 * kc * idleA; g.fillStyle = '#000'; g.filter = 'blur(8px)'; g.beginPath(); g.ellipse(cx2, y0 + R + 70, R * (.95 - .08 * Math.sin(time * 2.2)), 20, 0, 0, TAU); g.fill(); g.restore();
  g.save(); g.globalAlpha = .45 * ki * idleA; g.fillStyle = '#000'; g.filter = 'blur(8px)'; g.beginPath(); g.ellipse(ix, y0 + 150, 84 - 8 * Math.sin(time * 2.4 + i), 15, 0, 0, TAU); g.fill(); g.restore();
  // подарок: покачивается, при появлении падает с вращением, у него подпись с ценой
  const gi = art['gift_' + i], bob = Math.sin(time * 2.4 + i) * 10;
  g.save(); g.translate(ix, y0 + bob - (1 - ki) * 60); g.rotate(Math.sin(time * 1.7 + i) * .07 + (1 - ki) * -.7); g.scale(ki, ki);
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 22; g.shadowOffsetY = 12;
  if (gi) g.drawImage(gi, -105, -105, 210, 210); else txt(t.emoji, 0, 6, 150, '#fff', 'center', 0);
  g.restore();
  if (ki > .05) {   // цена в монетах TikTok
    g.save(); g.translate(ix, y0 + 150 + bob * .3); g.scale(ki, ki);
    rr(-48, -17, 96, 34, 17); g.fillStyle = 'rgba(21,12,14,.88)'; g.fill(); g.lineWidth = 3; g.strokeStyle = t.c[1]; g.stroke();
    g.fillStyle = '#ffc928'; g.beginPath(); g.arc(-26, 0, 11, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = '#b07a00'; g.stroke();
    g.fillStyle = '#b07a00'; g.beginPath(); g.arc(-26, 0, 5, 0, TAU); g.fill();
    txt(String(t.min), 12, 1, 24, '#fff5df', 'center', 4); g.restore();
  }
  // от подарка к монете бегут искры: подарок превращается в монету
  for (let k = 0; k < 7; k++) {
    const p = (time * .75 + k / 7) % 1, x = lerp(ix + 120, cx2 - R - 24, p), y = y0 - Math.sin(p * Math.PI) * 46 + Math.sin(p * 9 + k) * 6, a = Math.sin(p * Math.PI) * Math.min(ki, kc);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * .9; g.fillStyle = k % 2 ? t.c[0] : '#fff'; g.beginPath(); g.arc(x, y, 5 + 4 * Math.sin(p * Math.PI), 0, TAU); g.fill(); g.restore();
  }
  txt('›', (ix + cx2) / 2 + 12, y0 - 6, 70, t.c[0], 'center', 0);
  // монета: плавает, вращается с задержкой на лицевой стороне, вокруг неё искры
  const r = R * kc, by = y0 + Math.sin(time * 2.2) * 12, ang = time * 1.5 - .8 * Math.sin(time * 1.5);
  if (kc > .03) {
    if (i === 4) crystals(cx2, by, r, kc, false);
    g.save(); g.translate(cx2, by); g.rotate(Math.sin(time * 1.3) * .06); g.translate(-cx2, -by);
    coin3D(cx2, by, r, ang, i);
    g.restore();
    if (i === 4) crystals(cx2, by, r, kc, true);
    for (let k = 0; k < 6; k++) {
      const q = time * .9 + k * TAU / 6, d = (1.28 + .08 * Math.sin(q * 2 + k)) * r, sz = (9 + 8 * Math.abs(Math.sin(time * 3 + k * 2))) * kc;
      star(cx2 + Math.cos(q) * d, by + Math.sin(q * 1.4) * r * .85, sz, .5 + .5 * Math.sin(time * 4 + k), k % 2 ? t.c[0] : '#fff');
    }
  }
  g.globalAlpha = 1; g.restore();
}
function draw() {
  const [cz, ctx0, cty] = camMat();
  if (cz > 1) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0c0608'; g.fillRect(0, 0, cv.width, cv.height); }
  g.setTransform(dpr * cz, 0, 0, dpr * cz, dpr * ctx0, dpr * cty);
  g.imageSmoothingQuality = 'high';
  if (art.bg) {   // фон, затемнение и виньетка запекаются в один холст: это одна отрисовка за кадр
    if (!vig || vig.src !== art.bg) buildVignette();
    g.setTransform(cz, 0, 0, cz, dpr * ctx0, dpr * cty); g.drawImage(vig, 0, 0); g.setTransform(dpr * cz, 0, 0, dpr * cz, dpr * ctx0, dpr * cty);
  } else { if (!bg) buildBg(); g.drawImage(bg, 0, 0, SCW, SCH); }
  drawFire();
  g.setTransform(dpr * scale * cz, 0, 0, dpr * scale * cz, dpr * (ox * cz + ctx0), dpr * (oy * cz + cty));
  g.save();
  drawDust(); drawLegend(); drawWall(); drawPress(); drawLantern(); drawStrikeLight(); drawLevelRays(); drawChestShadow();
  drawChest();   // сияния над закрытым сундуком нет: крышка закрыта, свет только при взрыве
  drawWheel();
  drawTwinkles(); drawQueue(); drawTop();
  drawSpinOverlay();
  if (cine > .01) { g.fillStyle = `rgba(6,3,9,${cine})`; g.fillRect(-ox / scale - 60, -oy / scale - 60, SCW / scale + 120, SCH / scale + 120); }
  for (const f of flyers) { if (f.t < 0) continue; const u = clamp(f.t / f.d); g.save(); g.translate(lerp(f.x, f.tx, u), lerp(f.y, f.ty, u * u) - Math.sin(u * Math.PI) * 120); g.rotate(lerp(f.a + 8, f.slot ? f.slot.rot : 0, u * u)); g.scale(1, lerp(1, f.slot ? f.slot.sq : 1, u * u)); g.drawImage(f.sprite, -f.r, -f.r, f.r * 2, f.r * 2); g.restore(); }
  drawIdle(); drawJob(); drawSteam(frameDt);
  for (const p of tiny) {
    g.globalAlpha = clamp(p.life / .6) * (p.grow ? clamp(1 - (p.r - 60) / 140) : 1);
    if (p.spin) spinCoin(p.sprite, p.tier, p.x, p.y, p.r, p.ang);
    else { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.drawImage(p.sprite, -p.r, -p.r, p.r * 2, p.r * 2); g.restore(); }
  }
  g.globalAlpha = 1;
  if (lvlBadge > 0) { const sc = easeBack(clamp((1.9 - lvlBadge) / .35)); halo(L.cx, L.heroY, 360, '#ffd36b', clamp(lvlBadge / .5) * .7); g.save(); g.globalAlpha = clamp(lvlBadge / .5); g.translate(L.cx, L.heroY); g.scale(sc, sc); txt('★' + (level + 1), 0, 0, 180, '#fff1a8', 'center', 12); g.restore(); }
  for (const p of parts) { g.globalAlpha = clamp(p.life / .4); g.fillStyle = p.c; g.fillRect(p.x, p.y, p.size, p.size); }
  g.globalAlpha = 1;
  drawRings();
  g.restore();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (flash) { g.globalAlpha = flash * .7; g.fillStyle = flashColor; g.fillRect(0, 0, SCW, SCH); g.globalAlpha = 1; }
  if (Live.testMode) { g.beginPath(); g.roundRect(SCW - 64, 8, 56, 24, 6); g.fillStyle = '#b3122f'; g.fill(); g.font = '900 13px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('TEST', SCW - 36, 21); }
  else if (!connected) { g.fillStyle = '#ff3b4d'; g.beginPath(); g.arc(SCW - 20, 20, 7 + Math.sin(time * 6) * 2, 0, TAU); g.fill(); }
}
let frameDt = 1 / 60, last = performance.now(), fpsN = 0, fpsT = 0, fps = 60;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; frameDt = dt;
  fpsN++; fpsT += dt; if (fpsT >= 1) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  update(dt); draw(); requestAnimationFrame(loop);
}

// Лайки: мелкие искры над сундуком, без монет и без очков
let likeGate = 0;
function onLike(m) { if (m) onLikeUser(m); const n = performance.now(); if (n < likeGate) return; likeGate = n + 220; burst(rand(L.cx - 260, L.cx + 260), L.pileY - 10, TIERS[3], 5, 240); }

// Настоящие значки подарков из каталога TikTok, иначе остаются эмодзи
function onCatalog(list) {
  const wg = list.find(x => WHEEL.gifts.length ? WHEEL.gifts.includes(x.name) : x.coins === WHEEL.coins);
  if (wg) { wheelIcon = new Image(); wheelIcon.src = wg.img; }
  giftIcons = TIERS.map((t, i) => {
    if (ASSETS.includes('gift_' + i)) return null;   // значки ступеней лежат в assets/gift_N.png
    const next = TIERS[i + 1] ? TIERS[i + 1].min : Infinity, inTier = list.filter(x => x.coins >= t.min && x.coins < next);
    const pick = inTier.find(x => x.name === t.name) || inTier.sort((a, b) => a.coins - b.coins)[0];
    if (!pick) return null;
    const im = new Image(); im.src = pick.img; return im;
  });
}
Live.connect({ onGift: m => { addGift(m); if (isWheelGift(m)) queueSpin(m); }, onLike, onFollow, onStatus: v => { connected = v; }, onCatalog });
Live.keepAwake();

// Полноэкранный режим: кнопка сама исчезает, чтобы не попасть в эфир
const fsB = document.getElementById('fs');
if (!document.documentElement.requestFullscreen) fsB.hidden = true;
fsB.onclick = () => { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); fsB.classList.add('off'); };
setTimeout(() => fsB.classList.add('off'), 8000);

// Боты только для проверки. На планшете включаются адресом ?test=1, в эфире их нет
const NAMES = ['Алина', 'Maks_07', 'Dulce Thiime', 'ProPlay44', 'Катя ✨', '小猪猪', 'Ivan Alexandro', 'lazy_ga', 'Беня', 'ERI', 'wolf.of.north', 'Hani', 'Лука', 'saaa', 'Marta🌹', 'kingeris', 'Óscar', 'yulianas4'];
let bots = false, botTimer = 0;
// Нарисованные портреты для ботов, чтобы проверять гравировку на картинках, а не только на буквах
const portraits = [];
function makePortrait(k) {
  const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'), h = (k * 67) % 360;
  const bgc = x.createLinearGradient(0, 0, 160, 160); bgc.addColorStop(0, `hsl(${h} 60% 70%)`); bgc.addColorStop(1, `hsl(${(h + 60) % 360} 50% 35%)`); x.fillStyle = bgc; x.fillRect(0, 0, 160, 160);
  const skin = ['#f1c7a3', '#d9a07a', '#a8714a', '#6b4429', '#f5d7bf'][k % 5], hair = ['#2a1a10', '#6b3d1c', '#e0b25a', '#111', '#b84a2a', '#ddd'][k % 6];
  x.fillStyle = `hsl(${(h + 180) % 360} 45% 30%)`; x.beginPath(); x.ellipse(80, 168, 64, 50, 0, 0, TAU); x.fill();
  x.fillStyle = skin; x.fillRect(66, 96, 28, 26); x.beginPath(); x.ellipse(80, 78, 34, 40, 0, 0, TAU); x.fill();
  x.fillStyle = hair; x.beginPath(); x.ellipse(80, 54, 38, 24, 0, Math.PI, TAU); x.fill(); if (k % 3 === 0) { x.fillRect(42, 52, 12, 52); x.fillRect(106, 52, 12, 52); }
  x.fillStyle = '#1a1a1a'; if (k % 4 === 1) { x.fillRect(52, 70, 24, 12); x.fillRect(84, 70, 24, 12); x.fillRect(74, 73, 12, 3); } else { x.beginPath(); x.arc(67, 76, 4, 0, TAU); x.arc(93, 76, 4, 0, TAU); x.fill(); }
  x.strokeStyle = '#7a3b2a'; x.lineWidth = 3; x.beginPath(); x.arc(80, 92, 12, .2, Math.PI - .2); x.stroke();
  return c.toDataURL('image/jpeg', .85);
}
function botGift(ti) {
  const i = Math.floor(rand(0, NAMES.length)), t = ti ?? (Math.random() < .68 ? 0 : Math.random() < .62 ? 1 : Math.random() < .6 ? 2 : Math.random() < .7 ? 3 : 4);
  const coins = [1, 5, 20, 30, 199][t], name = NAMES[i] + (Math.random() < .5 ? '' : ' ' + Math.floor(rand(1, 99)));
  if (i % 2 === 0 && !portraits[i]) portraits[i] = makePortrait(i);
  addGift({ user: name, uid: name, pic: portraits[i] || '', coins, count: t === 0 && Math.random() < .3 ? 10 : 1 });
}
// Подарок с панели: можно от одного и того же зрителя и сериями, чтобы проверять комбо
let sticky = false, series = 1, lastTi = 0;
function panelGift(ti, count = 1, same = sticky) {
  lastTi = ti;
  const i = same ? 0 : Math.floor(rand(0, NAMES.length)), name = same ? NAMES[0] : NAMES[i] + ' ' + Math.floor(rand(1, 99));
  if (i % 2 === 0 && !portraits[i]) portraits[i] = makePortrait(i);
  addGift({ user: name, uid: name, pic: portraits[i] || '', coins: [1, 5, 20, 30, 199][ti], count });
}
function botTick() { if (bots) { botGift(); } botTimer = setTimeout(botTick, rand(500, 2400)); }
if (Live.testMode) {
  const pn = document.getElementById('panel'); pn.hidden = false;
  const btn = (label, fn, id) => { const b = document.createElement('button'); b.textContent = label; if (id) b.id = id; b.onclick = () => fn(b); pn.append(b); return b; };
  const hide = btn('⚙', () => pn.classList.toggle('min'), 'hide');
  TIERS.forEach((t, i) => btn(t.emoji, () => panelGift(i, series)));
  btn('+20', () => { for (let i = 0; i < 20; i++) botGift(); });
  btn('🤖', b => { bots = !bots; b.setAttribute('aria-pressed', bots); }).setAttribute('aria-pressed', 'false');
  btn('♥', () => onLike());
  btn('👍', () => { const n = NAMES[Math.floor(rand(0, NAMES.length))]; onLike({ user: n, uid: n, count: LIKES.step }); });
  btn('➕', () => { const n = NAMES[Math.floor(rand(0, NAMES.length))] + ' ' + Math.floor(rand(100, 999)); onFollow({ user: n, uid: n }); });
  // комбо: «👤» все подарки от одного зрителя; «×N» серия одним подарком (как в TikTok: одна розa ×10); «🔁» 10 подарков подряд от одного зрителя
  btn('👤', b => { sticky = !sticky; b.setAttribute('aria-pressed', sticky); b.title = 'Все подарки от одного зрителя'; }).setAttribute('aria-pressed', 'false');
  btn('×1', b => { series = series === 1 ? 5 : series === 5 ? 10 : series === 10 ? 30 : 1; b.textContent = '×' + series; b.title = 'Сколько штук в одной серии'; });
  btn('🔁', () => { for (let k = 0; k < 10; k++) setTimeout(() => panelGift(lastTi, 1, true), k * 250); });
  btn('🔊', b => { mute = !mute; b.textContent = mute ? '🔇' : '🔊'; });
  btn('🎡', () => { const n = NAMES[Math.floor(rand(0, NAMES.length))]; const m = { user: n, uid: 'w' + n, coins: WHEEL.coins, count: 1 }; addGift(m); queueSpin(m); });
  btn('🎵', b => { musicOn = !musicOn; b.style.opacity = musicOn ? 1 : .4; });
  botTick();
  bots = true; pn.querySelector('button:nth-of-type(8)').setAttribute('aria-pressed', 'true');
}

window.__mint = { coinTest: (src, ti) => makeCoin({ src }, ti), letter: letterAvatar, portrait: k => makePortrait(k), onLike, onFollow, owner: () => owner, sfx: (k, t) => { unlock(); sfx(k, t); }, addGift, botGift, lid: () => ({ b: !!build, t: lidT, fly: lidFly }), spin: () => spin && { t: spin.t, done: spin.done, k: spin.k }, wheel: m => { addGift(m); queueSpin(m); }, sounds: () => Object.keys(sbuf), music: () => music && { src: music.src, paused: music.paused, t: music.currentTime, vol: music.volume }, stat: () => ({ fountain: tiny.filter(p => p.spin && p.y < H + 60).length, lidFly, chestPop, slots: slots.length, pileN, fps, queue: queue.length, belt: belt.length, total, level, value, wall: wall.length, job: job && job.ph, W: SCW, H: SCH, scale, order: queue.slice(0, 3).map(j => j.tier) }), setBots: v => { bots = v; } };
resize();
requestAnimationFrame(loop);
})();
