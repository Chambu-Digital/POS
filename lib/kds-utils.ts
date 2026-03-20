import type { KDSOrder, KDSStats, ItemCategory } from '@/types/kds'

// ── Timing helpers ─────────────────────────────────────────────────────────────

export function getElapsedMs(isoDate: string): number {
  return Date.now() - new Date(isoDate).getTime()
}

export function getElapsedMinutes(isoDate: string): number {
  return Math.floor(getElapsedMs(isoDate) / 60000)
}

export function formatElapsed(isoDate: string): string {
  const secs = Math.floor(getElapsedMs(isoDate) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function getUrgencyLevel(order: KDSOrder): 'normal' | 'warning' | 'critical' {
  const mins = getElapsedMinutes(order.createdAt)
  if (order.priority === 'rush') return mins > 5 ? 'critical' : 'warning'
  if (order.priority === 'vip') return mins > 8 ? 'critical' : 'warning'
  if (mins > 20) return 'critical'
  if (mins > 12) return 'warning'
  return 'normal'
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export function computeStats(orders: KDSOrder[]): KDSStats {
  const stats: KDSStats = {
    pending: 0, acknowledged: 0, preparing: 0, ready: 0, collected: 0, avgPrepTime: 0,
  }
  let totalPrepSeconds = 0
  let prepCount = 0

  for (const o of orders) {
    switch (o.status) {
      case 'pending':      stats.pending++;      break
      case 'acknowledged': stats.acknowledged++; break
      case 'preparing':    stats.preparing++;    break
      case 'ready':        stats.ready++;        break
      case 'collected':    stats.collected++;    break
    }
    if (o.readyAt && o.preparingAt) {
      totalPrepSeconds += (new Date(o.readyAt).getTime() - new Date(o.preparingAt).getTime()) / 1000
      prepCount++
    }
  }

  stats.avgPrepTime = prepCount > 0 ? Math.round(totalPrepSeconds / prepCount / 60) : 0
  return stats
}

// ── Category config ────────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<ItemCategory, { label: string; color: string; bg: string }> = {
  starter: { label: 'Starter', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  main:    { label: 'Main',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  side:    { label: 'Side',    color: '#a3e635', bg: 'rgba(163,230,53,0.12)'  },
  dessert: { label: 'Dessert', color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  drink:   { label: 'Drink',   color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

export const MOCK_ORDERS: KDSOrder[] = [
  {
    id: 'ord_1',
    orderNumber: '#0042',
    tableNumber: '5',
    tableSection: 'Main Hall',
    waiterName: 'Alice M.',
    waiterId: 'w1',
    coverCount: 3,
    priority: 'rush',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    items: [
      { id: 'i1', menuItemId: 'm1', name: 'Grilled Salmon',  quantity: 1, category: 'main',    notes: 'No lemon, sauce on the side', prepTime: 14 },
      { id: 'i2', menuItemId: 'm2', name: 'Caesar Salad',    quantity: 2, category: 'starter', prepTime: 5 },
      { id: 'i3', menuItemId: 'm3', name: 'Sparkling Water', quantity: 3, category: 'drink' },
    ],
  },
  {
    id: 'ord_2',
    orderNumber: '#0041',
    tableNumber: '2',
    tableSection: 'Terrace',
    waiterName: 'Bob K.',
    waiterId: 'w2',
    coverCount: 2,
    priority: 'normal',
    status: 'preparing',
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
    preparingAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    assignedChefName: 'Chef Omar',
    items: [
      { id: 'i4', menuItemId: 'm4', name: 'Beef Burger',         quantity: 1, category: 'main',    notes: 'Well done, extra cheese', prepTime: 16 },
      { id: 'i5', menuItemId: 'm5', name: 'Sweet Potato Fries',  quantity: 1, category: 'side' },
      { id: 'i6', menuItemId: 'm6', name: 'Chocolate Lava Cake', quantity: 1, category: 'dessert', prepTime: 12 },
    ],
  },
  {
    id: 'ord_3',
    orderNumber: '#0040',
    tableNumber: '8',
    tableSection: 'Main Hall',
    waiterName: 'Alice M.',
    waiterId: 'w1',
    coverCount: 4,
    priority: 'normal',
    status: 'ready',
    createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 27 * 60 * 1000).toISOString(),
    preparingAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    readyAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    assignedChefName: 'Chef Sara',
    items: [
      { id: 'i7', menuItemId: 'm7', name: 'Margherita Pizza', quantity: 2, category: 'main' },
      { id: 'i8', menuItemId: 'm8', name: 'Tiramisu',         quantity: 2, category: 'dessert', notes: 'Extra cocoa dusting' },
    ],
  },
  {
    id: 'ord_4',
    orderNumber: '#0043',
    tableNumber: '11',
    tableSection: 'Private Room',
    waiterName: 'Carol N.',
    waiterId: 'w3',
    coverCount: 6,
    priority: 'vip',
    status: 'pending',
    createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    items: [
      { id: 'i9',  menuItemId: 'm9',  name: 'Pasta Carbonara', quantity: 2, category: 'main',    notes: 'Extra parmesan', prepTime: 12 },
      { id: 'i10', menuItemId: 'm10', name: 'Bruschetta',       quantity: 2, category: 'starter', prepTime: 6 },
      { id: 'i11', menuItemId: 'm11', name: 'House Red Wine',   quantity: 1, category: 'drink' },
    ],
  },
  {
    id: 'ord_5',
    orderNumber: '#0039',
    tableNumber: '3',
    tableSection: 'Bar Area',
    waiterName: 'Bob K.',
    waiterId: 'w2',
    coverCount: 1,
    priority: 'normal',
    status: 'acknowledged',
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    items: [
      { id: 'i12', menuItemId: 'm12', name: 'Club Sandwich',  quantity: 1, category: 'main',  prepTime: 10 },
      { id: 'i13', menuItemId: 'm13', name: 'Fresh Lemonade', quantity: 1, category: 'drink' },
    ],
  },
]
