// ─── lib/bar-tabs-cache.ts ────────────────────────────────────────────────────
// Offline-first localStorage cache for Bar Tabs.
//
// Every tab lives in localStorage under BAR_TABS_KEY as a JSON array.
// The UI reads from here exclusively — the server is a secondary mirror.
//
// Tab lifecycle:
//   create  → write to localStorage (synced:false) → POST /api/bar/tabs in bg
//   add item → update localStorage lines → POST /api/bar/tabs/[id]/lines in bg
//   recall   → load cart items from localStorage tab into Bar POS cart
//   checkout → mark status:'billing' in localStorage → payment page closes tab
//   closed   → update localStorage status → settled on server via close endpoint
//
// Sync reconciliation (runs on 'online' event and every 5 min):
//   1. Tabs with synced:false and no serverId → create on server, store serverId
//   2. Tabs with synced:false and a serverId  → push pending lines to server
//   3. Pull fresh open tabs from server, merge in (server wins for status)

export const BAR_TABS_KEY = 'barTabs'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LocalTabLine {
  localId:         string     // client-generated UUID
  inventoryItemId: string
  servingId:       string | null
  itemName:        string
  servingName:     string
  unitPrice:       number
  quantity:        number
  discount:        number
  addedAt:         string     // ISO timestamp
  synced:          boolean    // true once pushed to server
}

export interface LocalTab {
  localId:       string       // client-generated UUID (used as key before sync)
  serverId?:     string       // MongoDB _id once synced to server
  customerName:  string
  tableNumber?:  string
  notes?:        string
  status:        'open' | 'billing' | 'paid' | 'cancelled'
  lines:         LocalTabLine[]
  cartDiscount:  number
  synced:        boolean      // false = has unsynced changes
  createdAt:     string
  updatedAt:     string
  // Pending payment — set when checkout happens offline
  pendingPayment?: {
    paymentMethod: string
    amountPaid:    number
    mpesaCode?:    string
    mpesaPhone?:   string
    customerId?:   string
    customerName?: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function now(): string {
  return new Date().toISOString()
}

// ── Read / write ───────────────────────────────────────────────────────────────

export function readTabs(): LocalTab[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(BAR_TABS_KEY) || '[]')
  } catch { return [] }
}

function writeTabs(tabs: LocalTab[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(BAR_TABS_KEY, JSON.stringify(tabs))
}

// ── CRUD operations ────────────────────────────────────────────────────────────

/** Create a new tab locally and attempt to sync to server immediately if online */
export function createLocalTab(data: {
  customerName: string
  tableNumber?: string
  notes?: string
}): LocalTab {
  const tab: LocalTab = {
    localId:      uid(),
    customerName: data.customerName,
    tableNumber:  data.tableNumber,
    notes:        data.notes,
    status:       'open',
    lines:        [],
    cartDiscount: 0,
    synced:       false,
    createdAt:    now(),
    updatedAt:    now(),
  }
  const tabs = readTabs()
  tabs.unshift(tab)
  writeTabs(tabs)
  return tab
}

/** Return all open tabs (status === 'open') */
export function getOpenTabs(): LocalTab[] {
  return readTabs().filter(t => t.status === 'open')
}

/** Get a single tab by localId or serverId */
export function getTab(id: string): LocalTab | undefined {
  return readTabs().find(t => t.localId === id || t.serverId === id)
}

/** Update an existing tab (matched by localId) */
export function updateTab(localId: string, patch: Partial<LocalTab>): LocalTab | null {
  const tabs  = readTabs()
  const idx   = tabs.findIndex(t => t.localId === localId)
  if (idx === -1) return null
  const updated = { ...tabs[idx], ...patch, updatedAt: now() }
  tabs[idx] = updated
  writeTabs(tabs)
  return updated
}

/** Add lines to a tab (from a recalled cart snapshot) and mark unsynced */
export function setTabLines(
  localId: string,
  cartItems: Array<{
    productId:   string
    productName: string
    sellingPrice: number
    quantity:    number
    discount:    number
  }>,
  cartDiscount: number
): LocalTab | null {
  const lines: LocalTabLine[] = cartItems.map(item => ({
    localId:         uid(),
    inventoryItemId: item.productId.includes('__') ? item.productId.split('__')[0] : item.productId,
    servingId:       item.productId.includes('__') ? item.productId.split('__')[1] : null,
    itemName:        item.productName,
    servingName:     '',
    unitPrice:       item.sellingPrice,
    quantity:        item.quantity,
    discount:        item.discount,
    addedAt:         now(),
    synced:          false,
  }))
  return updateTab(localId, { lines, cartDiscount, synced: false })
}

/** Mark a tab as billing (about to be paid) with optional payment info for offline */
export function markTabBilling(localId: string, pendingPayment?: LocalTab['pendingPayment']): LocalTab | null {
  return updateTab(localId, { status: 'billing', pendingPayment, synced: false })
}

/** Mark a tab as paid locally */
export function markTabPaid(localId: string): LocalTab | null {
  return updateTab(localId, { status: 'paid', synced: false })
}

/** Delete a tab from localStorage (called after successful server close) */
export function removeTab(localId: string): void {
  const tabs = readTabs().filter(t => t.localId !== localId)
  writeTabs(tabs)
}

// ── Server sync ────────────────────────────────────────────────────────────────

/**
 * Push any unsynced tabs to the server.
 * Runs on 'online' event and periodically via initAutoSync.
 */
export async function syncBarTabs(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return

  const tabs = readTabs()
  const unsynced = tabs.filter(t => !t.synced && t.status !== 'paid')

  for (const tab of unsynced) {
    try {
      if (!tab.serverId) {
        // ── New tab — create on server ──────────────────────────────────────
        const res = await fetch('/api/bar/tabs', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            customerName: tab.customerName,
            tableNumber:  tab.tableNumber,
            notes:        tab.notes,
          }),
        })
        if (!res.ok) continue
        const data = await res.json()
        const serverId = data.tab._id as string

        // Push lines if any
        if (tab.lines.length > 0) {
          for (const line of tab.lines) {
            await fetch(`/api/bar/tabs/${serverId}/lines`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                inventoryItemId: line.inventoryItemId,
                servingId:       line.servingId,
                quantity:        line.quantity,
                unitPrice:       line.unitPrice,
                itemName:        line.itemName,
                servingName:     line.servingName,
                discount:        line.discount,
              }),
            })
          }
        }

        updateTab(tab.localId, { serverId, synced: true })

      } else {
        // ── Existing tab — push unsynced lines ──────────────────────────────
        const unsyncedLines = tab.lines.filter(l => !l.synced)
        for (const line of unsyncedLines) {
          const res = await fetch(`/api/bar/tabs/${tab.serverId}/lines`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              inventoryItemId: line.inventoryItemId,
              servingId:       line.servingId,
              quantity:        line.quantity,
              unitPrice:       line.unitPrice,
              itemName:        line.itemName,
              servingName:     line.servingName,
              discount:        line.discount,
            }),
          })
          if (res.ok) {
            // Mark this line synced
            const freshTab = getTab(tab.localId)
            if (freshTab) {
              const updatedLines = freshTab.lines.map(l =>
                l.localId === line.localId ? { ...l, synced: true } : l
              )
              updateTab(tab.localId, { lines: updatedLines })
            }
          }
        }
        // Mark tab synced if all lines are now synced
        const refreshed = getTab(tab.localId)
        if (refreshed && refreshed.lines.every(l => l.synced)) {
          updateTab(tab.localId, { synced: true })
        }
      }

      // ── Handle pending payment (offline checkout) ──────────────────────────
      const refreshed = getTab(tab.localId)
      if (refreshed?.pendingPayment && refreshed.serverId) {
        const { paymentMethod, amountPaid, mpesaCode, mpesaPhone, customerId, customerName } = refreshed.pendingPayment

        // 1. Move to billing status
        await fetch(`/api/bar/tabs/${refreshed.serverId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: 'billing' }),
        })

        // 2. Record payment
        await fetch(`/api/bar/tabs/${refreshed.serverId}/payments`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ amount: amountPaid, method: paymentMethod, mpesaCode, mpesaPhone }),
        })

        // 3. Close the tab
        await fetch(`/api/bar/tabs/${refreshed.serverId}/close`, { method: 'POST' })

        markTabPaid(tab.localId)
      }
    } catch (err) {
      console.error('[bar-tabs-cache] sync error for tab', tab.localId, err)
    }
  }

  // ── Pull fresh open tabs from server, merge in ───────────────────────────────
  try {
    const res = await fetch('/api/bar/tabs?status=open')
    if (!res.ok) return
    const data = await res.json()
    const serverTabs: any[] = data.tabs || []

    const current = readTabs()
    const knownServerIds = new Set(current.map(t => t.serverId).filter(Boolean))

    const toAdd: LocalTab[] = serverTabs
      .filter((st: any) => !knownServerIds.has(st._id))
      .map((st: any) => ({
        localId:      uid(),
        serverId:     st._id,
        customerName: st.customerName || 'Unknown',
        tableNumber:  st.tableNumber,
        notes:        st.notes,
        status:       st.status as LocalTab['status'],
        lines:        (st.lines || []).map((l: any) => ({
          localId:         uid(),
          inventoryItemId: l.inventoryItemId,
          servingId:       l.servingId || null,
          itemName:        l.itemName || l.productName || '',
          servingName:     l.servingName || '',
          unitPrice:       l.unitPrice || l.price || 0,
          quantity:        l.quantity,
          discount:        l.discount || 0,
          addedAt:         l.addedAt || new Date().toISOString(),
          synced:          true,
        })),
        cartDiscount:  st.discountAmount || 0,
        synced:        true,
        createdAt:     st.openedAt || new Date().toISOString(),
        updatedAt:     st.updatedAt || new Date().toISOString(),
      }))

    if (toAdd.length > 0) {
      writeTabs([...toAdd, ...current])
    }
  } catch { /* silent — server pull is best-effort */ }
}
