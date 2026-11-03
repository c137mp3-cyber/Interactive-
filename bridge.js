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

// Аватарки отдаём браузеру как data-URL, с кэшем. У TikTok для одного человека несколько ссылок (jpeg, webp, heic, разные размеры):
// пробуем по очереди, heic браузер не открывает, поэтому такие пропускаем
const PICS = new Map(), PICBAD = new Map();
const HDR = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36', Referer: 'https://www.tiktok.com/', Accept: 'image/jpeg,image/webp,image/png,image/*;q=.8' };
const imgRank = u => /\.jpe?g(\?|$|~)/i.test(u) || /jpeg/i.test(u) ? 0 : /\.png/i.test(u) ? 1 : /\.webp/i.test(u) || /webp/i.test(u) ? 2 : /heic|heif|avif/i.test(u) ? 9 : 3;
function picUrls(d) {   // все возможные ссылки на аватар зрителя; картинки подарков и значки не берём
  const out = [], seen = new Set(), BAD = /gift|extended|emote|badge|sticker|fans|medal|label|background/i, KEY = /avatar|profilepic|picture|portrait|headimg|photo/i;
  const add = u => { if (typeof u === 'string' && /^https?:\/\//.test(u) && !seen.has(u)) { seen.add(u); out.push(u); } };
  const walk = (o, depth, on) => {
    if (!o || depth > 5) return;
    if (typeof o === 'string') { if (on) add(o); return; }
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1, on)); return; }
    if (typeof o === 'object') for (const k of Object.keys(o)) { if (BAD.test(k)) continue; walk(o[k], depth + 1, on || KEY.test(k) || k === 'url' && on || k === 'urlList' && on); }
  };
  walk(d.user, 0, false); walk(d, 0, false);
  return out.filter(u => !/\.(svg|gif)(\?|$)/i.test(u)).sort((x, y) => imgRank(x) - imgRank(y));
}
async function getPic(urls) {
  if (!urls || !urls.length) return '';
  const key = urls[0];
  if (PICS.has(key)) return PICS.get(key);
  if (PICBAD.has(key) && Date.now() - PICBAD.get(key) < 60000) return '';   // недавно не вышло, не долбим снова
  let out = '', why = '';
  for (const url of urls.slice(0, 5)) {
    if (imgRank(url) === 9) { why = 'heic'; continue; }
    try {
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 5000);
      const x = await fetch(url, { signal: ac.signal, headers: HDR });
      clearTimeout(to);
      const ct = x.headers.get('content-type') || '';
      if (!x.ok) { why = 'HTTP ' + x.status; continue; }
      if (!/^image\/(jpeg|png|webp|gif)/i.test(ct)) { why = 'тип ' + ct; continue; }
      const b = Buffer.from(await x.arrayBuffer());
      if (b.length > 900000) { why = 'файл ' + Math.round(b.length / 1000) + ' КБ'; continue; }
      out = 'data:' + ct.split(';')[0] + ';base64,' + b.toString('base64'); break;
    } catch (e) { why = e.name === 'AbortError' ? 'таймаут' : String(e.message || e); }
  }
  if (out) PICS.set(key, out); else { PICBAD.set(key, Date.now()); console.log('аватар не загрузился:', why, '|', key.slice(0, 80)); }
  if (PICS.size > 1500) PICS.delete(PICS.keys().next().value);
  return out;
}
const picOf = d => picUrls(d);
const userOf = d => d.nickname || (d.user && (d.user.nickname || d.user.uniqueId)) || d.uniqueId || 'Viewer';
const uidOf = d => d.uniqueId || (d.user && d.user.uniqueId) || userOf(d);
const send = async o => { if (Array.isArray(o.pic)) o.pic = await getPic(o.pic); broadcast(o); };
// Текст сообщения: поле называется по-разному в разных версиях библиотеки
const textOf = d => {
  for (const k of ['comment', 'content', 'text', 'message', 'msg']) if (typeof d[k] === 'string' && d[k].trim()) return d[k];
  let best = '';
  const walk = (o, depth, on) => { if (!o || depth > 3) return; if (typeof o === 'string') { if (on && o.length > best.length && !/^https?:/.test(o)) best = o; return; } if (typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], depth + 1, on || /comment|content|text|message/i.test(k)); };
  walk(d, 0, false);
  return best;
};

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
  let likeLog = 0;
  C.on('like', d => { if (Date.now() - likeLog > 5000) { likeLog = Date.now(); console.log('лайки', userOf(d), '+' + (+d.likeCount || 1)); } send({ type: 'like', count: +d.likeCount || 1, user: userOf(d), uid: uidOf(d), pic: picOf(d) }); });
  let chatDump = 0;
  C.on('chat', d => {
    const text = textOf(d);
    console.log('чат', userOf(d) + ':', text.slice(0, 60) || '(текст пустой)');
    if (!text && chatDump++ < 3) console.log('  сырое событие:', Object.keys(d).join(','), JSON.stringify(d, (k, v) => typeof v === 'bigint' ? String(v) : v).slice(0, 700));
    send({ type: 'chat', text, user: userOf(d), uid: uidOf(d), pic: picOf(d) });
  });
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
