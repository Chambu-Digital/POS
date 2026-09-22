# Stock Transfers Refactor - Summary

## Problem Identified
The original implementation had a "module selector" dropdown that asked users to manually choose between "retail" or "pharmacy" before creating transfers. This was:
- Unnecessarily complex (asking users questions they already know the answer to)
- Not scalable (enum would grow with each new module)
- Against the natural workflow (stock-in doesn't ask for module, why should transfers?)

## Core Understanding
- **Branches** share the same catalog of items (Products/Drugs)
- **Only quantities differ** per branch via inventory collections
- Stock transfers are just inventory operations, not cross-module operations
- Users already know context from which page they're on

## Changes Made

### 1. Schema Changes (`lib/models/schemas.ts`)
**Before:**
```typescript
{
  module: 'retail' | 'pharmacy',  // User-selected enum
  moduleItemId: string,            // Generic string ID
  itemName: string,
  quantitySent: number,
  unitPrice: number
}
```

**After:**
```typescript
{
  productId: ObjectId,             // Direct reference to Product
  drugId: ObjectId,                // Direct reference to Drug
  itemName: string,
  quantitySent: number,
  unitPrice: number
}
```

- Removed `module` field entirely
- Replaced generic `moduleItemId` with specific `productId` and `drugId`
- One of the two fields will be populated, never both
- Backend checks which field exists to determine collection to update

### 2. API Changes (`app/api/stock-transfers/`)
**POST /api/stock-transfers**
- Removed module-based conditional logic
- Now checks `if (item.productId)` → update ProductInventory
- Or checks `if (item.drugId)` → update Inventory
- No more enum maintenance needed

**PUT /api/stock-transfers/[id]/receive**
- Updated to match items by `productId` or `drugId` instead of `moduleItemId`
- Creates inventory records if they don't exist (for branches with 0 stock)

**PUT /api/stock-transfers/[id]/reject**
- Updated to restore stock using `productId` or `drugId` references

### 3. New Transfer Creation Components

**Created:**
- `components/stock-transfers/create-product-transfer-modal.tsx` - For retail products
- `components/stock-transfers/create-drug-transfer-modal.tsx` - For pharmacy drugs

**Key Features:**
- Fetch from catalog (Products or Drugs) not inventory
- Show all items with stock info from current branch
- Only allow transfer if stock > 0
- No module selector needed - context is implicit

### 4. Page Updates

**`app/dashboard/stock-transfers/page.tsx`**
- Removed "Create Transfer" button
- Removed `CreateTransferModal` import
- Changed description: "View inter-branch stock movements. Create transfers from inventory pages."
- Now purely a history/receiving page

**To Be Updated (Step 13):**
- `app/dashboard/retail/inventory/page.tsx` - Add "Transfer Stock" button → opens CreateProductTransferModal
- `app/dashboard/pharmacy/inventory/page.tsx` - Add "Transfer Stock" button → opens CreateDrugTransferModal

### 5. Modal Updates

**`components/stock-transfers/receive-transfer-modal.tsx`**
- Updated to work with `productId`/`drugId` instead of `moduleItemId`
- Added `getItemId()` helper to extract correct ID

**`components/stock-transfers/transfer-details-modal.tsx`**
- (Needs same update as receive modal)

## Architecture

### Transfer Creation Flow
```
User Context → Inventory Page → Transfer Modal → API
─────────────────────────────────────────────────────
Retail Section → Retail Inventory → Product Transfer Modal → Updates ProductInventory
Pharmacy Section → Pharmacy Inventory → Drug Transfer Modal → Updates Inventory
```

### Transfer Receiving Flow
```
Notification/List → Receive Modal → API Detection → Update Correct Collection
─────────────────────────────────────────────────────────────────────────────────
Transfer has productId? → Update ProductInventory
Transfer has drugId? → Update Inventory
```

## Benefits

1. **Simpler UX** - No module selector, users stay in context
2. **Scalable** - Adding new modules doesn't require schema changes
3. **Type Safe** - Direct ObjectId references instead of string IDs
4. **Natural Flow** - Matches existing stock-in pattern
5. **Less Code** - Removed conditional module logic throughout

## Migration Needed

Existing `StockTransfer` records in database have old schema with `module` and `moduleItemId` fields. Need migration script to:
1. Find transfers with `module: 'retail'` → rename `moduleItemId` to `productId`
2. Find transfers with `module: 'pharmacy'` → rename `moduleItemId` to `drugId`
3. Remove `module` field

## Next Steps

1. Add "Transfer Stock" buttons to inventory pages (retail & pharmacy)
2. Test complete workflow end-to-end
3. Run migration script on existing transfers
4. Remove old `CreateTransferModal` component (now unused)
5. Update any remaining references to `moduleItemId` or `module` field

## Files Modified

### Schema & API
- `lib/models/schemas.ts` - Updated stockTransferItemSchema
- `app/api/stock-transfers/route.ts` - POST logic updated
- `app/api/stock-transfers/[id]/receive/route.ts` - Receive logic updated
- `app/api/stock-transfers/[id]/reject/route.ts` - Reject logic updated

### Components
- `components/stock-transfers/create-product-transfer-modal.tsx` - NEW
- `components/stock-transfers/create-drug-transfer-modal.tsx` - NEW
- `components/stock-transfers/receive-transfer-modal.tsx` - Updated
- `app/dashboard/stock-transfers/page.tsx` - Removed create button

### To Update
- `app/dashboard/retail/inventory/page.tsx` - Add transfer button
- `app/dashboard/pharmacy/inventory/page.tsx` - Add transfer button
- `components/stock-transfers/transfer-details-modal.tsx` - Update schema references

## Testing Checklist

- [ ] Create product transfer from retail inventory
- [ ] Create drug transfer from pharmacy inventory
- [ ] Receive transfer at destination branch
- [ ] Reject transfer and verify stock restoration
- [ ] Verify inventory records created for branches with 0 stock
- [ ] Check transfer history page shows all transfers correctly
- [ ] Verify notifications work
- [ ] Test with multi-branch scenario (3+ branches)
