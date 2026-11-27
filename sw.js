/* WORDWAVE PWA service worker
 * Shell is precached; word/sentence audio is cached on first play.
 * Bump VERSION whenever the shell changes.
 */
const VERSION = "wordwave-2026-11-27-v23";
const SHELL_CACHE = `wordwave-shell-${VERSION}`;
const RUNTIME_CACHE = `wordwave-runtime-${VERSION}`;
const SCOPE = self.registration.scope;
const abs = (path) => new URL(path, SCOPE).href;

const SHELL = [
  "index.html",
  "manifest.json",
  "data.js",
  "lab.js",
  "ipa.js",
  "account.js",
  "account.css",
  "favicon.svg",
  "fonts/fredoka-latin.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon-180.png",
  "audio/ui/cheer-base.mp3",
  "audio/ui/cheer-channel.mp3",
  "audio/ui/cheer-perfect.mp3",
  "audio/ui/correct.mp3",
  "audio/ui/correct-1.mp3",
  "audio/ui/correct-2.mp3",
  "audio/ui/correct-3.mp3",
  "audio/ui/correct-4.mp3",
  "audio/ui/correct-5.mp3",
  "audio/ui/correct-6.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Do not fail the whole install if one optional file is unavailable.
    await Promise.allSettled(SHELL.map((path) => cache.add(abs(path))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("wordwave-") && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Account/session APIs are private and dynamic: never cache or intercept.
  if (url.pathname.startsWith("/api/")) return;

  // Admin is a separate, authenticated app. Let the network/server own it so
  // it is never mistaken for the learning-app shell.
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/") || url.pathname === "/admin.html") return;

  // SPA navigation: network first, cached shell as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(abs("index.html"), network.clone());
        return network;
      } catch (error) {
        return (await caches.match(abs("index.html"))) ||
          (await caches.match(abs(""))) ||
          new Response("WORDWAVE 离线缓存尚未就绪，请联网打开一次。", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  // Audio and font assets: cache first. If a Range request arrives before the
  // full file is cached, fetch the full file once and cache it.
  if (url.pathname.includes("/audio/") || url.pathname.includes("/fonts/")) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const full = await fetch(new Request(request.url, {
          method: "GET",
          credentials: "same-origin"
        }));
        if (full.ok && full.status === 200) {
          await cache.put(request.url, full.clone());
        }
        return full;
      } catch (error) {
        return new Response("", { status: 504, statusText: "offline" });
      }
    })());
    return;
  }

  // The account gate is security-sensitive: network first, cache only as an
  // offline fallback, so a deploy cannot leave users on stale auth/paywall code.
  if (url.pathname === "/account.js") {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        const network = await fetch(request);
        if (network.ok) cache.put(request, network.clone());
        return network;
      } catch {
        return (await cache.match(request, { ignoreSearch: true })) ||
          (await caches.match(abs("account.js"))) ||
          new Response("", { status: 504 });
      }
    })());
    return;
  }

  // JS / data / manifest / icons: stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);
    return cached || (await network) || new Response("", { status: 504 });
  })());
});
