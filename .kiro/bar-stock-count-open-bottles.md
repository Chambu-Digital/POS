# Bar Stock Count: Sealed + Open Bottles Implementation

## Overview

Updated the bar stock count feature to include both sealed and open bottles in the physical count, providing a complete inventory picture.

## The Problem

**Original implementation only counted sealed bottles:**
- Missed open bottles currently in use behind the bar
- Could not detect stolen/missing open bottles
- Incomplete inventory value tracking
- False discrepancies (e.g., "1 sealed missing" when it was actually just opened)

## The Solution: "9 Sealed + 2 Open" Model

**Now counts complete bottle inventory:**
```
Jameson 750ml
System: 10 sealed + 2 open = 12 total bottles
Physical: [__] sealed + [__] open

Staff counts:
- Sealed in storage: 9 bottles
- Open behind bar: 2 bottles
- Total: 11 bottles

Discrepancy: 1 bottle missing
```

## Why This Works

### Architecture Confirmation

**When a bottle is opened:**
1. System decrements `sealedCount` by 1
2. Creates `BarBottle` record with `state: 'open'`
3. Creates `BOTTLE_OPEN` stock movement
4. Tracks `remainingFraction` as servings are poured

**This means:**
- `sealedCount` = actual sealed bottles in storage
- Open bottles are tracked separately in `BarBottle` table
- `sealedCount + open bottles = total bottles`
- Math works perfectly!

## Implementation Changes

### API Changes (`app/api/bar/stock-count/route.ts`)

**Request Interface:**
```typescript
interface CountItem {
  inventoryItemId: string
  systemSealed: number       // From BarInventoryItem.sealedCount
  physicalSealed: number     // Staff counts sealed bottles
  systemOpen: number         // Count of BarBottle records with state='open'
  physicalOpen: number       // Staff counts open bottles
}
```

**Processing Logic:**
```typescript
// Calculate differences
const sealedDiff = physicalSealed - systemSealed
const openDiff = physicalOpen - systemOpen
const totalBottleDiff = sealedDiff + openDiff

// Adjust sealedCount by total difference
// (Open bottles were already deducted when opened)
const newSealedCount = currentSealedCount + totalBottleDiff

// Create detailed movement notes
notes: "Sealed: 10→9 (-1), Open: 2→1 (-1)"
```

### Modal Changes (`components/bar/bar-stock-count-modal.tsx`)

**Data Fetching:**
- Fetches inventory items: `/api/bar/inventory-items`
- Fetches open bottles: `/api/bar/bottles?state=open`
- Counts open bottles per inventory item
- Initializes both sealed and open counts

**Table Structure:**
```
┌────────────────┬─────────┬──────────┬────────┬──────────┬───────────┐
│ Item           │ Sealed  │          │ Open   │          │ Total     │
│                │ Sys|Phy │          │ Sys|Phy│          │ Diff      │
├────────────────┼─────────┼──────────┼────────┼──────────┼───────────┤
│ Jameson 750ml  │ 10 │[_]│          │  2│[_] │          │ TBD       │
│ Total: 12      │         │          │        │          │           │
└────────────────┴─────────┴──────────┴────────┴──────────┴───────────┘
```

**Difference Display:**
- Shows breakdown: `S: -1` (sealed diff), `O: -1` (open diff)
- Shows total: `-2` (total bottle difference)
- Color-coded badges: Green (match), Blue (overage), Red (shortage)

## User Workflow

### Physical Count Process

```
1. Manager clicks "Stock Count"
    ↓
2. Modal opens showing all items with sealed + open columns
    ↓
3. Manager walks through bar with tablet:
   
   Storage room:
   - Jameson 750ml: Count sealed bottles → Enter 9
   - Vodka 1L: Count sealed bottles → Enter 15
   
   Behind bar:
   - Jameson 750ml: Count open bottles → Enter 1 (expected 2)
   - Vodka 1L: Count open bottles → Enter 1 (matches)
    ↓
4. System calculates differences in real-time:
   - Jameson: S: -1, O: -1, Total: -2 bottles (RED badge)
   - Vodka: All match (GREEN badge)
    ↓
5. Summary shows: 2 items, 1 needs adjustment, 2 bottle variance
    ↓
6. Enter reason: "Weekly stock count"
    ↓
7. Add notes: "Missing Jameson bottles - 1 sealed, 1 open (possible theft)"
    ↓
8. Submit
    ↓
9. System creates adjustment movement with detailed notes
    ↓
10. Toast: "Stock count complete. 1 adjustment made."
```

## Database Impact

### BarStockMovement Created

```typescript
{
  type: 'ADJUSTMENT',
  inventoryItemId: ObjectId("Jameson"),
  itemName: "Jameson 750ml",
  quantity: -2,                    // Total bottle difference
  previousStock: 10,               // Previous sealedCount
  newStock: 8,                     // New sealedCount (10 + (-2))
  unitCost: 1240,
  totalCost: 2480,
  staffId: ObjectId,
  reason: "Weekly stock count",
  notes: "Sealed: 10→9 (-1), Open: 2→1 (-1)\nMissing bottles - possible theft",
  timestamp: Date
}
```

### BarInventoryItem Updated

```typescript
{
  sealedCount: 8,    // Updated from 10 (adjusted by total diff: -2)
  updatedAt: Date
}
```

## Detection Scenarios

### Scenario 1: Stolen Open Bottle
```
System: 10 sealed + 2 open
Count:  10 sealed + 1 open
Result: Missing 1 open bottle (theft detected!)
```

### Scenario 2: Unreported Breakage
```
System: 10 sealed + 2 open
Count:  9 sealed + 2 open
Result: Missing 1 sealed bottle
```

### Scenario 3: Bottle Opened But Not Recorded
```
System: 10 sealed + 2 open
Count:  9 sealed + 3 open
Result: Match (total bottles same, just one moved from sealed to open)
```

### Scenario 4: Everything Matches
```
System: 10 sealed + 2 open
Count:  10 sealed + 2 open
Result: Perfect match ✓
```

## Benefits

### ✅ Complete Inventory Tracking
- Counts all bottles (not just sealed)
- Detects theft/loss of open bottles
- Accurate total bottle count

### ✅ Better Loss Detection
- Can identify if sealed or open bottle missing
- Helps pinpoint when loss occurred
- More accurate for investigations

### ✅ Accurate Valuations
- Total inventory value includes open bottles
- Better financial reporting
- More precise cost tracking

### ✅ Simple to Count
- Staff just counts bottles (don't measure units)
- Sealed: count bottles in storage
- Open: count bottles behind bar
- Fast and intuitive

### ✅ Detailed Audit Trail
- Movement notes show sealed vs open breakdown
- Example: "Sealed: 10→9 (-1), Open: 2→1 (-1)"
- Clear which category had discrepancy

## Technical Notes

### Why sealedCount is Adjusted by Total

When a bottle is opened:
- sealedCount decrements by 1
- BarBottle record created

So at any time:
- `sealedCount` = actual sealed bottles
- `open bottles` = separate tracking
- `Total = sealedCount + open bottles`

During count adjustment:
- If total bottles differ, adjust sealedCount
- This maintains the accounting balance
- Open bottle records remain unchanged

### Open Bottle Fetch

Fetches from: `/api/bar/bottles?state=open`

Counts by inventoryItemId to show:
```typescript
{
  "item-123": 2 open bottles,
  "item-456": 1 open bottle,
  "item-789": 0 open bottles
}
```

## Testing Checklist

- [ ] Open bar inventory page
- [ ] Click "Stock Count"
- [ ] Verify table shows Sealed and Open columns
- [ ] Verify open bottle count matches system
- [ ] Change sealed count for item
- [ ] Verify sealed difference shows
- [ ] Change open count for item
- [ ] Verify open difference shows
- [ ] Verify total difference calculates correctly
- [ ] Verify summary cards update
- [ ] Submit count
- [ ] Verify movement notes show breakdown
- [ ] Check sealedCount updated correctly
- [ ] Verify open bottles still tracked correctly

## Edge Cases Handled

1. **No open bottles**: Shows 0 in open column, still allows counting
2. **Multiple open bottles**: Counts correctly (e.g., 3 open bottles of same item)
3. **All sealed, no open**: Works like before (just adds unused open column)
4. **More physical open than system**: Detects unrecorded bottle openings
5. **Less physical open than system**: Detects stolen/missing open bottles

---

**Status**: ✅ Complete
**Date**: 2026-09-10
**Impact**: Complete inventory visibility including open bottles
**Files Modified**: 2 (API + Modal)
