// Мост: TikTok LIVE -> браузер. Запуск: node bridge.js НИК (без ника — только сервер для теста)
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const NICK = (process.argv[2] || '').replace(/^@/, '');
const PORT = +process.env.PORT || 8080;
const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

const srv = http.createServer((q, r) => {
  let u;
  try { u = decodeURIComponent(q.url.split('?')[0]); } catch (e) { r.writeHead(400); return r.end(); }
  if (u === '/') { r.writeHead(302, { Location: '/games/mint/' + (q.url.split('?')[1] ? '?' + q.url.split('?')[1] : '') }); return r.end(); }
  if (u.endsWith('/')) u += 'index.html';
  const file = path.normalize(path.join(ROOT, u));
  const allowed = file.startsWith(path.join(ROOT, 'core') + path.sep) || file.startsWith(path.join(ROOT, 'games') + path.sep);
  if (!allowed) { r.writeHead(404); return r.end(); }
  fs.readFile(file, (e, b) => {
    if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    r.end(b);
  });
});

const wss = new WebSocketServer({ server: srv });
let liveState = { type: 'status', live: false, nick: NICK };
let catalog = null;
wss.on('connection', c => {
  c.send(JSON.stringify(liveState));
  if (catalog) c.send(JSON.stringify(catalog));
});
const broadcast = o => { const m = JSON.stringify(o); wss.clients.forEach(c => c.readyState === 1 && c.send(m)); };
const setLive = v => { liveState = { ...liveState, live: v }; broadcast(liveState); };

// Аватарки отдаём браузеру как data-URL, с кэшем
const PICS = new Map();
async function getPic(url) {
  if (!url) return '';
  if (PICS.has(url)) return PICS.get(url);
  let out = '';
  try {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 4000);
    const x = await fetch(url, { signal: ac.signal });
    clearTimeout(to);
    if (x.ok) {
      const b = Buffer.from(await x.arrayBuffer());
      if (b.length < 300000) out = 'data:' + (x.headers.get('content-type') || 'image/jpeg') + ';base64,' + b.toString('base64');
    }
  } catch (e) {}
  PICS.set(url, out);
  if (PICS.size > 2000) PICS.delete(PICS.keys().next().value);
  return out;
}
const picOf = d => { const u = d.user || {}, pp = u.profilePicture || d.profilePicture || {}; return d.profilePictureUrl || u.profilePictureUrl || (pp.url && pp.url[0]) || (pp.urls && pp.urls[0]) || ''; };
const userOf = d => d.nickname || (d.user && (d.user.nickname || d.user.uniqueId)) || d.uniqueId || 'Viewer';
const uidOf = d => d.uniqueId || (d.user && d.user.uniqueId) || userOf(d);
const send = async o => { if (o.pic) o.pic = await getPic(o.pic); broadcast(o); };

const seen = new Set();
const isRepeat = id => { if (!id) return false; if (seen.has(id)) return true; seen.add(id); if (seen.size > 5000) seen.delete(seen.values().next().value); return false; };

function loadCatalog(list) {
  if (list && !Array.isArray(list)) list = list.gifts || Object.values(list);
  if (!Array.isArray(list)) return;
  const gifts = list.map(x => {
    const im = x.image || x.icon || {};
    return { id: +(x.id ?? x.giftId ?? 0), name: x.name ?? x.giftName ?? '', coins: +(x.diamond_count ?? x.diamondCount ?? 0), img: (im.url_list && im.url_list[0]) || (im.urlList && im.urlList[0]) || (im.url && im.url[0]) || '' };
  }).filter(g => g.name && g.coins > 0 && g.img);
  if (gifts.length) { catalog = { type: 'catalog', gifts }; broadcast(catalog); console.log('подарков в каталоге:', gifts.length); }
}

let retry = null;
function again(ms) { clearTimeout(retry); retry = setTimeout(go, ms); }
function go() {
  const L = require('tiktok-live-connector');
  const C = new (L.WebcastPushConnection || L.TikTokLiveConnection)(NICK, {});
  C.on('gift', d => {
    const g = d.giftDetails || {}, t = d.giftType ?? g.giftType;
    if (t === 1 && !d.repeatEnd) return; // серийный подарок считаем один раз, в конце серии
    if (isRepeat(d.msgId || (d.common && d.common.msgId))) return;
    const coins = +(d.diamondCount ?? g.diamondCount ?? 1) || 1, count = +d.repeatCount || 1, name = g.giftName || d.giftName || '';
    console.log('подарок', userOf(d), name, coins, 'x', count);
    send({ type: 'gift', coins, count, name, user: userOf(d), uid: uidOf(d), pic: picOf(d) });
  });
  C.on('like', d => send({ type: 'like', count: +d.likeCount || 1, user: userOf(d), uid: uidOf(d), pic: picOf(d) }));
  C.on('follow', d => { console.log('подписка', userOf(d)); send({ type: 'follow', user: userOf(d), uid: uidOf(d), pic: picOf(d) }); });
  C.on('disconnected', () => { setLive(false); console.log('эфир отключён, переподключаюсь'); again(5000); });
  C.connect().then(async st => {
    console.log('эфир подключён');
    setLive(true);
    try {
      let list = st && st.availableGifts;
      if (!list) { const f = C.getAvailableGifts || C.fetchAvailableGifts; if (f) list = await f.call(C); }
      loadCatalog(list);
    } catch (e) {}
  }).catch(e => { setLive(false); console.log('нет подключения:', e.message || e); again(10000); });
}

srv.listen(PORT, '127.0.0.1', () => {
  console.log('игра: http://localhost:' + PORT + '   тест с ботами: http://localhost:' + PORT + '/?test=1');
  if (NICK) go(); else console.log('ник не указан: эфир не подключён. Запуск: ./start.sh ник');
});
