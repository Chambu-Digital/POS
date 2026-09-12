# Bar Sales System - Diagnostic Report

## Executive Summary

Based on comprehensive code analysis of the bar sales system, I've confirmed **4 critical architectural issues** that explain the "bottle not found" and "saleId missing" errors you're experiencing.

---

## Confirmed Issues

### ✗ ISSUE 1: No Atomic Transactions

**Code Evidence:** `app/api/bar/pos-sale/route.ts` (lines 41-314)

The sale process has **8+ separate database operations** with NO transaction wrapper:

```
1. Create synthetic tab (line 137)
2. Add N tab lines (loop at line 159)
   - Each line triggers bottle deduction (TabManager.addLine)
3. Close synthetic tab (line 217)
4. Create Sale record (line 229)
```

**What Happens When Step 4 Fails:**
- ✓ Tab created and paid
- ✓ Bottles deducted
- ✗ Sale record not created
- **Result:** "saleId missing" error, inventory lost without revenue

**Evidence in Code:**
```typescript
// Line 229 - Sale creation AFTER tab already closed
const sale = await models.Sale.create({
  // ... if this fails, tab is already paid and bottles deducted
})
```

**Fix Priority:** 🔴 CRITICAL

---

### ✗ ISSUE 2: No Idempotency Protection

**Code Evidence:** `app/api/bar/pos-sale/route.ts` + `app/dashboard/sales/payment/page.tsx`

**Frontend (payment page):**
- No request deduplication
- No loading state prevents double-clicks
- No request ID generation

**Backend:**
- No idempotency key checking
- Same cart can be processed multiple times
- Each execution creates new synthetic tab + sale

**What Happens on Double-Click:**
```
Request 1: Creates tab DIRECT-1, deducts bottles, creates Sale #1
Request 2: Creates tab DIRECT-2, deducts SAME bottles again, creates Sale #2

Result:
- Customer charged once
- Inventory deducted twice
- Two sale records
- Bottle fraction goes negative or error
```

**Evidence in Code:**
```typescript
// Line 137 - No duplicate check
const syntheticTab = await TabManager.createSyntheticDirectSaleTab(...)
// Every call creates a NEW tab, even for same cart
```

**Fix Priority:** 🔴 CRITICAL

---

### ✗ ISSUE 3: Stale Bottle References in Cart

**Code Evidence:** `app/dashboard/bar/pos/page.tsx` (line 282)

**How Cart Items Are Built:**
```typescript
// Line 282 - Bottle ID embedded when item added to cart
const productId = `${product._id}__${serving._id}__${bottleId}`

// Line 520 - Cart stored in sessionStorage
sessionStorage.setItem('pendingSale', JSON.stringify({ cart, ... }))

// Payment happens LATER (maybe minutes later)
```

**Timeline Problem:**
```
10:00:00 → User adds "Jameson Tot" to cart
          → bottleId = "bottle-123" (75% full)
          → Cart saved to sessionStorage

10:02:30 → Another staff member sells last servings from bottle-123
          → Bottle closes automatically

10:03:00 → Original user clicks "Pay"
          → POST /api/bar/pos-sale with bottleId = "bottle-123"
          → Backend tries to deduct from closed bottle
          → Error: "BOTTLE_NOT_FOUND_OR_CLOSED"
```

**Evidence in Code:**
```typescript
// lib/bar/inventory-engine.ts, line 42
const bottle = await models.BarBottle.findOne({
  _id: bottleId,
  state: 'open',  // ← Fails if bottle closed since cart was built
})

if (!bottle) {
  throw new Error('BOTTLE_NOT_FOUND_OR_CLOSED')  // ← THIS IS YOUR ERROR
}
```

**Fix Priority:** 🔴 CRITICAL

---

### ✗ ISSUE 4: No Validation Before Deduction

**Code Evidence:** `lib/bar/tab-manager.ts` (line 236-404)

**Current Flow:**
```typescript
// Line 290 - Bottle ID comes from frontend cart
if (line.bottleId) {
  targetBottleId = line.bottleId  // ← Trust frontend completely
} else {
  // Query fresh bottles...
}

// Line 314 - Direct deduction, no revalidation
await InventoryEngine.deductFraction(
  targetBottleId,  // ← Could be stale, closed, or from wrong branch
  result.fractionToDeduct,
  line.staffId,
  conn
)
```

**Missing Checks:**
1. ✗ Is bottle still open?
2. ✗ Does bottle belong to current branch?
3. ✗ Does bottle have enough remaining fraction?

**These checks only happen INSIDE deductFraction**, after tab line already created.

**Fix Priority:** 🟠 HIGH

---

## Root Cause Analysis

### Why Payment Fails

**Sequence of Events:**

```
User Action                    System State                    Potential Failure Point
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Add serving to cart    → Cart: [{ bottleId: X }]       [OK]

2. Wait 2 minutes         → Bottle X gets closed          [⚠️ Stale reference]

3. Click "Pay"            → POST /api/bar/pos-sale        [🔄 Processing]

4. Create synthetic tab   → Tab DIRECT-1 created          [OK]

5. Add line with bottleId → Try deduct from bottle X      [❌ BOTTLE_NOT_FOUND]
                                                           [BUT tab already exists!]

6. Error thrown           → Response: 500 error           [User sees error]

7. User clicks "Pay" again→ POST /api/bar/pos-sale        [🔄 Duplicate request]

8. Create synthetic tab   → Tab DIRECT-2 created          [❌ Duplicate]

9. Select different bottle→ Bottle Y auto-opened          [Deduction succeeds]

10. Create Sale           → Sale #1 created               [OK]

11. First request retries → Creates Sale #2               [❌ Duplicate sale]
```

**Result:**
- Multiple synthetic tabs in database
- Possible duplicate sales
- Inventory inconsistencies
- Frustrated users

---

## Why Current Architecture is Fragile

### MongoDB Without Transactions

**Your Code Does:**
```typescript
// Step 1
const tab = await models.BarTab.create({ ... })  // ✓ Committed

// Step 2
await TabManager.addLine(tabId, item1, conn)     // ✓ Committed

// Step 3
await TabManager.addLine(tabId, item2, conn)     // ✓ Committed

// Step 4 - IF THIS FAILS:
const sale = await models.Sale.create({ ... })   // ✗ Error thrown
```

**Problem:** Steps 1-3 are already committed to database. Cannot roll back.

**What You Need:**
```typescript
const session = await conn.startSession()
await session.withTransaction(async () => {
  // All operations in transaction
  // If ANY fails, ALL roll back
})
```

**But:** Your code doesn't use MongoDB transactions anywhere.

---

## Hypothesis Validation Summary

| Hypothesis | Status | Evidence |
|------------|--------|----------|
| Bottle timing issue | ✅ CONFIRMED | Cart stores stale bottleId (line 282) |
| No atomic transactions | ✅ CONFIRMED | No session.withTransaction() in code |
| SaleId missing | ✅ CONFIRMED | Sale created AFTER tab closed (line 229) |
| No idempotency | ✅ CONFIRMED | No duplicate request checking |
| State machine issues | ⚠️ PARTIAL | Tab can be paid without sale (no guards) |
| Branch filtering | ⚠️ UNCLEAR | Needs live data to test |

---

## Recommended Fix Priority

### 🔴 IMMEDIATE (This Week)

**1. Add Bottle Revalidation**
```typescript
// Before deducting, check if bottle still valid
const bottle = await models.BarBottle.findOne({
  _id: bottleId,
  state: 'open',
  branchId: currentBranchId
})

if (!bottle) {
  // Return user-friendly error with bottle selection UI
  return NextResponse.json({
    error: 'BOTTLE_UNAVAILABLE',
    message: 'Bottle no longer available. Please select another.',
    requiresBottleSelection: true,
    inventoryItemId: line.inventoryItemId
  }, { status: 409 })
}
```

**2. Add Request Deduplication**
```typescript
// Frontend generates request ID
const requestId = crypto.randomUUID()
sessionStorage.setItem('lastPaymentRequestId', requestId)

// Backend checks for duplicate
const existing = await models.Sale.findOne({
  requestId,
  createdAt: { $gte: new Date(Date.now() - 60000) }
})

if (existing) {
  return NextResponse.json({ sale: existing }, { status: 200 })
}
```

**3. Disable Pay Button While Processing**
```typescript
<Button
  onClick={processPayment}
  disabled={processing || !selectedPayment}
>
  {processing ? 'Processing...' : 'Complete Payment'}
</Button>
```

### 🟠 SHORT TERM (Next 2 Weeks)

**4. Wrap in MongoDB Transactions**
```typescript
const session = await conn.startSession()

try {
  await session.withTransaction(async () => {
    // All operations here
    // If ANY fails, transaction rolls back
  })
} finally {
  await session.endSession()
}
```

**5. Add State Machine Guards**
```typescript
// Before marking tab paid, ensure sale created
if (!saleId) {
  throw new Error('Cannot mark tab paid without sale record')
}

tab.saleId = saleId
tab.status = 'paid'
await tab.save()
```

### 🟡 MEDIUM TERM (Next Month)

**6. Implement Bottle Reservation**
- When item added to cart → reserve bottle for 5 minutes
- Auto-release on timeout or sale completion
- Prevents bottle from being closed while in cart

**7. Add Compensation Logic**
- If sale creation fails, void tab and restore inventory
- Implement proper rollback procedures

**8. Health Checks**
- Daily job to find orphaned tabs
- Alert on inconsistent states
- Auto-remediation where safe

---

## Testing Recommendations

### Manual Tests to Confirm Issues

**Test 1: Stale Bottle Reference**
```
1. Add serving to cart (note which bottle)
2. In another tab, close that bottle
3. Try to complete payment
Expected: "Bottle not found" error
```

**Test 2: Double-Click**
```
1. Add items to cart
2. Click "Pay" button rapidly 3 times
3. Check database for duplicate sales
Expected: Multiple sales with same cart
```

**Test 3: Mid-Payment Bottle Closure**
```
1. User A adds serving to cart (bottle 50% full)
2. User B sells remaining servings + closes bottle
3. User A completes payment
Expected: Error or bottle selection required
```

### Database Queries to Run

**Find Orphaned Synthetic Tabs:**
```javascript
db.bartabs.find({
  isSyntheticDirectSale: true,
  status: 'paid',
  saleId: { $exists: false }
})
```

**Find Duplicate Sales:**
```javascript
db.sales.aggregate([
  { $match: { source: 'bar' } },
  {
    $group: {
      _id: { total: '$total', time: { $toDate: '$createdAt' } },
      count: { $sum: 1 },
      ids: { $push: '$_id' }
    }
  },
  { $match: { count: { $gt: 1 } } }
])
```

**Find Inconsistent Bottle States:**
```javascript
db.barbottles.find({
  state: 'open',
  remainingFraction: { $lte: 0 }
})
```

---

## Conclusion

Your bar sales system has **excellent architectural design** (unified bottle tracking, fractional servings, audit trails), but **critical execution gaps**:

1. ❌ No atomic transactions → partial failures leave inconsistent state
2. ❌ No idempotency → duplicate requests create duplicate sales
3. ❌ No bottle revalidation → stale cart references cause errors
4. ❌ No error recovery → failures cascade without rollback

**The good news:** These are all fixable without architectural redesign.

**The path forward:**
- Week 1: Band-aid fixes (revalidation, deduplication, UI improvements)
- Week 2-4: Proper implementation (transactions, state machine, recovery)
- Month 2: Polish (reservations, health checks, monitoring)

**Bottom Line:** Keep your unified transaction architecture (it's sound), but add the operational safeguards that production systems require.
