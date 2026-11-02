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
const GOALS = [100, 300, 700, 1500, 3000, 6000, 10000];

// Необязательная графика: файл появился в assets -> заглушка заменяется сама
const ASSETS = window.MINT_NO_ASSETS ? [] : ['bg', 'press_frame', 'press_head', 'anvil', 'chest_back', 'chest_front', 'legend', 'wall',
  ...TIERS.map(t => 'coin_' + t.id)];
const BUILD = 4;   // увеличивайте при каждом обновлении: сбрасывает кэш картинок и скрипта
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
function makeCoin(a, ti) {
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
  x.drawImage(a.src, R - hr, R - hr, hr * 2, hr * 2);
  x.globalCompositeOperation = 'multiply'; x.globalAlpha = .38; x.fillStyle = t.c[0]; x.fillRect(0, 0, S, S); // лёгкий оттенок металла
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  const gl = x.createLinearGradient(0, 40, S, S); gl.addColorStop(0, 'rgba(255,255,255,.30)'); gl.addColorStop(.42, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.22)');
  x.fillStyle = gl; x.fillRect(0, 0, S, S);
  x.restore();
  if (frame) x.drawImage(frame, 0, 0, S, S);
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
const wall = [], parts = [], flyers = [], tiny = [];
const donors = new Map(); let topDonors = [];
let hitstop = 0, anvilKick = 0, embers = [], emberAcc = 0, shake = 0, flash = 0, flashColor = '#fff', pressY = 0, chestKick = 0, level = 0, value = 0, total = 0, connected = !Live.local, time = 0, sprites = [];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function addGift(m) {
  const coins = Math.max(1, +m.coins || 1), count = Math.max(1, +m.count || 1);
  const j = { user: String(m.user || 'Viewer'), uid: String(m.uid || m.user || 'v'), pic: m.pic || '', coins, count, tier: tierOf(coins), at: performance.now() };
  avatarOf(j);
  queue.push(j); dirty = true;
  const d = donors.get(j.uid) || { user: j.user, uid: j.uid, pic: j.pic, sum: 0 };
  d.sum += coins * count; d.user = j.user; if (j.pic) d.pic = j.pic;
  donors.set(j.uid, d);
  topDonors = [...donors.values()].sort((a, b) => b.sum - a.sum).slice(0, 3);
}
// Дорогие подарки идут раньше, но ожидание тоже поднимает зрителя: 20 секунд = одна ступень
function score(j, now) { return j.tier + (now - j.at) / 20000; }
function sortQueue() { const now = performance.now(); queue.sort((a, b) => score(b, now) - score(a, now)); dirty = false; }

function startNext() {
  if (!queue.length) return;
  sortQueue();
  const j = queue.shift();
  j.avatar = avatarOf(j); j.sprite = makeCoin(j.avatar, j.tier); j.v = j.avatar.v;
  j.ph = 0; j.t = 0; j.dur = [.42, .15, .1, .22, .3, .55 + j.tier * .4, .4];
  const q = queue.length;
  j.speed = q <= 2 ? 1 : lerp(1.25, 4, clamp((q - 2) / 40));
  if (j.tier >= 3 && q < 30) j.speed = Math.min(j.speed, 1.3);
  job = j;
}
function nextPhase() {
  const j = job; j.ph++; j.t = 0;
  if (j.ph === 2) strike(j);
  if (j.ph === 5) { sfx('ta', j.tier); if (j.tier >= 2) burst(L.cx, L.heroY, TIERS[j.tier], TIERS[j.tier].burst, 700); if (j.tier >= 3) { flash = j.tier === 4 ? .5 : .25; flashColor = TIERS[j.tier].c[1]; } }
  if (j.ph === 6) { j.slot = moundSlot(); for (let i = 1; i < Math.min(j.count, 16); i++) flyers.push({ sprite: blankCoin(j.tier), x: L.cx, y: L.heroY, t: -i * .05, d: rand(.45, .7), tx: L.cx + rand(-L.slotHW, L.slotHW), ty: L.slotY - rand(0, 60), a: rand(0, TAU), r: 26 }); }
  if (j.ph >= j.dur.length) land(j);
}
function strike(j) {
  hitstop = .045 + j.tier * .012; anvilKick = 1;
  shake = Math.max(shake, 12 + j.tier * 5); sfx('clank', j.tier);
  burst(L.cx, L.anvil - 30, TIERS[j.tier], 14 + j.tier * 6, 560);
  if (j.avatar.v !== j.v) j.sprite = makeCoin(j.avatar, j.tier);
}
function land(j) {
  bake(j.sprite, j.slot); sfx('clink', j.tier); chestKick = 1; total++;
  burst(j.slot.x, j.slot.y, TIERS[j.tier], 6, 260);
  sprites.push(j.sprite); if (sprites.length > 30) sprites.shift();
  addWall(j);
  value += j.coins * j.count;
  if (value >= GOALS[Math.min(level, GOALS.length - 1)]) levelUp();
  job = null;
}
function addWall(j) {
  const v = j.coins, old = wall.find(w => w.uid === j.uid);
  if (old) { if (v < old.value) return; wall.splice(wall.indexOf(old), 1); }
  wall.push({ uid: j.uid, user: j.user, value: v, tier: j.tier, sprite: j.sprite, swing: 1, at: performance.now() });
  wall.sort((a, b) => b.value - a.value || b.at - a.at);
  wall.length = Math.min(wall.length, 7);
}
function levelUp() {
  value -= GOALS[Math.min(level, GOALS.length - 1)]; level++;
  sfx('win', 4); flash = .6; flashColor = '#fff1a8'; shake = 36; chestKick = 2;
  for (let i = 0; i < 44 && sprites.length; i++) {
    const a = rand(-Math.PI * .9, -Math.PI * .1), sp = rand(500, 1300);
    tiny.push({ sprite: sprites[i % sprites.length], x: L.cx + rand(-180, 180), y: L.pileY + 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(30, 58), a: rand(0, TAU), va: rand(-7, 7), life: 2.4 });
  }
  burst(L.cx, L.pileY, TIERS[4], 90, 1200);
  initMound();
}
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
function moundSlot() {
  let best = Math.floor(rand(1, 23));
  for (let i = 0; i < 3; i++) { const c = Math.floor(rand(1, 23)); if (heights[c] < heights[best]) best = c; }
  const h = Math.min(heights[best], L.capH);
  return { c: best, x: L.cx + ((best + .5) / 24 - .5) * 2 * L.slotHW + rand(-6, 6), y: L.slotY - h, h };
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
function sfx(k, ti) {
  if (!ac || mute || ac.state !== 'running') return;
  if (k === 'clank') { tone(150, .16, 'square', .22, 0, 55); tone(1900 + ti * 300, .1, 'triangle', .12); }
  if (k === 'clink') tone(2400 + ti * 450, .22, 'sine', .1);
  if (k === 'ta') [0, 4, 7, 12].slice(0, 2 + ti).forEach((s, i) => tone(523 * 2 ** (s / 12), .28, 'triangle', .1, i * .07));
  if (k === 'win') [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(523 * 2 ** (s / 12), .4, 'triangle', .12, i * .09));
}

// Обновление
function update(dt) {
  time += dt;
  if (hitstop > 0) { hitstop -= dt; return; }   // короткая заморозка в момент удара
  anvilKick = Math.max(0, anvilKick - dt * 7);
  updateEmbers(dt);
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
  for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i]; f.t += dt; if (f.t > f.d) { flyers.splice(i, 1); sfx('clink', 0); chestKick = Math.max(chestKick, .5); } }
  for (let i = tiny.length - 1; i >= 0; i--) { const p = tiny[i]; p.life -= dt; if (p.life <= 0 || p.y > H + 700) { tiny.splice(i, 1); continue; } p.vy += 1400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; }
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
    coinAt(blankCoin(i), cx + 44, y + wob, 31);
  });
}
function drawWall() {
  const y = L.rope, n = 7, w = Math.min(W - 60, 980), x0 = L.cx - w / 2, gap = w / n;
  if (art.wall) stretch3(art.wall, x0 - 20, y - 24, w + 40, 48, 70);
  else { g.lineWidth = 10; g.strokeStyle = '#a57a3d'; g.beginPath(); g.moveTo(x0 - 10, y); g.lineTo(x0 + w + 10, y); g.stroke(); }
  for (let i = 0; i < n; i++) {
    const cx = x0 + gap * (i + .5), it = wall[i], len = 56;
    if (!it) { g.fillStyle = 'rgba(255,240,200,.14)'; g.beginPath(); g.arc(cx, y + len + 52, 50, 0, TAU); g.fill(); continue; }
    const age = (performance.now() - it.at) / 1000, drop = -(1 - easeOut(clamp(age / .5))) * 230;
    const sw = Math.sin(time * 6 + i) * it.swing * .42, hx = cx + Math.sin(sw) * len, hy = y + Math.cos(sw) * len + drop;
    g.lineWidth = 4; g.strokeStyle = '#d6b36a'; g.beginPath(); g.moveTo(cx, y); g.lineTo(hx, hy); g.stroke();
    g.drawImage(it.sprite, hx - 56, hy - 10, 112, 112);
    txt(shortName(it.user, 8), hx, hy + 122, 21, TIERS[it.tier].c[0], 'center', 5);
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
  const hw = 125, hh = hw * ph.height / ph.width, hb = lerp(beamBottom + 40, a - 106, pressY), rx = cx - 16;
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
  const a = L.anvil, cx = L.cx, u = clamp(j.t / j.dur[j.ph]);
  if (j.ph <= 1) { coinAt(blankCoin(j.tier), j.ph === 0 ? lerp(-60, cx, easeOut(u)) : cx, a - 26, 76); }
  else if (j.ph <= 3) {
    if (j.ph === 2) coinAt(j.sprite, cx, a - 26, 82, 1, .72 + .28 * u * u);
    else if (j.ph === 3) coinAt(j.sprite, cx, a - 26, 82, 1, 1 + .1 * Math.sin(u * Math.PI));
    else coinAt(j.sprite, cx, a - 26, 82);
  }
  else if (j.ph === 4) { const e = easeOut(u); coinAt(j.sprite, cx, lerp(a - 26, L.heroY, e), lerp(82, 190 + j.tier * 12, e), Math.cos(u * TAU * 2)); }
  else if (j.ph === 5) {
    const r = 190 + j.tier * 12;
    if (j.tier >= 1) { g.save(); g.translate(cx, L.heroY); g.rotate(time * .55); g.globalAlpha = .18 + j.tier * .06; g.fillStyle = TIERS[j.tier].c[0]; for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(-54, r + 170); g.lineTo(54, r + 170); g.fill(); } g.restore(); }
    coinAt(j.sprite, cx, L.heroY + Math.sin(time * 4) * 7, r);
    const pw = 500, py = L.heroY + r + 36;
    rr(cx - pw / 2, py - 34, pw, 68, 34); g.fillStyle = 'rgba(21,12,14,.88)'; g.fill(); g.lineWidth = 4; g.strokeStyle = TIERS[j.tier].c[1]; g.stroke();
    txt(shortName(j.user, 15), cx, py + 2, 38, '#fff5df', 'center', 0);
    if (j.count > 1) txt('×' + j.count, cx + r * .72, L.heroY - r * .72, 76, TIERS[j.tier].c[0]);
  } else if (j.ph === 6) {
    const e = easeIn(u), tx = j.slot.x, ty = j.slot.y, r0 = 190 + j.tier * 12;
    coinAt(j.sprite, lerp(cx, tx, e), lerp(L.heroY, ty, e) - Math.sin(u * Math.PI) * 70, lerp(r0, 44, e), Math.cos(u * TAU * 1.5));
  }
}
function drawQueue() {
  const x0 = 28, y0 = L.queueTop, st = 90, shown = Math.min(queue.length, 6);
  for (let i = 0; i < shown; i++) {
    const j = queue[i], col = i % 2, row = i >> 1, x = x0 + 44 + col * st, y = y0 + 44 + row * st;
    g.save(); g.fillStyle = TIERS[j.tier].c[1]; g.beginPath(); g.arc(x, y, 43, 0, TAU); g.fill();
    g.drawImage(thumb(avatarOf(j)), x - 37, y - 37, 74, 74); g.restore();
  }
  if (queue.length) txt('+' + queue.length, x0 + 88, y0 - 16, 42, '#fff1a8');
}
function drawTop() {
  const x = W - 28, y0 = L.queueTop, colors = [TIERS[2].c[1], TIERS[1].c[1], TIERS[0].c[1]];
  topDonors.forEach((d, i) => {
    const y = y0 + 34 + i * 112, a = avatars.get(d.uid);
    g.fillStyle = colors[i]; g.beginPath(); g.arc(x - 46, y, 46, 0, TAU); g.fill();
    if (a) g.drawImage(thumb(a), x - 86, y - 40, 80, 80);
    if (i === 0) txt('👑', x - 46, y - 56, 40, '#fff', 'center', 0);
    txt(String(d.sum), x - 46, y + 50, 26, '#fff5df');
  });
}
function drawChest() {
  const cx = L.cx, t = L.chestTop, b = L.chestBot, kick = chestKick * 12, W2 = 310;
  // прогресс
  const goal = GOALS[Math.min(level, GOALS.length - 1)], py = L.goalY, pw = 620;
  rr(cx - pw / 2, py - 19, pw, 38, 19); g.fillStyle = 'rgba(14,8,10,.85)'; g.fill();
  const p = clamp(value / goal);
  if (p > .02) { rr(cx - pw / 2 + 4, py - 15, (pw - 8) * p, 30, 15); const m = g.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); m.addColorStop(0, '#ffb12b'); m.addColorStop(1, '#fff19a'); g.fillStyle = m; g.fill(); }
  txt(value + ' / ' + goal, cx, py + 1, 25, '#fff', 'center', 5);
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
  drawLegend(); drawWall(); drawPress(); drawChest(); drawQueue(); drawTop();
  for (const f of flyers) { if (f.t < 0) continue; const u = clamp(f.t / f.d); g.save(); g.translate(lerp(f.x, f.tx, u), lerp(f.y, f.ty, u * u) - Math.sin(u * Math.PI) * 120); g.rotate(f.a + u * 8); g.drawImage(f.sprite, -f.r, -f.r, f.r * 2, f.r * 2); g.restore(); }
  drawIdle(); drawJob();
  for (const p of tiny) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.drawImage(p.sprite, -p.r, -p.r, p.r * 2, p.r * 2); g.restore(); }
  for (const p of parts) { g.globalAlpha = clamp(p.life / .4); g.fillStyle = p.c; g.fillRect(p.x, p.y, p.size, p.size); }
  g.globalAlpha = 1;
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
function onLike() { const n = performance.now(); if (n < likeGate) return; likeGate = n + 220; burst(rand(L.cx - 260, L.cx + 260), L.pileY - 10, TIERS[3], 5, 240); }

// Настоящие значки подарков из каталога TikTok, иначе остаются эмодзи
function onCatalog(list) {
  giftIcons = TIERS.map((t, i) => {
    const next = TIERS[i + 1] ? TIERS[i + 1].min : Infinity, inTier = list.filter(x => x.coins >= t.min && x.coins < next);
    const pick = inTier.find(x => x.name === t.name) || inTier.sort((a, b) => a.coins - b.coins)[0];
    if (!pick) return null;
    const im = new Image(); im.src = pick.img; return im;
  });
}
Live.connect({ onGift: addGift, onLike, onStatus: v => { connected = v; }, onCatalog });
Live.keepAwake();

// Полноэкранный режим: кнопка сама исчезает, чтобы не попасть в эфир
const fsB = document.getElementById('fs');
if (!document.documentElement.requestFullscreen) fsB.hidden = true;
fsB.onclick = () => { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); fsB.classList.add('off'); };
setTimeout(() => fsB.classList.add('off'), 8000);

// Боты только для проверки. На планшете включаются адресом ?test=1, в эфире их нет
const NAMES = ['Алина', 'Maks_07', 'Dulce Thiime', 'ProPlay44', 'Катя ✨', '小猪猪', 'Ivan Alexandro', 'lazy_ga', 'Беня', 'ERI', 'wolf.of.north', 'Hani', 'Лука', 'saaa', 'Marta🌹', 'kingeris', 'Óscar', 'yulianas4'];
let bots = false, botTimer = 0;
function botGift(ti) {
  const i = Math.floor(rand(0, NAMES.length)), t = ti ?? (Math.random() < .68 ? 0 : Math.random() < .62 ? 1 : Math.random() < .6 ? 2 : Math.random() < .7 ? 3 : 4);
  const coins = [1, 5, 30, 100, 1000][t], name = NAMES[i] + (Math.random() < .5 ? '' : ' ' + Math.floor(rand(1, 99)));
  addGift({ user: name, uid: name, coins, count: t === 0 && Math.random() < .3 ? 10 : 1 });
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
  btn('🔊', b => { mute = !mute; b.textContent = mute ? '🔇' : '🔊'; });
  botTick();
  bots = true; pn.querySelector('button:nth-of-type(8)').setAttribute('aria-pressed', 'true');
}

window.__mint = { addGift, botGift, stat: () => ({ fps, queue: queue.length, total, level, value, wall: wall.length, job: job && job.ph, W: SCW, H: SCH, scale, order: queue.slice(0, 3).map(j => j.tier) }), setBots: v => { bots = v; } };
resize();
requestAnimationFrame(loop);
})();
