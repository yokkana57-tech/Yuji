// オフラインでも開けるように、画面のファイルを端末に保存しておく。
// アプリを更新したら VERSION を上げる（古い保存を消して新しいものに入れ替える）。
const VERSION = 'hatake-v11';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'geo.js', 'legal.js', 'help.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const TILES = 'hatake-tiles';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 地図タイル：一度見た場所はオフラインでも表示
  if (url.hostname === 'cyberjapandata.gsi.go.jp') {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return; // Supabase・Stripe などは保存しない
  // 自分のファイル：まずネットから最新を取り、つながらないときは保存したものを使う
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
