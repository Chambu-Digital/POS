export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'

export type OrderType = 'dine-in' | 'takeaway' | 'delivery'

export type ItemCategory = 'starter' | 'main' | 'dessert' | 'drink' | 'side'

export type KitchenStation = 'grill' | 'drinks' | 'dessert' | 'pizza' | 'all'

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
  station?: KitchenStation
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
  orderType: OrderType
  items: KDSOrderItem[]
  status: OrderStatus
  priority: OrderPriority
  notes?: string
  // Timestamps as ISO strings (safe for JSON serialization)
  createdAt: string
  preparingAt?: string
  readyAt?: string
  servedAt?: string
  cancelledAt?: string
  // Chef assignment
  assignedChefId?: string
  assignedChefName?: string
}

export interface KDSStats {
  pending: number
  preparing: number
  ready: number
  served: number
  cancelled: number
  avgPrepTime: number
}
