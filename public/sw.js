/* NEXUS service worker - shell cache. Auth/API always network-only. */
const CACHE = "nexus-shell-v2";
const SHELL = ["/", "/login", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/api/auth") ||
    url.pathname.includes("auth")
  ) {
    return;
  }

  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const hit =
            (await caches.match(req)) ||
            (await caches.match("/login")) ||
            (await caches.match("/")) ||
            null;
          if (hit) return hit;
          return new Response(
            "<!doctype html><html><body style='font-family:system-ui;padding:2rem'><h1>Offline</h1><p>Connect to the internet to load NEXUS. If you were signed in, reconnect and open /app.</p></body></html>",
            { status: 503, headers: { "Content-Type": "text/html" } },
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
    }),
  );
});
