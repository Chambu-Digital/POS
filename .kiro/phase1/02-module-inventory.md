# Phase 1 — Current-State Module Inventory

## Classification key

| Symbol | Meaning |
|---|---|
| ✅ | Implemented and operational |
| 🔶 | Implemented but partially broken |
| 🔲 | Placeholder only — page exists, no functionality |
| 🗂️ | Infrastructure / supporting code only |
| ❌ | Empty / absent |

---

## Platform Layer

| Area | Status | Location |
|---|---|---|
| Owner login | ✅ | `app/api/auth/login` |
| Staff login | ✅ | `app/api/auth/staff-login` |
| Register | ✅ | `app/api/auth/register` |
| Logout | ✅ | `app/api/auth/logout` |
| Me / session | ✅ | `app/api/auth/me` |
| Branch selection | ✅ | `app/api/auth/select-branch` |
| JWT / cookies | ✅ | `lib/jwt.ts` |
| Tenant DB resolution | ✅ | `lib/tenant/get-db.ts`, `lib/db-tenant.ts` |
| Model factory | ✅ | `lib/tenant/get-models.ts` |
| Admin DB | ✅ | `lib/admin-models.ts`, `lib/db.ts` |
| Feature flags | ✅ | `lib/modules.ts` — `normaliseFeatures()` |
| Permission model | ✅ | `lib/modules.ts` — `normalisePermissions()` |
| Module guard | ✅ | `components/auth/module-guard.tsx` |
| Permission guard | ✅ | `components/auth/permission-guard.tsx` |
| IndexedDB (offline) | ✅ | `lib/indexeddb.ts` |
| Sync engine | ✅ | `lib/sync.ts` |
| Service worker / PWA | ✅ | `components/pwa/*`, `public/manifest.json` |
| M-Pesa STK Push | ✅ | `lib/mpesa.ts`, `app/api/mpesa/*` |
| Media upload | ✅ | `lib/media-upload.ts`, `app/api/media/upload` |
| Barcode scanner (keyboard) | ✅ | `lib/barcode-scanner/*`, `hooks/use-barcode-scanner.ts` |
| Barcode scanner (camera) | ✅ | `components/barcode/camera-scanner.tsx` |
| Receipt / printing | ✅ | `components/sales/receipt.tsx` |
| Demo mode | ✅ | `lib/demo.ts`, `proxy.ts`, `app/api/demo/*` |
| Settings | ✅ | `app/api/settings`, `app/dashboard/settings` |
| Staff management | ✅ | `app/api/staff/*`, `app/dashboard/staff` |
| Branch management | ✅ | `app/api/branches/*` |
| Sidebar navigation | ✅ | `components/dashboard/sidebar.tsx` |
| Dashboard layout | ✅ | `app/dashboard/layout.tsx` |
| Main dashboard page | ✅ | `app/dashboard/page.tsx` |
| Landing / marketing page | ✅ | `app/page.tsx` |

---

## Retail Module (`pos.*`)

| Feature | Status | Canonical Route | Legacy Route |
|---|---|---|---|
| Make Sale (POS cart) | ✅ | `/dashboard/retail/sales` | `/dashboard/sales` |
| Payment flow | ✅ | `/dashboard/retail/sales/payment` | `/dashboard/sales/payment` |
| Order history | ✅ | `/dashboard/retail/orders` | `/dashboard/orders` |
| Inventory management | ✅ | `/dashboard/retail/inventory` | `/dashboard/inventory` |
| Reports | ✅ | `/dashboard/retail/reports` | `/dashboard/reports` |
| Expenses | ✅ | `/dashboard/retail/expenses` | `/dashboard/expenses` |
| Customers + credit | ✅ | `/dashboard/retail/customers` | `/dashboard/customers` |
| Product import (CSV) | ✅ | via `/dashboard/retail/inventory` | — |
| Barcode lookup | ✅ | `app/api/products/barcode/[code]` | — |
| Product images | ✅ | `app/api/products/[id]/images` | — |
| Offline sale queue | ✅ | `lib/indexeddb.ts`, `lib/sync.ts` | — |
| Held orders | ✅ | `components/sales/held-orders.tsx` | — |

---

## Service Module — Kitchen sub-domain (`kds.*`)

| Feature | Status | Canonical Route | Legacy Route |
|---|---|---|---|
| Create kitchen order (waiter) | ✅ | `/dashboard/service/kitchen/orders` | `/dashboard/kds/orders` |
| Chef view | ✅ | `/dashboard/service/kitchen/chef` | `/dashboard/kds/chef` |
| Waiter view | ✅ | `/dashboard/service/kitchen/waiter` | `/dashboard/kds/waiter` |
| Order history | ✅ | `/dashboard/service/kitchen/history` | `/dashboard/kds/history` |
| Menu management | ✅ | `/dashboard/service/kitchen/menu` | `/dashboard/kds/menu` |
| Kitchen inventory | ✅ | `/dashboard/service/kitchen/inventory` | `/dashboard/kds/inventory` |
| Menu CSV import | ✅ | `app/api/kds/menu/import` | — |
| Inventory CSV import | ✅ | `app/api/kds/inventory/import` | — |
| Table/section API | ✅ | `app/api/kds/tables` | — |
| Real-time polling | ✅ | 5-second interval in chef/waiter pages | — |

Note: KDS inventory page (`kds.inventory`) reads from `/api/products` — it shares the Retail product catalog, not a separate restaurant-specific inventory.

---

## Service Module — Bar sub-domain (`bar.*`)

| Feature | Status | Canonical Route | Legacy Route |
|---|---|---|---|
| Bar tabs landing | ✅ | `/dashboard/service/bar` | `/dashboard/bar` |
| Tab detail (lines + payment) | ✅ | `/dashboard/service/bar/tabs/[id]` | `/dashboard/bar/tabs/[id]` |
| Bar inventory items | ✅ | `/dashboard/service/bar/inventory` | `/dashboard/bar/inventory` |
| Bar inventory item detail | ✅ | `/dashboard/service/bar/inventory/[id]` | `/dashboard/bar/inventory/[id]` |
| New inventory item | ✅ | `/dashboard/service/bar/inventory/new` | `/dashboard/bar/inventory/new` |
| Brands management | ✅ | `/dashboard/service/bar/brands` | `/dashboard/bar/brands` |
| Brand detail | ✅ | `/dashboard/service/bar/brands/[id]` | `/dashboard/bar/brands/[id]` |
| Bar reports | 🔶 | `/dashboard/service/bar/reports` | `/dashboard/bar/reports` |
| Quick sale | 🗂️ | `/dashboard/bar/quick-sale` (gated by `bar.newui`) | — |
| Outstanding total API | ✅ | `app/api/bar/reports/outstanding` | — |
| Bottle differences API | ❌ | Not implemented — page call fails silently | — |
| Products sold API | ❌ | Not implemented — page call fails silently | — |

---

## Rentals Module (`rentals.*`)

| Feature | Status | Route |
|---|---|---|
| Rental services catalog | ✅ | `/dashboard/rental-services` |
| New booking flow | ✅ | `/dashboard/rental-services` (New Booking tab) |
| Booking management | ✅ | `/dashboard/rental-services` (Bookings tab) |
| Checkout / payment | ✅ | Via CheckoutDialog in rental-services page |
| Legacy product-based rental | ✅ | `/dashboard/rentals` |
| Legacy return flow | ✅ | Via return dialog in rentals page |
| Rental slip receipt | ✅ | `components/sales/receipt.tsx` (rental_slip type) |
| Return receipt | ✅ | `components/sales/receipt.tsx` (rental_return type) |
| Rental-linked Sale records | ✅ | `source: 'rental'` on Sale documents |

---

## Pharmacy Module (`pharmacy.*`)

| Feature | Status | Route |
|---|---|---|
| Pharmacy POS | ✅ | `/dashboard/pharmacy/pos` |
| Drug inventory + batch management | ✅ | `/dashboard/pharmacy/inventory` |
| Receive stock (new batch) | ✅ | Via dialog in inventory page |
| FEFO sale deduction | ✅ | `app/api/pharmacy/sale` |
| Expiry tracking + alerts | ✅ | Inventory page tabs |
| Batch recall (individual) | ✅ | Inventory page |
| Global lot recall | ✅ | `app/api/pharmacy/batches/recall` |
| Batch history | ✅ | `app/api/pharmacy/batches/[id]/history` |
| Inventory transactions ledger | ✅ | `app/api/inventory/transactions` |
| Patients | 🔲 | `/dashboard/pharmacy/patients` — "Coming soon" |
| Appointments | 🔲 | `/dashboard/pharmacy/appointments` — "Coming soon" |
| Billing | 🔲 | `/dashboard/pharmacy/billing` — "Coming soon" |

---

## Admin Control Plane

| Area | Status | Route |
|---|---|---|
| Admin login | ✅ | `/admin/login` |
| Tenant list | ✅ | `/admin/tenants` |
| Create tenant | ✅ | `/admin/tenants/new` |
| Edit tenant / features | ✅ | `/admin/tenants/[id]` |
| Provision owner account | ✅ | `app/api/admin/tenants/[id]/provision` |
| Update owner credentials | ✅ | `app/api/admin/tenants/[id]/update-owner` |
| Cluster management | ✅ | `/admin/clusters`, `app/api/admin/clusters/*` |

---

## HMS (Hotel Management System)

| Area | Status | Location |
|---|---|---|
| HMS module | ❌ | `app/dashboard/hms/*` — three empty folders, zero files |
