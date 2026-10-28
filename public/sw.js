// public/sw.js
// Service Worker para Gestão de Crédito & Finanças - PWA Offline & Auto-Update
// Versão do Cache: v11 (Suporte a 1 parcela única e juros customizados)

const CACHE_NAME = 'vandomotos-fintech-v11';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-vandomotos.png',
  '/icon.svg'
];

// Comunicação: Permite que a aplicação ordene pular a fila de espera ou limpar caches
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

// Instalação: Precache dos recursos essenciais e ativação rápida
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (err) {
        console.warn('[SW] Precache parcial:', err);
        await Promise.all(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(asset).catch((e) => console.warn('[SW] Falha em:', asset, e))
          )
        );
      }
    })
  );
});

// Ativação: Limpeza agressiva de qualquer cache antigo (v1, v2, v3, v4, etc.)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purgando cache obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições com foco em dados atualizados
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

  // 2. Navegação / HTML: Network-first estrito para nunca servir HTML com bundles antigos
  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }
          // Caso dê 4xx ou 5xx na rede, tenta o cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
          return fallback || networkResponse;
        })
        .catch(async () => {
          // Offline: busca no cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
          return fallback;
        })
    );
    return;
  }

  // 3. Ativos Estáticos (JS, CSS, Imagens, Fontes)
  const isStaticAsset =
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    /\.(css|js|mjs|png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|json)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        // Se temos em cache, devolvemos mas revalidamos em segundo plano (Stale-While-Revalidate)
        if (cachedResponse) {
          fetch(event.request)
            .then(async (freshResponse) => {
              if (freshResponse && freshResponse.status === 200) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, freshResponse);
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Se não está no cache, busca na rede e salva
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

  // 4. Demais requisições
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
