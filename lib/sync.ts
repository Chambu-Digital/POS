import {
  getPendingSales,
  removePendingSale,
  updateSyncTime,
  isOnline,
} from './indexeddb'

export async function syncPendingSales() {
  if (!isOnline()) {
    console.log('[v0] Offline - cannot sync')
    return false
  }

  try {
    const pendingSales = await getPendingSales()

    if (pendingSales.length === 0) {
      console.log('[v0] No pending sales to sync')
      return true
    }

    console.log(`[v0] Syncing ${pendingSales.length} pending sales...`)

    for (const sale of pendingSales) {
      try {
        const { id, ...saleData } = sale

        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        })

        if (response.ok) {
          await removePendingSale(id)
          console.log(`[v0] Synced sale ${id}`)
        } else {
          console.error(`[v0] Failed to sync sale ${id}:`, response.status)
        }
      } catch (error) {
        console.error(`[v0] Error syncing sale:`, error)
      }
    }

    await updateSyncTime()
    console.log('[v0] Sync completed')
    return true
  } catch (error) {
    console.error('[v0] Sync error:', error)
    return false
  }
}

export function initAutoSync() {
  if (typeof window === 'undefined') return

  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('[v0] Back online - syncing...')
    syncPendingSales()
  })

  // Sync periodically (every 5 minutes)
  setInterval(() => {
    if (isOnline()) {
      syncPendingSales()
    }
  }, 5 * 60 * 1000)
}
