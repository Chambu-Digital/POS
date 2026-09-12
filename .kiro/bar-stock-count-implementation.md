# Bar Stock Count Implementation + Movement Type Cleanup

## Summary

Implemented dedicated bar stock count workflow and cleaned up the record movement modal by removing redundant operations now handled by specialized features.

## Changes Made

### 1. Created Bar Stock Count Feature

**Files Created:**

#### `app/api/bar/stock-count/route.ts`
- POST endpoint for processing physical inventory counts
- Compares system stock (sealedCount) vs physical count
- Creates ADJUSTMENT movements for discrepancies
- Updates BarInventoryItem.sealedCount to match physical counts
- Tracks staff, branch, reason, and notes
- Returns adjustment summary

#### `components/bar/bar-stock-count-modal.tsx`
- Full-screen modal listing all bar inventory items
- Table format: Item | System | Physical | Difference
- Real-time difference calculation and color coding:
  - Green badge: Match (no difference)
  - Blue badge: Overage (+N)
  - Red badge: Shortage (-N)
- Search filter to find specific items
- Summary cards showing:
  - Total items counted
  - Items needing adjustment
  - Total variance (absolute bottles)
- Required reason field
- Optional notes field
- Warning alert when discrepancies detected
- Auto-fills physical count with system stock initially
- Select-on-focus for fast data entry

### 2. Updated Record Movement Modal

**File Modified:** `components/bar/record-bar-movement-modal.tsx`

**Removed Movement Types:**
- ❌ STOCK_IN (now handled by BarStockInModal)
- ❌ ADJUSTMENT (now handled by BarStockCountModal)

**Remaining Movement Types (8):**
- ✅ BREAKAGE - Bottle Broken
- ✅ SPILLAGE - Wasted Liquid
- ✅ DAMAGE - Unusable
- ✅ THEFT - Missing Stock
- ✅ WASTAGE - Quality Issues
- ✅ TRANSFER_OUT - Transfer Out
- ✅ TRANSFER_IN - Transfer In
- ✅ RETURN - Return to Supplier

**Updated Description:**
- Before: "Record manual stock movements such as deliveries, breakage, spillage, or adjustments"
- After: "Record exceptional stock movements such as breakage, spillage, damage, theft, or transfers"

### 3. Updated Bar Inventory Page

**File Modified:** `app/dashboard/bar/inventory/page.tsx`

**Added:**
- Import for BarStockCountModal
- State: `isStockCountOpen`
- Stock Count button in Actions card
- BarStockCountModal component at bottom

**Updated Actions Card Layout:**
```
Before (3 buttons):
Row 1: Stock In | Import
Row 2: Download Template (spans 2 cols)

After (4 buttons in 2x2 grid):
Row 1: Stock In | Stock Count
Row 2: Import    | Template
```

## Feature Comparison

### Bar Module Now Has Full Inventory Toolkit

| Feature | Purpose | How to Access |
|---------|---------|---------------|
| **Stock In** | Receive supplier deliveries (multi-item batch) | Bar Inventory → Stock In button |
| **Stock Count** | Physical count reconciliation | Bar Inventory → Stock Count button |
| **Record Movement** | Exceptional events (breakage, theft, etc.) | Individual item page |
| **Import** | Bulk item creation from CSV | Bar Inventory → Import button |

### Matches Retail Module

| Aspect | Retail | Bar | ✓ |
|--------|--------|-----|---|
| Batch Receiving | ✓ StockInModal | ✓ BarStockInModal | ✅ |
| Physical Count | ✓ StockCountModal | ✓ BarStockCountModal | ✅ |
| Exception Handling | ✓ Manual forms | ✓ RecordMovementModal | ✅ |
| CSV Import | ✓ ImportModal | ✓ BarImportModal | ✅ |

## User Workflows

### Stock Count Workflow

```
1. Navigate to Bar Inventory
    ↓
2. Click "Stock Count" button
    ↓
3. Modal opens with all items listed
   - Items show: Name, Size, Category
   - System stock pre-filled in Physical column
    ↓
4. Staff walks through bar counting bottles
    ↓
5. Enter physical count for each item
   - Focus auto-selects value for fast typing
   - Difference updates in real-time
   - Color coding: Green=match, Blue=over, Red=short
    ↓
6. Summary shows:
   - 45 items counted
   - 12 need adjustment
   - 18 total bottle variance
    ↓
7. Enter reason: "Weekly stock count"
    ↓
8. Add notes: "Shortage in whiskey, likely unrecorded breakage last night"
    ↓
9. Submit
    ↓
10. System creates ADJUSTMENT movements for 12 items
    ↓
11. sealedCount updated to match physical
    ↓
12. Toast: "Stock count complete. 12 adjustments made."
    ↓
13. Inventory refreshes with new counts
```

### Simplified Exception Handling

```
Record Movement now used ONLY for:

✓ Bottle broke during service
✓ Spillage/wastage from pour
✓ Damaged goods received
✓ Discovered theft
✓ Quality issues (expired, off)
✓ Branch transfers
✓ Returns to supplier

✗ NOT for deliveries (use Stock In)
✗ NOT for count corrections (use Stock Count)
```

## Database Operations

### Stock Count Creates:

**BarStockMovement Records:**
```typescript
{
  type: 'ADJUSTMENT',
  inventoryItemId: ObjectId,
  itemName: "Jameson 750ml",
  brandName: "Whiskey",
  quantity: -2,              // Can be positive or negative
  previousStock: 10,
  newStock: 8,
  unitCost: 1240,
  totalCost: 2480,           // abs(quantity) * unitCost
  staffId: ObjectId,
  staffName: "John Doe",
  branchId: ObjectId,
  reason: "Weekly stock count",
  notes: "Shortage likely from unrecorded breakage",
  timestamp: Date
}
```

**BarInventoryItem Updates:**
```typescript
{
  sealedCount: 8,            // Updated from 10
  updatedAt: Date
}
```

## Technical Details

### API Endpoints

**POST /api/bar/stock-count**
```typescript
Request:
{
  counts: [{
    inventoryItemId: string
    systemStock: number
    physicalStock: number
  }],
  reason: string,            // Required
  notes?: string
}

Response:
{
  success: true,
  adjustmentCount: number,
  totalDifference: number,
  adjustments: [{
    inventoryItemId: string,
    itemName: string,
    systemStock: number,
    physicalStock: number,
    difference: number
  }]
}
```

### Component Props

**BarStockCountModal:**
```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}
```

## Testing Checklist

### Stock Count Feature
- [ ] Open bar inventory page
- [ ] Click "Stock Count" button
- [ ] Verify modal shows all inventory items
- [ ] Verify system stock displayed correctly
- [ ] Change physical count for 3-4 items
- [ ] Verify difference calculated correctly
- [ ] Verify badges show (green/blue/red)
- [ ] Verify summary cards update
- [ ] Test search filter
- [ ] Leave reason blank and submit → Should error
- [ ] Enter reason and submit
- [ ] Verify toast shows adjustment count
- [ ] Verify inventory refreshes
- [ ] Check item stock levels updated
- [ ] Verify movements in stock movements page

### Movement Type Cleanup
- [ ] Try to record a movement via individual item
- [ ] Verify STOCK_IN not in dropdown
- [ ] Verify ADJUSTMENT not in dropdown
- [ ] Verify 8 remaining types present
- [ ] Record a BREAKAGE movement
- [ ] Verify it works correctly
- [ ] Check description updated

### Actions Card Layout
- [ ] Verify 2x2 button grid
- [ ] All 4 buttons accessible
- [ ] Icons display correctly
- [ ] Buttons trigger correct modals

## Benefits

### ✅ Complete Inventory Management
Bar staff now have proper tools for:
- Receiving deliveries (batch, with supplier tracking)
- Counting stock (reconciliation with audit trail)
- Recording exceptions (focused on actual exceptions)

### ✅ Faster Operations
- Stock count: 5-10 minutes vs manual one-by-one adjustments
- Clear interface for each workflow
- No confusion about which tool to use

### ✅ Better Audit Trail
- Stock counts have reasons and dates
- Clear distinction between:
  - Planned receiving (deliveries)
  - Periodic reconciliation (counts)
  - Exceptional events (breakage, theft)

### ✅ Module Consistency
- Bar now matches retail's professional workflows
- Same UI patterns across modules
- Staff trained once, works everywhere

## Notes

### Only Sealed Bottles Counted
- Stock count only affects `sealedCount` field
- Open bottles tracked separately in Bottle model
- Modal description clarifies "sealed bottles only"

### Backend Stays Flexible
- API still accepts STOCK_IN and ADJUSTMENT types
- Only UI removes them from dropdown
- Maintains backward compatibility

### No Movement Recorder Rename
- Still called "Record Stock Movement"
- Accurate enough for remaining 8 types
- Avoids breaking references elsewhere

---

**Status**: ✅ Complete
**Date**: 2026-09-10
**Files Created**: 2
**Files Modified**: 3
**Impact**: Professional inventory management toolkit for bar operations
