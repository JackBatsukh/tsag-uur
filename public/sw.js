/* Tsag-uur bounded offline shell. No API, map tile, or location caching. */
const VERSION = "tsag-uur-v3";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";
const MAX_STATIC_ENTRIES = 80;
const MAX_PAGE_ENTRIES = 8;
const PUBLIC_SHELL_PAGES = ["/offline", "/herder"];

async function trim(cacheName, maximum) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maximum)).map((key) => cache.delete(key)));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const pageCache = await caches.open(PAGE_CACHE);
    const responses = await Promise.all(PUBLIC_SHELL_PAGES.map(async (path) => {
      const request = new Request(path, { cache: "reload" });
      const response = await fetch(request);
      await pageCache.put(request, response.clone());
      return response.text();
    }));
    const assets = responses.flatMap((html) => [...html.matchAll(/["'](\/_next\/static\/[^"']+)["']/g)]
      .map((match) => match[1]).filter(Boolean));
    if (assets.length) {
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.addAll([...new Set(assets)]);
      await trim(STATIC_CACHE, MAX_STATIC_ENTRIES);
    }
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("tsag-uur-") && ![STATIC_CACHE, PAGE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    await trim(STATIC_CACHE, MAX_STATIC_ENTRIES);
  }
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
      await trim(PAGE_CACHE, MAX_PAGE_ENTRIES);
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/icons.svg"
  ) {
    event.respondWith(cacheFirstStatic(request));
  }
});
