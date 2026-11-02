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
  { id: 'gold',    min: 30,  name: 'Doughnut',     emoji: '🍩', c: ['#fff3ad', '#ecbb22', '#8f640a'], burst: 26 },
  { id: 'ruby',    min: 100, name: 'Hand Hearts',  emoji: '🫶', c: ['#ffb0bb', '#e0244d', '#760a24'], burst: 40 },
  { id: 'diamond', min: 500, name: 'Galaxy',       emoji: '🌌', c: ['#ecfdff', '#5cdcf8', '#2868d0'], burst: 70 }
];
const tierOf = coins => { let n = 0; TIERS.forEach((t, i) => { if (coins >= t.min) n = i; }); return n; };
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
const ASSETS = window.MINT_NO_ASSETS ? [] : ['bg', 'press_frame', 'press_head', 'anvil', 'chest_back', 'chest_front', 'legend', 'wall',
  ...TIERS.map(t => 'coin_' + t.id)];
const BUILD = 10;   // увеличивайте при каждом обновлении: сбрасывает кэш картинок и скрипта
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
  bg = null; layoutChest(); if (!mound) initMound();
}
// Сундук: с картинкой (задняя часть + передняя стенка) или нарисованный кодом
function layoutChest() {
  const b = art.chest_back, f = art.chest_front;
  if (b && f) {
    const cs = CHEST_W / b.width, h = b.height * cs, y = 1388 - h;
    L.art = { cs, x: L.cx - CHEST_W / 2, y, w: CHEST_W, h, fy: y + (b.height - f.height) * cs, fh: f.height * cs };
    L.rimY = L.art.fy; L.goalY = y - 36; L.mBase = L.rimY + 34; L.slotY = L.rimY - 44;
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
  return c;
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
  return blanks[ti] = c;
}

// Состояние
const queue = []; let dirty = false, job = null;
const wall = [], parts = [], flyers = [], tiny = [], rings = [], spots = [], twinkles = [];
const donors = new Map(); let topDonors = [];
let build = null, burstHold = 0, pileLevel = 0, lvlBadge = 0, cine = 0, lvlT = 0, hitstop = 0, anvilKick = 0, embers = [], emberAcc = 0, shake = 0, flash = 0, flashColor = '#fff', pressY = 0, chestKick = 0, level = 0, value = 0, total = 0, connected = !Live.local, time = 0, sprites = [];
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
  const j = { user: String(m.user || 'Viewer'), uid, pic: m.pic || '', coins, count, tier, base, combo, free, src: m.src || '', value: free ? 1 : coins * count, at: now };
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
  if (!queue.length || build || burstHold > 0 || value >= curGoal()) return;
  sortQueue();
  const j = queue.shift();
  j.avatar = avatarOf(j); j.sprite = makeCoin(j.avatar, j.tier, j.free); j.v = j.avatar.v;
  j.ph = 0; j.t = 0; j.dur = [.42, .15, .1, .22, .3 + j.tier * .08, .6 + j.tier * .45, .42];
  const q = queue.length;
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
  if (j.ph === 6) { const lv = Math.min(1, (value + j.value) / curGoal()); pourTo(lv, j.tier, L.cx, L.heroY, Math.min(j.count - 1, 15)); j.slot = moundSlot(lv); }
  if (j.ph >= j.dur.length) land(j);
}
function strike(j) {
  hitstop = .045 + j.tier * .012; anvilKick = 1;
  shake = Math.max(shake, 12 + j.tier * 5); sfx('clank', j.tier);
  burst(L.cx, L.anvil - 30, TIERS[j.tier], 14 + j.tier * 6, 560);
  ring(L.cx, L.anvil + 30, 170 + j.tier * 30, '#ffffff', .35, 12);
  if (j.avatar.v !== j.v) j.sprite = makeCoin(j.avatar, j.tier, j.free);
}
function land(j) {
  for (const f of flyers) if (f.slot) { bake(f.sprite, f.slot); } flyers.length = 0;   // докидываем мелочь, чтобы монета зрителя легла сверху
  bake(j.sprite, j.slot); sfx('clink', j.tier); chestKick = 1; total++;
  burst(j.slot.x, j.slot.y, TIERS[j.tier], 6, 260);
  ring(j.slot.x, j.slot.y, 70, TIERS[j.tier].c[0], .3, 6);
  spots.push({ x: j.slot.x, y: j.slot.y, tier: j.tier }); if (spots.length > 40) spots.shift();
  sprites.push({ s: j.sprite, tier: j.tier }); if (sprites.length > 30) sprites.shift();
  addWall(j); sfx('rope');
  value += j.value; if (!j.free) lastLander = j;
  job = null;
}
function addWall(j) {
  const v = j.coins, old = wall.find(w => w.uid === j.uid);
  if (old) { if (v < old.value) return; wall.splice(wall.indexOf(old), 1); }
  wall.push({ uid: j.uid, user: j.user, value: v, tier: j.tier, sprite: j.sprite, swing: 1, at: performance.now() });
  wall.sort((a, b) => b.value - a.value || b.at - a.at);
  wall.length = Math.min(wall.length, 7);
}
// Мелкие монеты сыплются в сундук, чтобы высота кучи совпадала с полосой прогресса
function pourTo(lv, maxTier, fx, fy, extra = 0) {
  const n = Math.min(40, Math.max(extra, Math.round((lv - pileLevel) * 45)));
  for (let i = 0; i < n; i++) {
    const tl = i < extra ? maxTier : Math.floor(rand(0, maxTier + 1)), slot = moundSlot(lerp(pileLevel, lv, (i + 1) / (n + 1)));
    flyers.push({ sprite: blankCoin(tl), x: fx + rand(-50, 50), y: fy, t: -i * (.3 / Math.max(n, 1)), d: rand(.26, .4), tx: slot.x, ty: slot.y, slot, a: rand(0, TAU), r: 24 });
  }
  pileLevel = Math.max(pileLevel, lv);
}
function startBuild() {
  build = { t: 0, d: 1.25, next: 0 }; sfx('build');
  if (lastLander) { const b = (ownerWins.get(lastLander.uid) || 0) + 1; ownerWins.set(lastLander.uid, b); owner = { uid: lastLander.uid, user: lastLander.user, b, at: performance.now() + 1300 }; }
}
// Сундук переполнен: дрожит, светится и взрывается фонтаном монет
function doBurst() {
  value = Math.min(value - curGoal(), Math.floor(curGoal() * .8)); level++;
  sfx('win', 4); flash = .55; flashColor = '#fff1a8'; shake = 42; chestKick = 2;
  const pool = sprites.length ? sprites : [{ s: blankCoin(0), tier: 0 }];
  for (let i = 0; i < 72; i++) {
    const own = i < 30 && i < pool.length * 2, src = own ? pool[i % pool.length] : null, ti = src ? src.tier : Math.floor(rand(0, 5));
    tiny.push({ spin: true, sprite: src ? src.s : blankCoin(ti), tier: ti, x: L.cx + rand(-L.slotHW, L.slotHW), y: L.pileY + rand(0, 70),
      vx: rand(-560, 560), vy: -rand(950, 1800), r: own ? rand(40, 62) : rand(22, 38), ang: rand(0, TAU), vang: rand(-14, 14), life: rand(2.2, 3.2), grow: i % 14 === 0 ? rand(45, 80) : 0 });
  }
  ring(L.cx, L.pileY, 760, '#fff1a8', .8, 20); ring(L.cx, L.pileY, 520, '#ffb12b', .65, 14, -.12); ring(L.cx, L.pileY, 300, '#ffffff', .4, 10);
  burst(L.cx, L.pileY, TIERS[4], 100, 1300);
  lvlT = 1.6; lvlBadge = 1.9; spots.length = 0; burstHold = 1.1;
  initMound(); pileLevel = 0;
}
function heroStart(j) {
  const t = TIERS[j.tier], r = heroR(j);
  if (j.tier >= 2) ring(L.cx, L.heroY, r * 2.1, t.c[0], .6, 14);
  if (j.tier >= 3) { ring(L.cx, L.heroY, r * 2.8, t.c[1], .8, 10, -.18);
    for (let i = 0; i < (j.tier === 4 ? 42 : 24); i++) tiny.push({ sprite: blankCoin(j.tier), x: rand(0, W), y: rand(-420, -40), vx: rand(-60, 60), vy: rand(80, 380), r: rand(16, 30), a: rand(0, TAU), va: rand(-6, 6), life: 3.2 }); }
}
function ring(x, y, r1, color, d = .5, w = 10, t = 0) { rings.push({ x, y, r1, color, d, w, t }); }
function burst(x, y, t, n, sp) {
  n = Math.min(n, 120 - Math.min(parts.length, 100));
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(.25, 1) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 170, life: rand(.4, .95), max: .95, size: rand(3, 9), c: t.c[i % 2] }); }
}

// Куча в сундуке запекается в отдельный холст: тысячи монет не тормозят экран
let mound, mx, heights, MW = 600, MH = 420;
function initMound() {
  mound = document.createElement('canvas'); mound.width = MW; mound.height = MH; mx = mound.getContext('2d');
  heights = new Array(24).fill(0);
}
function moundSlot(level = pileLevel) {
  const c = Math.floor(rand(1, 23)), edge = ((c - 11.5) / 11.5) ** 2;
  const h = clamp(level) * L.capH * rand(.84, 1) * (1 - .3 * edge);   // горка: в середине выше
  return { c, x: L.cx + ((c + .5) / 24 - .5) * 2 * L.slotHW + rand(-6, 6), y: L.slotY - h, h };
}
function bake(sprite, s) {
  const r = 44, x = s.x - (L.cx - MW / 2), y = s.y - (L.mBase - MH);
  mx.save(); mx.translate(x, y); mx.rotate(rand(-.5, .5)); mx.shadowColor = 'rgba(0,0,0,.45)'; mx.shadowBlur = 5; mx.drawImage(sprite, -r, -r, r * 2, r * 2); mx.restore();
  const k = 600 / (2 * L.slotHW); heights[s.c] += 24 * k; heights[s.c - 1] += 14 * k; heights[s.c + 1] += 14 * k;
}

// Звук из браузера, без файлов
let ac = null, mute = false;
function unlock() { if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); } if (ac && ac.state === 'suspended') ac.resume(); }
addEventListener('pointerdown', unlock);
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
  if (k === 'spark') noise(.03 + Math.random() * .03, rand(2500, 6500), 2, .035, 0, 'bandpass');
}
let crackleOn = false;
function crackle() { if (ac && !mute && ac.state === 'running') sfx('spark'); setTimeout(crackle, rand(120, 900)); }
addEventListener('pointerdown', () => { if (!crackleOn) { crackleOn = true; crackle(); } });

// Обновление
function update(dt) {
  time += dt;
  if (hitstop > 0) { hitstop -= dt; return; }   // короткая заморозка в момент удара
  anvilKick = Math.max(0, anvilKick - dt * 7);
  updateEmbers(dt);
  if (build) {
    build.t += dt; build.next -= dt;
    if (build.next <= 0) { build.next = rand(.07, .14); sfx('clink', Math.floor(rand(0, 5))); if (Math.random() < .6) tiny.push({ sprite: blankCoin(Math.floor(rand(0, 5))), x: L.cx + rand(-L.slotHW, L.slotHW), y: L.pileY, vx: rand(-120, 120), vy: -rand(350, 650), r: rand(16, 26), a: rand(0, TAU), va: rand(-8, 8), life: 1.2 }); }
    if (build.t >= build.d) { build = null; doBurst(); }
  }
  burstHold = Math.max(0, burstHold - dt); lvlBadge = Math.max(0, lvlBadge - dt);
  if (!build && !job && burstHold <= 0 && !flyers.length && value >= curGoal()) startBuild();
  if (!build && !job && burstHold <= 0 && !flyers.length && value > 0 && pileLevel < Math.min(1, value / curGoal()) - .02) pourTo(Math.min(1, value / curGoal()), 4, L.cx, L.pileY - 420);
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
  for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt; if (f.t > f.d) { flyers.splice(i, 1); if (f.slot) bake(f.sprite, f.slot); if (i % 3 === 0) sfx('clink', 0); chestKick = Math.max(chestKick, .5); } }
  for (let i = tiny.length - 1; i >= 0; i--) { const p = tiny[i]; p.life -= dt; if (p.life <= 0 || p.y > H + 700) { tiny.splice(i, 1); continue; } p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.spin) { p.ang += p.vang * dt; if (p.grow) p.r += p.grow * dt; } else p.a += p.va * dt; }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].d) rings.splice(i, 1); }
  for (let i = twinkles.length - 1; i >= 0; i--) { twinkles[i].t += dt; if (twinkles[i].t > twinkles[i].d) twinkles.splice(i, 1); }
  if (spots.length && Math.random() < dt * (1.2 + spots.length * .08)) { const p = spots[Math.floor(rand(0, spots.length))]; twinkles.push({ x: p.x + rand(-22, 22), y: p.y + rand(-22, 10), t: 0, d: rand(.5, .9), s: 9 + p.tier * 4, c: TIERS[p.tier].c[0] }); }
  const ct = job && (job.ph === 4 || job.ph === 5) ? [0, .12, .3, .5, .62][job.tier] : 0; cine = lerp(cine, ct, clamp(dt * 5));
  lvlT = Math.max(0, lvlT - dt);
  shake = Math.max(0, shake - dt * 70); flash = Math.max(0, flash - dt * 1.7); chestKick = Math.max(0, chestKick - dt * 4);
  wall.forEach(w => { w.swing = Math.max(0, w.swing - dt * .55); });
}

// Печь: мерцание света и искры, привязаны к картинке фона
const FIRE = { x: 140, y: 745 };   // где в bg.png горит огонь
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
    const ic = giftIcons[i];
    if (ic && ic.complete && ic.naturalWidth) g.drawImage(ic, cx - 74, y - 34, 68, 68);
    else txt(t.emoji, cx - 40, y + 2, 46, '#fff', 'center', 0);
    txt('›', cx + 2, y - 3, 34, '#d9b77a', 'center', 0);
    coinAt(blankCoin(i), cx + 44, y + wob, 31); glint(cx + 44, y + wob, 30, ((time * .3 + i * .2) % 1) / .3);
  });
}
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
// Подвес по металлу: бронза на бечёвке, серебро и золото на цепочках, рубин с бусинами, бриллиант светится
function drawRope(x0, y0, x1, y1, ti) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  g.save(); g.translate(x0, y0); g.rotate(ang);
  if (ti === 0) {
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
function drawWall() {
  const y = L.rope, n = 7, w = Math.min(W - 60, 980), x0 = L.cx - w / 2, gap = w / n, now = performance.now();
  if (art.wall) stretch3(art.wall, x0 - 20, y - 24, w + 40, 48, 70);
  else { g.lineWidth = 10; g.strokeStyle = '#a57a3d'; g.beginPath(); g.moveTo(x0 - 10, y); g.lineTo(x0 + w + 10, y); g.stroke(); }
  for (let i = 0; i < n; i++) {
    const cx = x0 + gap * (i + .5), it = wall[i], len = 56;
    if (!it) { g.fillStyle = 'rgba(255,240,200,.14)'; g.beginPath(); g.arc(cx, y + len + 52, 50, 0, TAU); g.fill(); continue; }
    const t = it.tier, age = (now - it.at) / 1000, drop = -(1 - easeOut(clamp(age / .5))) * 230;
    const sway = Math.sin(time * (1.3 - t * .12) + i * 1.1) * (.06 - t * .008);       // дорогие качаются спокойнее
    const sw = Math.sin(time * 6 + i) * it.swing * .42 + sway, bob = t === 4 ? Math.sin(time * 2 + i) * 6 : 0;
    const hx = cx + Math.sin(sw) * len, hy = y + Math.cos(sw) * len + drop + bob, ccy = hy + 46;
    // за монетой
    if (t === 4) rays(hx, ccy, 40, 80, 10, ['#ffffff', '#7ff3ff', '#ff9cf0', '#fff59a'], time * .6 + i, .4);
    if (t >= 3) halo(hx, ccy, 110, TIERS[t].c[1], .35 + .15 * Math.sin(time * 2.4 + i));
    else if (t === 2) halo(hx, ccy, 92, TIERS[t].c[1], .16 + .08 * Math.sin(time * 2 + i));
    else if (i === 0) halo(hx, ccy, 110, TIERS[t].c[1], .25 + .1 * Math.sin(time * 3));
    drawRope(cx, y, hx, hy, t);
    // монета: рубин и бриллиант время от времени делают оборот
    const per = t === 4 ? 4 : 6.5, sp = ((time + i * .9) % per) / .9;
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
function drawPressArt() {
  const cx = L.cx, a = L.anvil, fr = art.press_frame, ph = art.press_head, F = FRAME, sf = F.s, hole = F.hole;
  // Наковальни нет: монета лежит на железной плите, настеленной на основание рамы
  const plankTop = a + 66, fx = cx - (hole[0] + hole[2]) / 2 * sf, fy = plankTop - hole[3] * sf, beamBottom = fy + hole[1] * sf;
  const px0 = fx + hole[0] * sf, px1 = fx + hole[2] * sf;
  // лента подачи
  g.fillStyle = '#231b20'; rr(0, plankTop - 16, px0 + 4, 20, 4); g.fill();
  g.fillStyle = '#5b4a3d'; const off = (job && job.ph === 0 ? time * 240 : 0) % 44;
  for (let x = -44 + off; x < px0 - 8; x += 44) g.fillRect(x, plankTop - 12, 22, 12);
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
}
function drawPress() {
  if (art.press_frame && art.press_head) return drawPressArt();
  const cx = L.cx, a = L.anvil, top = L.pressTop, hw = 170;
  // наковальня
  rr(cx - 150, a + 8, 300, 34, 8); g.fillStyle = '#3f3a44'; g.fill();
  rr(cx - 86, a + 40, 172, 44, 6); g.fillStyle = '#2d2932'; g.fill();
  // лента подачи
  g.fillStyle = '#231b20'; rr(0, a + 8, cx - 140, 22, 4); g.fill();
  g.fillStyle = '#5b4a3d'; const off = (job && job.ph === 0 ? time * 240 : 0) % 44;
  for (let x = -44 + off; x < cx - 150; x += 44) g.fillRect(x, a + 12, 22, 14);
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
  if (j.ph === 0) { const x = lerp(-80, cx, easeOut(u)); g.save(); g.translate(x, a - 26); g.rotate((x - cx) / 76); g.drawImage(blankCoin(j.tier), -76, -76, 152, 152); g.restore(); }
  else if (j.ph === 1) coinAt(blankCoin(j.tier), cx, a - 26, 76);
  else if (j.ph === 2) coinAt(j.sprite, cx, a - 26, 82, 1, .72 + .28 * u * u);
  else if (j.ph === 3) { coinAt(j.sprite, cx, a - 26, 82, 1, 1 + .1 * Math.sin(u * Math.PI)); glint(cx, a - 26, 80, u); }
  else if (j.ph === 4) {
    const r = lerp(82, heroR(j), easeBack(u)), y = lerp(a - 26, L.heroY, easeOut(u));
    if (j.tier >= 2) halo(cx, y, r * 2.2, t.c[1], u * .6);
    spinCoin(j.sprite, j.tier, cx, y, r, u * TAU * (j.tier >= 3 ? 3 : 2));
  } else if (j.ph === 5) {
    const r = heroR(j), y = L.heroY + Math.sin(time * 3) * 8, tt = j.t, intro = easeBack(clamp(tt / .35));
    if (j.tier >= 1) {
      const len = (150 + j.tier * 95) * intro, n = j.tier === 4 ? 18 : 10 + j.tier * 2, al = .14 + j.tier * .07;
      const cols = j.tier === 4 ? ['#ffffff', '#7ff3ff', '#ff9cf0', '#fff59a', '#9cffb3'] : [t.c[0], t.c[1]];
      rays(cx, L.heroY, r * .55, len, n, cols, time * .35, al);
      if (j.tier >= 3) rays(cx, L.heroY, r * .45, len * .7, n, cols.slice().reverse(), -time * .5, al * .8);
    }
    halo(cx, y, r * (1.8 + j.tier * .25), t.c[1], .3 + j.tier * .1);
    coinAt(j.sprite, cx, y, r);
    glint(cx, y, r * .97, (tt % 1.5) / .7, .5);
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
    const r0 = heroR(j), tx = j.slot.x, ty = j.slot.y;
    const pos = v => { const e = easeIn(v); return [lerp(cx, tx, e), lerp(L.heroY, ty, e) - Math.sin(v * Math.PI) * 90, lerp(r0, 44, e)]; };
    for (let k = 4; k >= 1; k--) { const v = u - k * .05; if (v <= 0) continue; const p = pos(v); g.globalAlpha = .12 * (5 - k) / 4; coinAt(j.sprite, p[0], p[1], p[2]); }
    g.globalAlpha = 1; const p = pos(u); spinCoin(j.sprite, j.tier, p[0], p[1], p[2], u * TAU * 1.5);
  }
}
function drawQueue() {
  const x0 = 28, y0 = L.queueTop, st = 90, shown = Math.min(queue.length, 6), now = performance.now();
  for (let i = 0; i < shown; i++) {
    const j = queue[i], col = i % 2, row = i >> 1, x = x0 + 44 + col * st, y = y0 + 44 + row * st + Math.sin(time * 2.5 + i) * 3;
    const ps = easeBack(clamp((now - j.at) / 350));
    if (i === 0) { g.save(); g.globalAlpha = .55 + .45 * Math.sin(time * 5); g.strokeStyle = TIERS[j.tier].c[0]; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 49 + 2 * Math.sin(time * 5), 0, TAU); g.stroke(); g.restore(); }
    g.save(); g.translate(x, y); g.scale(ps, ps);
    g.fillStyle = TIERS[j.tier].c[1]; g.beginPath(); g.arc(0, 0, 43, 0, TAU); g.fill();
    g.drawImage(thumb(avatarOf(j)), -37, -37, 74, 74); g.restore();
  }
  if (queue.length) txt('+' + queue.length, x0 + 88, y0 - 16, 42, '#fff1a8');
}
function drawTop() {
  const cx = W - 76, y0 = L.queueTop, now = performance.now();
  // хозяин сундука: чья монета взорвала сундук последней
  if (owner && now >= owner.at) {
    const a = avatars.get(owner.uid), age = (now - owner.at) / 1000, ps = easeBack(clamp(age / .4)), oy2 = y0 + 46;
    halo(cx, oy2, 130, '#ffd36b', .35 + .12 * Math.sin(time * 2.6));
    g.save(); g.translate(cx, oy2); g.scale(ps, ps);
    g.fillStyle = '#e8b923'; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff1a8'; g.stroke();
    if (a) g.drawImage(thumb(a), -50, -50, 100, 100);
    g.restore();
    glint(cx, oy2, 50, ((time * .25) % 1) / .3, .45);
    txt('👑', cx, oy2 - 76 + Math.sin(time * 2.4) * 5 - (1 - easeOut(clamp(age / .55))) * 160, 54, '#fff', 'center', 0);
    txt(shortName(owner.user, 9), cx, oy2 + 78, 22, '#fff1a8', 'center', 5);
    txt('💥×' + owner.b, cx, oy2 + 106, 22, '#fff5df', 'center', 5);
    if (age < 1.1) for (let k = 0; k < 8; k++) { const q = k / 8 * TAU + age * 2, d = 90 * easeOut(age / 1.1); star(cx + Math.cos(q) * d, oy2 + Math.sin(q) * d, 16, 1 - age / 1.1, '#fff1a8'); }
  } else {
    g.save(); g.globalAlpha = .35; g.setLineDash([8, 8]); g.lineWidth = 4; g.strokeStyle = '#fff1a8'; g.beginPath(); g.arc(cx, y0 + 46, 56, 0, TAU); g.stroke(); g.setLineDash([]);
    txt('👑', cx, y0 - 30, 48, '#fff', 'center', 0); txt('?', cx, y0 + 48, 56, '#fff1a8', 'center', 0); g.restore();
  }
  // топ-3 дарителей эфира
  const colors = [TIERS[2].c[1], TIERS[1].c[1], TIERS[0].c[1]];
  topDonors.forEach((d, i) => {
    const y = y0 + 210 + i * 92, a = avatars.get(d.uid);
    g.fillStyle = colors[i]; g.beginPath(); g.arc(cx, y, 36, 0, TAU); g.fill();
    if (a) g.drawImage(thumb(a), cx - 31, y - 31, 62, 62);
    txt(String(d.sum), cx, y + 42, 21, '#fff5df', 'center', 5);
  });
}
function drawChest() {
  const cx = L.cx, t = L.chestTop, b = L.chestBot, kick = chestKick * 12, W2 = 310;
  // прогресс
  const goal = GOALS[Math.min(level, GOALS.length - 1)], py = L.goalY, pw = 620;
  rr(cx - pw / 2, py - 19, pw, 38, 19); g.fillStyle = 'rgba(14,8,10,.85)'; g.fill();
  const p = clamp(value / goal);
  if (p > .02) { rr(cx - pw / 2 + 4, py - 15, (pw - 8) * p, 30, 15); const m = g.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); m.addColorStop(0, '#ffb12b'); m.addColorStop(1, '#fff19a'); g.fillStyle = m; g.fill(); }
  txt(Math.min(value, goal) + ' / ' + goal, cx, py + 1, 25, '#fff', 'center', 5);
  txt('★' + (level + 1), cx - pw / 2 - 42, py + 1, 32, '#fff1a8');
  if (L.art) {
    const a = L.art, base = a.y + a.h, k = 1 + kick * .004;
    g.save(); g.translate(cx, base); g.scale(k, 2 - k); g.translate(-cx, -base);
    g.save(); g.globalAlpha = .55; g.fillStyle = '#000'; g.filter = 'blur(10px)';   // тень на полу, чтобы сундук не висел
    g.beginPath(); g.ellipse(cx + 8, base - 8, a.w * .52, 34, 0, 0, TAU); g.fill(); g.restore();
    g.drawImage(art.chest_back, a.x, a.y, a.w, a.h);
    g.drawImage(mound, cx - MW / 2, L.mBase - MH);
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
function drawIdle() {
  if (job || queue.length) return;
  const y = L.heroY, b = Math.sin(time * 3), t = TIERS[0];
  g.globalAlpha = .9;
  halo(L.cx + 110, y, 260, TIERS[0].c[1], .25 + .1 * Math.sin(time * 2));
  coinAt(blankCoin(0), L.cx + 110, y, 130, Math.cos(time * 1.4));
  txt('?', L.cx + 110, y + 4, 110, '#fff5df');
  g.globalAlpha = 1;
  txt(t.emoji, L.cx - 170, y + b * 16, 142, '#fff', 'center', 0);
  txt('›', L.cx - 46, y - 8, 96, '#fff1a8', 'center', 0);
}
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingQuality = 'high';
  if (art.bg) {
    const s = Math.max(SCW / art.bg.width, SCH / art.bg.height);
    g.drawImage(art.bg, SCW / 2 - art.bg.width * s / 2, SCH / 2 - art.bg.height * s / 2, art.bg.width * s, art.bg.height * s);
    g.fillStyle = 'rgba(12,6,10,.30)'; g.fillRect(0, 0, SCW, SCH);   // затемнение, чтобы монеты и ники читались
  } else { if (!bg) buildBg(); g.drawImage(bg, 0, 0, SCW, SCH); }
  drawFire();
  g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  g.save();
  if (shake && !reduced) g.translate(rand(-shake, shake), rand(-shake, shake));
  drawLegend(); drawWall(); drawPress(); drawLevelRays();
  if (build) { const k = build.t / build.d; g.save(); g.translate(rand(-1, 1) * k * 10, rand(-1, 1) * k * 5); drawChest(); g.restore(); rays(L.cx, L.pileY, 20, 300 * k, 14, ['#fff1a8', '#ffb12b'], time * 1.6, .4 * k); halo(L.cx, L.pileY, 260 + k * 260, '#ffd36b', .25 + .5 * k); }
  else drawChest();
  drawTwinkles(); drawQueue(); drawTop();
  if (cine > .01) { g.fillStyle = `rgba(6,3,9,${cine})`; g.fillRect(-ox / scale - 60, -oy / scale - 60, SCW / scale + 120, SCH / scale + 120); }
  for (const f of flyers) { if (f.t < 0) continue; const u = clamp(f.t / f.d); g.save(); g.translate(lerp(f.x, f.tx, u), lerp(f.y, f.ty, u * u) - Math.sin(u * Math.PI) * 120); g.rotate(f.a + u * 8); g.drawImage(f.sprite, -f.r, -f.r, f.r * 2, f.r * 2); g.restore(); }
  drawIdle(); drawJob();
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
let last = performance.now(), fpsN = 0, fpsT = 0, fps = 60;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  fpsN++; fpsT += dt; if (fpsT >= 1) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  update(dt); draw(); requestAnimationFrame(loop);
}

// Лайки: мелкие искры над сундуком, без монет и без очков
let likeGate = 0;
function onLike(m) { if (m) onLikeUser(m); const n = performance.now(); if (n < likeGate) return; likeGate = n + 220; burst(rand(L.cx - 260, L.cx + 260), L.pileY - 10, TIERS[3], 5, 240); }

// Настоящие значки подарков из каталога TikTok, иначе остаются эмодзи
function onCatalog(list) {
  giftIcons = TIERS.map((t, i) => {
    const next = TIERS[i + 1] ? TIERS[i + 1].min : Infinity, inTier = list.filter(x => x.coins >= t.min && x.coins < next);
    const pick = inTier.find(x => x.name === t.name) || inTier.sort((a, b) => a.coins - b.coins)[0];
    if (!pick) return null;
    const im = new Image(); im.src = pick.img; return im;
  });
}
Live.connect({ onGift: addGift, onLike, onFollow, onStatus: v => { connected = v; }, onCatalog });
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
  const coins = [1, 5, 30, 100, 1000][t], name = NAMES[i] + (Math.random() < .5 ? '' : ' ' + Math.floor(rand(1, 99)));
  if (i % 2 === 0 && !portraits[i]) portraits[i] = makePortrait(i);
  addGift({ user: name, uid: name, pic: portraits[i] || '', coins, count: t === 0 && Math.random() < .3 ? 10 : 1 });
}
function botTick() { if (bots) { botGift(); } botTimer = setTimeout(botTick, rand(500, 2400)); }
if (Live.testMode) {
  const pn = document.getElementById('panel'); pn.hidden = false;
  const btn = (label, fn, id) => { const b = document.createElement('button'); b.textContent = label; if (id) b.id = id; b.onclick = () => fn(b); pn.append(b); return b; };
  const hide = btn('⚙', () => pn.classList.toggle('min'), 'hide');
  TIERS.forEach((t, i) => btn(t.emoji, () => botGift(i)));
  btn('+20', () => { for (let i = 0; i < 20; i++) botGift(); });
  btn('🤖', b => { bots = !bots; b.setAttribute('aria-pressed', bots); }).setAttribute('aria-pressed', 'false');
  btn('♥', () => onLike());
  btn('👍', () => { const n = NAMES[Math.floor(rand(0, NAMES.length))]; onLike({ user: n, uid: n, count: LIKES.step }); });
  btn('➕', () => { const n = NAMES[Math.floor(rand(0, NAMES.length))] + ' ' + Math.floor(rand(100, 999)); onFollow({ user: n, uid: n }); });
  btn('×5', () => { const n = NAMES[Math.floor(rand(0, NAMES.length))]; for (let i = 0; i < 6; i++) addGift({ user: n, uid: n, coins: 1, count: 1 }); });
  btn('🔊', b => { mute = !mute; b.textContent = mute ? '🔇' : '🔊'; });
  botTick();
  bots = true; pn.querySelector('button:nth-of-type(8)').setAttribute('aria-pressed', 'true');
}

window.__mint = { coinTest: (src, ti) => makeCoin({ src }, ti), letter: letterAvatar, portrait: k => makePortrait(k), onLike, onFollow, owner: () => owner, sfx: (k, t) => { unlock(); sfx(k, t); }, addGift, botGift, stat: () => ({ fps, queue: queue.length, total, level, value, wall: wall.length, job: job && job.ph, W: SCW, H: SCH, scale, order: queue.slice(0, 3).map(j => j.tier) }), setBots: v => { bots = v; } };
resize();
requestAnimationFrame(loop);
})();
