/**
 * PWA Update Management Utility
 * Handles service worker updates and cache management
 */

export interface PWAUpdateStatus {
  hasUpdate: boolean
  isOnline: boolean
  swActive: boolean
  cacheVersion: string
}

/**
 * Check if a new PWA version is available
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.update()
      if (registration.waiting) {
        return true
      }
    }
    return false
  } catch (error) {
    console.error('[PWA] Error checking for updates:', error)
    return false
  }
}

/**
 * Get current PWA update status
 */
export async function getPWAStatus(): Promise<PWAUpdateStatus> {
  const hasUpdate = await checkForUpdates()
  const isOnline = navigator.onLine
  const swActive = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null

  // Get cache version from active SW
  let cacheVersion = 'unknown'
  try {
    const cacheNames = await caches.keys()
    const latestCache = cacheNames[cacheNames.length - 1]
    if (latestCache) {
      cacheVersion = latestCache
    }
  } catch (error) {
    console.error('[PWA] Error getting cache version:', error)
  }

  return {
    hasUpdate,
    isOnline,
    swActive,
    cacheVersion,
  }
}

/**
 * Clear all caches (useful for debugging)
 */
export async function clearAllCaches(): Promise<void> {
  try {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((name) => caches.delete(name)))
    console.log('[PWA] All caches cleared')
  } catch (error) {
    console.error('[PWA] Error clearing caches:', error)
  }
}

/**
 * Clear specific cache by name
 */
export async function clearCache(cacheName: string): Promise<void> {
  try {
    await caches.delete(cacheName)
    console.log('[PWA] Cache cleared:', cacheName)
  } catch (error) {
    console.error('[PWA] Error clearing cache:', error)
  }
}

/**
 * Get all cached URLs
 */
export async function getCachedUrls(): Promise<string[]> {
  try {
    const cacheNames = await caches.keys()
    const urls: string[] = []

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName)
      const requests = await cache.keys()
      urls.push(...requests.map((req) => req.url))
    }

    return urls
  } catch (error) {
    console.error('[PWA] Error getting cached URLs:', error)
    return []
  }
}

/**
 * Unregister all service workers (for debugging)
 */
export async function unregisterAllServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.unregister()
    }
    console.log('[PWA] All service workers unregistered')
  } catch (error) {
    console.error('[PWA] Error unregistering service workers:', error)
  }
}

/**
 * Force update check and reload
 */
export async function forceUpdate(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      await registration.update()
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        // Reload after SW takes control
        setTimeout(() => {
          window.location.reload()
        }, 500)
        return
      }
    }
    console.log('[PWA] No updates available')
  } catch (error) {
    console.error('[PWA] Error forcing update:', error)
  }
}

/**
 * Listen for online/offline events
 */
export function onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * Get service worker controller info
 */
export function getServiceWorkerInfo(): {
  isControlled: boolean
  scriptURL: string | null
  state: string | null
} {
  const controller = navigator.serviceWorker.controller
  return {
    isControlled: controller !== null,
    scriptURL: controller?.scriptURL || null,
    state: controller?.state || null,
  }
}
