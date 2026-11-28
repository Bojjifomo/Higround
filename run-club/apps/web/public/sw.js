// Higround Coffee & Run Club — Lightweight PWA Service Worker
// Caches immutable pixel-art sprites for instant mobile load & supports Web Push Notifications.
const CACHE_NAME = "higround-world-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Cache-first only for static world sprites & PWA icons; never intercept API/SSR pages!
  if (url.origin === self.location.origin && (url.pathname.startsWith("/assets/world/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      }),
    );
  }
});

// Web Push Notification handler (iOS 16.4+ PWA & Android)
self.addEventListener("push", (event) => {
  let payload = { title: "Higround Coffee & Run Club", body: "Ada info baru di Dunia Higround!", url: "/world" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/world" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/world";
  event.waitUntil(self.clients.openWindow(targetUrl));
});
