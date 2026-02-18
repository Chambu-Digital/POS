// Chambu Digital POS Service Worker
// Handles offline caching and background sync

const CACHE_NAME = 'chambu-pos-v1'
const RUNTIME_CACHE = 'chambu-pos-runtime-v1'

// Assets to cache on install (excluding large images)
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/dashboard/sales',
  '/dashboard/inventory',
  '/dashboard/staff',
  '/auth/login',
  '/auth/register',
  '/manifest.json',
  '/chambu-logo.svg',
]

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching assets')
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip caching for:
  // 1. Non-GET requests
  // 2. API calls (let them go to network/IndexedDB)
  // 3. Large images (placeholder images, user uploads)
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('placeholder') ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  ) {
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version
        return cachedResponse
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          // Don't cache if not successful
          if (!response || response.status !== 200 || response.type === 'error') {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          // Cache the fetched resource
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // Network failed, return offline page if available
          if (request.destination === 'document') {
            return caches.match('/')
          }
        })
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
