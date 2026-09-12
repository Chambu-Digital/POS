# Bar Sales Logging Guide

## Overview

I've added comprehensive logging throughout the bar sales system to help diagnose issues. Every critical operation now logs its start, progress, and completion.

---

## What's Logged

### 1. **API Endpoint** (`app/api/bar/pos-sale/route.ts`)
Already had good logging:
- ✅ Request start/end markers
- ✅ Auth payload details
- ✅ Cart validation
- ✅ Each item processing
- ✅ Sale creation
- ✅ Error details with stack traces

### 2. **TabManager** (`lib/bar/tab-manager.ts`)
**NEW logging added:**

#### `createSyntheticDirectSaleTab()`
- Input parameters (userId, branchId, customerName)
- Generated tab number
- Tab creation success
- Audit log creation

#### `addLine()`
- Input parameters (tabId, inventoryItemId, servingId, bottleId)
- Tab validation (found, status)
- Item type detection (serving vs sealed bottle)
- Serving details (price, servingsPerContainer)
- Fraction computation
- Bottle selection strategy (explicit/auto/multiple)
- Auto-open events
- Inventory deduction calls
- TabLine creation
- Tab recomputation
- Audit log creation

#### `closeSyntheticTab()`
- Input parameters (tabId, paymentMethod, amount)
- Tab validation (found, status, total)
- Tab status update to 'paid'
- Audit log creation

### 3. **InventoryEngine** (`lib/bar/inventory-engine.ts`)
**NEW logging added:**

#### `deductFraction()`
- Input parameters (bottleId, fraction, staffId)
- Bottle query and validation
- **Special error logging if bottle not found:**
  - Checks if bottle exists with different state
  - Logs bottle details (state, remainingFraction, closedAt)
  - Helps diagnose stale bottle issues
- Fraction validation
- Deduction calculation (before, amount, after)
- Bottle update in DB
- Audit log creation

#### `sellSealedBottle()`
- Input parameters (inventoryItemId, staffId)
- Item validation (found, stock level)
- Stock deduction (before, after)
- Audit log creation
- Stock movement record creation

---

## Log Format

All logs follow this pattern:

```
[ComponentName.methodName] MESSAGE
[ComponentName.methodName] Key: value
```

### Special Markers

- `==========` = Start/end of major operations
- `✓` = Success checkpoint
- `❌` = Error or validation failure
- `⚠️` = Warning or unusual condition

### Examples

```typescript
// Operation start
[TabManager.addLine] ========== START ==========

// Data logging
[TabManager.addLine] Input: { tabId: '123', itemName: 'Jameson' }

// Success checkpoint
[TabManager.addLine] ✓ Tab found: { tabNumber: 'DIRECT-1', status: 'open' }

// Error
[TabManager.addLine] ❌ Tab is locked (status: paid)

// Operation end
[TabManager.addLine] ========== SUCCESS ==========
```

---

## How to Use These Logs

### When a Sale Fails

1. **Check your server console** (where Next.js is running)
2. **Look for the error markers** (`❌`)
3. **Find the operation start** marker before the error
4. **Trace the flow** through each component

### Example Flow for Serving Sale

```
[bar/pos-sale] ========== POST STARTED ==========
[bar/pos-sale] ✅ Auth payload: { userId: 'xxx', type: 'staff' }
[bar/pos-sale] Request body: { itemCount: 1, total: 50, paymentMethod: 'cash' }

[TabManager.createSyntheticDirectSaleTab] ========== START ==========
[TabManager.createSyntheticDirectSaleTab] Generated tab number: DIRECT-123
[TabManager.createSyntheticDirectSaleTab] ✓ Tab created: { tabId: 'abc', tabNumber: 'DIRECT-123' }
[TabManager.createSyntheticDirectSaleTab] ========== SUCCESS ==========

[bar/pos-sale] 🔄 Processing items...
[bar/pos-sale]   Item: Jameson 750ml — Tot, isServing: true, invItemId: xyz, servingId: abc

[TabManager.addLine] ========== START ==========
[TabManager.addLine] Input: { tabId: 'abc', inventoryItemId: 'xyz', servingId: 'abc', bottleId: 'bottle-123' }
[TabManager.addLine] ✓ Tab found: { tabNumber: 'DIRECT-123', status: 'open' }
[TabManager.addLine] Item type: SERVING
[TabManager.addLine] ✓ Serving found: { name: 'Tot', price: 50, servingsPerContainer: 20 }
[TabManager.addLine] Computed serving: { quantity: 1, fractionToDeduct: 0.05, lineTotal: 50 }
[TabManager.addLine] Bottle selection: EXPLICIT (from frontend)
[TabManager.addLine] Using bottleId: bottle-123
[TabManager.addLine] Target bottle determined: bottle-123
[TabManager.addLine] Calling InventoryEngine.deductFraction...

[InventoryEngine.deductFraction] ========== START ==========
[InventoryEngine.deductFraction] Input: { bottleId: 'bottle-123', fraction: 0.05, staffId: 'staff-1' }
[InventoryEngine.deductFraction] Querying bottle...
[InventoryEngine.deductFraction] ✓ Bottle found: { bottleId: 'bottle-123', bottleNumber: 5, state: 'open', currentFraction: 0.75 }
[InventoryEngine.deductFraction] ✓ Validation passed, proceeding with deduction
[InventoryEngine.deductFraction] Deducting: { before: 0.75, deduction: 0.05, after: 0.70 }
[InventoryEngine.deductFraction] ✓ Bottle updated in DB
[InventoryEngine.deductFraction] Creating SERVING_SOLD audit log...
[InventoryEngine.deductFraction] ✓ Audit log created
[InventoryEngine.deductFraction] ========== SUCCESS ==========

[TabManager.addLine] ✓ Fraction deducted successfully
[TabManager.addLine] Creating BarTabLine record...
[TabManager.addLine] ✓ TabLine created: { lineId: 'line-1', itemName: 'Jameson 750ml', bottleId: 'bottle-123' }
[TabManager.addLine] Recomputing tab totals...
[TabManager.addLine] ✓ Tab totals updated
[TabManager.addLine] Creating TAB_LINE_ADDED audit log...
[TabManager.addLine] ✓ Audit log created
[TabManager.addLine] ========== SUCCESS ==========

[TabManager.closeSyntheticTab] ========== START ==========
[TabManager.closeSyntheticTab] Input: { tabId: 'abc', paymentMethod: 'cash', amountPaid: 50 }
[TabManager.closeSyntheticTab] ✓ Tab found: { tabNumber: 'DIRECT-123', status: 'open', total: 50 }
[TabManager.closeSyntheticTab] Saving tab with status=paid...
[TabManager.closeSyntheticTab] ✓ Tab marked as paid
[TabManager.closeSyntheticTab] Creating TAB_CLOSED audit log...
[TabManager.closeSyntheticTab] ✓ Audit log created
[TabManager.closeSyntheticTab] ========== SUCCESS ==========

[bar/pos-sale] 📝 Creating Sale record for compatibility...
[bar/pos-sale] ✅ Sale created: { saleId: 'sale-1', orderNumber: 'BAR-00001', syntheticTabId: 'abc' }
[bar/pos-sale] ========== POST COMPLETED SUCCESSFULLY ==========
```

---

## Common Error Patterns

### Pattern 1: Bottle Not Found

```
[InventoryEngine.deductFraction] ❌ BOTTLE NOT FOUND
[InventoryEngine.deductFraction] Attempted bottleId: bottle-123
[InventoryEngine.deductFraction] ⚠️ Bottle exists but state is: closed
[InventoryEngine.deductFraction] Bottle details: { 
  bottleNumber: 5, 
  state: 'closed', 
  remainingFraction: 0.05, 
  closedAt: 2024-01-15T10:30:00.000Z 
}
```

**Diagnosis:** Bottle was closed between cart-add and payment

---

### Pattern 2: Bottle Does Not Exist

```
[InventoryEngine.deductFraction] ❌ BOTTLE NOT FOUND
[InventoryEngine.deductFraction] Attempted bottleId: bottle-999
[InventoryEngine.deductFraction] ⚠️ Bottle does not exist in database at all
```

**Diagnosis:** Invalid bottleId from frontend (corrupted cart data)

---

### Pattern 3: Multiple Bottles Open

```
[TabManager.addLine] Bottle selection: AUTO (no bottleId provided)
[TabManager.addLine] Found 3 open bottles for this item
[TabManager.addLine] ❌ Multiple bottles open - selection required
[TabManager.addLine] Available bottles: [
  { id: 'bottle-1', number: 5, remaining: 0.75 },
  { id: 'bottle-2', number: 6, remaining: 0.50 },
  { id: 'bottle-3', number: 7, remaining: 0.90 }
]
```

**Diagnosis:** User must select which bottle to use (UI should show modal)

---

### Pattern 4: Tab Already Paid

```
[TabManager.addLine] ✓ Tab found: { tabNumber: 'DIRECT-123', status: 'paid' }
[TabManager.addLine] ❌ Tab is locked (status: paid)
```

**Diagnosis:** Duplicate request or stale tab reference

---

## Sharing Logs With Me

When you encounter an error:

1. **Copy the entire console output** from the `========== POST STARTED ==========` marker to the error
2. **Include the error stack trace** at the bottom
3. **Note the timestamp** when it occurred
4. **Describe what you were doing** (e.g., "Selling 1 tot of Jameson")

### What to Include

```
=== Error Report ===
Timestamp: 2024-01-15 10:45:23
Action: Direct POS sale of serving
Cart: [{ productName: "Jameson 750ml — Tot", quantity: 1, price: 50 }]

=== Console Logs ===
[bar/pos-sale] ========== POST STARTED ==========
... (entire log output)
[bar/pos-sale] ========== POST ERROR ==========
Error message: BOTTLE_NOT_FOUND_OR_CLOSED

=== Browser Console (if applicable) ===
... any frontend errors
```

---

## Log Levels

Currently all logs use `console.log` and `console.error`. You can filter in your terminal:

### View only errors
```bash
npm run dev 2>&1 | grep "❌"
```

### View only a specific component
```bash
npm run dev 2>&1 | grep "InventoryEngine"
```

### Save logs to file
```bash
npm run dev > logs.txt 2>&1
```

---

## Performance Impact

**Minimal** - Each log is a simple console.log with no complex serialization. In production, you can:

1. **Add environment check:**
```typescript
const DEBUG = process.env.NODE_ENV === 'development'
if (DEBUG) console.log(...)
```

2. **Use a logging library** (Winston, Pino) with log levels
3. **Send to monitoring service** (Sentry, LogRocket) for production

---

## Next Steps

1. **Test a sale** and observe the logs
2. **Reproduce the error** and capture the full log output
3. **Share logs with me** so I can diagnose the exact failure point

The logs will tell us:
- ✅ Which operation failed
- ✅ What data was being processed
- ✅ What the bottle state was at failure time
- ✅ Whether it's a timing issue, stale data, or logic bug
