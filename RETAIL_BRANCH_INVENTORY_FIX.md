# Retail Branch Inventory Fix - Critical Update

## ⚠️ Problem Identified
Retail products were sharing stock across all branches, which would cause:
- Stock conflicts when multiple branches sell the same product
- Incorrect inventory counts after transfers
- No way to track branch-specific stock levels
- Data integrity issues

## ✅ Solution Implemented

### New Architecture: Product-Branch Inventory Pattern

Similar to pharmacy's Drug + Inventory separation, retail now uses:
- **Product** (catalog): Defines the product (name, price, details)
- **ProductInventory**: Tracks stock per-branch

This mirrors the pharmacy pattern:
- **Drug** (catalog) → **Product** (catalog)
- **Inventory** (per-branch) → **ProductInventory** (per-branch)

---

## 📦 Schema Changes

### ProductInventory Schema (NEW)
```typescript
{
  userId: ObjectId (ref: User)
  branchId: ObjectId (ref: Branch)  
  productId: ObjectId (ref: Product)
  stock: Number
  reserved: Number  // For held orders
  lastUpdated: Date
  createdAt: Date
}

// Unique index: userId + branchId + productId
```

### Product Schema (UPDATED)
- **`stock` field**: Now DEPRECATED (kept for backward compatibility)
- Stock is now tracked in `ProductInventory` per branch
- Added barcode to search index

---

## 🔄 API Updates

### GET `/api/products`
**Before:**
- Returned products with global stock

**After:**
- Returns products from catalog
- Joins with `ProductInventory` using current branch context
- Each product shows branch-specific stock
- Falls back to 0 stock if no inventory record exists

**Logic:**
```typescript
const branchContext = await getBranchContext(request)
if (branchContext) {
  // Fetch products
  // Fetch ProductInventory for this branch
  // Merge stock values
}
```

### POST `/api/products`
**Before:**
- Created product with stock

**After:**
- Creates product catalog entry
- Creates `ProductInventory` record for current branch
- Stock field in Product kept for backward compatibility

---

## 📤 Stock Transfer Updates

### Creating Transfer (POST `/api/stock-transfers`)
**Before:**
- Read stock from `Product.stock`
- Deducted from `Product.stock`

**After:**
- Read stock from `ProductInventory` for source branch
- Deduct from `ProductInventory` for source branch
- Create TRANSFER_OUT ledger entry

### Receiving Transfer (PUT `/api/stock-transfers/[id]/receive`)
**Before:**
- Added stock to `Product.stock`

**After:**
- Find or create `ProductInventory` for receiving branch
- Add stock to `ProductInventory`
- Create TRANSFER_IN ledger entry

### Rejecting Transfer (PUT `/api/stock-transfers/[id]/reject`)
**Before:**
- Restored stock to `Product.stock`

**After:**
- Restore stock to source branch's `ProductInventory`
- Create ADJUSTMENT ledger entry

---

## 🔧 Migration Script

### `scripts/migrate-product-inventory.ts`

**What it does:**
1. Connects to all active tenants
2. Finds all products with stock > 0
3. Gets or creates a default branch for each tenant
4. Creates `ProductInventory` records for each product
5. Assigns existing stock to the default branch

**How to run:**
```bash
npx ts-node scripts/migrate-product-inventory.ts
```

**Safe to run multiple times:**
- Checks for existing inventory records
- Skips if already migrated
- Creates default branch if none exists

---

## 📊 Data Flow

### Creating a Product
```
User creates product → 
  Product catalog entry created →
  ProductInventory created for current branch →
  Stock tracked per-branch
```

### Selling a Product
```
Sale created →
  Deduct from ProductInventory (current branch) →
  StockLedger entry (SALE) →
  Product.stock remains (deprecated field)
```

### Transferring Stock
```
Branch A sends to Branch B →
  ProductInventory(Branch A).stock -= qty →
  StockLedger entry (TRANSFER_OUT) →
  
Branch B receives →
  ProductInventory(Branch B).stock += qty →
  StockLedger entry (TRANSFER_IN)
```

---

## 🔍 Backward Compatibility

### Product.stock field
- **Kept in schema** to avoid breaking existing code
- Marked as DEPRECATED in comments
- New code should use `ProductInventory` instead
- Can be removed in future version after full migration

### Existing queries
- Still work but show deprecated stock
- Should be updated to query `ProductInventory`

### Migration path
1. Run migration script
2. Update all product queries to use `ProductInventory`
3. Update sales/adjustments to use `ProductInventory`
4. Eventually remove `Product.stock` field

---

## ✅ Benefits

### Data Integrity
- Each branch tracks its own stock accurately
- No stock conflicts between branches
- Atomic transfers with transactions

### Scalability
- Support unlimited branches
- Easy to add new branches
- Clear audit trail per branch

### Consistency
- Retail now matches pharmacy pattern
- Unified architecture across modules
- Easier to maintain

### Flexibility
- Can move stock between branches
- Can track reserved stock (held orders)
- Branch-specific reporting

---

## 🧪 Testing Checklist

### Basic Operations
- [ ] Create product with branch context
- [ ] View products shows branch-specific stock
- [ ] Search products includes barcode
- [ ] Stock shows 0 for products without inventory

### Stock Transfers
- [ ] Create transfer deducts from source ProductInventory
- [ ] Receive transfer adds to destination ProductInventory
- [ ] Reject transfer restores to source ProductInventory
- [ ] Ledger entries created correctly

### Branch Switching
- [ ] Owner switches branches
- [ ] Product list shows different stock levels
- [ ] Creating product in different branches
- [ ] Sales deduct from correct branch

### Migration
- [ ] Run migration on test tenant
- [ ] Verify ProductInventory records created
- [ ] Verify stock values match Product.stock
- [ ] Default branch created if needed

### Edge Cases
- [ ] Product with no inventory shows 0 stock
- [ ] Transfer to branch without inventory creates record
- [ ] Multiple transfers of same product
- [ ] Negative stock prevention

---

## 📋 Files Modified

### Schema
- `lib/models/schemas.ts` - Added ProductInventory schema

### Model Factory
- `lib/tenant/get-models.ts` - Added ProductInventory model

### APIs
- `app/api/products/route.ts` - Branch-aware GET/POST
- `app/api/stock-transfers/route.ts` - Use ProductInventory
- `app/api/stock-transfers/[id]/receive/route.ts` - Use ProductInventory
- `app/api/stock-transfers/[id]/reject/route.ts` - Use ProductInventory

### Scripts
- `scripts/migrate-product-inventory.ts` - Migration script (NEW)

---

## 🚨 Critical Notes

1. **Run migration before using transfers**: Existing products won't show in transfers without ProductInventory records

2. **Branch context required**: Creating products now requires branch context (from JWT or cookie)

3. **Sales must be updated**: Sale creation should deduct from ProductInventory, not Product.stock (TODO: Future update)

4. **Stock adjustments**: Inventory adjustments should update ProductInventory (TODO: Future update)

5. **Default branch**: System creates "Main Branch" if none exists during migration

---

## 🎯 Next Steps

### Immediate
1. Run migration script on all environments
2. Test stock transfers thoroughly
3. Verify branch-specific stock display

### Short-term
1. Update sales API to use ProductInventory
2. Update inventory adjustment APIs
3. Update stock count features

### Long-term
1. Remove Product.stock field (after full migration)
2. Add ProductInventory to all product-related APIs
3. Branch-specific reporting and analytics

