// public/sw.js
// Service Worker para Vando Motos Locadora LTDA - PWA Offline Completo

const CACHE_NAME = 'vandomotos-cache-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-vandomotos.png',
  '/icon.svg'
];

// Instalação: Precache dos recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        try {
          await cache.addAll(PRECACHE_ASSETS);
        } catch (err) {
          console.warn('[SW] Falha em cache.addAll, tentando individualmente:', err);
          await Promise.all(
            PRECACHE_ASSETS.map((asset) =>
              cache.add(asset).catch((e) => console.warn('[SW] Erro ao precachear:', asset, e))
            )
          );
        }
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: Limpeza de caches antigos e claim imediato dos clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignora esquemas que não sejam HTTP/HTTPS (ex: chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // 1. Google Fonts: Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 2. Navegação / HTML: Network-first com fallback para cache e offline fallback (/index.html)
  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
          // Caso receba erro do servidor (ex: 502/503/504), tenta o cache
          if (!networkResponse || networkResponse.status >= 500) {
            const cachedResponse = await caches.match(event.request);
            if (cachedResponse) return cachedResponse;
            const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
            if (fallback) return fallback;
          }
          return networkResponse;
        })
        .catch(async () => {
          // Se falhar rede (offline), busca no cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se falharem ambos (network e cache miss), retorna /index.html em cache
          const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
          return fallback;
        })
    );
    return;
  }

  // 3. Ativos Estáticos (CSS, JS, Imagens, Fontes): Cache-first
  const isStaticAsset =
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    /\.(css|js|mjs|png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|json)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse;
        }
      })
    );
    return;
  }

  // 4. Demais requisições: Network-first com fallback para cache
  event.respondWith(
    fetch(event.request)
      .then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
