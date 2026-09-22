// ── Cashier Routes Configuration ──────────────────────────────────────────────
// Routes that cashiers can access in offline-first mode without permission checks
// These routes are aggressively cached by the service worker

export const CASHIER_ALLOWED_ROUTES = [
  '/dashboard',
  '/dashboard/sales',
  '/dashboard/retail/sales',
  '/dashboard/customers',
  '/dashboard/retail/customers',
] as const

export type CashierRoute = typeof CASHIER_ALLOWED_ROUTES[number]

/**
 * Check if a route is allowed for cashier mode
 */
export function isCashierRoute(pathname: string): boolean {
  return CASHIER_ALLOWED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

/**
 * Get all permissions that a cashier should have based on allowed routes
 * This creates a static permission set for offline operation
 */
export function getCashierPermissions(): Record<string, boolean> {
  return {
    // Core
    'core.customers': true,
    
    // Retail/POS
    'pos.sales': true,
    'pos.orders': true,      // View orders (read-only for cashiers typically)
    
    // Explicitly deny admin features
    'core.staff': false,
    'core.settings': false,
    'pos.inventory': false,  // Typically cashiers shouldn't edit inventory
    'pos.reports': false,
    'pos.expenses': false,
  }
}
