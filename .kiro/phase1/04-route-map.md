# Phase 1 — Route Migration Map

## Strategy

Old routes are **not removed or redirected**. They continue to render the real page implementation directly. New canonical routes are thin `export { default }` re-exports pointing to the implementations at the old paths.

This means:
- No `redirect()` calls were added — no extra network round-trips
- Bookmarks, PWA shortcuts, and saved links all continue to work
- The sidebar now points to canonical new paths
- The sidebar's `LEGACY_ACTIVE_MAP` highlights the correct item when a user lands on an old path

---

## Retail

| Old path (still works) | New canonical path | Implementation file |
|---|---|---|
| `/dashboard/sales` | `/dashboard/retail/sales` | `app/dashboard/sales/page.tsx` |
| `/dashboard/sales/payment` | `/dashboard/retail/sales/payment` | `app/dashboard/sales/payment/page.tsx` |
| `/dashboard/orders` | `/dashboard/retail/orders` | `app/dashboard/orders/page.tsx` |
| `/dashboard/inventory` | `/dashboard/retail/inventory` | `app/dashboard/inventory/page.tsx` |
| `/dashboard/reports` | `/dashboard/retail/reports` | `app/dashboard/reports/page.tsx` |
| `/dashboard/expenses` | `/dashboard/retail/expenses` | `app/dashboard/expenses/page.tsx` |
| `/dashboard/customers` | `/dashboard/retail/customers` | `app/dashboard/customers/page.tsx` |

---

## Service → Kitchen

| Old path (still works) | New canonical path | Implementation file |
|---|---|---|
| `/dashboard/kds` | `/dashboard/service/kitchen` | `app/dashboard/kds/page.tsx` |
| `/dashboard/kds/orders` | `/dashboard/service/kitchen/orders` | `app/dashboard/kds/orders/page.tsx` |
| `/dashboard/kds/chef` | `/dashboard/service/kitchen/chef` | `app/dashboard/kds/chef/page.tsx` |
| `/dashboard/kds/waiter` | `/dashboard/service/kitchen/waiter` | `app/dashboard/kds/waiter/page.tsx` |
| `/dashboard/kds/history` | `/dashboard/service/kitchen/history` | `app/dashboard/kds/history/page.tsx` |
| `/dashboard/kds/menu` | `/dashboard/service/kitchen/menu` | `app/dashboard/kds/menu/page.tsx` |
| `/dashboard/kds/inventory` | `/dashboard/service/kitchen/inventory` | `app/dashboard/kds/inventory/page.tsx` |

---

## Service → Bar

| Old path (still works) | New canonical path | Implementation file |
|---|---|---|
| `/dashboard/bar` | `/dashboard/service/bar` | `app/dashboard/bar/page.tsx` |
| `/dashboard/bar/tabs/[id]` | `/dashboard/service/bar/tabs/[id]` | `app/dashboard/bar/tabs/[id]/page.tsx` |
| `/dashboard/bar/inventory` | `/dashboard/service/bar/inventory` | `app/dashboard/bar/inventory/page.tsx` |
| `/dashboard/bar/inventory/new` | `/dashboard/service/bar/inventory/new` | `app/dashboard/bar/inventory/new/page.tsx` |
| `/dashboard/bar/inventory/[id]` | `/dashboard/service/bar/inventory/[id]` | `app/dashboard/bar/inventory/[id]/page.tsx` |
| `/dashboard/bar/brands` | `/dashboard/service/bar/brands` | `app/dashboard/bar/brands/page.tsx` |
| `/dashboard/bar/brands/[id]` | `/dashboard/service/bar/brands/[id]` | `app/dashboard/bar/brands/[id]/page.tsx` |
| `/dashboard/bar/reports` | `/dashboard/service/bar/reports` | `app/dashboard/bar/reports/page.tsx` |

---

## Rentals (unchanged — no new canonical paths)

| Path | Implementation file | Notes |
|---|---|---|
| `/dashboard/rental-services` | `app/dashboard/rental-services/page.tsx` | New booking system |
| `/dashboard/rentals` | `app/dashboard/rentals/page.tsx` | Legacy product-based |

---

## Pharmacy (unchanged)

| Path | Implementation file | Notes |
|---|---|---|
| `/dashboard/pharmacy/pos` | `app/dashboard/pharmacy/pos/page.tsx` | Operational |
| `/dashboard/pharmacy/inventory` | `app/dashboard/pharmacy/inventory/page.tsx` | Operational |
| `/dashboard/pharmacy/patients` | `app/dashboard/pharmacy/patients/page.tsx` | Placeholder |
| `/dashboard/pharmacy/appointments` | `app/dashboard/pharmacy/appointments/page.tsx` | Placeholder |
| `/dashboard/pharmacy/billing` | `app/dashboard/pharmacy/billing/page.tsx` | Placeholder |

---

## Platform routes (unchanged)

| Path | Notes |
|---|---|
| `/dashboard` | Main dashboard |
| `/dashboard/staff` | Staff management |
| `/dashboard/settings` | Shop settings |
| `/auth/login`, `/auth/register`, `/auth/demo` | Auth flows |
| `/admin/*` | Admin control plane |

---

## Sidebar active-path mapping (LEGACY_ACTIVE_MAP)

The sidebar component uses this map to highlight the correct item when a user arrives via an old bookmark:

| Canonical sidebar href | Legacy paths that also activate it |
|---|---|
| `/dashboard/retail/sales` | `/dashboard/sales` |
| `/dashboard/retail/orders` | `/dashboard/orders` |
| `/dashboard/retail/inventory` | `/dashboard/inventory` |
| `/dashboard/retail/reports` | `/dashboard/reports` |
| `/dashboard/retail/expenses` | `/dashboard/expenses` |
| `/dashboard/retail/customers` | `/dashboard/customers` |
| `/dashboard/service/kitchen/orders` | `/dashboard/kds/orders`, `/dashboard/kds` |
| `/dashboard/service/kitchen/chef` | `/dashboard/kds/chef` |
| `/dashboard/service/kitchen/waiter` | `/dashboard/kds/waiter` |
| `/dashboard/service/kitchen/history` | `/dashboard/kds/history` |
| `/dashboard/service/kitchen/menu` | `/dashboard/kds/menu` |
| `/dashboard/service/kitchen/inventory` | `/dashboard/kds/inventory` |
| `/dashboard/service/bar` | `/dashboard/bar` |
| `/dashboard/service/bar/inventory` | `/dashboard/bar/inventory` |
| `/dashboard/service/bar/brands` | `/dashboard/bar/brands` |
| `/dashboard/service/bar/reports` | `/dashboard/bar/reports` |

---

## API routes — no changes

All API routes remain at their original paths. Frontend reorganisation does not require API renaming.

```
/api/products/*
/api/sales/*
/api/categories/*
/api/customers/*
/api/expenses/*
/api/reports
/api/inventory/*
/api/kds/*
/api/bar/*
/api/rentals/*
/api/rental-services/*
/api/rental-bookings/*
/api/pharmacy/*
/api/auth/*
/api/admin/*
/api/settings
/api/branches/*
/api/media/*
/api/mpesa/*
/api/tenant/config
/api/dashboard/stats
/api/demo/*
```
