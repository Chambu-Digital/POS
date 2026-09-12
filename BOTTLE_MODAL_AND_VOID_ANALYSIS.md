# Bottle Selection Modal & Void Order Analysis

## Issue 1: Bottle Modal Fraction Display ✅ CONFIRMED

### Current Behavior

The `SelectBottleModal` component displays fractions as **percentages**:

```typescript
// components/bar/select-bottle-modal.tsx (line 70)
const remainingPct = (bottle.remainingFraction * 100).toFixed(0)

// Display: "75% remaining"
```

### The Problem

**Fractions are NOT intuitive for bar staff:**

- Staff don't think in percentages (75%, 50%, 25%)
- Staff think in physical servings: "How many tots can I pour?"
- Percentage doesn't communicate the actual serving capacity

**Example Confusion:**

```
Bottle shows: "75% remaining"

Staff thinks:
- "Can I pour 10 tots from this?"
- "Is this enough for a double?"
- "Which bottle has more servings?"

They have to do mental math: 75% of 20 tots = 15 tots
```

### What Should Be Shown

**Option A: Serving Count (Recommended)**
```
Bottle #5
Opened 2 hours ago • 15 tots remaining (75%)
```

**Option B: Visual + Count**
```
Bottle #5
[████████░░] 15/20 tots • Opened 2h ago
```

**Option C: Simple Count**
```
Bottle #5 • 15 tots left
Opened 2 hours ago
```

### Current Data Available

The modal already receives `availableServings`:

```typescript
// app/dashboard/bar/pos/page.tsx (line 263)
availableServings: b.availability[serving._id]?.available || 0
```

But it's **not displayed** in the UI! It's only used for the "Can only provide X servings" warning when insufficient.

---

## Issue 2: Voided Orders NOT Restoring Bottle Fractions ✅ CONFIRMED

### Current Behavior

When a serving sale is voided via `TabManager.removeLastLine()`:

```typescript
// lib/bar/tab-manager.ts (lines 547-549)
// Note: serving-unit restoration into an open bottle is not performed here —
// the bottle may have been closed or the units already consumed by other lines.
// The void is recorded in the audit log for reconciliation.
```

**The code explicitly does NOT restore bottle fractions.**

### What Happens

**Scenario:**
```
1. Bartender sells 1 Tot from Bottle #5 (20 tots total)
   → Bottle fraction: 1.0 → 0.95 (19 tots remaining)
   → Tab line created
   → Money expected

2. Customer cancels order
   → Tab line voided (marked voided: true)
   → Tab total recalculated (line excluded)
   → Money not charged

3. Bottle state: STILL 0.95 (19 tots)
   → The "poured" tot is NOT restored
   → Inventory permanently reduced
```

### The Logic (Why It's Designed This Way)

From the code comments:

> "serving-unit restoration into an open bottle is not performed here — the bottle may have been closed or the units already consumed by other lines."

**Rationale:**
1. **Physical Reality**: You can't "un-pour" liquid
2. **Bottle Lifecycle**: Bottle might be closed by the time void happens
3. **Multi-Line Conflict**: Other servings might have been poured from same bottle

**Example Conflict:**
```
10:00 → Sell 2 tots from Bottle #5 (20 → 18 tots)
10:05 → Sell 3 tots from Bottle #5 (18 → 15 tots)
10:10 → Void first sale (2 tots)
        Question: Restore to 17 tots or 20 tots?
        If restored to 17: conflicts with second sale's deduction
```

### Accounting Impact

**Problem: Ghost Inventory Loss**

```
Physical Reality:
- Bottle has 20 tots
- 1 tot poured but not sold (voided)
- 19 tots physically remain

System Reality:
- Bottle shows 19 tots (correct physical state)
- 0 tots sold (void)
- 1 tot "disappeared" from accounting

Impact:
- Variance at bottle close: 1 tot unaccounted
- Theft detection flags false positive
- Revenue loss (1 tot worth of stock lost without revenue)
```

**Over Time:**
```
If 5 orders voided per day:
- 5 servings lost per day
- 150 servings per month
- If each serving costs KES 50
- Monthly loss: KES 7,500 ($50 USD)
```

### Current Compensation

**For Sealed Bottle Sales:**
Voids DO restore inventory:

```typescript
// lib/bar/tab-manager.ts (lines 516-544)
if (!lastLine.servingId) {
  // Restore sealed bottle stock
  item.stock += lastLine.quantity
  await item.save()
  
  // Create stock movement: "Voided sale - stock restored"
}
```

**For Serving Sales:**
No restoration, only audit logging:

```typescript
// Void is recorded in BarAuditLog for reconciliation
lastLine.voided = true
await lastLine.save()
```

---

## Root Causes

### Issue 1: Modal Display
- **Design Oversight**: Developer focused on technical precision (fractions) vs user needs (servings)
- **Data Present**: `availableServings` calculated but not displayed
- **Easy Fix**: Add serving count to UI

### Issue 2: Void Not Restoring
- **Intentional Design**: Based on physical reality (can't un-pour)
- **Accounting Gap**: No mechanism to track "wastage" vs "theft"
- **Business Impact**: Staff errors cost real money

---

## Recommendations

### Fix 1: Improve Modal Display (Easy - 10 minutes)

**Update `components/bar/select-bottle-modal.tsx`:**

```typescript
// Current (line 70):
<p className="text-xs text-muted-foreground">
  Opened {openedAgo} • {remainingPct}% remaining
</p>

// Improved:
<p className="text-xs text-muted-foreground">
  Opened {openedAgo} • {bottle.availableServings} {servingName} left ({remainingPct}%)
</p>
```

**Result:**
```
Before: Opened 2 hours ago • 75% remaining
After:  Opened 2 hours ago • 15 tots left (75%)
```

**Even Better (show what they're ordering):**
```typescript
<p className="text-xs text-muted-foreground">
  {bottle.availableServings} {servingName} available • {remainingPct}% full
</p>
<p className="text-xs text-muted-foreground mt-0.5">
  Opened {openedAgo}
</p>
```

**Result:**
```
15 tots available • 75% full
Opened 2 hours ago
```

---

### Fix 2A: Track Wastage (Medium - 2 hours)

**Add wastage tracking to distinguish staff errors from theft:**

```typescript
// When voiding serving sale, give reason
enum VoidReason {
  CUSTOMER_CANCELLED = 'customer_cancelled',  // → wastage
  STAFF_ERROR = 'staff_error',                // → wastage
  FRAUD_SUSPECTED = 'fraud_suspected',        // → theft
  OTHER = 'other'
}

// Create wastage record
await models.BarWastage.create({
  bottleId: lastLine.bottleId,
  servingId: lastLine.servingId,
  quantity: lastLine.quantity,
  fractionWasted: computedFraction,
  reason: voidReason,
  voidedTabLineId: lastLine._id,
  staffId: staffId,
  timestamp: now
})
```

**Benefits:**
- Separate wastage from theft in variance reports
- Track which staff make most errors (training opportunity)
- Justify variance at bottle close
- Accurate cost accounting

---

### Fix 2B: Confirmation Dialog for Voids (Easy - 30 minutes)

**Add warning when voiding serving sales:**

```typescript
// Before allowing void:
if (lastLine.servingId) {
  // Show modal:
  "⚠️ Void Serving Sale
  
  This will void the sale but CANNOT restore the poured serving.
  
  Bottle: #5 (Jameson 750ml)
  Poured: 1 tot (worth KES 50)
  
  This serving will be counted as wastage.
  
  Reason: [Customer Cancelled ▼]
  
  [Cancel] [Confirm Void]"
}
```

**Benefits:**
- Staff aware of cost implications
- Reduces frivolous voids
- Captures void reason for reporting

---

### Fix 2C: Bottle Fraction Restoration (Complex - 4 hours)

**Allow restoration with safety checks:**

```typescript
async function voidServingSale(
  tabLineId: string,
  reason: VoidReason,
  restoreToBottle: boolean = false
) {
  const line = await BarTabLine.findById(tabLineId)
  const bottle = await BarBottle.findById(line.bottleId)
  
  // Check if restoration is safe
  if (restoreToBottle) {
    // Safety checks:
    if (bottle.state === 'closed') {
      throw new Error('Cannot restore to closed bottle')
    }
    
    // Check for newer servings from same bottle
    const newerServings = await BarTabLine.find({
      bottleId: line.bottleId,
      addedAt: { $gt: line.addedAt },
      voided: false
    })
    
    if (newerServings.length > 0) {
      throw new Error('Cannot restore - newer servings poured from this bottle')
    }
    
    // Safe to restore
    bottle.remainingFraction += computedFraction
    await bottle.save()
    
    await BarAuditLog.create({
      operation: 'SERVING_RESTORED',
      details: {
        reason: 'Voided sale - immediate void before other servings',
        fractionRestored: computedFraction
      }
    })
  } else {
    // Track as wastage
    await BarWastage.create({ ... })
  }
}
```

**Benefits:**
- Allows restoration when safe (immediate voids)
- Prevents dangerous restorations (bottle closed, other servings)
- Best of both worlds

**Risks:**
- Complex logic
- Edge cases (concurrent operations)
- Requires thorough testing

---

## Immediate Actions (Today)

### Priority 1: Fix Modal Display (10 min)
✅ Easy win, huge UX improvement

### Priority 2: Add Void Confirmation (30 min)
✅ Prevents accidental costly voids

### Priority 3: Document Wastage Policy (15 min)
✅ Staff training: "Voided servings = permanent loss"

---

## Medium-Term Actions (This Week)

### Priority 4: Add Wastage Tracking
Accounting accuracy + variance analysis

### Priority 5: Wastage Reports
Show daily/weekly wastage by staff/product

---

## Long-Term Actions (Next Month)

### Priority 6: Conditional Restoration
Safe restoration for immediate voids

### Priority 7: Pre-Void Checks
Warn before voiding high-value items

---

## Summary

### Issue 1: Modal Display ✅ CONFIRMED
- **Impact:** Medium annoyance, poor UX
- **Cause:** Technical fractions vs user-friendly servings
- **Fix:** Add serving count to display (10 min)
- **Risk:** None

### Issue 2: Void Not Restoring ✅ CONFIRMED & BY DESIGN
- **Impact:** High business cost (wastage = revenue loss)
- **Cause:** Intentional - can't "un-pour" liquid
- **Fix Options:**
  1. Track wastage separately (recommended)
  2. Add confirmation dialog (quick win)
  3. Allow conditional restoration (complex)
- **Risk:** Complex restoration could cause inventory bugs

### Cost of Not Fixing Issue 2
```
Conservative Estimate:
- 3 voided servings per day
- Average serving value: KES 100
- Monthly cost: 90 × KES 100 = KES 9,000
- Annual cost: KES 108,000 (~$800 USD)

Multiply by number of bars using system!
```

---

## Decision Points

1. **Modal fix:** Proceed immediately? ✅ YES
2. **Void confirmation:** Add now? ✅ YES  
3. **Wastage tracking:** Worth the effort? ✅ YES (cost justified)
4. **Fraction restoration:** Too risky? ⚠️ EVALUATE (pros/cons above)

What's your preference on the void restoration approach?
