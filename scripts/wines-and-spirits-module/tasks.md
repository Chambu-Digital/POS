# Implementation Plan: Wines & Spirits Module

## Overview

This plan migrates the existing minimal bar sale endpoint into a full-featured wines and spirits management system in five phases. Each phase builds on the previous one without breaking existing functionality. TypeScript is used throughout, matching the project's language and toolchain.

## Tasks

- [ ] 1. Phase 1 — Schema Foundation & Feature Flags
  - [x] 1.1 Add seven new Mongoose schemas to `lib/models/schemas.ts`
    - Add `barBrandSchema` with fields: userId, branchId, name, description, category, isArchived, compound unique index on `{ userId, name }`
    - Add `barInventoryItemSchema` with fields: userId, branchId, brandId, size, buyingPrice, bottleSellingPrice, stock, lowStockThreshold, isActive
    - Add `barServingSchema` with fields: userId, branchId, inventoryItemId, name, sellingPrice, unitsProduced (min: 1), isActive
    - Add `barBottleSchema` with fields: userId, branchId, inventoryItemId, bottleNumber, state (full/open/closed), openedBy, openedAt, closedAt, expectedUnits, remainingUnits, actualUnitsSold, difference; partial unique index on `{ userId, branchId, inventoryItemId, state }` where `state = 'open'`
    - Add `barTabSchema` with embedded `barTabPaymentSchema` (amount, method, amountGiven, change, mpesaCode, mpesaPhone, recordedBy); tab fields: userId, branchId, staffId, tabNumber (unique per userId), customerName, tableNumber, notes, status (open/hold/billing/paid), subtotal, discountPct, discountAmount, total, amountPaid, payments array, saleId, openedAt, closedAt, synced
    - Add `barTabLineSchema` with fields: userId, branchId, tabId, inventoryItemId, servingId (nullable), itemName, servingName, quantity, unitPrice, lineTotal, addedBy, addedAt, voided, voidedBy, voidedAt
    - Add `barAuditLogSchema` with fields: userId, branchId, staffId, operation (enum of 10 operations), referenceId, referenceType, details, timestamp; no pre-save hooks (immutable)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 27.6_

  - [x] 1.2 Register all seven models in `lib/tenant/get-models.ts`
    - Import the seven new schemas from `lib/models/schemas`
    - Add BarBrand, BarInventoryItem, BarServing, BarBottle, BarTab, BarTabLine, BarAuditLog to the `getModels` return object using the `conn.models.X || conn.model('X', xSchema)` pattern
    - _Requirements: 29.1, 29.3_

  - [x] 1.3 Add new bar sub-feature flags to `lib/modules.ts`
    - Add `bar.inventory` feature (label: "Bar Inventory", href: `/dashboard/bar/inventory`, adminOnly: true, defaultOn: false)
    - Add `bar.reports` feature (label: "Bar Reports", href: `/dashboard/bar/reports`, adminOnly: true, defaultOn: false)
    - Add `bar.admin` feature (label: "Bar Administration", href: `/dashboard/bar/brands`, adminOnly: true, defaultOn: false)
    - Keep `bar.tabs` unchanged and as the primary staff-facing feature
    - Add the new keys to `DEFAULT_STAFF_PERMISSIONS` and `DEFAULT_MANAGER_PERMISSIONS` (all false by default)
    - _Requirements: 20.1, 20.3, 20.4, 20.5, 29.1_

- [x] 2. Phase 2 — Service Layer
  - [x] 2.1 Create `lib/bar/serving-engine.ts` with `ServingEngine` class
    - Implement static `computeServing(serving: { sellingPrice: number; unitsProduced: number }, quantity: number): { lineTotal: number; unitsToDeduct: number }`
    - Throw if quantity < 1 or not an integer
    - Accept any positive integer for `unitsProduced` without domain validation
    - Export `ServingEngine` class and `ValidationResult` type
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 24.1, 24.2, 24.3, 24.4_

  - [ ]* 2.2 Write property test for ServingEngine (Property 14 & 4 partial)
    - **Property 14: Serving Engine Accepts Any Positive Integer**
    - **Validates: Requirements 5.5, 5.6, 24.1, 24.3**
    - Use `fc.integer({ min: 1, max: 10000 })` for unitsProduced and quantity; assert no throw and lineTotal = sellingPrice * quantity, unitsToDeduct = unitsProduced * quantity
    - File: `__tests__/bar/serving-engine.test.ts`

  - [x] 2.3 Create `lib/bar/inventory-engine.ts` with `InventoryEngine` class
    - Implement `deductServingUnits(inventoryItemId, units, conn)`: finds open BarBottle, decrements remainingUnits, inserts SERVING_SOLD audit log; returns `{ bottle, remainingUnits }` or throws `NO_OPEN_BOTTLE`
    - Implement `sellSealedBottle(inventoryItemId, staffId, conn)`: decrements BarInventoryItem.stock by 1, throws `INSUFFICIENT_STOCK` if stock is 0, inserts BOTTLE_SOLD audit log
    - Implement `openBottle(inventoryItemId, staffId, conn)`: calls `closeCurrentBottle` if one exists, decrements stock by 1, creates new BarBottle with state 'open', sets expectedUnits from the item's first active serving's unitsProduced, inserts BOTTLE_OPENED audit log
    - Implement `closeCurrentBottle(inventoryItemId, conn)`: finds open bottle, sets state to 'closed', computes actualUnitsSold = expectedUnits - remainingUnits, computes difference = expectedUnits - actualUnitsSold, records closedAt, inserts BOTTLE_CLOSED audit log
    - Implement `getOpenBottle(inventoryItemId, conn)`: returns open BarBottle or null
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 2.4 Write property tests for InventoryEngine (Properties 2, 3, 4)
    - **Property 2: Single Open Bottle Invariant** — Validates: Requirements 7.6, 7.9, 19.7
    - **Property 3: Bottle Difference Round-Trip** — Validates: Requirements 7.8, 8.1, 8.2, 8.3
    - **Property 4: Inventory Deduction Exactness** — Validates: Requirements 6.5, 9.1, 9.2, 9.5, 9.6
    - Use `fc.nat()` for stock counts and unit amounts; assert invariants hold across random inputs
    - File: `__tests__/bar/inventory-engine.test.ts`

  - [x] 2.5 Create `lib/bar/tab-manager.ts` with `TabManager` class
    - Implement `createTab(data, conn)`: generates sequential tabNumber, creates BarTab with status 'open', subtotal/total/amountPaid all 0, empty payments array, inserts TAB_CREATED audit log
    - Implement `addLine(tabId, line, conn)`: validates tab status is 'open' (throws `TAB_LOCKED` otherwise), calls `ServingEngine.computeServing`, calls `InventoryEngine.deductServingUnits` or `sellSealedBottle`, inserts BarTabLine, recomputes and updates tab subtotal/discountAmount/total, inserts TAB_LINE_ADDED audit log
    - Implement `removeLastLine(tabId, conn)`: voids the most-recent non-voided line, restores inventory, recomputes balance
    - Implement `setStatus(tabId, status, conn)`: validates transition is legal per state machine, updates tab, inserts TAB_STATUS_CHANGED audit log
    - Implement `applyDiscount(tabId, discountPct, conn)`: validates discountPct ∈ {0,5,10,15,20}, recomputes discountAmount and total, inserts TAB_DISCOUNT_APPLIED audit log
    - Implement `getRunningBalance(tabId, conn)`: returns { subtotal, discountAmount, total, amountPaid, remaining } derived from live line and payment data
    - _Requirements: 2.5, 2.6, 2.7, 10.1, 10.2, 10.3, 10.4, 10.6, 10.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.7, 12.8, 12.9, 28.1, 28.2, 28.3, 28.4_

  - [ ]* 2.6 Write property tests for TabManager (Properties 1, 5, 6, 10)
    - **Property 1: Tab Running Balance Invariant** — Validates: Requirements 10.2, 10.3, 11.3
    - **Property 5: Tab Status State Machine Constraints** — Validates: Requirements 12.1, 12.7, 12.8, 12.9
    - **Property 6: New Tab Initial State** — Validates: Requirements 2.4, 2.5, 2.6, 2.7
    - **Property 10: Discount Computation Correctness** — Validates: Requirements 28.1, 28.2, 28.3, 28.4
    - File: `__tests__/bar/tab-manager.test.ts`

  - [x] 2.7 Create `lib/bar/payment-handler.ts` with `PaymentHandler` class
    - Implement `recordPayment(tabId, payment, conn)`: validates tab is in 'billing' status, appends payment to tab.payments, recalculates amountPaid, inserts audit log entry; supports cash (with amountGiven/change calculation), card, and mobile_money (with mpesaCode/mpesaPhone)
    - Implement `getRemainingBalance(tabId, conn)`: returns total minus amountPaid
    - Implement `closeTab(tabId, conn)`: validates remaining balance ≤ 0 (or full payment recorded), creates Sale record with `source: 'bar'` mapped from tab fields, writes saleId back to BarTab, updates tab status to 'paid', sets closedAt, sets synced based on Sale save success; on Sale save failure sets `synced: false` and keeps tab in billing status, inserts TAB_CLOSED audit log
    - _Requirements: 11.1, 11.2, 11.3, 12.6, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 21.2, 21.3, 23.1, 23.2, 23.3_

  - [ ]* 2.8 Write property tests for PaymentHandler (Properties 8, 13)
    - **Property 8: Bar Sale Source Tagging** — Validates: Requirements 21.3
    - **Property 13: Failed Sale Sync Flag** — Validates: Requirements 23.1, 23.2, 23.3, 23.4
    - File: `__tests__/bar/payment-handler.test.ts`

- [x] 3. Phase 2 Checkpoint — Service layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Phase 2 — Core API Routes (Brands & Inventory Items)
  - [-] 4.1 Create `app/api/bar/brands/route.ts` (GET, POST)
    - GET: list brands with `?search=&category=&archived=false` query params; filter on userId+branchId; return sorted by name
    - POST: validate body with Zod (`name` required, `description`/`category` optional), check for duplicate name (409 BRAND_DUPLICATE), create BarBrand, insert INVENTORY_ADJUSTED audit log
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [-] 4.2 Create `app/api/bar/brands/[id]/route.ts` (GET, PATCH, DELETE)
    - GET: return brand with its associated BarInventoryItems
    - PATCH: update name/description/category; re-validate uniqueness on name change; insert audit log
    - DELETE: soft-delete by setting `isArchived: true`; preserve all linked data; do not allow hard delete
    - _Requirements: 16.6, 16.7_

  - [ ]* 4.3 Write property test for Brand Name Uniqueness (Property 7)
    - **Property 7: Brand Name Uniqueness** — Validates: Requirements 16.5
    - Assert that creating two brands with the same name (case-insensitive trimmed) returns 409 and no duplicate document exists
    - File: `__tests__/bar/api/brands.test.ts`

  - [-] 4.4 Create `app/api/bar/inventory-items/route.ts` (GET, POST)
    - GET: list items with `?brandId=&lowStock=true`; populate brand name; return with current open bottle state
    - POST: validate body (brandId, size, buyingPrice, bottleSellingPrice, stock required); create BarInventoryItem; insert audit log
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [-] 4.5 Create `app/api/bar/inventory-items/[id]/route.ts` (GET, PATCH)
    - GET: return item with current open bottle status and low-stock alert flag (`stock <= lowStockThreshold`)
    - PATCH: update buyingPrice, bottleSellingPrice, lowStockThreshold; do not allow editing historical transaction data
    - _Requirements: 17.7, 17.8_

  - [-] 4.6 Create `app/api/bar/inventory-items/[id]/stock/route.ts` (POST)
    - Accept `{ adjustment: number, reason: string }` where adjustment can be positive or negative
    - Validate resulting stock will not go below 0
    - Update stock, insert INVENTORY_ADJUSTED audit log with reason
    - _Requirements: 9.5, 27.4_

  - [~] 4.7 Create `app/api/bar/inventory-items/[id]/servings/route.ts` (GET, POST)
    - GET: list all active servings for the item
    - POST: validate body (name, sellingPrice required, unitsProduced required integer ≥ 1); create BarServing; insert audit log
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [~] 4.8 Create `app/api/bar/servings/[id]/route.ts` (PATCH, DELETE)
    - PATCH: update name, sellingPrice, unitsProduced
    - DELETE: check for existing BarTabLine references; return 409 SERVING_IN_USE if any exist; soft-delete by setting `isActive: false` otherwise
    - _Requirements: 18.8, 18.9_

- [ ] 5. Phase 2 — Core API Routes (Bottles & Tabs)
  - [~] 5.1 Create `app/api/bar/bottles/route.ts` (GET) and `app/api/bar/bottles/open/route.ts` (POST)
    - GET: list bottles filtered by `?inventoryItemId=&state=&staffId=`
    - POST open: call `InventoryEngine.openBottle(inventoryItemId, staffId, conn)`; return new BarBottle; handle INSUFFICIENT_STOCK (409)
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 19.1, 19.2, 19.3, 19.7_

  - [~] 5.2 Create `app/api/bar/bottles/[id]/route.ts` (GET) and `app/api/bar/bottles/[id]/close/route.ts` (POST)
    - GET: return bottle detail including difference field
    - POST close: call `InventoryEngine.closeCurrentBottle(inventoryItemId, conn)` for the bottle's item; return updated bottle with actualUnitsSold and difference
    - _Requirements: 7.7, 7.8, 8.1, 8.2, 8.3, 8.4_

  - [~] 5.3 Create `app/api/bar/tabs/route.ts` (GET, POST)
    - GET: list tabs with `?status=open`; return with running balance computed from lines
    - POST: call `TabManager.createTab(data, conn)`; accept optional customerName, tableNumber, notes; return new tab with status 'open'
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 10.1_

  - [~] 5.4 Create `app/api/bar/tabs/[id]/route.ts` (GET, PATCH)
    - GET: return tab with all non-voided lines and payments populated
    - PATCH: accept updates to customerName, tableNumber, notes, status (validate transition), discountPct (call `TabManager.applyDiscount`)
    - _Requirements: 10.2, 10.3, 12.1, 12.3, 12.4, 12.5_

  - [~] 5.5 Create `app/api/bar/tabs/[id]/lines/route.ts` (POST) and `app/api/bar/tabs/[id]/lines/[lineId]/route.ts` (DELETE)
    - POST: call `TabManager.addLine`; on `NO_OPEN_BOTTLE` return 409 `{ requiresBottleOpen: true, inventoryItemId }`; on `TAB_LOCKED` return 409; on `INSUFFICIENT_STOCK` return 409
    - DELETE: void the line (set voided:true), restore inventory via InventoryEngine, recompute tab balance
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 9.6, 10.3, 10.4, 10.6_

  - [~] 5.6 Create `app/api/bar/tabs/[id]/payments/route.ts` (POST)
    - Call `PaymentHandler.recordPayment`; validate method (cash/card/mobile_money); for cash validate amountGiven >= amount and compute change; for mobile_money validate mpesaCode and mpesaPhone
    - _Requirements: 11.1, 11.2, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [~] 5.7 Create `app/api/bar/tabs/[id]/close/route.ts` (POST)
    - Call `PaymentHandler.closeTab`; on Sale save failure set synced:false and return 503 with recoverable state; on success return `{ tab, sale }`
    - _Requirements: 10.7, 12.6, 21.2, 21.3, 23.1, 23.2, 23.3_

  - [ ]* 5.8 Write integration tests for tabs API (Properties 1, 5, 6)
    - Test POST /api/bar/tabs creates tab with status 'open', total 0
    - Test POST /api/bar/tabs/:id/lines deducts inventory, updates running balance
    - Test PATCH /api/bar/tabs/:id with status 'hold' blocks subsequent line additions
    - File: `__tests__/bar/api/tabs.test.ts`

- [ ] 6. Phase 2 — Report & Audit API Routes
  - [~] 6.1 Create `app/api/bar/reports/open-tabs/route.ts` (GET)
    - Return all tabs with status 'open' including running balances (total - amountPaid per tab)
    - _Requirements: 14.1_

  - [~] 6.2 Create `app/api/bar/reports/closed-tabs/route.ts` (GET)
    - Accept `?from=&to=` date range params; return tabs with status 'paid' in range
    - _Requirements: 14.2_

  - [~] 6.3 Create `app/api/bar/reports/outstanding/route.ts` (GET)
    - Return sum of (total - amountPaid) for all open tabs only; paid/hold tabs do NOT contribute
    - _Requirements: 1.2, 14.3_

  - [~] 6.4 Create `app/api/bar/reports/bottle-differences/route.ts` (GET)
    - Return all closed BarBottle documents with inventoryItem name, openedBy staff name, expectedUnits, actualUnitsSold, difference
    - Restrict to `bar.reports` permission (403 if missing)
    - _Requirements: 8.4, 14.4, 20.3_

  - [~] 6.5 Create `app/api/bar/reports/products-sold/route.ts` (GET)
    - Aggregate BarTabLine by inventoryItemId; return quantity sold and total revenue per product in date range
    - _Requirements: 14.5_

  - [~] 6.6 Create `app/api/bar/reports/top-brands/route.ts` (GET)
    - Aggregate via BarTabLine → BarInventoryItem → BarBrand; rank brands by total quantity sold
    - _Requirements: 14.6_

  - [~] 6.7 Create `app/api/bar/reports/staff-differences/route.ts` (GET)
    - Aggregate BarBottle.difference grouped by openedBy staff; return per-staff totals
    - Restrict to `bar.reports` permission (403 if missing)
    - _Requirements: 14.8, 20.3_

  - [~] 6.8 Create `app/api/bar/reports/audit-log/route.ts` (GET)
    - Accept `?staffId=&operation=&from=&to=` filters; return BarAuditLog records read-only; no POST/PATCH/DELETE routes
    - _Requirements: 14.5, 27.1, 27.2, 27.3, 27.5, 27.6_

  - [ ]* 6.9 Write property tests for reports (Properties 9, 11, 12)
    - **Property 9: Search and Filter AND Logic** — Validates: Requirements 26.2, 26.5
    - **Property 11: Outstanding Balance Aggregate** — Validates: Requirements 1.2, 14.3
    - **Property 12: Audit Log Immutability** — Validates: Requirements 27.1, 27.6
    - File: `__tests__/bar/reports.test.ts` and `__tests__/bar/audit-log.test.ts`

- [~] 7. Phase 2 Checkpoint — All API routes and reports complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Phase 3 — State Management (Zustand Store)
  - [~] 8.1 Create `store/bar-store.ts` Zustand store
    - Define `BarState` interface with: openTabs, recentlyClosed, outstandingTotal, activeTabId, activeTab, tabLines, searchQuery, categoryFilter, searchResults, pendingBottleOpen
    - Implement `loadLandingData()`: fetch open tabs and outstanding total from `/api/bar/reports/outstanding` and `/api/bar/tabs?status=open`
    - Implement `openTab(data)`: POST to `/api/bar/tabs`, add to openTabs
    - Implement `addLine(inventoryItemId, servingId, qty)`: POST to `/api/bar/tabs/:id/lines`; on 409 `requiresBottleOpen` set `pendingBottleOpen` state to trigger bottle prompt
    - Implement `setBottleOpenConfirmed(inventoryItemId)`: POST to `/api/bar/bottles/open`, then retry pending add-line
    - Implement `setTabStatus`, `applyDiscount`, `recordPayment`, `closeTab` actions calling respective API routes
    - Implement `setSearchQuery` and `setCategoryFilter` for real-time product search with debounce (200ms)
    - _Requirements: 1.1, 1.2, 1.3, 15.3, 19.1, 19.4, 30.1, 30.2, 30.3_

- [ ] 9. Phase 3 — Landing Page & Tab Components
  - [~] 9.1 Create landing page components in `components/bar/landing/`
    - `OpenTabsGrid.tsx`: renders a responsive grid of TabCard components; displays empty state when no open tabs
    - `TabCard.tsx`: shows tabNumber, customerName, tableNumber, status badge, running total; minimum 44px touch targets; links to tab detail page
    - `OutstandingBadge.tsx`: displays formatted outstanding total from store
    - `RecentlyClosedList.tsx`: shows last 5 paid tabs with closedAt timestamp and total
    - _Requirements: 1.1, 1.2, 1.3, 15.1, 15.2, 15.6_

  - [~] 9.2 Create `app/dashboard/bar/page.tsx` Landing Page
    - Wire `OpenTabsGrid`, `OutstandingBadge`, `RecentlyClosedList` to bar Zustand store
    - Provide "New Tab" button that opens `NewTabForm` dialog; provide "Quick Sale" button that navigates to quick sale flow
    - Load data via `loadLandingData()` on mount; no product search on this page
    - _Requirements: 1.4, 1.5, 1.6, 30.5_

  - [~] 9.3 Create `components/bar/tabs/NewTabForm.tsx`
    - Form fields: Customer Name (optional), Table Number (optional), Notes (optional)
    - Submit calls `openTab` action; closes dialog on success and navigates to new tab detail
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 15.4_

  - [~] 9.4 Create tab detail components in `components/bar/tabs/`
    - `TabStatusBadge.tsx`: color-coded pill for open/hold/billing/paid states
    - `TabLineItem.tsx`: shows itemName, servingName, quantity, unitPrice, lineTotal; void button for owner/manager
    - `RunningBalanceBar.tsx`: displays subtotal, discount, total, paid, remaining live from store
    - `DiscountSelector.tsx`: five preset buttons (0/5/10/15/20%); calls `applyDiscount` action; disabled when tab is not open
    - `PaymentPanel.tsx`: renders cash/card/mobile_money tabs; cash shows amountGiven input and change display; mobile money shows mpesaCode and mpesaPhone inputs
    - _Requirements: 12.1, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 28.1, 28.5_

  - [~] 9.5 Create `app/dashboard/bar/tabs/[id]/page.tsx` Tab Detail Page
    - Left panel: product search (`BrandSearchInput` + `CategoryFilterBar`); right panel: `TabLineItem` list + `RunningBalanceBar` + `DiscountSelector` + `PaymentPanel`
    - On mobile (< 1024px): show one panel at a time with navigation tabs
    - Wire all actions to Zustand store; handle `pendingBottleOpen` state by rendering `BottleOpenPrompt` dialog
    - _Requirements: 10.4, 10.5, 15.3, 15.6, 25.1, 25.2, 25.3, 25.4_

- [ ] 10. Phase 3 — Product Search & Bottle Prompt Components
  - [~] 10.1 Create product search components in `components/bar/product/`
    - `BrandSearchInput.tsx`: debounced (200ms) search input; fetches `/api/bar/brands?search=` and `/api/bar/inventory-items?brandId=`; results appear within 200ms
    - `InventoryItemCard.tsx`: shows brand name, size, bottleSellingPrice, stock count; two action buttons ("Sell Bottle" and "Serve"); buttons disabled when stock = 0
    - `ServingOptionList.tsx`: shows all configured servings for selected item; each serving shows name and sellingPrice; tap to add to tab
    - `CategoryFilterBar.tsx`: filter buttons for Spirits, Beer, Wine, Cocktails, Shots, Soft Drinks; selected category highlighted; combined with search via AND logic
    - _Requirements: 3.2, 3.3, 6.1, 6.2, 6.3, 6.4, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 30.1_

  - [~] 10.2 Create bottle prompt components in `components/bar/bottles/`
    - `BottleOpenPrompt.tsx`: dialog shown when `pendingBottleOpen` is set; displays current open bottle remaining units if exists; shows current stock of sealed bottles; Confirm and Cancel actions; on confirm calls `setBottleOpenConfirmed`
    - `BottleStatusBadge.tsx`: Full / Open / Closed indicator pill
    - `BottleDifferenceRow.tsx`: table row showing bottleNumber, openedBy, openedAt, closedAt, expectedUnits, actualUnitsSold, difference (color-coded: negative = red, zero = green)
    - _Requirements: 7.2, 8.5, 8.6, 19.1, 19.5, 19.6_

- [ ] 11. Phase 3 — Management Pages (Brands, Inventory, Reports)
  - [~] 11.1 Create `app/dashboard/bar/brands/page.tsx` Brand List Page
    - List all brands with search and category filter; "Add Brand" button; archive action per row
    - Each row links to brand detail page showing associated inventory items
    - _Requirements: 16.1, 16.6, 16.7_

  - [~] 11.2 Create `app/dashboard/bar/brands/[id]/page.tsx` Brand Detail Page
    - Show brand info with edit form; list associated BarInventoryItems; link to add new inventory item linked to this brand
    - _Requirements: 16.6_

  - [~] 11.3 Create `app/dashboard/bar/inventory/page.tsx` Inventory List Page
    - List all BarInventoryItems with brand name, size, stock, lowStockAlert badge; filter by brandId and low-stock flag
    - Link to item detail; stock adjustment button calls `/api/bar/inventory-items/:id/stock`
    - _Requirements: 17.6, 17.7_

  - [~] 11.4 Create `app/dashboard/bar/inventory/[id]/page.tsx` Inventory Item Detail Page
    - Show item details with edit form; section for managing servings (add/edit/delete); section for bottle history with `BottleDifferenceRow` components
    - _Requirements: 17.8, 18.1, 18.7, 18.8, 18.9_

  - [~] 11.5 Create `app/dashboard/bar/quick-sale/page.tsx` Quick Sale Flow
    - Step 1: product search (same `BrandSearchInput` + `InventoryItemCard` + `ServingOptionList` components)
    - Step 2: payment panel (`PaymentPanel` component)
    - On payment completion: POST to `/api/bar/sale` with `type: 'quick_sale'`; show receipt summary; clear and return to landing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [~] 11.6 Create `app/dashboard/bar/reports/page.tsx` Reports Dashboard Page
    - Render tabs/sections for each report: Open Tabs, Closed Tabs, Outstanding Balances, Bottle Differences, Products Sold, Top Brands, Staff Differences, Audit Log
    - Restrict Bottle Differences and Staff Differences sections to `bar.reports` permission; show access-denied message otherwise
    - Include date range pickers for closed tabs and audit log reports
    - Import and use `OpenTabsReport`, `BottleDifferencesTable`, `StaffDifferenceReport`, `ProductsSoldChart` components from `components/bar/reports/`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 20.3_

- [~] 12. Phase 3 Checkpoint — UI components wired and connected
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Phase 4 — Refactor Existing Bar Sale Route
  - [~] 13.1 Update `app/api/bar/sale/route.ts` to support new `type` field
    - Accept optional `type: 'quick_sale' | 'tab_close'` field in request body; default to current behavior when `type` is absent (backward compatibility)
    - For `type: 'quick_sale'`: call `InventoryEngine.sellSealedBottle` then create Sale record directly; return `{ sale }`
    - For `type: 'tab_close'`: delegate to `PaymentHandler.closeTab(tabId, conn)`; return `{ tab, sale }`
    - When `type` is absent: execute original logic (create Sale with BAR_PLACEHOLDER_ID) unchanged
    - _Requirements: 29.2, 29.3, 29.6_

  - [ ]* 13.2 Write integration tests for refactored bar sale route
    - Test backward-compatible path (no `type` field) still returns 201 with same response shape
    - Test `type: 'quick_sale'` creates Sale with `source: 'bar'`
    - Test `type: 'tab_close'` delegates to PaymentHandler and returns tab + sale
    - File: `__tests__/bar/api/sale.test.ts`

- [ ] 14. Phase 5 — Migration & Integration
  - [~] 14.1 Export existing BarPage as `LegacyBarPage` fallback component
    - Move current `app/dashboard/bar/page.tsx` content into a new component `components/bar/LegacyBarPage.tsx`
    - Replace `app/dashboard/bar/page.tsx` with the new Landing Page that feature-flags between new UI and legacy
    - Gate behind `bar.newui` feature flag: if enabled show new Landing Page, otherwise render `LegacyBarPage`
    - Add `bar.newui` as a hidden config key (not in MODULES array, set per-tenant in tenant config)
    - _Requirements: 29.5, 29.6_

  - [~] 14.2 Update sidebar navigation in `components/dashboard/sidebar.tsx`
    - Add navigation links for new bar sub-pages: `/dashboard/bar/brands`, `/dashboard/bar/inventory`, `/dashboard/bar/reports`
    - Gate each link behind the corresponding feature key (`bar.admin`, `bar.inventory`, `bar.reports`)
    - Keep existing `/dashboard/bar` link gated behind `bar.tabs`
    - _Requirements: 20.1, 20.2, 20.5_

  - [~] 14.3 Add background sync mechanism for `synced: false` tabs
    - Create `lib/bar/sync-manager.ts` with a `syncPendingTabs(conn)` function
    - Query BarTabs where `synced: false` and `status: 'billing'`; for each, attempt `PaymentHandler.closeTab` again
    - Use tabNumber as idempotency key: check if Sale with that orderNumber already exists before creating a new one
    - Export the function for use in a polling hook or API route
    - _Requirements: 23.3, 23.4, 23.5_

  - [ ]* 14.4 Write property test for sync idempotency (Property 13)
    - **Property 13: Failed Sale Sync Flag** — Validates: Requirements 23.1, 23.2, 23.3, 23.4
    - Assert that calling `syncPendingTabs` multiple times on the same `synced: false` tab creates exactly one Sale document
    - File: `__tests__/bar/payment-handler.test.ts`

  - [ ]* 14.5 Write integration test for full tab lifecycle
    - Create tab → add lines (trigger bottle open prompt) → open bottle → add lines → apply discount → record payment → close tab → verify Sale created with `source: 'bar'` and correct total
    - File: `__tests__/bar/api/tabs.test.ts`

- [~] 15. Final Checkpoint — Full integration and migration complete
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery
- Each task references specific requirements by number for full traceability
- The five-phase structure mirrors the design's migration plan — each phase leaves the system in a working state
- Service layer (Phase 2) is implemented before UI (Phase 3) so components can use real API calls rather than mocks
- The existing `/api/bar/sale` route continues to function unchanged until Task 13.1 explicitly updates it
- Feature flag `bar.newui` (Task 14.1) allows instant rollback to the legacy bar page without a code deployment
- Property tests use fast-check with a minimum of 100 runs per property; unit tests use Vitest
- Test files are co-located under `__tests__/bar/` following the structure described in the design document
- The `BottleOpenPrompt` flow is the most complex UI interaction — it is driven entirely by the `pendingBottleOpen` Zustand state so the prompt can appear from any context (tab detail or quick sale)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "2.5"] },
    { "id": 5, "tasks": ["2.6", "2.7"] },
    { "id": 6, "tasks": ["2.8", "4.1", "4.4", "4.7", "5.3"] },
    { "id": 7, "tasks": ["4.2", "4.3", "4.5", "4.6", "4.8", "5.1", "5.4", "6.1", "6.2", "6.3"] },
    { "id": 8, "tasks": ["5.2", "5.5", "5.6", "5.7", "6.4", "6.5", "6.6", "6.7", "6.8"] },
    { "id": 9, "tasks": ["5.8", "6.9", "8.1"] },
    { "id": 10, "tasks": ["9.1", "9.3", "10.1", "10.2"] },
    { "id": 11, "tasks": ["9.2", "9.4"] },
    { "id": 12, "tasks": ["9.5"] },
    { "id": 13, "tasks": ["11.1", "11.3", "11.5"] },
    { "id": 14, "tasks": ["11.2", "11.4", "11.6"] },
    { "id": 15, "tasks": ["13.1"] },
    { "id": 16, "tasks": ["13.2", "14.1", "14.3"] },
    { "id": 17, "tasks": ["14.2", "14.4"] },
    { "id": 18, "tasks": ["14.5"] }
  ]
}
```
