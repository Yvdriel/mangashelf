const CACHE_VERSION = "v1";
const STATIC_CACHE = `mangashelf-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `mangashelf-images-${CACHE_VERSION}`;
const PAGE_CACHE = `mangashelf-pages-${CACHE_VERSION}`;

const IMAGE_CACHE_LIMIT = 500;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k !== STATIC_CACHE && k !== IMAGE_CACHE && k !== PAGE_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

function isImageRequest(url) {
  const path = url.pathname;
  return (
    path.match(/\/api\/manga\/\d+\/volume\/\d+\/page\/\d+/) ||
    path.match(/\/api\/covers\/\d+/)
  );
}

function isManagerRequest(url) {
  return url.pathname.startsWith("/api/manager");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    for (let i = 0; i < keys.length - maxItems; i++) {
      await cache.delete(keys[i]);
    }
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache manager API calls
  if (isManagerRequest(url)) return;

  // Cache-first for images (manga pages & covers)
  if (isImageRequest(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((response) => {
              if (response.ok) {
                cache.put(event.request, response.clone());
                trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT);
              }
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // Cache-first for static assets
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((response) => {
              if (response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // Network-first for pages and API routes
  if (event.request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGE_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }
});
