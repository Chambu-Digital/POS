// ─── Module definitions ────────────────────────────────────────────────────────
// Single source of truth for:
//   - Sidebar grouping and navigation
//   - Admin tenant feature toggles (grouped by module)
//   - Staff permission checkboxes (grouped by module)
//
// Phase 1 reorganisation
// ──────────────────────
// User-facing modules are now: Retail, Service, Rentals, Pharmacy.
// "Service" consolidates KDS (Kitchen) and Bar into one workspace.
//
// Internal feature/permission keys are UNCHANGED:
//   pos.*        — Retail features
//   kds.*        — Service → Kitchen features
//   bar.*        — Service → Bar features
//   rentals.*    — Rentals features
//   pharmacy.*   — Pharmacy features
//
// All stored tenant feature documents and staff permission records continue to
// work without any database migration — the key strings are preserved verbatim.
//
// The only change visible to the user is the navigation grouping and labels.

import {
  ShoppingCart,
  UtensilsCrossed,
  BedDouble,
  Pill,
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

// ── Service sub-domain marker ──────────────────────────────────────────────────
// Features inside the Service module carry a subDomain so the sidebar can
// render separate Kitchen and Bar sections within the single Service group.
export type ServiceSubDomain = 'kitchen' | 'bar'

export interface ServiceModuleFeature extends ModuleFeature {
  subDomain: ServiceSubDomain
}

export interface ModuleDefinition {
  /** Top-level module key, e.g. 'retail', 'service', 'rentals', 'pharmacy' */
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
    {
      key: 'pos.customers',
      label: 'Customers',
      description: 'Customer management and credit accounts',
      href: '/dashboard/retail/customers',
      adminOnly: false,
      defaultOn: true,
    },
    {
      key: 'pos.suppliers',
      label: 'Suppliers',
      description: 'Manage suppliers and track purchases',
      href: '/dashboard/retail/suppliers',
      adminOnly: true,
      defaultOn: true,
    },
    {
      key: 'pos.settings',
      label: 'Settings',
      description: 'Shop settings and configuration',
      href: '/dashboard/settings',
      adminOnly: true,
      defaultOn: true,
    },
  ],
}

// ── 2. Service (consolidates KDS + Bar) ───────────────────────────────────────
// Internal keys remain kds.* and bar.* — no stored data changes required.
// Features carry a `subDomain` property used by the sidebar to render
// nested "Kitchen" and "Bar" sections within the Service group.
export const SERVICE_MODULE: ModuleDefinition & { features: ServiceModuleFeature[] } = {
  key: 'service',
  label: 'Service',
  description: 'Kitchen display and bar tab management',
  defaultOn: true,
  icon: UtensilsCrossed,
  features: [
    // ── Kitchen sub-domain ──────────────────────────────────────────────────
    {
      key: 'kds.menu',
      label: 'Menu Management',
      description: 'Manage restaurant menu items',
      href: '/dashboard/service/kitchen/menu',
      adminOnly: true,
      defaultOn: true,
      subDomain: 'kitchen',
    },
    {
      key: 'kds.inventory',
      label: 'Kitchen Inventory',
      description: 'Track restaurant stock and supplies',
      href: '/dashboard/service/kitchen/inventory',
      adminOnly: true,
      defaultOn: true,
      subDomain: 'kitchen',
    },
    {
      key: 'kds.orders',
      label: 'Create Order',
      description: 'Waiter creates new kitchen orders',
      href: '/dashboard/service/kitchen/orders',
      adminOnly: false,
      defaultOn: true,
      subDomain: 'kitchen',
    },
    {
      key: 'kds.chef',
      label: 'Chef View',
      description: 'Kitchen display for chefs',
      href: '/dashboard/service/kitchen/chef',
      adminOnly: false,
      defaultOn: true,
      subDomain: 'kitchen',
    },
    {
      key: 'kds.waiter',
      label: 'Waiter View',
      description: 'Order pickup and serving',
      href: '/dashboard/service/kitchen/waiter',
      adminOnly: false,
      defaultOn: true,
      subDomain: 'kitchen',
    },
    {
      key: 'kds.history',
      label: 'Kitchen History',
      description: 'View all kitchen orders',
      href: '/dashboard/service/kitchen/history',
      adminOnly: false,
      defaultOn: true,
      subDomain: 'kitchen',
    },
    // ── Bar sub-domain ──────────────────────────────────────────────────────
    {
      key: 'bar.tabs',
      label: 'POS',
      description: 'Bar point of sale — sell drinks and servings',
      href: '/dashboard/bar/pos',
      adminOnly: false,
      defaultOn: true,
      subDomain: 'bar',
    },
    {
      key: 'bar.inventory',
      label: 'Inventory',
      description: 'Manage bar inventory and stock',
      href: '/dashboard/service/bar/inventory',
      adminOnly: true,
      defaultOn: true,
      subDomain: 'bar',
    },
    {
      key: 'bar.reports',
      label: 'Reports',
      description: 'View bar sales and performance reports',
      href: '/dashboard/service/bar/reports',
      adminOnly: true,
      defaultOn: true,
      subDomain: 'bar',
    },
    {
      key: 'bar.admin',
      label: 'Administration',
      description: 'Manage brands and bar settings',
      href: '/dashboard/service/bar/brands',
      adminOnly: true,
      defaultOn: true,
      subDomain: 'bar',
    },
    {
      key: 'bar.customers',
      label: 'Customers',
      description: 'Manage bar customers and credit accounts',
      href: '/dashboard/retail/customers',
      adminOnly: false,
      defaultOn: true,
      subDomain: 'bar',
    },
  ],
}

// ── 3. Rentals ─────────────────────────────────────────────────────────────────
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

// ── Master module list ─────────────────────────────────────────────────────────
// Order determines sidebar rendering order.
export const MODULES: ModuleDefinition[] = [
  RETAIL_MODULE,
  SERVICE_MODULE,
  RENTALS_MODULE,
  PHARMACY_MODULE,
]

// ── Derived helpers ────────────────────────────────────────────────────────────

/** Flat list of all features across all modules */
export const ALL_FEATURES: ModuleFeature[] = MODULES.flatMap(m => m.features)

/** Default feature flags for new tenants: { 'pos.sales': true, 'bar.tabs': true, ... } */
export const DEFAULT_MODULE_FEATURES: Record<string, boolean> = Object.fromEntries(
  ALL_FEATURES.map(f => [f.key, f.defaultOn])
)

// ── Legacy key compatibility ───────────────────────────────────────────────────
// Tenant feature documents and staff permission records may contain old flat keys
// (pre-dotted) or the previous dotted keys under the old module structure.
// This map ensures stored values continue to resolve correctly.
//
// IMPORTANT: The internal kds.* and bar.* keys have NOT changed — only the
// user-facing module grouping changed from "KDS"/"Bar" to "Service → Kitchen"
// /"Service → Bar". No new legacy entries are needed for this reorganisation.
export const LEGACY_KEY_MAP: Record<string, string> = {
  // Pre-dotted flat keys (original migration)
  pos:            'pos.sales',
  kitchenDisplay: 'kds.chef',
  bar:            'bar.tabs',
  rentals:        'rentals.bookings',
  orders:         'pos.orders',
  inventory:      'pos.inventory',
  reports:        'pos.reports',
  expenses:       'pos.expenses',
  // Old dotted artefacts from earlier migration scripts
  'kds.display':  'kds.chef',
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
  // Backward compat: existing tenants with bar enabled retain all bar sub-features.
  if (raw['bar'] === true || raw['bar.tabs'] === true) {
    out['bar.tabs']      = true
    out['bar.inventory'] = true
    out['bar.reports']   = true
    out['bar.admin']     = true
  }
  return out
}

/**
 * Given a set of selected module keys, returns a full feature flags record.
 * Accepts both old top-level keys ('pos', 'kds') and new ones ('retail', 'service').
 */
export function modulesToFeatures(selectedModuleKeys: string[]): Record<string, boolean> {
  const normalised = selectedModuleKeys.map(k => {
    if (k === 'pos') return 'retail'
    if (k === 'kds') return 'service'
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
 * Returns 'retail', 'service', 'rentals', 'pharmacy'.
 */
export function featuresToModuleKeys(features: Record<string, boolean>): string[] {
  return MODULES
    .filter(mod => mod.features.some(f => features[f.key]))
    .map(mod => mod.key)
}

// ── Service sub-domain helpers ─────────────────────────────────────────────────

/** Returns only the Kitchen features from the Service module. */
export function getKitchenFeatures(): ServiceModuleFeature[] {
  return (SERVICE_MODULE.features as ServiceModuleFeature[]).filter(
    f => f.subDomain === 'kitchen'
  )
}

/** Returns only the Bar features from the Service module. */
export function getBarFeatures(): ServiceModuleFeature[] {
  return (SERVICE_MODULE.features as ServiceModuleFeature[]).filter(
    f => f.subDomain === 'bar'
  )
}

// ── Staff permission defaults ──────────────────────────────────────────────────
// Internal keys are unchanged — these match existing stored staff records.

/** Default permissions for a new cashier/employee */
export const DEFAULT_STAFF_PERMISSIONS: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.stock-movements': true,
  'pos.reports':      false,
  'pos.expenses':     false,
  'pos.customers':    false,
  'pos.suppliers':    false,
  'kds.orders':       true,
  'kds.chef':         true,
  'kds.waiter':       true,
  'kds.history':      true,
  'kds.menu':         false,
  'kds.inventory':    false,
  'bar.tabs':         true,
  'bar.inventory':    false,
  'bar.reports':      false,
  'bar.admin':        false,
  'bar.customers':    false,
  'rentals.bookings': false,
  'rentals.manage':   false,
  'pharmacy.pos':          false,
  'pharmacy.inventory':    false,
  'pharmacy.patients':     false,
  'pharmacy.appointments': false,
  'pharmacy.billing':      false,
}

/** Default permissions for a manager */
export const DEFAULT_MANAGER_PERMISSIONS: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.stock-movements': true,
  'pos.reports':      true,
  'pos.expenses':     true,
  'pos.customers':    true,
  'pos.suppliers':    true,
  'kds.orders':       true,
  'kds.chef':         true,
  'kds.waiter':       true,
  'kds.history':      true,
  'kds.menu':         false,
  'kds.inventory':    false,
  'bar.tabs':         false,
  'bar.inventory':    false,
  'bar.reports':      false,
  'bar.admin':        false,
  'bar.customers':    true,
  'rentals.bookings': false,
  'rentals.manage':   false,
  'pharmacy.pos':          false,
  'pharmacy.inventory':    false,
  'pharmacy.patients':     false,
  'pharmacy.appointments': false,
  'pharmacy.billing':      false,
}

/** Normalises a permissions object — only keys explicitly set to true are granted */
export function normalisePermissions(raw: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const f of ALL_FEATURES) {
    out[f.key] = raw[f.key] === true
  }
  return out
}
