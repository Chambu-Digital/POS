# Phase 1 — Navigation Hierarchy

## Sidebar structure

The sidebar renders items in this order. Visibility is controlled by tenant feature flags AND staff permissions simultaneously.

```
[Shop logo + name]
[Branch selector — if branches.length > 0]

Dashboard                           (always visible)

── RETAIL ──────────────────────────── (pos.* features enabled)
   Make Sale                        pos.sales
   Orders                           pos.orders
   Inventory                        pos.inventory
   Reports                          pos.reports
   Expenses                         pos.expenses
   Customers                        pos.customers

── SERVICE ─────────────────────────── (any kds.* or bar.* feature enabled)
   ▾ Kitchen                        (sub-section header)
     Menu Management                kds.menu       [admin only]
     Kitchen Inventory              kds.inventory  [admin only]
     Create Order                   kds.orders
     Chef View                      kds.chef
     Waiter View                    kds.waiter
     Kitchen History                kds.history
   ▾ Bar                            (sub-section header)
     Bar Tabs                 ●     bar.tabs       [live indicator]
     Bar Inventory                  bar.inventory  [admin only]
     Bar Reports                    bar.reports    [admin only]
     Bar Administration             bar.admin      [admin only]

── RENTALS ─────────────────────────── (rentals.* features enabled)
   Rental Services                  rentals.bookings
   Rentals                          rentals.manage

── PHARMACY ────────────────────────── (pharmacy.* features enabled)
   Pharmacy POS                     pharmacy.pos
   Drug Inventory                   pharmacy.inventory
   [Patients, Appointments, Billing are defaultOn:false — not shown unless explicitly enabled]

Staff                               [admin only, always shown to owner]
Settings                            [admin only, always shown to owner]

[Logout]
```

### Collapsible behaviour
- Module headers (Retail, Service, Rentals, Pharmacy) are collapsible
- Service sub-section headers (Kitchen, Bar) are independently collapsible
- Collapse state is stored in React component state (resets on page reload — intentional)
- If a module has only one visible feature, the group header is omitted and the feature renders as a top-level item

### Feature visibility rules
- **Owner (type: `user`)** — sees all features for which the tenant flag is `true`
- **Staff (type: `staff`)** — sees only features where both `features[key] === true` AND `permissions[key] === true` AND `adminOnly === false`
- `adminOnly: true` features are always hidden from staff regardless of permissions
- If no features within a module are visible, the module group header is not rendered

### Live indicator
The animated orange dot (●) appears on Bar Tabs when the user is on any Bar route. This signals that bar tabs may need attention. Implemented via `LIVE_HREFS` set in the sidebar.

### Demo mode
Demo mode has no structural difference in navigation. The DemoBanner renders above the main content area. The sidebar renders normally based on demo tenant feature flags.

---

## Top navigation (TopNav)

The top navigation bar renders:
- Page breadcrumb / current section name
- User name and role indicator
- (No module switcher — modules are in the sidebar)

---

## Admin navigation (separate from dashboard)

```
/admin
  Tenants    → /admin/tenants
  Clusters   → /admin/clusters
  [Logout]
```

Admin navigation is entirely separate from the tenant dashboard navigation. It is protected by `ADMIN_HOSTNAME` in production.

---

## Mobile navigation

On small screens:
- The sidebar is hidden behind a hamburger button (top-left)
- Tapping a nav item closes the sidebar
- A semi-transparent overlay covers the content while the sidebar is open
- The PWA install prompt and other platform components render above the content

---

## Notes on pharmacy placeholder features

`pharmacy.patients`, `pharmacy.appointments`, and `pharmacy.billing` have `defaultOn: false`. They will only appear in the sidebar if a tenant admin explicitly sets them to `true` in the tenant feature flags. This prevents "Coming soon" pages from showing to normal users.
