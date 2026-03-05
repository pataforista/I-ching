// ============================================================
//  I Ching PWA — Service Worker  v1.0.0
//  Strategy: Cache-First shell + Stale-While-Revalidate data
//  Play Store / TWA ready
// ============================================================

const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `iching-shell-${CACHE_VERSION}`;
const DATA_CACHE = `iching-data-${CACHE_VERSION}`;

// App Shell — all critical assets for offline first paint
const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./privacy.html",
  "./styles.css",
  "./app.js",
  "./engine.js",
  "./ui-lib.js",
  "./manifest.webmanifest",
  "./src/art-background.js",

  // Icons (Play Store required sizes)
  "./assets/icons/icon-48.png",
  "./assets/icons/icon-72.png",
  "./assets/icons/icon-96.png",
  "./assets/icons/icon-144.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",

  // Core images
  "./assets/sage.png",
  "./assets/sage_cover.png",
  "./assets/coin_yang.png",
  "./assets/coin_yin.png",

  // Sumi-e offline art backgrounds
  "./assets/fallback/sumi-mountains.svg",
  "./assets/fallback/sumi-bamboo.svg",
  "./assets/fallback/sumi-waves.svg",
  "./assets/fallback/sumi-moon.svg",
  "./assets/fallback/sumi-reeds.svg",

  // Third-party libraries (cached for offline)
  "https://unpkg.com/lenis@1.1.20/dist/lenis.min.js",
  "https://cdn.jsdelivr.net/gh/sarathsaleem/grained@master/grained.js",
  "https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js",
];

// Data assets — stale-while-revalidate
const DATA_ASSETS = [
  "./data/hexagrams_meta.json",
  "./data/trigrams.json",
  "./data/dataset_manifest.json",
];

// ────────────────────────────────────────────────────────────
//  INSTALL — pre-cache shell
// ────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Cache shell assets individually so one failure doesn't block install
      const results = await Promise.allSettled(
        SHELL.map(url => cache.add(url).catch(err => {
          console.warn(`[SW] Failed to cache: ${url}`, err.message);
        }))
      );

      // Also pre-cache data assets
      const dataCache = await caches.open(DATA_CACHE);
      await Promise.allSettled(
        DATA_ASSETS.map(url => dataCache.add(url).catch(() => { }))
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) console.warn(`[SW] ${failed} assets failed to cache (non-critical)`);

      console.log(`[SW] Installed ${CACHE_VERSION}`);
      self.skipWaiting();
    })()
  );
});

// ────────────────────────────────────────────────────────────
//  ACTIVATE — clean up old caches
// ────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const stale = keys.filter(k => k !== CACHE_NAME && k !== DATA_CACHE);
      await Promise.all(stale.map(k => {
        console.log(`[SW] Deleting old cache: ${k}`);
        return caches.delete(k);
      }));
      await self.clients.claim();
      console.log(`[SW] Active — ${CACHE_VERSION}`);
    })()
  );
});

// ────────────────────────────────────────────────────────────
//  FETCH — route handler
// ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and browser-extension requests
  if (req.method !== "GET" || !url.protocol.startsWith("http")) return;

  // Skip Chrome extension requests
  if (url.hostname === "chrome-extension") return;

  // Data files: stale-while-revalidate
  if (url.pathname.includes("/data/")) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    return;
  }

  // Google Fonts: network-first with cache fallback (they change rarely)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(networkFirst(req, CACHE_NAME));
    return;
  }

  // Everything else (shell, CDN libs, images): cache-first
  event.respondWith(cacheFirst(req, CACHE_NAME));
});

// ────────────────────────────────────────────────────────────
//  Strategies
// ────────────────────────────────────────────────────────────

/** Cache-first: serve from cache, fallback to network + cache it */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // Offline fallback for navigation requests
    if (req.mode === "navigate") {
      const offline = await cache.match("./offline.html");
      if (offline) return offline;
    }
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

/** Stale-while-revalidate: serve cached immediately, refresh in background */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

/** Network-first: try network, fallback to cache */
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response("", { status: 204 });
  }
}

// ────────────────────────────────────────────────────────────
//  PUSH Notifications (Daily reminder support)
// ────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "I Ching · Momento de Reflexión";
  const options = {
    body: data.body || "El oráculo te espera para tu reflexión del día.",
    icon: "./assets/icons/icon-192.png",
    badge: "./assets/icons/icon-72.png",
    tag: "daily-reminder",
    renotify: false,
    data: { url: data.url || "./" },
    actions: [
      { action: "open", title: "Consultar ahora" },
      { action: "dismiss", title: "Luego" }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const urlToOpen = event.notification.data?.url || "./";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(self.registration.scope));
      if (existing) return existing.focus();
      return clients.openWindow(urlToOpen);
    })
  );
});
