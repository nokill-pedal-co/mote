// Mote service worker: keeps the game on the device so it opens with no signal at all.
// build.py stamps VERSION, so every build gets a fresh cache and the old one is cleared out.
const VERSION = '20261125-123526';
const CACHE = 'mote-' + VERSION;
const VOICE = 'mote-voice';        // the narrator's recordings outlive a new build
const CORE = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mote-') && k !== CACHE && k !== VOICE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Only good answers are kept: an error page or a hotel wifi sign-in must never replace the game.
function keep(key, res) {
  if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(typeof key !== 'string' && key.url.indexOf('/voice/') >= 0 ? VOICE : CACHE).then(c => c.put(key, copy)).catch(() => {}); }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Open at once from the device, and fetch the newest copy behind it for next time.
    // With nothing cached yet, wait for the network, but not for ever.
    e.respondWith(caches.match('index.html').then(hit => {
      const fresh = fetch(req, { cache: 'no-cache' }).then(res => keep('index.html', res));
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => keep(req, res))));
});
