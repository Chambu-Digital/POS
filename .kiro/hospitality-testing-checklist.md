# Hospitality Module - Testing Checklist

## Quick Testing Guide

Use this checklist to verify all hospitality features are working correctly before production deployment.

---

## ✅ **Phase 1-4: Foundation & POS**

### **Menu Management** (`/dashboard/hospitality/menu`)
- [ ] Create a new menu item (for-sale, whole-only)
- [ ] Create a new menu item (for-sale, servable)
- [ ] Add serving types to servable item
- [ ] Set default serving type
- [ ] Create an ingredient item
- [ ] Create a category
- [ ] Reorder categories
- [ ] Edit menu item
- [ ] Delete menu item (check validation if used in orders)

### **Inventory Management** (`/dashboard/hospitality/inventory`)
**Tab 1: For Sale**
- [ ] View tracked items with stock levels
- [ ] See serving breakdown for servable items
- [ ] Check low stock indicators
- [ ] Check out-of-stock indicators

**Tab 2: Ingredients**
- [ ] View ingredient inventory
- [ ] See quantities and units
- [ ] Check low stock for ingredients

**Tab 3: Receive Stock**
- [ ] Search and add item to receiving list
- [ ] Add multiple items
- [ ] Enter quantities
- [ ] Add supplier reference
- [ ] Complete receiving
- [ ] Verify stock updated

### **POS Interface** (`/dashboard/hospitality/pos`)
**Basic Operations:**
- [ ] Search menu items
- [ ] Filter by category
- [ ] Click servable item → serving modal opens
- [ ] Select serving type
- [ ] Enter quantity
- [ ] Add to cart
- [ ] Click whole-only item → adds directly
- [ ] Click untracked item → adds without stock check
- [ ] Update quantity in cart
- [ ] Remove item from cart
- [ ] Apply cart discount
- [ ] Clear cart

**Stock Validation:**
- [ ] Try to add out-of-stock item (should fail)
- [ ] Try to exceed available stock (should fail)
- [ ] Add item with low stock (should warn)
- [ ] Add untracked item (no stock check)

**Checkout:**
- [ ] Select payment method (cash, M-Pesa, card, credit)
- [ ] Select order type (dine-in, takeaway, delivery)
- [ ] Enter table number (dine-in only)
- [ ] Complete sale
- [ ] Verify success message
- [ ] Check stock deducted for tracked items
- [ ] Check no deduction for untracked items

**Held Orders:**
- [ ] Hold an order with table name
- [ ] Hold an order without name
- [ ] View held orders
- [ ] Recall a held order
- [ ] Delete a held order
- [ ] Verify persistence after page refresh

**Mobile:**
- [ ] Switch between Menu/Cart tabs
- [ ] Add items on mobile
- [ ] Complete sale on mobile

---

## ✅ **Phase 5: Stock Operations**

### **Stock History** (`/dashboard/hospitality/stock`)
- [ ] View all movements
- [ ] Filter by type (sale, receive, production, adjustment, waste)
- [ ] Filter by date (today, week, month, all)
- [ ] Search by item name
- [ ] See before/after states
- [ ] Export movements to CSV

### **Log Waste**
- [ ] Click "Log Waste" button
- [ ] Search for item
- [ ] Select item from results
- [ ] Enter quantity wasted
- [ ] Select reason (spillage, breakage, expiry)
- [ ] Submit waste log
- [ ] Verify stock deducted
- [ ] Check movement appears in history

### **Manual Adjustment**
- [ ] Click "Adjust Inventory" button
- [ ] Search for item
- [ ] Select item
- [ ] Choose adjustment type (add/subtract/set)
- [ ] Enter value
- [ ] Enter reason
- [ ] Submit adjustment
- [ ] Verify stock updated
- [ ] Check movement in history

### **Consolidate Partials**
- [ ] Click "Consolidate Partials" button
- [ ] Verify only items with 2+ partials shown
- [ ] Select item to consolidate
- [ ] Confirm consolidation
- [ ] Verify partial count reduced
- [ ] Check movement logged

---

## ✅ **Phase 6: Production Tracking**

### **Log Production** (`/dashboard/hospitality/production`)
- [ ] Click "Log Production" button
- [ ] Search for produced item
- [ ] Select item (for-sale)
- [ ] Select serving type (if servable)
- [ ] Enter expected yield
- [ ] Enter actual yield (exact match)
- [ ] Submit → should auto-approve
- [ ] Check inventory updated

### **Production with Variance**
**Low Variance (<20%):**
- [ ] Enter expected: 100 servings
- [ ] Enter actual: 95 servings (-5%)
- [ ] Submit → auto-approve
- [ ] Check inventory updated

**High Variance (>20%):**
- [ ] Enter expected: 100 servings
- [ ] Enter actual: 75 servings (-25%)
- [ ] See high variance warning
- [ ] Submit → status = pending
- [ ] Check inventory NOT updated yet

### **Add Ingredients**
- [ ] Click "Add Ingredient"
- [ ] Search ingredient
- [ ] Select ingredient
- [ ] Enter quantity used
- [ ] Add to list
- [ ] Add multiple ingredients
- [ ] Remove an ingredient
- [ ] Submit production with ingredients

### **Approval Workflow**
- [ ] View pending production (status = pending)
- [ ] Click approve button
- [ ] Confirm approval
- [ ] Verify status changed to approved
- [ ] Check inventory now updated
- [ ] Try rejecting a pending production
- [ ] Enter rejection reason
- [ ] Verify status = rejected

### **Production History**
- [ ] Filter by status (all, pending, approved, rejected)
- [ ] See variance indicators (green/red/orange)
- [ ] Check ingredient breakdown displayed
- [ ] View notes on production logs

---

## ✅ **Phase 7: Reports & Analytics**

### **Generate Report** (`/dashboard/hospitality/reports`)
- [ ] Set start date (30 days ago)
- [ ] Set end date (today)
- [ ] Click "Generate Report"
- [ ] Verify loading state
- [ ] Check report loads successfully

### **Summary Cards**
- [ ] Total Orders count is correct
- [ ] Total Revenue matches order totals
- [ ] Average Order Value calculated correctly
- [ ] Date range displayed

### **Payment Methods Breakdown**
- [ ] All payment methods shown
- [ ] Amounts match order records
- [ ] Percentages add up to 100%
- [ ] Progress bars sized correctly

### **Order Types Breakdown**
- [ ] Dine-in, Takeaway, Delivery shown
- [ ] Amounts match order records
- [ ] Percentages calculated correctly

### **Top 10 Items**
- [ ] Items sorted by revenue (highest first)
- [ ] Quantity sold shown
- [ ] Revenue shown
- [ ] Percentages calculated
- [ ] Top 3 have special badges

### **Quick Insights**
- [ ] Best selling item identified
- [ ] Low AOV warning (if AOV < 500)
- [ ] Single payment method alert (if only 1)
- [ ] No sales message (if totalOrders = 0)

### **Export**
- [ ] Click "Export CSV"
- [ ] File downloads
- [ ] Open in Excel/Sheets
- [ ] Verify all data present
- [ ] Check filename has date

---

## ✅ **Bonus: Orders Page**

### **Order History** (`/dashboard/hospitality/orders`)
- [ ] View all completed orders
- [ ] Search by order number
- [ ] Search by table number
- [ ] Search by item name
- [ ] Filter by status (pending, completed, cancelled)
- [ ] See order cards with summary

### **Order Details**
- [ ] Click order card
- [ ] Details modal opens
- [ ] See full order info
- [ ] Check item list with servings
- [ ] Verify totals calculation
- [ ] See payment method and status
- [ ] Close modal

### **Export Orders**
- [ ] Click "Export CSV"
- [ ] Download orders list
- [ ] Open in Excel/Sheets
- [ ] Verify order data

---

## 🔍 **Integration Testing**

### **End-to-End Workflow 1: New Item Sale**
1. [ ] Create menu item (tracked, servable)
2. [ ] Add serving types (Tot, Prime)
3. [ ] Receive stock (10 bottles)
4. [ ] Go to POS
5. [ ] Add item, select Tot, quantity 5
6. [ ] Complete sale
7. [ ] Check Inventory → stock deducted
8. [ ] Check Stock page → sale movement logged
9. [ ] Check Orders → sale appears
10. [ ] Generate report → sale included

### **End-to-End Workflow 2: Production**
1. [ ] Create producible item (e.g., Fresh Juice)
2. [ ] Create ingredients (Sugar, Water, Lemons)
3. [ ] Receive ingredient stock
4. [ ] Log production:
    - Expected: 50L = 400 servings
    - Actual: 390 servings
    - Add ingredients used
5. [ ] Submit (auto-approve: -2.5% variance)
6. [ ] Check Inventory → 390 servings available
7. [ ] Check Stock → production movement logged
8. [ ] Go to POS → sell 10 servings
9. [ ] Check Inventory → 380 servings remain

### **End-to-End Workflow 3: Waste & Adjustment**
1. [ ] Break a bottle (waste)
2. [ ] Log waste → 1 bottle, reason: Breakage
3. [ ] Check Inventory → deducted
4. [ ] Check Stock → waste movement logged
5. [ ] Physical count reveals discrepancy
6. [ ] Adjust Inventory → set to actual count
7. [ ] Enter reason: Physical count correction
8. [ ] Check Stock → adjustment logged

### **End-to-End Workflow 4: Multi-User**
1. [ ] User A: Add item to cart
2. [ ] User B: Add same item to cart
3. [ ] User A: Complete sale (stock: 10 → 9)
4. [ ] User B: Try to complete sale
5. [ ] Check stock refreshes correctly
6. [ ] Both sales processed without overselling

---

## 🐛 **Edge Cases & Error Handling**

### **Stock Management**
- [ ] Try to sell item with 0 stock → error message
- [ ] Try to sell more than available → error message
- [ ] Sell servable item with no servings → error
- [ ] Receive negative quantity → validation error
- [ ] Adjust stock below zero → validation error

### **Production**
- [ ] Submit production without item → error
- [ ] Submit without yield values → error
- [ ] Expected yield = 0 → validation error
- [ ] Actual yield negative → validation error
- [ ] Add same ingredient twice → should allow (multiple uses)

### **Reports**
- [ ] Start date after end date → swap or error
- [ ] No data in date range → show empty state
- [ ] Very large date range → handle gracefully
- [ ] Export with no data → empty CSV or message

### **Concurrency**
- [ ] Two users sell last item simultaneously
- [ ] User A adds to cart, User B sells item, User A tries checkout
- [ ] Transaction rollback on failure
- [ ] No negative inventory

---

## 📱 **Mobile Testing**

### **Responsive Design**
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on tablet (iPad/Android)
- [ ] Portrait orientation
- [ ] Landscape orientation
- [ ] Touch targets sized correctly (44px+)

### **Mobile-Specific Features**
- [ ] Bottom tab navigation works
- [ ] Modals display correctly
- [ ] Forms are usable
- [ ] Search keyboards appropriate (numeric for qty)
- [ ] Scroll areas work smoothly
- [ ] No horizontal scrolling

---

## ⚡ **Performance Testing**

### **Load Times**
- [ ] POS page loads <2 seconds
- [ ] Menu page loads <2 seconds
- [ ] Inventory page loads <2 seconds
- [ ] Stock history with 1000+ records performs well
- [ ] Reports generate <3 seconds

### **API Response Times**
- [ ] GET /api/hospitality/pos/menu <500ms
- [ ] POST /api/hospitality/sales <1000ms
- [ ] GET /api/hospitality/stock/history <500ms
- [ ] GET /api/hospitality/reports/sales <2000ms

### **Concurrent Users**
- [ ] 5 users making sales simultaneously
- [ ] No race conditions
- [ ] No inventory discrepancies
- [ ] All transactions complete successfully

---

## 🔒 **Security & Permissions**

### **Permission Checks**
- [ ] Staff without `hospitality.menu` can't access Menu page
- [ ] Staff without `hospitality.reports` can't access Reports
- [ ] Staff with `hospitality.pos` can make sales
- [ ] Owner can access all pages

### **Data Validation**
- [ ] SQL injection attempts fail
- [ ] XSS attempts sanitized
- [ ] File upload validation (images only)
- [ ] API endpoints check authentication
- [ ] Tenant isolation working

---

## 📊 **Data Accuracy**

### **Inventory Calculations**
- [ ] Serving availability correct for fraction-based
- [ ] Serving availability correct for volume-based
- [ ] Multiple serving types from same item accurate
- [ ] FIFO consumption works (oldest partial first)
- [ ] Partial consolidation reduces fragmentation

### **Report Accuracy**
- [ ] Total revenue matches sum of orders
- [ ] Average order value calculated correctly
- [ ] Payment method breakdown adds to 100%
- [ ] Top items sorted by revenue descending
- [ ] Percentages calculated correctly

### **Movement Audit Trail**
- [ ] Every stock change logged
- [ ] Before/after states accurate
- [ ] Timestamps correct
- [ ] User tracking works
- [ ] Reference linking works (sale ID, production ID)

---

## ✅ **Final Sign-Off**

### **Before Production:**
- [ ] All critical bugs fixed
- [ ] All user roles tested
- [ ] Mobile testing complete
- [ ] Performance acceptable
- [ ] Security audit passed
- [ ] Data backup strategy in place
- [ ] Rollback plan prepared
- [ ] User training completed
- [ ] Documentation finalized

### **Production Deployment:**
- [ ] Database migrations run
- [ ] Environment variables set
- [ ] SSL certificates valid
- [ ] Monitoring enabled
- [ ] Error tracking active (Sentry/etc.)
- [ ] Backup automated
- [ ] Support team briefed

---

## 📞 **Issue Reporting Template**

When you find a bug, report using this format:

**Bug Title:** Brief description

**Steps to Reproduce:**
1. Go to [page]
2. Click [button]
3. Enter [data]
4. Observe [issue]

**Expected Result:** What should happen

**Actual Result:** What actually happened

**Screenshots:** Attach if visual bug

**Environment:**
- Browser: Chrome/Safari/etc.
- Device: Desktop/Mobile/Tablet
- User Role: Owner/Staff
- Date & Time: When it occurred

---

**Happy Testing! 🎉**
