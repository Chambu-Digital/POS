export type OrderStatus =
  | 'pending'
  | 'acknowledged'
  | 'preparing'
  | 'ready'
  | 'collected'

export type ItemCategory = 'starter' | 'main' | 'dessert' | 'drink' | 'side'

export type OrderPriority = 'normal' | 'rush' | 'vip'

export type ViewMode = 'chef' | 'waiter' | 'manager'

export type KDSView = 'grid' | 'list'

export type KDSFilter = 'ALL' | OrderStatus

export interface KDSOrderItem {
  id: string
  menuItemId: string
  name: string
  quantity: number
  category: ItemCategory
  notes?: string
  modifications?: string[]
  prepTime?: number
}

export interface KDSOrder {
  id: string
  orderNumber: string
  tableNumber: string
  tableSection?: string
  waiterName: string
  waiterId: string
  coverCount: number
  items: KDSOrderItem[]
  status: OrderStatus
  priority: OrderPriority
  notes?: string
  // Timestamps as ISO strings (safe for JSON serialization)
  createdAt: string
  acknowledgedAt?: string
  preparingAt?: string
  readyAt?: string
  collectedAt?: string
  // Chef assignment
  assignedChefId?: string
  assignedChefName?: string
}

export interface KDSStats {
  pending: number
  acknowledged: number
  preparing: number
  ready: number
  collected: number
  avgPrepTime: number
}
