# Phase 1 — Code Change Log

## Files modified

| File | Change |
|---|---|
| `lib/modules.ts` | Fully rewritten. Introduced `RETAIL_MODULE`, `SERVICE_MODULE` (with `ServiceModuleFeature` sub-domain typing), `RENTALS_MODULE`, `PHARMACY_MODULE`. Added `getKitchenFeatures()`, `getBarFeatures()` helpers. Added lucide-react icon field to `ModuleDefinition`. All internal keys (`pos.*`, `kds.*`, `bar.*`) unchanged. |
| `lib/features.ts` | Updated re-exports to match new `lib/modules.ts` exports. No functional change. |
| `components/dashboard/sidebar.tsx` | Fully rewritten. Added Service module with Kitchen/Bar sub-sections. Added `LEGACY_ACTIVE_MAP` for backward-compatible active-state detection. Preserved live dot indicator, BranchSelector, mobile toggle, skeleton loading, logout. |
| `app/dashboard/page.tsx` | Fixed stale `kds.display` feature key reference to `kds.orders || kds.chef || kds.waiter`. |
| `app/dashboard/staff/page.tsx` | Added `{ModIcon && ...}` null guard for optional `mod.icon` field. |
| `app/dashboard/sales/page.tsx` | Accidentally overwritten during Stage 6 work; restored from full implementation. Content is identical to the original. |

---

## New canonical route files created

All are thin `export { default }` re-exports — zero business logic.

### Retail (`app/dashboard/retail/`)
| New file | Re-exports from |
|---|---|
| `retail/sales/page.tsx` | `app/dashboard/sales/page.tsx` |
| `retail/sales/payment/page.tsx` | `app/dashboard/sales/payment/page.tsx` |
| `retail/orders/page.tsx` | `app/dashboard/orders/page.tsx` |
| `retail/inventory/page.tsx` | `app/dashboard/inventory/page.tsx` |
| `retail/reports/page.tsx` | `app/dashboard/reports/page.tsx` |
| `retail/expenses/page.tsx` | `app/dashboard/expenses/page.tsx` |
| `retail/customers/page.tsx` | `app/dashboard/customers/page.tsx` |

### Service → Kitchen (`app/dashboard/service/kitchen/`)
| New file | Re-exports from |
|---|---|
| `kitchen/page.tsx` | `app/dashboard/kds/page.tsx` |
| `kitchen/orders/page.tsx` | `app/dashboard/kds/orders/page.tsx` |
| `kitchen/chef/page.tsx` | `app/dashboard/kds/chef/page.tsx` |
| `kitchen/waiter/page.tsx` | `app/dashboard/kds/waiter/page.tsx` |
| `kitchen/history/page.tsx` | `app/dashboard/kds/history/page.tsx` |
| `kitchen/menu/page.tsx` | `app/dashboard/kds/menu/page.tsx` |
| `kitchen/inventory/page.tsx` | `app/dashboard/kds/inventory/page.tsx` |

### Service → Bar (`app/dashboard/service/bar/`)
| New file | Re-exports from |
|---|---|
| `bar/page.tsx` | `app/dashboard/bar/page.tsx` |
| `bar/inventory/page.tsx` | `app/dashboard/bar/inventory/page.tsx` |
| `bar/inventory/new/page.tsx` | `app/dashboard/bar/inventory/new/page.tsx` |
| `bar/inventory/[id]/page.tsx` | `app/dashboard/bar/inventory/[id]/page.tsx` |
| `bar/brands/page.tsx` | `app/dashboard/bar/brands/page.tsx` |
| `bar/brands/[id]/page.tsx` | `app/dashboard/bar/brands/[id]/page.tsx` |
| `bar/reports/page.tsx` | `app/dashboard/bar/reports/page.tsx` |
| `bar/tabs/[id]/page.tsx` | `app/dashboard/bar/tabs/[id]/page.tsx` |

**Total new files: 22**

---

## Redirects introduced

None. Old route pages were not changed. They render their implementations directly. No `redirect()` calls were added.

---

## Shared components extracted

None extracted in Phase 1. The spec requirement for extraction was met by confirming existing shared components (`Receipt`, `PermissionGuard`, `ModuleGuard`, `ScannerFeedback`, `ManualBarcodeEntry`) already serve multiple modules and no further extraction was necessary.

---

## Legacy code retained (unchanged)

| Item | Why retained |
|---|---|
| `app/dashboard/sales/page.tsx` (original path) | Active implementation; new canonical re-exports from it |
| `app/dashboard/orders/page.tsx` | Active implementation |
| `app/dashboard/inventory/page.tsx` | Active implementation |
| `app/dashboard/reports/page.tsx` | Active implementation |
| `app/dashboard/expenses/page.tsx` | Active implementation |
| `app/dashboard/customers/page.tsx` | Active implementation |
| `app/dashboard/kds/*` | Active implementations |
| `app/dashboard/bar/*` | Active implementations |
| `app/dashboard/hms/*` | Empty dirs — retained, not promoted |
| `lib/modules.ts` `LEGACY_KEY_MAP` | Required for backward compat with stored records |
| `lib/auth.ts` | Still imported by some API routes |
| `lib/mongodb.ts` | Used by some API routes; not removed |
| `scripts/migrate-*.ts` | Historical reference; no runtime impact |
| `scripts/wines-and-spirits-module/` | Design docs only; preserved for context |

---

## Legacy code removed

None. No code was deleted during Phase 1.

Rationale: the spec requires confirmation of no active dependencies before removing any identifier. Given the size of the codebase and the strict scope of Phase 1, no deletions were made. All removal candidates are documented in the deferred register.

---

## Database migrations

None required. All schema changes: zero. The reorganisation affected navigation and routing only. All `pos.*`, `kds.*`, `bar.*`, `rentals.*`, `pharmacy.*` keys stored in MongoDB documents remain valid without any migration.

---

## Pre-existing defects not fixed

The following defects were observed but not addressed (out of Phase 1 scope):

| Defect | Location | Severity |
|---|---|---|
| Bar reports page calls `/api/bar/reports/bottle-differences` and `/api/bar/reports/products-sold` — routes do not exist | `app/dashboard/bar/reports/page.tsx` | Medium — two report tabs show no data |
| KDS inventory page reads from `/api/products` (Retail products) instead of a restaurant-specific stock | `app/dashboard/kds/inventory/page.tsx` | Low — functional but conceptually misaligned |
| Pharmacy billing page title reads "HMS Billing" | `app/dashboard/pharmacy/billing/page.tsx` | Low — placeholder page, not shown by default |
| Bar quick-sale uses undocumented `bar.newui` flag not in the module registry | `app/dashboard/bar/quick-sale/page.tsx` | Low — not exposed to users by default |

---

## Assumptions made during implementation

1. The implementation at each old path (e.g., `app/dashboard/sales/page.tsx`) is the authoritative source of truth. The new canonical path re-exports from it, not the other way around.
2. No redirect components were introduced because (a) the old pages still exist and serve their implementations, and (b) the overhead of `redirect()` on every bookmark navigation is unnecessary.
3. The `kds.inventory` feature key was kept as-is. Its current behaviour (reading Retail products) is preserved; separating it to a true restaurant-inventory API is deferred.
4. Pharmacy placeholder features (`pharmacy.patients`, `pharmacy.appointments`, `pharmacy.billing`) remain in the module registry with `defaultOn: false` so that stored tenant configs referencing them are not invalidated.
5. The `bar.newui` feature flag is left undocumented in the module registry. Adding it would activate the quick-sale UI for tenants, which is an intentional gating decision outside this phase.
6. The `lib/auth.ts` and `lib/mongodb.ts` legacy files are retained without clean-up since they have active importers and removal was not required for Phase 1.
