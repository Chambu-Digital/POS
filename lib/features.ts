// ─── Single source of truth for all available features ────────────────────────
// Add a new entry here → it automatically appears in:
//   - The sidebar (as a menu item, gated by the feature key)
//   - The admin tenant form (feature toggles)
//   - The Tenant model defaults

import {
  ShoppingCart, UtensilsCrossed, Wine, BedDouble,
  FileText, Package, BarChart3, Receipt,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface FeatureDefinition {
  key: string
  label: string
  description: string
  defaultOn: boolean
  // Sidebar metadata
  href: string
  icon: LucideIcon
  permission: string | null   // staff permission key required to see this item
  adminOnly: boolean
}

export const FEATURES: FeatureDefinition[] = [
  {
    key: 'pos', label: 'Make Sale', description: 'Point of sale, cart and checkout',
    defaultOn: true, href: '/dashboard/sales', icon: ShoppingCart,
    permission: 'canMakeSales', adminOnly: false,
  },
  {
    key: 'kitchenDisplay', label: 'Kitchen Display', description: 'KDS for restaurant kitchen orders',
    defaultOn: false, href: '/dashboard/kds', icon: UtensilsCrossed,
    permission: null, adminOnly: false,
  },
  {
    key: 'bar', label: 'Bar', description: 'Bar tab management',
    defaultOn: false, href: '/dashboard/bar', icon: Wine,
    permission: null, adminOnly: false,
  },
  {
    key: 'rentals', label: 'Rental Services', description: 'Room, bike, car and other rentals',
    defaultOn: false, href: '/dashboard/rental-services', icon: BedDouble,
    permission: null, adminOnly: false,
  },
  {
    key: 'orders', label: 'Orders', description: 'Order history and management',
    defaultOn: true, href: '/dashboard/orders', icon: FileText,
    permission: 'canViewOrders', adminOnly: false,
  },
  {
    key: 'inventory', label: 'Inventory', description: 'Product and stock management',
    defaultOn: true, href: '/dashboard/inventory', icon: Package,
    permission: 'canViewInventory', adminOnly: false,
  },
  {
    key: 'reports', label: 'Reports', description: 'Sales, inventory and profit reports',
    defaultOn: true, href: '/dashboard/reports', icon: BarChart3,
    permission: 'canViewSalesReports', adminOnly: false,
  },
  {
    key: 'expenses', label: 'Expenses', description: 'Expense tracking and approval',
    defaultOn: true, href: '/dashboard/expenses', icon: Receipt,
    permission: null, adminOnly: false,
  },
]

// Default features object for new tenants
export const DEFAULT_FEATURES: Record<string, boolean> = Object.fromEntries(
  FEATURES.map(f => [f.key, f.defaultOn])
)
