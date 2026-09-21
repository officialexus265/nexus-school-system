/* NEXUS SW v3 — cache app shell + hashed assets so offline refresh works */
const CACHE = "nexus-shell-v3";
const SHELL = ["/", "/login", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          SHELL.map((u) =>
            cache.add(u).catch(() => {
              /* ignore missing during install */
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function offlineHtml() {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>NEXUS — Offline</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:system-ui,sans-serif;background:#0b0f14;color:#e8eef5;padding:1.5rem;text-align:center}
    h1{font-size:1.35rem;font-weight:600;margin:0 0 .5rem}
    p{opacity:.75;line-height:1.5;max-width:28rem;margin:0 auto}
    a{color:#5eead4}
  </style>
</head>
<body>
  <div>
    <h1>You are offline</h1>
    <p>NEXUS needs a network connection to load this page the first time (or after an update).</p>
    <p style="margin-top:1rem">Reconnect, open the site once online, then offline mode can use the cached app.</p>
    <p style="margin-top:1rem"><a href="/">Try home</a> · <a href="/login">Try login</a></p>
  </div>
</body>
</html>`,
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never touch API / auth
  if (url.pathname.startsWith("/api/") || url.pathname.includes("auth")) {
    return;
  }

  if (req.method !== "GET") return;

  // Hashed build assets — cache every successful fetch so offline can reload routes
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          if (cached) return cached;
          return new Response("/* offline — asset not cached */", {
            status: 503,
            headers: { "Content-Type": "application/javascript" },
          });
        }
      }),
    );
    return;
  }

  // Navigations
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
          // Also try to remember as fallback document
          if (url.pathname === "/" || url.pathname === "/login") {
            cache.put(url.pathname, res.clone());
          }
          return res;
        } catch {
          const cache = await caches.open(CACHE);
          const hit =
            (await cache.match(req)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match("/login")) ||
            (await cache.match("/")) ||
            null;
          // Cached HTML still may request missing chunks → prefer honest offline page
          // if we have no document at all
          if (hit) return hit;
          return offlineHtml();
        }
      })(),
    );
    return;
  }

  // Other same-origin GETs
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return cached || offlineHtml();
        }
      }),
    );
  }
});
