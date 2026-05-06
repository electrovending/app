// ============================================================
// AG Vending � Service Worker
// Cambiar APP_VERSION para forzar actualizaci�n en los clientes
// ============================================================
const APP_VERSION = 'ag-v2.1.5'; // ? CAMBIAR PARA FORZAR UPDATE
const BASE_PATH = '/MARLEW';

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`
];

// -- INSTALL --------------------------------------------------
// ?? NO llamar self.skipWaiting() aqu�.
// Si lo hac�s, el SW nuevo se activa solo y el banner
// de "Nueva versi�n disponible" NUNCA aparece en el cliente.
// El skipWaiting se dispara solo cuando el usuario toca ACTUALIZAR.
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando:', APP_VERSION);
  event.waitUntil(
    caches.open(APP_VERSION).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
          console.log('[SW] Cacheado:', url);
        } catch (err) {
          console.warn('[SW] Error cacheando:', url, err.message);
        }
      }
    })
  );
  // ? NO poner self.skipWaiting() ac�
});

// -- ACTIVATE -------------------------------------------------
// Se activa despu�s de que el usuario confirma la actualizaci�n
// (v�a postMessage SKIP_WAITING ? skipWaiting() ? controllerchange ? reload)
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando:', APP_VERSION);
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== APP_VERSION) {
            console.log('[SW] Borrando cache viejo:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  // claim() para tomar control de tabs ya abiertas
  self.clients.claim();
});

// -- FETCH ----------------------------------------------------
// Estrategia: Network-first con fallback a cach�.
// Siempre intenta la red primero para tener datos frescos,
// y usa la cach� solo si no hay conexi�n.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo interceptar GETs
  if (req.method !== 'GET') return;

  // No interceptar requests de otras origins (MQTT, APIs externas, etc.)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        // Respuesta v�lida ? actualizar cach� y devolver
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(APP_VERSION).then((cache) => {
            cache.put(req, clone);
          });
        }
        return networkRes;
      })
      .catch(() => {
        // Sin red ? intentar desde cach�
        return caches.match(req).then((cacheRes) => {
          if (cacheRes) {
            console.log('[SW] Sirviendo desde cach� (offline):', req.url);
            return cacheRes;
          }
          // Sin cach� tampoco ? devolver respuesta de error b�sica
          return new Response('Sin conexi�n', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// -- MENSAJES -------------------------------------------------
// El index.html manda { type: 'SKIP_WAITING' } cuando el usuario
// toca el bot�n ACTUALIZAR en el banner.
// Reci�n ah� activamos el nuevo SW.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING recibido � activando nueva versi�n...');
    self.skipWaiting();
  }
});

console.log('[SW] Cargado:', APP_VERSION);
