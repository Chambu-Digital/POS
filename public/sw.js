// Chambu Digital POS Service Worker
// Handles offline caching, background sync, and automatic updates

const CACHE_VERSION = 'chambu-pos-' + (self.registration?.scope || 'v1')
const CACHE_NAME = CACHE_VERSION + '-precache'
const RUNTIME_CACHE = CACHE_VERSION + '-runtime'
const API_CACHE = CACHE_VERSION + '-api'
// Image cache is stable across deployments — product images shouldn't be re-fetched on every deploy
const IMAGE_CACHE = 'chambu-pos-images-v1'

// Assets to cache on install (excluding large images)
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/chambu-logo.svg',
]

// Install event - cache essential assets and skip waiting
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', CACHE_NAME)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching assets')
      return cache.addAll(PRECACHE_ASSETS).catch((error) => {
        console.warn('[SW] Some assets failed to cache:', error)
        // Continue even if some assets fail
        return Promise.resolve()
      })
    })
  )
  // Skip waiting - activate immediately instead of waiting for all tabs to close
  self.skipWaiting()
})

// Activate event - clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all caches except current version
          if (!cacheName.startsWith(CACHE_VERSION)) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // Claim all clients immediately - new SW takes control right away
  self.clients.claim()
})

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip caching for non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Strategy 1: Network-first for HTML (app shell)
  // Don't cache HTML to ensure users always get latest version
  if (request.destination === 'document' || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache HTML responses
          return response
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cached) => {
            return cached || caches.match('/')
          })
        })
    )
    return
  }

  // Strategy 2: Cache-first for product images from fecy.co.ke (cross-origin)
  // These are cached permanently so they work offline after first load
  if (url.hostname === 'fecy.co.ke') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone())
            }
            return response
          }).catch(() => cached || new Response('', { status: 404 }))
        })
      })
    )
    return
  }

  // Strategy 3: Cache-first for static assets (JS, CSS, local images)
  if (
    url.pathname.match(/\.(js|css|woff2|woff|ttf|eot|svg|png|jpg|jpeg|gif|webp)$/i) &&
    !url.pathname.includes('placeholder')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached
        }
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response
            }
            const responseToCache = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache)
            })
            return response
          })
          .catch(() => {
            // Return placeholder or cached version
            return caches.match(request)
          })
      })
    )
    return
  }

  // Strategy 4: Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone()
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request)
        })
    )
    return
  }

  // Default: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response
      })
      .catch(() => {
        return caches.match(request)
      })
  )
})

// Background sync event - sync pending sales when online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(
      // Notify the app to sync
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_SYNC',
            tag: event.tag,
          })
        })
      })
    )
  }
})

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

console.log('[SW] Service worker loaded')
