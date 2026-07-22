# Chambu POS — Phase 1 Platform Architecture

## Overview

Chambu POS is a multi-tenant SaaS point-of-sale platform built with Next.js (App Router), MongoDB/Mongoose, React 19, and TypeScript. After Phase 1 reorganisation it is structured as a **platform layer** hosting four **business modules**.

---

## Two-Layer Model

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN CONTROL PLANE  (/admin, /api/admin)                   │
│  Separate hostname protection. Tenant + cluster management.  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  PLATFORM LAYER                                              │
│  Auth · Tenancy · Permissions · PWA · Offline · Payments     │
│  Media · Printing · Shared UI · Demo mode                    │
└──────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼─────────────────────┐
          ▼                   ▼                     ▼
┌──────────────┐  ┌──────────────────────┐  ┌──────────────┐  ┌──────────────┐
│   RETAIL     │  │      SERVICE         │  │   RENTALS    │  │  PHARMACY    │
│              │  │  ┌────────────────┐  │  │              │  │              │
│  pos.* keys  │  │  │ Kitchen (kds.*)│  │  │ rentals.*    │  │ pharmacy.*   │
│              │  │  ├────────────────┤  │  │ keys         │  │ keys         │
│              │  │  │  Bar   (bar.*) │  │  │              │  │              │
│              │  │  └────────────────┘  │  │              │  │              │
└──────────────┘  └──────────────────────┘  └──────────────┘  └──────────────┘
```

---

## Platform Layer

The platform layer owns infrastructure used across all modules. Its components are not tied to any single business domain.

### Sub-areas

| Sub-area | Key files |
|---|---|
| Authentication | `lib/jwt.ts`, `lib/auth.ts`, `app/api/auth/*` |
| Multi-tenancy | `lib/db.ts`, `lib/db-tenant.ts`, `lib/admin-models.ts`, `lib/tenant/get-db.ts`, `lib/tenant/get-models.ts` |
| Permissions | `lib/permissions.ts`, `lib/modules.ts` (feature flags + permission defaults) |
| Branch context | `lib/branch-middleware.ts`, `app/api/auth/select-branch` |
| Offline / PWA | `lib/indexeddb.ts`, `lib/sync.ts`, `lib/pwa-update.ts`, `components/pwa/*` |
| Payments | `lib/mpesa.ts`, `app/api/mpesa/*` |
| Media | `lib/media-upload.ts`, `lib/media-url.ts`, `app/api/media/*` |
| Printing | `components/sales/receipt.tsx` (shared receipt primitive) |
| Demo mode | `lib/demo.ts`, `proxy.ts`, `app/api/demo/*` |
| Shared UI | `components/ui/*`, `components/auth/*`, `components/barcode/*`, `components/dashboard/*` |
| Settings | `app/api/settings`, `app/dashboard/settings` |
| Staff | `app/api/staff/*`, `app/dashboard/staff` |
| Barcode scanning | `lib/barcode-scanner/*`, `hooks/use-barcode-scanner.ts` |

### Multi-tenancy mechanism

1. Each tenant gets an isolated MongoDB database. URIs are stored in an admin DB `tenants` collection.
2. At login, the tenant's MongoDB URI and feature flags are embedded directly in the JWT.
3. Every API request calls `getTenantDB()` which reads the URI from the JWT cookie — no admin-DB lookup per request.
4. A connection pool (`lib/db-tenant.ts`) caps tenant connections at 10 LRU entries.
5. Models are bound per-connection via `getModels(conn)` — no global Mongoose model registry.

---

## Business Modules

### Module 1 — Retail

The main general-purpose point-of-sale.

| Aspect | Detail |
|---|---|
| User-facing label | Retail |
| Internal key prefix | `pos.*` |
| Default enabled | Yes |
| Canonical routes | `/dashboard/retail/*` |
| Legacy routes | `/dashboard/sales`, `/dashboard/orders`, `/dashboard/inventory`, `/dashboard/reports`, `/dashboard/expenses`, `/dashboard/customers` |
| API routes | `/api/products/*`, `/api/sales/*`, `/api/categories/*`, `/api/customers/*`, `/api/expenses/*`, `/api/reports`, `/api/inventory/*` |
| Offline support | Yes — IndexedDB product cache, pending-sale queue, auto-sync |
| Barcode scanning | Yes — hardware keyboard scanner + camera + manual entry |

**Features:** `pos.sales`, `pos.orders`, `pos.inventory`, `pos.reports`, `pos.expenses`, `pos.customers`, `pos.settings`

---

### Module 2 — Service

Hospitality workspace consolidating Kitchen Display (KDS) and Bar operations into one top-level module with two sub-domains.

| Aspect | Detail |
|---|---|
| User-facing label | Service |
| Internal key prefixes | `kds.*` (Kitchen), `bar.*` (Bar) |
| Default enabled | Yes |
| Canonical routes | `/dashboard/service/kitchen/*`, `/dashboard/service/bar/*` |
| Legacy routes | `/dashboard/kds/*`, `/dashboard/bar/*` |

**Kitchen sub-domain** (`kds.*`)

Operational features: `kds.orders`, `kds.chef`, `kds.waiter`, `kds.history`, `kds.menu`, `kds.inventory`

API: `/api/kds/*` — create-order, menu CRUD, status transitions (pending→preparing→ready→served), table/section info, order history

**Bar sub-domain** (`bar.*`)

Operational features: `bar.tabs`, `bar.inventory`, `bar.reports`, `bar.admin`

API: `/api/bar/*` — tabs, tab lines, bottle lifecycle, brands, inventory items, servings, payments, sale creation, outstanding report

Note: `bar.reports` page calls `/api/bar/reports/bottle-differences` and `/api/bar/reports/products-sold` which do not yet have route handlers. These calls fail silently. See deferred register.

---

### Module 3 — Rentals

Rental booking management with two parallel implementations.

| Aspect | Detail |
|---|---|
| User-facing label | Rentals |
| Internal key prefix | `rentals.*` |
| Default enabled | No |
| Routes | `/dashboard/rental-services` (new booking system), `/dashboard/rentals` (legacy product-based) |
| API routes | `/api/rental-services/*`, `/api/rental-bookings/*`, `/api/rentals/*` |

Both the new RentalService/RentalBooking system and the legacy product-based Rental model are active and in use.

**Features:** `rentals.bookings`, `rentals.manage`

---

### Module 4 — Pharmacy

Clinical pharmacy module with FEFO batch inventory.

| Aspect | Detail |
|---|---|
| User-facing label | Pharmacy |
| Internal key prefix | `pharmacy.*` |
| Default enabled | No |
| Routes | `/dashboard/pharmacy/pos`, `/dashboard/pharmacy/inventory` (operational) |
| API routes | `/api/pharmacy/*` — drugs, batches, sale (FEFO deduction), batch history, recall |

Patients (`pharmacy.patients`), Appointments (`pharmacy.appointments`), Billing (`pharmacy.billing`) — feature keys exist in the registry for backward compatibility but pages show "Coming soon". Not promoted in sidebar navigation.

---

## Admin Control Plane

Entirely separate from the tenant business modules.

- Protected by `ADMIN_HOSTNAME` environment variable (production) or localhost check (development)
- Separate login (`/admin/login`) with its own session cookie
- Manages: tenants, clusters, tenant provisioning, owner credentials, feature toggles
- Data stored in the admin MongoDB database alongside the tenant registry

Routes: `/admin/*`, `/api/admin/*`

---

## Key Design Principles Preserved

1. **Tenant isolation** — each tenant's data remains in its own MongoDB database
2. **JWT-embedded tenant context** — no per-request admin DB lookup
3. **Internal key stability** — `pos.*`, `kds.*`, `bar.*`, `rentals.*`, `pharmacy.*` keys unchanged in all stored documents
4. **Backward-compatible normalisation** — `normaliseFeatures()` handles flat legacy keys, old dotted keys, and new keys uniformly
5. **No business logic moved** — all page implementations remain at original paths; new canonical paths are thin re-exports
6. **Offline Retail POS** — IndexedDB caching, pending-sale queue, service worker unchanged

---

## What Changed in Phase 1

Phase 1 was a navigational and structural reorganisation only.

- `lib/modules.ts` restructured with `RETAIL_MODULE`, `SERVICE_MODULE`, `RENTALS_MODULE`, `PHARMACY_MODULE`
- Sidebar rewritten to render the new four-module hierarchy with Service sub-sections
- 22 new canonical route files created as thin re-exports
- Dashboard `kds.display` key reference fixed to use current `kds.*` keys
- Staff page null-guard added for `mod.icon`
- One stale `kds.display` reference in `dashboard/page.tsx` corrected

Zero API routes changed. Zero database schemas changed. Zero business workflows changed.
