/**
 * WeatherFlow – service-worker.js
 * Strategie: Cache First pro statické soubory, Network First pro API
 */

'use strict';

const CACHE_VERSION = 'weatherflow-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;

// Statické soubory k předcachování
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700&display=swap',
];

// ============================================================
//  INSTALL – předcachuj statické soubory
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        // Ignoruj chyby u externích zdrojů (fonts)
        console.warn('[SW] Some static assets could not be cached:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
//  ACTIVATE – smaž staré cache
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('weatherflow-') && k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
//  FETCH – strategie podle typu požadavku
// ============================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API požadavky (Open-Meteo, Nominatim) → Network First, fallback cache
  if (url.hostname.includes('open-meteo.com') || url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Google Fonts → Cache First
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Statické soubory aplikace → Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }
});

// ============================================================
//  STRATEGIE FETCHOVÁNÍ
// ============================================================

/** Network First – zkusí síť, při selhání vrátí cache */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkRes = await fetch(request.clone());
    if (networkRes.ok) {
      // Uložit do cache (klonovaná kopie)
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch (err) {
    console.log('[SW] Network failed, serving from cache:', request.url);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Pokud nemáme ani cache, vrátíme error response
    return new Response(JSON.stringify({ error: 'Offline – data nejsou dostupná' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/** Cache First – vrátí z cache, pokud není, stáhne ze sítě */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request.clone());
    if (networkRes.ok) {
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch (err) {
    console.log('[SW] Cache miss & network failed for:', request.url);
    // Fallback pro HTML stránky
    if (request.destination === 'document') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}
