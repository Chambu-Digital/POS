// ─── Module definitions ────────────────────────────────────────────────────────
// A module is a group of related features (sidebar items).
// Tenant feature flags and staff permissions use dotted keys: 'module.feature'
//
// This is the single source of truth for:
//   - Sidebar grouping
//   - Admin tenant feature toggles (grouped)
//   - Step 2: staff permission checkboxes (grouped)

export interface ModuleFeature {
  /** Dotted key: 'module.feature', e.g. 'pos.sales' */
  key: string
  label: string
  description: string
  href: string
  /** If true, only the business owner (type:'user') can see this */
  adminOnly: boolean
  /** Whether this feature is on by default for new tenants */
  defaultOn: boolean
}

export interface ModuleDefinition {
  /** Top-level module key, e.g. 'pos' */
  key: string
  label: string
  description: string
  /** If true, this module is enabled by default for new tenants */
  defaultOn: boolean
  features: ModuleFeature[]
}

export const MODULES: ModuleDefinition[] = [
  {
    key: 'pos',
    label: 'Point of Sale',
    description: 'Sales, inventory, orders and reports',
    defaultOn: true,
    features: [
      {
        key: 'pos.sales', label: 'Make Sale', description: 'POS cart and checkout',
        href: '/dashboard/sales',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'pos.orders', label: 'Orders', description: 'Order history and management',
        href: '/dashboard/orders',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'pos.inventory', label: 'Inventory', description: 'Product and stock management',
        href: '/dashboard/inventory',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'pos.reports', label: 'Reports', description: 'Sales, inventory and profit reports',
        href: '/dashboard/reports',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'pos.expenses', label: 'Expenses', description: 'Expense tracking and approval',
        href: '/dashboard/expenses',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'pos.customers', label: 'Customers', description: 'Customer management and credit accounts',
        href: '/dashboard/customers',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'pos.settings', label: 'Settings', description: 'Shop settings and configuration',
        href: '/dashboard/settings',
        adminOnly: true, defaultOn: true,
      },
    ],
  },
  {
    key: 'kds',
    label: 'Kitchen Display',
    description: 'KDS for restaurant kitchen orders',
    defaultOn: true,
    features: [
      {
        key: 'kds.menu', label: 'Menu Management', description: 'Manage restaurant menu items',
        href: '/dashboard/kds/menu',
        adminOnly: true, defaultOn: true,
      },
      {
        key: 'kds.inventory', label: 'Inventory', description: 'Track restaurant stock and supplies',
        href: '/dashboard/kds/inventory',
        adminOnly: true, defaultOn: true,
      },
      {
        key: 'kds.orders', label: 'Create Order', description: 'Waiter creates new kitchen orders',
        href: '/dashboard/kds/orders',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'kds.chef', label: 'Chef View', description: 'Kitchen display for chefs',
        href: '/dashboard/kds/chef',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'kds.waiter', label: 'Waiter View', description: 'Order pickup and serving',
        href: '/dashboard/kds/waiter',
        adminOnly: false, defaultOn: true,
      },
      {
        key: 'kds.history', label: 'Order History', description: 'View all kitchen orders',
        href: '/dashboard/kds/history',
        adminOnly: false, defaultOn: true,
      },
    ],
  },
  {
    key: 'bar',
    label: 'Bar',
    description: 'Bar tab management',
    defaultOn: false,
    features: [
      {
        key: 'bar.tabs', label: 'Bar Tabs', description: 'Manage bar tabs and orders',
        href: '/dashboard/bar',
        adminOnly: false, defaultOn: false,
      },
    ],
  },
  {
    key: 'rentals',
    label: 'Rentals',
    description: 'Room, bike, car and other rentals',
    defaultOn: false,
    features: [
      {
        key: 'rentals.bookings', label: 'Rental Services', description: 'Create and manage rental bookings',
        href: '/dashboard/rental-services',
        adminOnly: false, defaultOn: false,
      },
      {
        key: 'rentals.manage', label: 'Rentals', description: 'View and manage active rentals',
        href: '/dashboard/rentals',
        adminOnly: false, defaultOn: false,
      },
    ],
  },
]

// ── Derived helpers ────────────────────────────────────────────────────────────

/** Flat list of all features across all modules */
export const ALL_FEATURES: ModuleFeature[] = MODULES.flatMap(m => m.features)

/** Default feature flags for new tenants: { 'pos.sales': true, 'bar.tabs': false, ... } */
export const DEFAULT_MODULE_FEATURES: Record<string, boolean> = Object.fromEntries(
  ALL_FEATURES.map(f => [f.key, f.defaultOn])
)

/**
 * Maps old flat feature keys (from lib/features.ts) to new dotted keys.
 * Used during the transition so existing tenant records still work.
 */
export const LEGACY_KEY_MAP: Record<string, string> = {
  pos:            'pos.sales',
  kitchenDisplay: 'kds.chef',
  bar:            'bar.tabs',
  rentals:        'rentals.bookings',
  orders:         'pos.orders',
  inventory:      'pos.inventory',
  reports:        'pos.reports',
  expenses:       'pos.expenses',
}

/**
 * Normalises a features record that may contain old flat keys, new dotted keys,
 * or a mix of both. Always returns dotted keys.
 */
export function normaliseFeatures(raw: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = { ...DEFAULT_MODULE_FEATURES }
  for (const [k, v] of Object.entries(raw)) {
    if (k in LEGACY_KEY_MAP) {
      out[LEGACY_KEY_MAP[k]] = v
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Given a set of selected module keys, returns a full feature flags record
 * with all features of selected modules set to true, others false.
 */
export function modulesToFeatures(selectedModuleKeys: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const mod of MODULES) {
    const on = selectedModuleKeys.includes(mod.key)
    for (const f of mod.features) {
      out[f.key] = on
    }
  }
  return out
}

/**
 * Given a feature flags record, returns the set of module keys that are
 * considered "enabled" (at least one feature in the module is true).
 */
export function featuresToModuleKeys(features: Record<string, boolean>): string[] {
  return MODULES
    .filter(mod => mod.features.some(f => features[f.key]))
    .map(mod => mod.key)
}

/** Default permissions for a new cashier/employee */
export const DEFAULT_STAFF_PERMISSIONS: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.reports':      false,
  'pos.expenses':     false,
  'pos.customers':    false,
  'kds.orders':       true,
  'kds.chef':         true,
  'kds.waiter':       true,
  'kds.history':      true,
  'bar.tabs':         false,
  'rentals.bookings': false,
  'rentals.manage':   false,
}

/** Default permissions for a manager */
export const DEFAULT_MANAGER_PERMISSIONS: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.reports':      true,
  'pos.expenses':     true,
  'pos.customers':    true,
  'kds.orders':       true,
  'kds.chef':         true,
  'kds.waiter':       true,
  'kds.history':      true,
  'bar.tabs':         false,
  'rentals.bookings': false,
  'rentals.manage':   false,
}

/** Normalises a permissions object — only keys explicitly set to true are granted */
export function normalisePermissions(raw: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const f of ALL_FEATURES) {
    out[f.key] = raw[f.key] === true
  }
  return out
}
