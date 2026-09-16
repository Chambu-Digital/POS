// ─── Module definitions ────────────────────────────────────────────────────────
// Single source of truth for:
//   - Sidebar grouping and navigation
//   - Admin tenant feature toggles (grouped by module)
//   - Staff permission checkboxes (grouped by module)
//
// Phase 1 reorganisation
// ──────────────────────
// User-facing modules are now: Retail, Rentals, Pharmacy.
//
// Internal feature/permission keys:
//   pos.*        — Retail features
//   rentals.*    — Rentals features
//   pharmacy.*   — Pharmacy features
//
// All stored tenant feature documents and staff permission records continue to
// work without any database migration — the key strings are preserved verbatim.

import {
  ShoppingCart,
  BedDouble,
  Pill,
  Users,
  Truck,
  UserCog,
  Settings,
  UtensilsCrossed,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

// ── Core types ─────────────────────────────────────────────────────────────────

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
  /** Top-level module key, e.g. 'retail', 'rentals', 'pharmacy' */
  key: string
  /** User-facing label shown in the sidebar and admin panel */
  label: string
  description: string
  /** If true, this module is enabled by default for new tenants */
  defaultOn: boolean
  features: ModuleFeature[]
  /**
   * Optional lucide-react icon component for admin/staff UI display.
   * The staff permissions modal uses this to label each module group.
   */
  icon?: React.ComponentType<LucideProps>
}

// ── 0. Core (Essential Resources) ──────────────────────────────────────────────
// Core features are business-wide resources available to all modules.
// Always enabled by default. Not module-specific.
export const CORE_MODULE: ModuleDefinition = {
  key: 'core',
  label: 'Core',
  description: 'Essential business resources',
  defaultOn: true,
  features: [
    {
      key: 'core.customers',
      label: 'Customers',
      description: 'Customer management and credit accounts',
      href: '/dashboard/customers',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'core.suppliers',
      label: 'Suppliers',
      description: 'Supplier management and purchase tracking',
      href: '/dashboard/suppliers',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'core.restocking',
      label: 'Restocking',
      description: 'Purchase order generation and intelligent restocking analysis',
      href: '/dashboard/restocking',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'core.staff',
      label: 'Staff',
      description: 'Employee management and permissions',
      href: '/dashboard/staff',
      adminOnly: true,
      defaultOn: true,
    },
    {
      key: 'core.settings',
      label: 'Settings',
      description: 'Business settings and configuration',
      href: '/dashboard/settings',
      adminOnly: true,
      defaultOn: true,
    },
  ],
}

// ── 1. Retail (was: POS) ───────────────────────────────────────────────────────
// Internal keys remain pos.* — no stored data changes required.
export const RETAIL_MODULE: ModuleDefinition = {
  key: 'retail',
  label: 'Retail',
  description: 'Sales, inventory, orders and reports',
  defaultOn: true,
  icon: ShoppingCart,
  features: [
    {
      key: 'pos.sales',
      label: 'Make Sale',
      description: 'POS cart and checkout',
      href: '/dashboard/retail/sales',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pos.orders',
      label: 'Orders',
      description: 'Order history and management',
      href: '/dashboard/retail/orders',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pos.inventory',
      label: 'Inventory',
      description: 'Product and stock management',
      href: '/dashboard/retail/inventory',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pos.stock-movements',
      label: 'Stock Movements',
      description: 'View stock movement history and audit trail',
      href: '/dashboard/retail/stock-movements',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pos.reports',
      label: 'Reports',
      description: 'Sales, inventory and profit reports',
      href: '/dashboard/retail/reports',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pos.expenses',
      label: 'Expenses',
      description: 'Expense tracking and approval',
      href: '/dashboard/retail/expenses',
      adminOnly: false,
      defaultOn: true,
    },
  ],
}

// ── 2. Rentals ─────────────────────────────────────────────────────────────────
export const RENTALS_MODULE: ModuleDefinition = {
  key: 'rentals',
  label: 'Rentals',
  description: 'Room, bike, car and other rentals',
  defaultOn: false,
  icon: BedDouble,
  features: [
    {
      key: 'rentals.bookings',
      label: 'Rental Services',
      description: 'Create and manage rental bookings',
      href: '/dashboard/rental-services',
      adminOnly: false,
      defaultOn: false,
    },
    {
      key: 'rentals.manage',
      label: 'Rentals',
      description: 'View and manage active rentals',
      href: '/dashboard/rentals',
      adminOnly: false,
      defaultOn: false,
    },
  ],
}

// ── 4. Pharmacy ────────────────────────────────────────────────────────────────
// Only pharmacy.pos and pharmacy.inventory are operational.
// Patients, appointments, and billing are placeholder pages ("Coming soon").
// They remain in the registry so stored tenant configs are not invalidated,
// but they default to false and the sidebar does not promote them.
export const PHARMACY_MODULE: ModuleDefinition = {
  key: 'pharmacy',
  label: 'Pharmacy',
  description: 'Pharmacy management system',
  defaultOn: false,
  icon: Pill,
  features: [
    {
      key: 'pharmacy.pos',
      label: 'Pharmacy POS',
      description: 'Fast checkout for OTC and prescription drugs',
      href: '/dashboard/pharmacy/pos',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pharmacy.inventory',
      label: 'Drug Inventory',
      description: 'Batch tracking, expiry, FEFO stock management',
      href: '/dashboard/pharmacy/inventory',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pharmacy.patients',
      label: 'Patients',
      description: 'Patient registration and records',
      href: '/dashboard/pharmacy/patients',
      adminOnly: false,
      defaultOn: false,
    },
    {
      key: 'pharmacy.appointments',
      label: 'Appointments',
      description: 'Schedule and manage appointments',
      href: '/dashboard/pharmacy/appointments',
      adminOnly: false,
      defaultOn: false,
    },
    {
      key: 'pharmacy.billing',
      label: 'Billing',
      description: 'Patient billing and payments',
      href: '/dashboard/pharmacy/billing',
      adminOnly: false,
      defaultOn: false,
    },
  ],
}

// ── 5. Hospitality ─────────────────────────────────────────────────────────────
// Food and beverage management with serving-based inventory
export const HOSPITALITY_MODULE: ModuleDefinition = {
  key: 'hospitality',
  label: 'Hospitality',
  description: 'Restaurant, bar, and food service management',
  defaultOn: false,
  icon: UtensilsCrossed,
  features: [
    {
      key: 'hospitality.pos',
      label: 'POS',
      description: 'Point of sale with serving selection',
      href: '/dashboard/hospitality/pos',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'hospitality.orders',
      label: 'Orders',
      description: 'Order history and management',
      href: '/dashboard/hospitality/orders',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'hospitality.menu',
      label: 'Menu',
      description: 'Menu configuration and pricing',
      href: '/dashboard/hospitality/menu',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'hospitality.inventory',
      label: 'Inventory',
      description: 'Stock management with serving tracking',
      href: '/dashboard/hospitality/inventory',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'hospitality.stock',
      label: 'Stock Movements',
      description: 'Movement history and audit trail',
      href: '/dashboard/hospitality/stock',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'hospitality.production',
      label: 'Production',
      description: 'Kitchen/bar production logs',
      href: '/dashboard/hospitality/production',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'hospitality.reports',
      label: 'Reports',
      description: 'Sales, wastage, and variance analytics',
      href: '/dashboard/hospitality/reports',
      adminOnly: false,
      defaultOn: true,
    },
  ],
}

// ── Master module list ─────────────────────────────────────────────────────────
// Order determines sidebar rendering order.
export const MODULES: ModuleDefinition[] = [
  CORE_MODULE,
  RETAIL_MODULE,
  RENTALS_MODULE,
  PHARMACY_MODULE,
  HOSPITALITY_MODULE,
]

// ── Derived helpers ────────────────────────────────────────────────────────────

/** Flat list of all features across all modules */
export const ALL_FEATURES: ModuleFeature[] = MODULES.flatMap(m => m.features)

/** Default feature flags for new tenants: { 'pos.sales': true, ... } */
export const DEFAULT_MODULE_FEATURES: Record<string, boolean> = Object.fromEntries(
  ALL_FEATURES.map(f => [f.key, f.defaultOn])
)

// ── Legacy key compatibility ───────────────────────────────────────────────────
// Tenant feature documents and staff permission records may contain old flat keys
// (pre-dotted) or the previous dotted keys under the old module structure.
// This map ensures stored values continue to resolve correctly.
export const LEGACY_KEY_MAP: Record<string, string> = {
  // Pre-dotted flat keys (original migration)
  pos:            'pos.sales',
  rentals:        'rentals.bookings',
  orders:         'pos.orders',
  inventory:      'pos.inventory',
  reports:        'pos.reports',
  expenses:       'pos.expenses',
  // Core feature migrations (moved from pos.* to core.*)
  'pos.customers': 'core.customers',
  'pos.suppliers': 'core.suppliers',
  'pos.settings':  'core.settings',
}

/**
 * Normalises a features record that may contain old flat keys, new dotted keys,
 * or a mix of both. Always returns dotted keys with all known features present.
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
 * Given a set of selected module keys, returns a full feature flags record.
 * Accepts both old top-level keys ('pos') and new ones ('retail').
 */
export function modulesToFeatures(selectedModuleKeys: string[]): Record<string, boolean> {
  const normalised = selectedModuleKeys.map(k => {
    if (k === 'pos') return 'retail'
    return k
  })
  const out: Record<string, boolean> = {}
  for (const mod of MODULES) {
    const on = normalised.includes(mod.key)
    for (const f of mod.features) {
      out[f.key] = on
    }
  }
  return out
}

/**
 * Given a feature flags record, returns the set of new module keys that are
 * enabled (at least one feature in the module is true).
 * Returns 'retail', 'rentals', 'pharmacy'.
 */
export function featuresToModuleKeys(features: Record<string, boolean>): string[] {
  return MODULES
    .filter(mod => mod.features.some(f => features[f.key]))
    .map(mod => mod.key)
}

// ── Staff permission defaults ──────────────────────────────────────────────────

/** Default permissions for a new cashier/employee */
export const DEFAULT_STAFF_PERMISSIONS: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.stock-movements': true,
  'pos.reports':      false,
  'pos.expenses':     false,
  'core.customers':   false,
  'core.suppliers':   false,
  'core.restocking':  false,
  'rentals.bookings': false,
  'rentals.manage':   false,
  'pharmacy.pos':          false,
  'pharmacy.inventory':    false,
  'pharmacy.patients':     false,
  'pharmacy.appointments': false,
  'pharmacy.billing':      false,
  'hospitality.pos':        false,
  'hospitality.orders':     false,
  'hospitality.menu':       false,
  'hospitality.inventory':  false,
  'hospitality.stock':      false,
  'hospitality.production': false,
  'hospitality.reports':    false,
}

/** Default permissions for a manager */
export const DEFAULT_MANAGER_PERMISSIONS: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.stock-movements': true,
  'pos.reports':      true,
  'pos.expenses':     true,
  'core.customers':   true,
  'core.suppliers':   true,
  'core.restocking':  true,
  'rentals.bookings': false,
  'rentals.manage':   false,
  'pharmacy.pos':          false,
  'pharmacy.inventory':    false,
  'pharmacy.patients':     false,
  'pharmacy.appointments': false,
  'pharmacy.billing':      false,
  'hospitality.pos':        false,
  'hospitality.orders':     false,
  'hospitality.menu':       false,
  'hospitality.inventory':  false,
  'hospitality.stock':      false,
  'hospitality.production': false,
  'hospitality.reports':    false,
}

/** Normalises a permissions object — only keys explicitly set to true are granted */
export function normalisePermissions(raw: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  
  // First, apply legacy key mapping for backward compatibility
  const mapped: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k in LEGACY_KEY_MAP) {
      mapped[LEGACY_KEY_MAP[k]] = v
    } else {
      mapped[k] = v
    }
  }
  
  // Then, populate all known features
  for (const f of ALL_FEATURES) {
    out[f.key] = mapped[f.key] === true
  }
  
  return out
}
