const CACHE_NAME = "iching-tao-shell-v0.1.1";
const DATA_CACHE = "iching-tao-data-v0.1.1";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./engine.js",
  "./ui-lib.js",
  "./manifest.webmanifest",
  "https://unpkg.com/lenis@1.1.20/dist/lenis.min.js",
  "https://cdn.jsdelivr.net/gh/sarathsaleem/grained@master/grained.js",
  "https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js",
  "./assets/sage.png",
  "./assets/coin_yang.png",
  "./assets/coin_yin.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (![CACHE_NAME, DATA_CACHE].includes(k)) return caches.delete(k);
    }));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Handle requests

  // data: stale-while-revalidate
  if (url.pathname.includes("/data/")) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    return;
  }

  // shell: cache-first
  event.respondWith(cacheFirst(req, CACHE_NAME));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;

  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);

  return cached || fetchPromise;
}
