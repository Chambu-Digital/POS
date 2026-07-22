# Phase 1 — Feature Key and Permission Key Compatibility Map

## Principle

Internal feature keys (`pos.*`, `kds.*`, `bar.*`, `rentals.*`, `pharmacy.*`) are **identical before and after Phase 1**. Only the user-facing module grouping changed. No stored tenant feature records or staff permission records need migration.

---

## Current canonical keys

### Retail module (internal prefix: `pos.*`)

| Key | Label | Default | admin only |
|---|---|---|---|
| `pos.sales` | Make Sale | `true` | No |
| `pos.orders` | Orders | `true` | No |
| `pos.inventory` | Inventory | `true` | No |
| `pos.reports` | Reports | `true` | No |
| `pos.expenses` | Expenses | `true` | No |
| `pos.customers` | Customers | `true` | No |
| `pos.settings` | Settings | `true` | Yes |

### Service module — Kitchen (internal prefix: `kds.*`)

| Key | Label | Default | admin only |
|---|---|---|---|
| `kds.menu` | Menu Management | `true` | Yes |
| `kds.inventory` | Kitchen Inventory | `true` | Yes |
| `kds.orders` | Create Order | `true` | No |
| `kds.chef` | Chef View | `true` | No |
| `kds.waiter` | Waiter View | `true` | No |
| `kds.history` | Kitchen History | `true` | No |

### Service module — Bar (internal prefix: `bar.*`)

| Key | Label | Default | admin only |
|---|---|---|---|
| `bar.tabs` | Bar Tabs | `true` | No |
| `bar.inventory` | Bar Inventory | `true` | Yes |
| `bar.reports` | Bar Reports | `true` | Yes |
| `bar.admin` | Bar Administration | `true` | Yes |

### Rentals module (internal prefix: `rentals.*`)

| Key | Label | Default | admin only |
|---|---|---|---|
| `rentals.bookings` | Rental Services | `false` | No |
| `rentals.manage` | Rentals | `false` | No |

### Pharmacy module (internal prefix: `pharmacy.*`)

| Key | Label | Default | admin only |
|---|---|---|---|
| `pharmacy.pos` | Pharmacy POS | `true` | No |
| `pharmacy.inventory` | Drug Inventory | `true` | No |
| `pharmacy.patients` | Patients | `false` | No |
| `pharmacy.appointments` | Appointments | `false` | No |
| `pharmacy.billing` | Billing | `false` | No |

---

## Legacy key map — handled by `normaliseFeatures()`

Stored tenant documents or staff records containing any of these old keys are automatically mapped to their current equivalents. No database migration is required.

| Old key | Maps to | Notes |
|---|---|---|
| `pos` (flat) | `pos.sales` | Pre-dotted top-level key |
| `kitchenDisplay` | `kds.chef` | Pre-dotted KDS key |
| `bar` (flat) | `bar.tabs` | Pre-dotted bar key |
| `rentals` (flat) | `rentals.bookings` | Pre-dotted rentals key |
| `orders` (flat) | `pos.orders` | Pre-dotted |
| `inventory` (flat) | `pos.inventory` | Pre-dotted |
| `reports` (flat) | `pos.reports` | Pre-dotted |
| `expenses` (flat) | `pos.expenses` | Pre-dotted |
| `kds.display` | `kds.chef` | Old dotted migration artefact |

---

## Module key changes (top-level grouping only)

The top-level module keys used in `modulesToFeatures()` / `featuresToModuleKeys()` have changed for the new admin UI. Old module keys are accepted as input via auto-mapping inside `modulesToFeatures()`.

| Old module key | New module key | Internal feature keys affected |
|---|---|---|
| `pos` | `retail` | None — `pos.*` unchanged |
| `kds` | (now part of `service`) | None — `kds.*` unchanged |
| `bar` | (now part of `service`) | None — `bar.*` unchanged |
| `rentals` | `rentals` | No change |
| (new) | `service` | Groups `kds.*` and `bar.*` together |

`featuresToModuleKeys()` now returns `['retail', 'service', 'rentals', 'pharmacy']` — the admin tenants page reads these and displays the new human-readable labels.

---

## Staff permission records — no migration needed

Staff permissions are stored as `Record<string, boolean>` with dotted keys. Since all `pos.*`, `kds.*`, `bar.*`, `rentals.*`, and `pharmacy.*` keys are unchanged, all existing staff permission records continue to work without modification.

`normalisePermissions()` produces a complete permissions map from any partial input using `ALL_FEATURES` — which still covers every key that could ever appear in a stored record.

---

## JWT claims — no changes

The `permissions` and `tenantFeatures` fields embedded in the JWT use the same dotted keys. No re-login is required after Phase 1 deployment. Existing valid tokens continue to work.

---

## Backward compatibility behaviour summary

| Scenario | Result |
|---|---|
| Tenant stored with `bar: true` (flat key) | `normaliseFeatures()` maps to `bar.tabs: true`, also sets `bar.inventory`, `bar.reports`, `bar.admin` to `true` |
| Tenant stored with `kds.display: false` | `normaliseFeatures()` maps to `kds.chef: false` |
| Staff stored with `kds.display: false` | `normalisePermissions()` silently ignores unknown key; key not in `ALL_FEATURES` so it gets default `false` |
| Fresh new tenant | Receives `DEFAULT_MODULE_FEATURES` — all `pos.*` true, `kds.*` true, all others false |
| Existing valid JWT token | No re-login needed; all claims valid |
| Bookmark to `/dashboard/bar` | Page renders correctly (implementation still at original path); sidebar highlights Service → Bar section |
| Bookmark to `/dashboard/kds/chef` | Page renders correctly; sidebar highlights Service → Kitchen section |
