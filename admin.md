# CHAMBU ADMIN — Rebuild the Edit Tenant Interface

## Objective

Improve the existing Chambu Admin **Edit Tenant** page so administrators can manage tenant information, tenant status, owner credentials, primary business modules, and Service submodules through a clear, scalable, responsive interface.

The current page is available at:

```text
/admin/tenants/[id]
```

This task is an improvement of the existing tenant editor. Do not replace the existing tenant-management architecture, authentication system, tenancy model, database structure, or feature-permission system.

The new interface must work with the existing codebase and preserve compatibility with current tenant records.

---

# 1. Current System Context

Chambu POS currently has the following tenant-facing business modules:

* POS
* KDS
* Bar
* Rentals
* Pharmacy

The new user-facing module organization should be:

* Retail
* Service
* Rentals
* Pharmacy

The mapping should be:

```text
Retail
└── Existing POS module and pos.* feature keys

Service
├── Kitchen Operations
│   └── Existing KDS module and kds.* feature keys
└── Bar & Beverage
    └── Existing Bar module and bar.* feature keys

Rentals
└── Existing Rentals module and rentals.* feature keys

Pharmacy
└── Existing Pharmacy module and pharmacy.* feature keys
```

For this interface, **Service is a user-facing grouping**.

Do not immediately replace existing `kds.*` and `bar.*` feature keys with new keys.

Do not break:

* existing tenant feature records
* legacy feature records
* staff permissions
* tenant JWT behavior
* existing API authorization
* existing module navigation
* demo-mode behavior
* tenant provisioning
* current tenant database isolation

Use compatibility adapters where needed.

---

# 2. Source of Truth

Before implementing the new interface:

1. Inspect the existing `/admin/tenants/[id]` page.
2. Inspect `lib/modules.ts`.
3. Inspect the existing tenant type and tenant schema.
4. Inspect the following APIs:

   * `GET /api/admin/tenants/[id]`
   * `PUT /api/admin/tenants/[id]`
   * `PUT /api/admin/tenants/[id]/update-owner`
5. Inspect how tenant features are normalized and saved.
6. Inspect how existing module cards are currently rendered.
7. Inspect the current admin layout and styling conventions.

Use the actual implementation as the source of truth.

Do not create duplicate APIs when the current APIs can support the required behavior.

Do not invent tenant properties that are not returned by the backend.

---

# 3. Scope

Implement the following:

* Improved tenant page header
* Tabbed tenant-management interface
* Tenant overview section
* Modules and Access section
* Service submodule configuration
* Improved Owner Account section
* Tenant status management
* Unsaved-changes handling
* Change-summary confirmation
* Responsive behavior
* Accessible interaction
* Existing feature-key compatibility

Do not implement:

* staff-level permission assignment
* subscription billing
* payment-plan management
* tenant deletion
* new Hospitality business workflows
* Kitchen features
* Bar features
* shifts
* cash drawers
* tables
* supplier management
* reports that do not already exist
* new module APIs
* platform-wide audit infrastructure
* new authentication architecture

This page controls **tenant entitlements**, not individual staff permissions.

---

# 4. Page Layout

Replace the narrow single-column form with a wider centered layout.

Use a maximum content width between approximately `1100px` and `1200px`.

The page should use the available desktop space without becoming excessively wide.

Recommended structure:

```text
Breadcrumbs

Tenant name                         Tenant status
Tenant identifier                  Save actions

[Overview] [Modules & Access] [Owner Account]

Active tab content

Sticky unsaved-changes bar
```

Preserve the existing Chambu Admin sidebar.

Do not redesign the entire admin application.

---

# 5. Page Header

Display:

* Breadcrumbs
* Page title
* Tenant shop name
* Tenant identifier or subdomain, where available
* Tenant status
* Unsaved-changes indicator where applicable

Example:

```text
Tenants / Wonder shops

Wonder shops                                  Active
Tenant: wondersshop
```

The status must use both text and visual styling.

Do not communicate status using colour alone.

Possible status presentation:

```text
Active
Inactive
```

Use the actual tenant status values currently supported by the backend.

Do not introduce additional statuses unless the backend already supports them.

---

# 6. Page Tabs

Create three tabs:

```text
Overview
Modules & Access
Owner Account
```

The active tab should be visually clear and keyboard accessible.

Use the project’s existing Radix or shadcn tab primitives where appropriate.

Do not create separate routes unless the existing application architecture makes that clearly preferable.

The selected tab may be stored in local component state.

Optional: preserve the selected tab using a query parameter such as:

```text
?tab=modules
```

Only add query-parameter support if it can be implemented cleanly without creating routing issues.

---

# 7. Overview Tab

The Overview tab should contain the tenant’s general information.

At minimum, include:

* Shop name
* Tenant status
* Tenant identifier or subdomain, where available

Show additional tenant information only when it is already returned by the existing API and safe to expose.

Do not display:

* raw MongoDB connection URIs
* JWT secrets
* database credentials
* environment variables
* admin passwords
* private cluster credentials

## Shop name

Keep Shop Name editable.

Requirements:

* Required
* Trim leading and trailing spaces
* Show inline validation
* Preserve the existing backend validation
* Do not submit an unchanged value unnecessarily

## Tenant status

Move the current `Active` checkbox into the Overview section or page header.

Use a clearer control such as a switch with a text label:

```text
Tenant access

[On] Active
The tenant owner and staff can sign in.
```

When disabling the tenant, show a confirmation dialog.

Example:

```text
Deactivate Wonder shops?

The tenant owner and staff will no longer be able to sign in.
Existing tenant data will not be deleted.

Cancel
Deactivate tenant
```

Do not delete or modify tenant business data when deactivating a tenant.

---

# 8. Modules & Access Tab

The Modules & Access tab is the central part of this task.

Display four primary module cards:

* Retail
* Service
* Rentals
* Pharmacy

Use a two-column grid on desktop and a single column on smaller screens.

Each module card should include:

* Module name
* Short description
* Enabled or Disabled badge
* Selection control
* Included capabilities summary
* Configure button where configuration is available

Example:

```text
SERVICE                                      Enabled

Hospitality, kitchen, and beverage operations.

Kitchen Operations
Bar & Beverage

2 submodules enabled

Configure
```

---

# 9. Primary Module Cards

## Retail

Display label:

```text
Retail
```

Description:

```text
Sales, orders, inventory, customers, expenses, and reports.
```

Retail maps to the existing `pos` module.

Do not rename stored `pos.*` feature keys merely because the visible label is now Retail.

When Retail is enabled, retain the current POS features according to the existing module configuration.

## Service

Display label:

```text
Service
```

Description:

```text
Kitchen, food-service, bar, and beverage operations.
```

Service is a parent grouping containing:

* Kitchen Operations
* Bar & Beverage

Service should have a **Configure** action.

The card should show:

* Enabled
* Partially enabled
* Disabled

Examples:

```text
Enabled
Kitchen Operations and Bar & Beverage
```

```text
Partially enabled
Kitchen Operations
```

```text
Disabled
No Service submodules enabled
```

Use an indeterminate visual state when only one Service submodule is enabled.

## Rentals

Description:

```text
Room, vehicle, equipment, and service rentals.
```

Map to the current Rentals module.

## Pharmacy

Description:

```text
Pharmacy sales, batch inventory, expiry tracking, and stock control.
```

Map to the current Pharmacy module.

Do not expose partially implemented patient, appointment, or billing functionality through this admin page unless it is already represented in the current tenant feature registry.

---

# 10. Service Configuration Drawer

Selecting **Configure** on the Service card should open a right-side drawer.

Use a dialog on small screens if a drawer is not suitable.

Recommended width on desktop:

```text
420px–520px
```

The drawer should include:

* Service status
* Optional business preset
* Kitchen Operations submodule
* Bar & Beverage submodule
* Included-feature summaries
* Cancel action
* Apply configuration action

Example:

```text
Service Configuration

Configure the hospitality capabilities available to this tenant.

Business setup
[Restaurant & Bar ▼]

Service submodules

[✓] Kitchen Operations
Kitchen display, menus, waiter orders, chef views, and order history.

Included:
Menu
Orders
Chef View
Waiter View
History

[✓] Bar & Beverage
Tabs, bottles, servings, beverage inventory, and bar reports.

Included:
Tabs
Inventory
Reports
Administration

Cancel
Apply configuration
```

---

# 11. Service Business Presets

Add an optional preset selector to make common configurations easier.

Use the following presets:

```text
Restaurant or Café
Bar, Lounge, or Club
Restaurant and Bar
Custom
```

Preset behavior:

## Restaurant or Café

Enable:

* Kitchen Operations

Disable:

* Bar & Beverage

## Bar, Lounge, or Club

Enable:

* Bar & Beverage

Disable:

* Kitchen Operations

## Restaurant and Bar

Enable:

* Kitchen Operations
* Bar & Beverage

## Custom

Allow the administrator to control each submodule manually.

A preset is only a selection shortcut.

Do not store the preset as a new permanent business type unless the current backend already has an appropriate field.

The stored source of truth should remain the enabled feature set.

When the administrator manually changes a preset selection, automatically change the preset display to `Custom`.

---

# 12. Kitchen Operations Submodule

Kitchen Operations maps to the existing KDS module and its existing feature keys.

It may include the current features:

* Menu
* Inventory
* Orders
* Chef View
* Waiter View
* History

Use the actual feature definitions from `lib/modules.ts`.

Do not hard-code a list that can become inconsistent with the module registry.

The drawer may show included features as read-only chips or text.

The administrator is selecting the **Kitchen Operations submodule**, not individual Kitchen permissions.

When Kitchen Operations is selected:

* Preserve or enable the corresponding current KDS tenant features.
* Do not grant staff permissions automatically.
* Do not create missing KDS features.
* Do not alter Kitchen business logic.

---

# 13. Bar & Beverage Submodule

Bar & Beverage maps to the existing Bar module and its existing feature keys.

It may include the current features:

* Tabs
* Inventory
* Reports
* Administration

Use the actual feature definitions from `lib/modules.ts`.

Do not duplicate the module definition inside the page.

The administrator is selecting the **Bar & Beverage submodule**, not individual Bar permissions.

When Bar & Beverage is selected:

* Preserve or enable the corresponding current Bar tenant features.
* Do not grant staff permissions automatically.
* Do not alter Bar tab, bottle, serving, inventory, payment, or reporting logic.

Wines and Spirits should be represented within Bar & Beverage where the existing implementation already belongs to the Bar domain.

Do not create a separate Wines and Spirits tenant module during this task.

---

# 14. Service Parent-State Rules

Apply the following rules.

## Service becomes enabled automatically

When either Kitchen Operations or Bar & Beverage is enabled, Service should display as enabled or partially enabled.

## Service becomes disabled automatically

When both Service submodules are disabled, Service should display as disabled.

## Enabling Service from the card

When the administrator directly enables Service and no previous child selection exists, open the Service configuration drawer instead of enabling every child automatically.

Require the administrator to select a preset or at least one submodule.

## Disabling Service

When the administrator disables Service, show a confirmation dialog:

```text
Disable Service?

This will remove tenant access to:

Kitchen Operations
Bar & Beverage

Existing Kitchen and Bar data will not be deleted.

Cancel
Disable Service
```

Disabling Service should update entitlement flags only.

Do not delete:

* kitchen orders
* menu items
* bar tabs
* bar bottles
* bar brands
* bar inventory
* bar servings
* bar audit logs
* linked sales
* reports

## Restore previous selection

Where practical, retain the previous Service child selection in local form state while the administrator remains on the page.

Do not add new database fields solely to remember the previous UI selection.

---

# 15. Module Card Interaction

The entire card should not behave like a hidden checkbox.

Use explicit controls.

Recommended controls:

* Switch or checkbox for simple modules
* Configure button for Service
* Status badge
* Clear hover and focus states

Example:

```text
Retail                          Enabled
[On]

Sales, inventory, orders, customers, and reports.
```

For Service:

```text
Service                         Partially enabled

Kitchen Operations

[Configure]
```

Do not rely only on a green border and check icon.

---

# 16. Owner Account Tab

Move owner credential management out of the general tenant form.

Display the current owner email.

Provide two clearly separated operations:

* Change owner email
* Set a new password

Use the existing owner-update API.

Recommended structure:

```text
Owner Account

Owner email
wonders@gmail.com

[Change email]

Password
The current password is not displayed.

[Set new password]
```

## Change email

When selected, show an email field with:

* Current email prefilled where safe
* Email-format validation
* Cancel action
* Save action

## Set new password

When selected, show:

* New password
* Confirm new password
* Show or hide password control
* Existing backend password rules
* Inline mismatch validation

Do not use a permanently visible empty password field with “leave blank” instructions.

Do not submit a password field unless the administrator deliberately enters password-change mode.

After a successful password update, clear password fields immediately.

Do not display the password in a success message.

---

# 17. Unsaved Changes

Track changes independently for:

* General tenant information
* Tenant status
* Module entitlements
* Service submodules

Show a sticky bottom action bar when unsaved tenant changes exist.

Example:

```text
3 unsaved changes

Discard changes
Review and save
```

Requirements:

* Hidden when there are no changes
* Sticky at the bottom of the viewport
* Must not cover page content
* Responsive
* Keyboard accessible
* Save button disabled while saving
* Show loading state
* Prevent duplicate submissions

Warn before the administrator leaves the page with unsaved changes.

Do not treat owner email or password operations as part of the same unsaved-change batch if they use a separate API.

---

# 18. Review Changes Dialog

Selecting **Review and save** should open a confirmation dialog summarizing the changes.

Example:

```text
Review tenant changes

Tenant
Shop name changed:
Wonder shops → Wonder Shops Kenya

Modules added
Service → Kitchen Operations
Service → Bar & Beverage

Modules removed
Rentals

Tenant status
No change

Access note
Module visibility is also controlled by staff permissions.
Existing signed-in users may need to sign in again before updated tenant features appear.

Cancel
Save changes
```

Only show sections that contain actual changes.

Use clear added and removed labels.

Do not display raw feature objects or JSON.

---

# 19. Save Behavior

On confirmation:

1. Build the updated tenant payload.
2. Preserve all unrelated tenant properties.
3. Normalize module features using the current feature utilities.
4. Submit through the existing tenant update API.
5. Handle success and failure.
6. Refresh the local baseline after success.
7. Clear the dirty state.
8. Keep the administrator on the same tab.
9. Show a success toast.

Example success message:

```text
Tenant configuration updated successfully.
```

When module entitlements change, also show:

```text
Signed-in tenant users may need to sign in again before the new module configuration appears.
```

This is necessary because tenant features are currently included in the authentication token.

Do not silently claim that active sessions were invalidated unless the system actually invalidates them.

---

# 20. Feature Compatibility

The current codebase supports existing and legacy feature keys.

The new UI must preserve this compatibility.

## Visible labels

Use:

```text
Retail
Service
Rentals
Pharmacy
```

## Internal keys

Continue supporting:

```text
pos.*
kds.*
bar.*
rentals.*
pharmacy.*
```

Use the existing feature-normalization utilities.

Do not create two competing sources of truth.

Do not store a separate nested Service object if the existing feature map can represent the same access safely.

A suitable UI adapter may derive Service state from existing keys:

```ts
const kitchenEnabled = hasAnyEnabledFeature("kds");
const barEnabled = hasAnyEnabledFeature("bar");
const serviceEnabled = kitchenEnabled || barEnabled;
```

Use the actual types and utilities in the project rather than copying this exact pseudocode without inspection.

---

# 21. Data-Driven Configuration

Do not hard-code module cards repeatedly throughout the component.

Create a data-driven configuration layer based on the existing module registry.

A possible view model may include:

```ts
interface AdminModuleView {
  id: string;
  label: string;
  description: string;
  status: "enabled" | "partial" | "disabled";
  includedFeatureKeys: string[];
  configurable: boolean;
  children?: AdminModuleView[];
}
```

Service may be represented as a display-only parent with existing KDS and Bar modules as children.

Do not move the actual business logic into the UI configuration.

The interface should make it possible to add additional completed Service submodules later by extending configuration rather than rewriting the page.

Do not render incomplete capabilities.

---

# 22. Loading State

While tenant data is loading, show structured skeletons for:

* Header
* Tabs
* Form fields
* Module cards

Do not display a blank page.

Do not show false disabled states before the tenant data is available.

---

# 23. Error Handling

Handle:

* Tenant not found
* Unauthorized access
* Failed tenant update
* Failed owner update
* Invalid email
* Invalid password
* Network failure
* Unexpected server response

Use user-friendly messages.

Example:

```text
We could not save the tenant configuration. No changes were applied.
```

Preserve the administrator’s unsaved form state after a failed save.

Do not reset the form on failure.

---

# 24. Accessibility

The interface must support:

* Keyboard navigation
* Visible focus indicators
* Screen-reader labels
* Correct dialog focus trapping
* Escape-to-close for drawers and dialogs
* Semantic field labels
* Error descriptions connected to fields
* Status communication that does not rely on colour alone
* Minimum accessible touch-target sizes

Use appropriate Radix UI primitives already available in the project.

---

# 25. Responsive Behavior

## Desktop

* Two-column module grid
* Right-side Service drawer
* Sticky save bar
* Wide content container

## Tablet

* Two-column or single-column module grid depending on width
* Service drawer may use a wider percentage of the screen

## Mobile

* Single-column module cards
* Full-screen Service configuration dialog or sheet
* Sticky action bar with stacked or compact actions
* Tabs must remain scrollable or wrap cleanly
* No horizontal page overflow

---

# 26. Visual Design

Preserve the current Chambu Admin visual language:

* White or very light neutral backgrounds
* Green primary action colour
* Dark navy text
* Subtle borders
* Clear spacing
* Minimal shadows
* Compact enterprise-administration appearance

Improve hierarchy through:

* Section headings
* Status badges
* Module icons
* Consistent card padding
* Better use of width
* Clear primary and secondary buttons

Do not perform a full brand redesign.

Do not add excessive gradients, animations, glass effects, or decorative illustrations.

---

# 27. Component Structure

Use a maintainable component structure.

Possible components include:

```text
TenantEditor
TenantHeader
TenantEditorTabs
TenantOverviewForm
TenantStatusControl
TenantModulesPanel
TenantModuleCard
ServiceConfigurationDrawer
ServicePresetSelector
ServiceSubmoduleCard
OwnerAccountPanel
ChangeReviewDialog
UnsavedChangesBar
```

These names are suggestions.

Follow the existing folder and component conventions in the codebase.

Do not create unnecessary abstractions for components used only once when a local component is clearer.

---

# 28. State Management

Use React state and form utilities already used by the project.

Do not introduce Zustand solely for this page.

Maintain:

* Original tenant values
* Current edited tenant values
* Current active tab
* Service drawer state
* Change-review dialog state
* Save loading state
* Owner update state

Derive dirty state by comparing normalized editable values.

Avoid storing duplicated derived state where possible.

---

# 29. Validation

Validate:

## Shop name

* Required
* Non-empty after trimming
* Existing length constraints

## Owner email

* Required when email-update mode is active
* Valid email format

## Password

* Required when password-update mode is active
* Must satisfy existing backend rules
* Confirmation must match

## Service

* Service cannot be saved as enabled with no selected Service submodule
* Service parent status must match its children

Do not invent stricter business rules than the backend unless they are required to prevent invalid UI states.

---

# 30. Testing

Add or update tests for:

* Existing tenant data loading
* Retail enabled state
* Rentals enabled state
* Pharmacy enabled state
* Kitchen-only Service state
* Bar-only Service state
* Kitchen-and-Bar Service state
* Disabled Service state
* Service preset selection
* Custom Service selection
* Service disable confirmation
* Dirty-state detection
* Discard changes
* Change-review summary
* Successful save
* Failed save
* Owner email update
* Password validation
* Responsive drawer behavior
* Keyboard interaction
* Legacy feature normalization

Where the current project lacks a test framework for these components, provide a manual verification checklist instead of adding an unrelated testing stack.

---

# 31. Manual Verification Checklist

Verify the following manually:

1. Open an existing tenant with all modules enabled.
2. Confirm all four primary module cards display correctly.
3. Confirm Service shows Kitchen and Bar.
4. Disable Kitchen while keeping Bar enabled.
5. Confirm Service shows `Partially enabled`.
6. Save and reload.
7. Confirm the selection remains correct.
8. Disable Bar and enable Kitchen.
9. Save and reload.
10. Confirm existing `kds.*` keys remain compatible.
11. Disable Service completely.
12. Confirm no KDS or Bar data is deleted.
13. Re-enable Service.
14. Confirm the configuration drawer works on mobile.
15. Change the shop name.
16. Confirm the review dialog shows the exact change.
17. Change the owner email.
18. Confirm the email update uses the owner-update API.
19. Set a new password.
20. Confirm the password field clears after success.
21. Trigger a failed tenant update.
22. Confirm unsaved values remain on screen.
23. Confirm keyboard navigation works through tabs, module controls, drawer, and dialogs.

---

# 32. Acceptance Criteria

The task is complete when:

* The Edit Tenant page uses a clearer tabbed layout.
* The page makes better use of desktop screen width.
* Overview, Modules & Access, and Owner Account are clearly separated.
* Retail, Service, Rentals, and Pharmacy appear as primary module cards.
* Service can be configured through a dedicated drawer.
* Kitchen Operations can be selected independently.
* Bar & Beverage can be selected independently.
* Kitchen and Bar continue using their existing feature keys.
* Service correctly displays enabled, partially enabled, or disabled.
* Service presets work as selection shortcuts.
* Disabling Service does not delete business data.
* Staff permissions are not modified by tenant entitlement changes.
* Existing tenant feature records remain compatible.
* Shop name and tenant status can be updated safely.
* Owner email and password operations are deliberate and separate.
* Unsaved changes are clearly indicated.
* Administrators can review exact changes before saving.
* Failed saves do not discard edited values.
* The layout works on desktop, tablet, and mobile.
* The interface is keyboard accessible.
* No incomplete Hospitality capability is exposed.
* No existing tenant, authentication, or module workflow is broken.

---

# 33. Required Delivery Summary

At completion, provide:

* List of files created
* List of files modified
* Explanation of how Service state is derived
* Explanation of how existing `kds.*` and `bar.*` keys were preserved
* Explanation of how tenant updates are submitted
* Explanation of owner-account update behavior
* Screenshots of:

  * Overview
  * Modules & Access
  * Service configuration drawer
  * Change-review dialog
  * Mobile layout
* Manual testing results
* Any limitations discovered in the existing APIs
* Confirmation that no Hospitality business functionality was created as part of this admin-interface task
