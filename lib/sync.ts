import {
  getPendingSales,
  removePendingSale,
  updateSyncTime,
  isOnline,
} from './indexeddb'

// Prevent multiple concurrent sync runs and duplicate listener registration
let syncing = false
let autoSyncInitialised = false

export async function syncPendingSales(onProgress?: (synced: number, total: number) => void): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) {
    console.log('[sync] Offline - cannot sync')
    return { synced: 0, failed: 0 }
  }

  if (syncing) {
    console.log('[sync] Sync already in progress, skipping')
    return { synced: 0, failed: 0 }
  }

  syncing = true
  let syncedCount = 0
  let failedCount = 0

  try {
    const pendingSales = await getPendingSales()

    if (pendingSales.length === 0) {
      console.log('[sync] No pending sales to sync')
      return { synced: 0, failed: 0 }
    }

    console.log(`[sync] Syncing ${pendingSales.length} pending sale(s)...`)

    for (const sale of pendingSales) {
      try {
        // Strip the local indexeddb tracking fields before sending to server
        const { id, createdAt, synced, _endpoint, ...saleData } = sale
        const endpoint = _endpoint || '/api/sales'

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        })

        if (response.ok) {
          await removePendingSale(id)
          syncedCount++
          console.log(`[sync] Synced sale ${id} → ${endpoint}`)
          onProgress?.(syncedCount, pendingSales.length)
        } else {
          const errBody = await response.json().catch(() => ({}))
          console.error(`[sync] Server rejected sale ${id} (${response.status}):`, errBody?.error || response.statusText)
          failedCount++
          // Leave in queue — will retry on next sync
        }
      } catch (error) {
        console.error(`[sync] Network error syncing sale:`, error)
        failedCount++
      }
    }

    await updateSyncTime()
    console.log(`[sync] Done — ${syncedCount} synced, ${failedCount} failed`)
    return { synced: syncedCount, failed: failedCount }
  } catch (error) {
    console.error('[sync] Sync error:', error)
    return { synced: syncedCount, failed: failedCount }
  } finally {
    syncing = false
  }
}

export function initAutoSync() {
  if (typeof window === 'undefined') return
  // Guard: only register listeners once, even if the sales page re-mounts
  if (autoSyncInitialised) return
  autoSyncInitialised = true

  // Sync when the browser detects network restoration
  window.addEventListener('online', async () => {
    console.log('[sync] Back online — syncing pending sales...')
    const { synced, failed } = await syncPendingSales()
    if (synced > 0) {
      // Dynamically import toast so this utility stays framework-agnostic
      import('sonner').then(({ toast }) => {
        toast.success(`${synced} offline sale${synced > 1 ? 's' : ''} synced successfully`)
      })
    }
    if (failed > 0) {
      import('sonner').then(({ toast }) => {
        toast.error(`${failed} offline sale${failed > 1 ? 's' : ''} failed to sync — will retry`)
      })
    }
  })

  // Also handle the custom event fired by the service-worker-register component
  // when the SW triggers a background sync (tag: 'sync-sales')
  window.addEventListener('background-sync', async () => {
    console.log('[sync] Background sync triggered by service worker')
    const { synced } = await syncPendingSales()
    if (synced > 0) {
      import('sonner').then(({ toast }) => {
        toast.success(`${synced} offline sale${synced > 1 ? 's' : ''} synced in background`)
      })
    }
  })

  // Periodic fallback every 5 minutes
  setInterval(async () => {
    if (isOnline()) {
      await syncPendingSales()
    }
  }, 5 * 60 * 1000)
}
