// Service worker de la PWA "Capitales del Mundo".
// Estrategia: cachea de entrada el "esqueleto" de la app (HTML/CSS/JS/datos)
// para que funcione offline desde la primera visita, y va cacheando el resto
// (banderas, etc.) la primera vez que se piden, sin tener que listarlas todas
// aquí a mano.
const CACHE_VERSION = "v1";
const CACHE_NAME = `capitales-mundo-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./mascot.js",
  "./continents.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./lib/d3.min.js",
  "./data/africa.js",
  "./data/america.js",
  "./data/asia.js",
  "./data/europe.js",
  "./data/oceania.js",
  "./data/facts.js",
  "./data/facts-en.js",
  "./data/facts-fr.js",
  "./data/facts-pt.js",
  "./data/facts-de.js",
  "./data/i18n.js",
  "./data/i18n-names-en.js",
  "./data/i18n-names-fr.js",
  "./data/i18n-names-pt.js",
  "./data/i18n-names-de.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // sin red y sin caché: si era la página principal, al menos devuelve el shell
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        });
    })
  );
});
