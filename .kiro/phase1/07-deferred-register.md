# Phase 1 — Deferred Functionality Register

Items listed here were discovered during Phase 1 but are out of scope. Their presence is documented so future phases can address them with full context.

Documentation does not authorise implementation.

---

## 1. HMS — Hotel Management System

| Field | Detail |
|---|---|
| Name | Hotel Management System (HMS) |
| Current location | `app/dashboard/hms/` |
| Intended module | Standalone (or merged with Rentals) |
| Implementation status | Empty directories — zero page files, zero API routes, zero models |
| Existing routes | None |
| Existing models | None |
| Existing APIs | None |
| Existing UI | None |
| Currently exposed to users | No |
| Dependencies | None known |
| Why not completed in Phase 1 | No implementation exists to reorganise |
| Recommended phase | Phase 2 or later (requires full feature design) |

---

## 2. Pharmacy — Patients

| Field | Detail |
|---|---|
| Name | Patient Registration and Records |
| Current location | `app/dashboard/pharmacy/patients/page.tsx` |
| Intended module | Pharmacy |
| Implementation status | Placeholder only — renders "Coming soon" text with Stethoscope icon |
| Existing routes | `/dashboard/pharmacy/patients` |
| Existing models | None (no Patient schema in `lib/models/schemas.ts`) |
| Existing APIs | None |
| Existing UI | Icon + heading + text only |
| Feature key | `pharmacy.patients` (defaultOn: false) |
| Currently exposed to users | Not by default — feature flag defaults to false |
| Why not completed in Phase 1 | No implementation exists; out of Phase 1 scope |
| Recommended phase | Phase 2 Pharmacy expansion |

---

## 3. Pharmacy — Appointments

| Field | Detail |
|---|---|
| Name | Appointment Scheduling and Management |
| Current location | `app/dashboard/pharmacy/appointments/page.tsx` |
| Intended module | Pharmacy |
| Implementation status | Placeholder only — renders "Coming soon" text with CalendarClock icon |
| Existing routes | `/dashboard/pharmacy/appointments` |
| Existing models | None |
| Existing APIs | None |
| Existing UI | Icon + heading + text only |
| Feature key | `pharmacy.appointments` (defaultOn: false) |
| Currently exposed to users | Not by default |
| Why not completed in Phase 1 | No implementation exists; out of scope |
| Recommended phase | Phase 2 Pharmacy expansion |

---

## 4. Pharmacy — Billing

| Field | Detail |
|---|---|
| Name | Patient Billing and Payment Management |
| Current location | `app/dashboard/pharmacy/billing/page.tsx` |
| Intended module | Pharmacy |
| Implementation status | Placeholder only — page title reads "HMS Billing" (copy error, not fixed in Phase 1) |
| Existing routes | `/dashboard/pharmacy/billing` |
| Existing models | None |
| Existing APIs | None |
| Existing UI | Icon + heading + "Coming soon" text |
| Feature key | `pharmacy.billing` (defaultOn: false) |
| Currently exposed to users | Not by default |
| Known defect | H1 title reads "HMS Billing" — should read "Pharmacy Billing" |
| Why not completed in Phase 1 | Fixing the title would be a cosmetic change outside Phase 1 scope; placeholder status unchanged |
| Recommended phase | Phase 2 Pharmacy expansion (fix title as part of implementation) |

---

## 5. Bar Reports — Missing API endpoints

| Field | Detail |
|---|---|
| Name | Bottle Differences Report, Products Sold Report |
| Current location | `app/dashboard/bar/reports/page.tsx` (page calls the missing routes) |
| Intended module | Service → Bar |
| Implementation status | Page UI is implemented. API routes do not exist. |
| Existing routes | `/dashboard/service/bar/reports` (and legacy `/dashboard/bar/reports`) |
| Missing API routes | `GET /api/bar/reports/bottle-differences`, `GET /api/bar/reports/products-sold` |
| Existing APIs | `GET /api/bar/reports/outstanding` — operational |
| Effect | Bottle differences table and products sold chart show empty / fail silently |
| Currently exposed to users | Yes — page is visible but two of four tabs show no data |
| Dependencies | BarBottle, BarTabLine, BarAuditLog models (all exist) |
| Why not completed in Phase 1 | Adding API routes is new feature work, not reorganisation |
| Recommended phase | Phase 2 Bar module completion |

---

## 6. Bar Quick Sale

| Field | Detail |
|---|---|
| Name | Quick Sale (sealed bottle direct sale without creating a tab) |
| Current location | `app/dashboard/bar/quick-sale/page.tsx`, `components/bar/QuickSalePage.tsx` |
| Intended module | Service → Bar |
| Implementation status | UI component implemented. Page gated behind undocumented `bar.newui` feature flag. |
| Existing routes | `/dashboard/bar/quick-sale` (accessible only when `features['bar.newui'] === true`) |
| Feature key | `bar.newui` (not in `lib/modules.ts` registry, checked directly in the route file) |
| Currently exposed to users | No — flag not set for any tenant by default |
| Dependencies | Requires `/api/bar/sale` with `type: 'quick_sale'` support |
| Why not completed in Phase 1 | Gated flag, partially implemented; enabling it would be feature activation not reorganisation |
| Recommended phase | Phase 2 Bar module completion — decision needed on whether to promote or remove |

---

## 7. Wines and Spirits — Standalone Module

| Field | Detail |
|---|---|
| Name | Wines and Spirits Module |
| Current location | `scripts/wines-and-spirits-module/` |
| Intended module | Originally planned as a standalone module; the functionality is now part of Service → Bar |
| Implementation status | Design docs only (`design.md`, `requirements.md`, `tasks.md`) |
| Existing routes | None beyond existing Bar routes |
| Existing models | All 7 Bar schemas (BarBrand, BarInventoryItem, BarServing, BarBottle, BarTab, BarTabLine, BarAuditLog) are already implemented |
| Existing APIs | All Bar APIs already implemented |
| Currently exposed to users | The functionality is available via `bar.*` features |
| Why not completed in Phase 1 | Not a separate module — already part of Bar. Design docs preserved for reference. |
| Recommendation | No separate Wines and Spirits module is needed. The Bar module covers this domain. Retain design docs as historical context. |

---

## 8. KDS Inventory — Separate Restaurant Stock

| Field | Detail |
|---|---|
| Name | Restaurant-specific ingredient inventory (separate from Retail products) |
| Current location | `app/dashboard/kds/inventory/page.tsx` |
| Intended module | Service → Kitchen |
| Current behaviour | KDS inventory page reads from `/api/products` — it is the Retail product catalog, not a separate restaurant inventory |
| Expected behaviour per design | A separate `RestaurantInventoryItem` catalog tied to menu ingredients |
| Implementation status | Partially implemented — UI exists but targets wrong data source |
| Feature key | `kds.inventory` |
| Currently exposed to users | Yes — admin only (`adminOnly: true`) |
| Why not completed in Phase 1 | Separating it would require new schemas and API routes — new feature work |
| Recommended phase | Phase 2 Kitchen module expansion |
