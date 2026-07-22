# Phase 1 — Target Ownership Map

Every file and directory area of the codebase assigned to one owner category.

## Platform

### Library (`lib/`)
- `lib/jwt.ts` — auth token creation, verification, cookie management
- `lib/auth.ts` — legacy token helpers (still imported by some routes)
- `lib/permissions.ts` — role-based permission presets (legacy, still read)
- `lib/db.ts` — main and admin DB connections
- `lib/db-tenant.ts` — per-tenant connection pool
- `lib/mongodb.ts` — early cached connection helper (legacy, still used by some routes)
- `lib/admin-models.ts` — Tenant and Cluster models for admin DB
- `lib/tenant/get-db.ts` — per-request tenant DB resolver
- `lib/tenant/get-models.ts` — model factory, binds schemas to a connection
- `lib/models/schemas.ts` — all Mongoose schema definitions (shared by all modules)
- `lib/modules.ts` — module/feature registry, permission defaults, normalisation
- `lib/features.ts` — backward-compat re-exports from modules.ts
- `lib/branch-middleware.ts` — branch context extraction helpers
- `lib/indexeddb.ts` — offline storage (products, pending sales, conflicts)
- `lib/sync.ts` — pending-sale sync engine
- `lib/pwa-update.ts` — PWA update handling
- `lib/backup.ts` — data backup utilities
- `lib/media-upload.ts` — fecy.co.ke upload client
- `lib/media-url.ts` — URL resolution for stored media paths
- `lib/mpesa.ts` — M-Pesa Daraja API (STK Push, query)
- `lib/demo.ts` — demo user, demo data accessors
- `lib/utils.ts` — general utilities (cn, etc.)
- `lib/barcode-scanner/` — keyboard detector, scan queue, processor, state machine, types

### Components
- `components/ui/` — shadcn/ui primitives
- `components/auth/` — PermissionGuard, ModuleGuard, LoginForm
- `components/barcode/` — CameraScanner, ManualBarcodeEntry, ScannerFeedback
- `components/pwa/` — ServiceWorkerRegister, InstallPrompt, BackupPermissionDialog, ConflictNotification, PWADebug
- `components/demo/` — DemoBanner
- `components/branch-selector.tsx`
- `components/theme-provider.tsx`
- `components/dashboard/sidebar.tsx`
- `components/dashboard/top-nav.tsx`

### Hooks
- `hooks/use-barcode-scanner.ts`
- `hooks/use-offline.ts`
- `hooks/use-mobile.tsx`
- `hooks/use-toast.ts`

### API Routes
- `app/api/auth/*` — login, staff-login, logout, me, register, select-branch
- `app/api/tenant/config` — feature flags from JWT
- `app/api/branches/*` — branch CRUD
- `app/api/media/upload` — media proxy
- `app/api/mpesa/*` — STK push, callback
- `app/api/settings` — tenant settings CRUD
- `app/api/demo/*` — static demo data endpoints
- `app/api/dashboard/stats` — cross-module aggregated dashboard

### App
- `app/layout.tsx` — root layout, PWA metadata
- `app/page.tsx` — public landing page
- `app/auth/` — login, register, demo auth pages
- `app/dashboard/layout.tsx` — dashboard shell (sidebar + topnav + toaster)
- `app/dashboard/page.tsx` — main dashboard overview
- `app/dashboard/staff/` — staff management (owned by Platform, not any single module)
- `app/dashboard/settings/` — tenant settings

### Scripts
- `scripts/migrate-tenant-features.ts` — legacy key migration
- `scripts/migrate-permissions.ts` — legacy permission migration
- `scripts/migrate-data-ownership.js` — data ownership repair
- `scripts/enable-bar-features.ts` — bulk feature enable
- `scripts/list-users.js` — diagnostic

---

## Retail

### Pages
- `app/dashboard/sales/` — **implementation** of POS cart + payment
- `app/dashboard/orders/` — order history
- `app/dashboard/inventory/` — product management
- `app/dashboard/reports/` — sales/inventory/profit reports
- `app/dashboard/expenses/` — expense tracking
- `app/dashboard/customers/` — customer credit management
- `app/dashboard/retail/` — canonical route re-exports (all point to above)

### API Routes
- `app/api/products/*` — CRUD, barcode lookup, image upload, CSV import
- `app/api/sales/*` — sale CRUD
- `app/api/categories/*` — category CRUD + sync
- `app/api/customers/*` — customer CRUD + credit
- `app/api/expenses/*` — expense CRUD + categories
- `app/api/reports` — report generation
- `app/api/inventory/*` — stock adjustments, transactions, reconstruct

### Components
- `components/sales/` — FloatingCartButton, HeldOrders, Receipt, OrderCompletionDialog
- `components/inventory/` — inventory-specific components

### Library
- `lib/inventory-service.ts` — shared between Retail and Pharmacy (stock transaction helpers)
- `lib/column-mapper.ts` — CSV column mapping for product import

---

## Service → Kitchen

### Pages
- `app/dashboard/kds/` — **implementations** of all KDS views
- `app/dashboard/service/kitchen/` — canonical route re-exports

### API Routes
- `app/api/kds/*` — orders, menu, inventory import, create-order, tables, status updates

### Components
- `components/kds/` — OrderCard and KDS-specific UI

### Library
- `lib/kds-utils.ts` — stat computation, time formatting
- `types/kds.ts` — KDS type definitions

### Hooks
- `hooks/useKDS.ts` — KDS data fetching

---

## Service → Bar

### Pages
- `app/dashboard/bar/` — **implementations** of all bar pages
- `app/dashboard/service/bar/` — canonical route re-exports

### API Routes
- `app/api/bar/*` — brands, inventory-items, servings, bottles, tabs, tab-lines, payments, close, sale, reports

### Components
- `components/bar/` — LandingPage, TabDetailPage, TabCard, QuickSalePage, and all bar UI

### Store
- `store/bar-store.ts` — Zustand store for bar tab state

### Library
- `lib/bar/` — TabManager, InventoryEngine, ServingEngine, PaymentHandler service layer

---

## Rentals

### Pages
- `app/dashboard/rental-services/` — new booking system (RentalService + RentalBooking)
- `app/dashboard/rentals/` — legacy product-based rentals

### API Routes
- `app/api/rental-services/*` — RentalService CRUD
- `app/api/rental-bookings/*` — RentalBooking CRUD + checkout
- `app/api/rentals/*` — legacy Rental CRUD + return

---

## Pharmacy

### Pages
- `app/dashboard/pharmacy/pos/` — pharmacy POS
- `app/dashboard/pharmacy/inventory/` — drug catalog + batch management
- `app/dashboard/pharmacy/patients/` — placeholder only
- `app/dashboard/pharmacy/appointments/` — placeholder only
- `app/dashboard/pharmacy/billing/` — placeholder only

### API Routes
- `app/api/pharmacy/drugs/*` — drug catalog CRUD
- `app/api/pharmacy/batches/*` — batch receiving, recall, history
- `app/api/pharmacy/sale` — FEFO sale processing

---

## Admin Control Plane

### Pages
- `app/admin/` — login, tenants CRUD, clusters CRUD

### API Routes
- `app/api/admin/*` — tenant CRUD, cluster CRUD, auth, provision, update-owner

### Library
- `lib/admin-models.ts` — Tenant and Cluster Mongoose models

---

## Legacy (retained, not promoted)

| Area | Reason retained |
|---|---|
| `app/dashboard/hms/` (empty dirs) | Directory structure preserved; no pages inside |
| `app/dashboard/rentals/` legacy rental | Still in use alongside new rental-services system |
| `lib/modules.ts` LEGACY_KEY_MAP | Required for backward compat with stored tenant/staff records |
| `lib/auth.ts` | Still imported by several API routes; not removed |
| `lib/mongodb.ts` | Used by a small number of routes; not removed |
| `scripts/migrate-*.ts` | One-time migration tools; kept for reference |

---

## Deferred (documented, not built)

See `04-deferred-register.md` for full detail.

- HMS module
- Pharmacy patients / appointments / billing
- Bar reports: bottle-differences and products-sold APIs
- Bar quick-sale (behind `bar.newui` flag)
- Wines & Spirits standalone module design docs
