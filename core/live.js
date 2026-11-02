// Подключение страницы к мосту. Новые игры используют этот же файл.
window.Live = (function () {
  const host = location.hostname;
  const params = new URLSearchParams(location.search);
  const local = host === 'localhost' || host === '127.0.0.1';
  const testMode = !local || params.has('test') || !!window.LIVE_FORCE_TEST;

  function connect(h) {
    if (!local) return;
    let ws;
    const open = () => {
      h.onStatus && h.onStatus(false);
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch (e) { return setTimeout(open, 3000); }
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.type === 'gift') h.onGift && h.onGift(m);
        else if (m.type === 'like') h.onLike && h.onLike(m);
        else if (m.type === 'status') h.onStatus && h.onStatus(m.live);
        else if (m.type === 'catalog') h.onCatalog && h.onCatalog(m.gifts);
      };
      ws.onclose = () => { h.onStatus && h.onStatus(false); setTimeout(open, 3000); };
    };
    open();
  }

  // Заставка экрана и полноэкранный режим планшета
  function keepAwake() {
    const ask = () => { try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {} };
    ask();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ask(); });
  }
  return { connect, testMode, local, keepAwake };
})();
