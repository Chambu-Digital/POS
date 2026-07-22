# Phase 1 — Regression Verification Checklist

Use this checklist after deploying Phase 1 to confirm no existing workflows were broken.

Mark each item ✅ pass, ❌ fail, or ⏭ not applicable.

---

## Authentication and Tenancy

- [ ] Owner can log in with email + password
- [ ] Staff can log in with email + password
- [ ] Staff login page at `/auth/login` works for both owner and staff
- [ ] Logout clears the auth cookie and redirects to `/auth/login`
- [ ] After login, the correct tenant database is selected (verify data belongs to the logged-in tenant)
- [ ] Feature flags from the JWT are loaded into the sidebar correctly
- [ ] Staff permissions are applied — admin-only items are hidden from staff
- [ ] Branch selector appears when tenant has multiple branches
- [ ] Selecting a branch updates the session and branch-scoped data
- [ ] Admin login at `/admin/login` works
- [ ] Admin panel is inaccessible from a non-admin hostname (redirects to `/`)
- [ ] Demo login (`demo@chambudigital.co.ke` / `demoxyz`) succeeds and shows demo data
- [ ] Demo mode mutation protection: POST/PUT/PATCH/DELETE return fake responses

---

## Retail — Sales

- [ ] `/dashboard/retail/sales` renders the POS page
- [ ] `/dashboard/sales` (old path) also renders correctly
- [ ] Products load from API (or IndexedDB when offline)
- [ ] Barcode keyboard scan adds product to cart
- [ ] Camera scanner opens and scans successfully
- [ ] Manual barcode entry adds product to cart
- [ ] Cart persists when navigating away and returning within the same session
- [ ] Quantity +/− and per-item discount work
- [ ] Cart discount applies correctly to total
- [ ] "Complete Sale" navigates to `/dashboard/sales/payment`
- [ ] Cash payment completes and creates a Sale record
- [ ] M-Pesa payment (STK Push and manual code) completes correctly
- [ ] Card payment completes correctly
- [ ] Credit sale deducts from customer credit balance
- [ ] Held orders: hold saves cart, recall restores it
- [ ] Receipt prints correctly (58mm and A4 paper sizes)
- [ ] Offline: product grid loads from IndexedDB when offline
- [ ] Offline: completing a sale queues it as pending_sale
- [ ] Online recovery: pending sales sync when connectivity returns
- [ ] Low stock warning badge appears on products near threshold

---

## Retail — Other

- [ ] `/dashboard/retail/orders` shows order history
- [ ] `/dashboard/retail/inventory` shows product list; add/edit/delete products work
- [ ] Product image upload works
- [ ] CSV product import works
- [ ] `/dashboard/retail/reports` shows sales and inventory reports
- [ ] `/dashboard/retail/expenses` shows expenses; add/approve/reject work
- [ ] `/dashboard/retail/customers` shows customer list; credit balance and ledger visible

---

## Service — Kitchen

- [ ] `/dashboard/service/kitchen/orders` renders Create Order page
- [ ] `/dashboard/kds/orders` (old path) also renders correctly
- [ ] Waiter can create a kitchen order with table, waiter assignment, and items
- [ ] Order appears in chef view at `/dashboard/service/kitchen/chef`
- [ ] Chef can transition order: pending → preparing → ready
- [ ] Waiter view at `/dashboard/service/kitchen/waiter` shows ready orders
- [ ] Waiter can mark order as served
- [ ] Kitchen history at `/dashboard/service/kitchen/history` shows all orders
- [ ] Menu management at `/dashboard/service/kitchen/menu` — add/edit/delete items
- [ ] Kitchen inventory at `/dashboard/service/kitchen/inventory` shows product list
- [ ] Kitchen pages auto-refresh every 5 seconds
- [ ] New order notification sound plays when a new order arrives in chef view

---

## Service — Bar

- [ ] `/dashboard/service/bar` renders bar tabs landing page
- [ ] `/dashboard/bar` (old path) also renders correctly
- [ ] Create a new tab — tab appears in open tabs list
- [ ] Add a serving (portion) to a tab — requires open bottle prompt if none open
- [ ] Open bottle prompt: confirm opens bottle and retries the add
- [ ] Add a sealed bottle sale to a tab
- [ ] Tab total updates correctly after each line item
- [ ] Apply discount to tab — total recalculates
- [ ] Record partial payment on a tab
- [ ] Close tab — creates linked Sale record with `source: 'bar'`
- [ ] Bar inventory at `/dashboard/service/bar/inventory` shows items
- [ ] Bar brands at `/dashboard/service/bar/brands` shows brands
- [ ] Bar reports at `/dashboard/service/bar/reports` shows open tabs and outstanding total
- [ ] Sidebar live indicator (orange dot) appears on Bar Tabs when active
- [ ] Navigating to `/dashboard/bar` (old path) still highlights Service → Bar in sidebar

---

## Rentals

- [ ] `/dashboard/rental-services` shows rental services catalog
- [ ] Add a rental service with pricing tiers and amenities
- [ ] Create a new booking from a service card
- [ ] Booking appears in Bookings tab with status "active"
- [ ] Check out a booking — records payment, creates Sale with `source: 'rental'`
- [ ] Cancel a booking
- [ ] `/dashboard/rentals` (legacy) shows product-based rentals
- [ ] Start a legacy rental — slip dialog appears
- [ ] Process return — calculates duration, records payment
- [ ] Rental receipt prints correctly

---

## Pharmacy

- [ ] `/dashboard/pharmacy/pos` renders pharmacy POS
- [ ] Drugs load into the product grid
- [ ] Barcode scan finds a drug and adds it to cart
- [ ] Checkout: cash payment creates Sale with FEFO batch deduction
- [ ] Checkout: M-Pesa payment creates Sale correctly
- [ ] Credit sale updates customer credit balance
- [ ] Held sales work (hold + recall)
- [ ] `/dashboard/pharmacy/inventory` shows drug catalog and batches
- [ ] Receive stock (new batch) — batch appears under drug with correct expiry
- [ ] Expiry tab shows batches expiring within 90 days
- [ ] Recall individual batch — batch status changes to "recalled"
- [ ] Global lot recall — all batches matching lot number recalled
- [ ] Batch history dialog shows inventory transactions

---

## Admin Panel

- [ ] Create a new tenant — assigns cluster, constructs MongoDB URI
- [ ] Tenant appears in list with correct module labels (Retail, Service, etc.)
- [ ] Edit tenant — feature toggles save correctly
- [ ] Provision owner account on new tenant
- [ ] Update owner credentials
- [ ] Create a new cluster
- [ ] Cluster tenant count increments on tenant creation

---

## Platform

- [ ] Settings page: save general info (shop name, phone, address, logo) — persists
- [ ] Logo upload: image appears in sidebar after save
- [ ] Staff management: add staff, assign permissions — staff can log in with correct access
- [ ] Staff permissions modal shows Retail / Service / Rentals / Pharmacy groups
- [ ] PWA install prompt appears on mobile browsers
- [ ] Service worker registers successfully (check DevTools → Application)
- [ ] M-Pesa STK Push sends prompt to phone
- [ ] Media upload: product image uploads and displays

---

## Navigation

- [ ] Retail group collapses/expands correctly
- [ ] Service group collapses/expands correctly
- [ ] Kitchen sub-section collapses/expands within Service
- [ ] Bar sub-section collapses/expands within Service
- [ ] Active route is highlighted correctly when navigating via sidebar
- [ ] Active route is highlighted correctly when arriving via old bookmarked path
- [ ] Features disabled by tenant flags do not appear in sidebar
- [ ] Staff-only features (adminOnly: true) are hidden from staff logins
- [ ] Mobile hamburger menu opens and closes sidebar
- [ ] Tapping a sidebar item on mobile closes the sidebar
