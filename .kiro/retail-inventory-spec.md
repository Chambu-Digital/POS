# Retail Inventory Management System

## Overview

A lean, action-based inventory management system for Chambu POS retail module.

**Core Philosophy**: Keep navigation simple. Complex workflows live inside modals and actions, not separate menu items.

---

## Architecture

```
RETAIL
│
├── INVENTORY
│   ├── View Current Stock
│   ├── + Stock In (modal)
│   └── Stock Count (modal)
│
├── STOCK MOVEMENTS
│   ├── View History
│   └── Record Movement (modal)
│
└── SUPPLIERS
    ├── Supplier List
    ├── + Add Supplier (modal)
    └── Supplier Details
        ├── Information
        ├── Purchase History
        └── Products
```

---

## 1. Inventory

### Purpose
Manage the **current state of stock**.

Answers: **"What do I have right now?"**

### Main Page

**Header**
> Inventory  
> Manage your products and current stock.

**Actions**
- `+ Stock In` - Receive stock from suppliers
- `Stock Count` - Physical inventory verification

**Search & Filters**
- Search product by name
- Filter by category
- Filter by stock status (In Stock, Low Stock, Out of Stock)

**Inventory Table**

| Product | SKU | Stock | Buying Price | Selling Price | Stock Value | Status |
|---------|-----|-------|--------------|---------------|-------------|--------|
| Coca-Cola 500ml | CC500 | 48 | 50 | 80 | 2,400 | In Stock |
| Samsung A15 | SAM15 | 7 | 18,000 | 22,000 | 126,000 | Low Stock |
| Sugar 2kg | SUG20 | 0 | 180 | 250 | 0 | Out of Stock |

**Clicking a product** opens its inventory details modal.

---

### Stock In Action

**Triggered by**: `+ Stock In` button in Inventory page

**Form**
```
Stock In

Supplier *
[ Select Supplier ▼ ]  [+ Quick Add]

Reference / Invoice
[ __________________ ]

Products
────────────────────────────────
Product             Qty    Cost
[ Select product ]  [10]   [500]
[ Select product ]  [20]   [180]
[+ Add Product]
────────────────────────────────

Notes
[ ______________________________ ]

Total Cost: KSh 8,600

[ Cancel ]              [ Receive Stock ]
```

**On Submit**:
1. Inventory increases
2. Supplier is recorded
3. Cost of received stock is recorded
4. A **Stock In** movement is created in ledger
5. Transaction appears in supplier's purchase history

**No purchase order system required.**

---

### Stock Count Action

**Triggered by**: `Stock Count` button in Inventory page

**Purpose**: Compare system stock vs. physical count

**Form**
```
Stock Count

Product             System    Physical    Difference

Coca-Cola 500ml       48         46           -2
Samsung A15            7          7            0
Sugar 2kg             20         19           -1

                                      Total: -3

[ Cancel ]             [ Submit Count ]
```

**On Submit**:
- Creates **Adjustment** movements for each difference
- Updates inventory to match physical count
- Records who performed the count and when

---

## 2. Stock Movements

### Purpose
The immutable stock ledger.

Answers: **"Why did my stock change?"**

### Main Page

**Header**
> Stock Movements  
> View complete stock movement history

**Filter Tabs**
```
[ All ]
[ Stock In ]
[ Sales ]
[ Returns ]
[ Damage ]
[ Wastage ]
[ Loss ]
[ Adjustment ]
```

**Additional Filters**
- Search by product name
- Date range picker
- Filter by user/staff

**Movements Table**

| Date | Product | Movement | Qty | Before | After | Reference | Staff | Reason |
|------|---------|----------|-----|--------|-------|-----------|-------|--------|
| Aug 30 | Coca-Cola | Stock In | +50 | 20 | 70 | INV-102 | Admin | - |
| Aug 30 | Coca-Cola | Sale | -2 | 70 | 68 | SALE-981 | John | - |
| Aug 30 | Samsung A15 | Return | +1 | 6 | 7 | SALE-975 | Admin | Customer return |
| Aug 30 | Sugar 2kg | Damage | -1 | 10 | 9 | - | Mary | Broken bag |

**Clicking a movement** opens details modal.

---

### Movement Types

#### Stock In
Stock received from a supplier or initial stock entry.

#### Sale
Automatically generated when a retail sale is completed.

#### Return
Customer returns a product (may or may not restock).

#### Damage
Product becomes unusable (broken, damaged, defective).

#### Wastage
Stock is wasted or spoiled without being sold.

#### Loss
Stock is missing and cannot be accounted for (theft, etc.).

#### Adjustment
Manual correction from stock count or authorized adjustment.

---

### Record Movement Action

**Triggered by**: `Record Movement` button in Stock Movements page

**Form**
```
Record Stock Movement

Movement Type *
[ Damage ▼ ]

Product *
[ Search and select product ]

Quantity *
[ 1 ]

Reason *
[ Screen damaged during unboxing ]

Notes (optional)
[ __________________________ ]

[ Cancel ]       [ Record Movement ]
```

**Rules**:
- Reason is required for all manual movements
- Stock cannot go negative
- Movement is immediately written to ledger
- Creates audit trail (who, when, why)

**Users cannot directly edit stock quantities.** If stock changes, there must be a movement explaining why.

---

## 3. Suppliers

### Purpose
Manage businesses that supply the store.

**This is a top-level sidebar menu item.**

### Supplier List Page

**Header**
> Suppliers  
> Manage your suppliers and purchasing

**Actions**
- `+ Add Supplier` button

**Search**
- Search by name

**Suppliers Table**

| Supplier | Phone | Products | Status |
|----------|-------|----------|--------|
| ABC Distributors | 0722 xxx xxx | 24 | Active |
| XYZ Wholesale | 0711 xxx xxx | 12 | Active |

**Clicking a supplier** opens their detail page.

---

### Supplier Model (Simple)

**Fields**:
- Business/name *
- Contact person
- Phone
- Email
- Address
- Notes
- Active/Inactive status

**That's it.** No credit, no payments, no terms.

---

### Supplier Details Page

**Header**
```
ABC Distributors

John Kamau
0722 xxx xxx
john@example.com
Nairobi, Kenya

[ Edit Supplier ]    [ Stock In ]
```

**Tabs**:

#### 1. Purchase History
Shows stock received from this supplier.

| Date | Reference | Items | Total |
|------|-----------|-------|-------|
| Aug 30 | INV-102 | 12 | KSh 45,000 |
| Aug 21 | INV-087 | 8 | KSh 28,500 |
| Aug 08 | INV-061 | 15 | KSh 31,200 |

#### 2. Products
List of products previously purchased from this supplier.

| Product | Last Cost | Last Purchase |
|---------|-----------|---------------|
| Coca-Cola 500ml | KSh 50 | Aug 30, 2024 |
| Sugar 2kg | KSh 180 | Aug 21, 2024 |

---

## What We're NOT Building

**Deliberately excluded** from v1:

- ❌ Purchase Orders
- ❌ Supplier credit limits
- ❌ Supplier payment ledger
- ❌ Supplier balances owed
- ❌ Payment terms
- ❌ Supplier performance scoring
- ❌ Supplier analytics dashboard
- ❌ Preferred supplier system
- ❌ Automatic reordering
- ❌ Multi-currency purchasing
- ❌ Supplier approval workflows
- ❌ Supplier product catalogs
- ❌ Separate Returns menu
- ❌ Separate Damage menu
- ❌ Separate Wastage menu
- ❌ Separate Stock Count menu
- ❌ Separate Purchases menu

These can be added later if needed, but they're not necessary for core inventory workflow.

---

## Customer Returns Workflow

**No separate Returns menu.**

Returns begin from the original sale/receipt.

**From Order Details**:
```
Sale #SALE-975

Samsung A15       KSh 22,000
Quantity: 1

[ Return Item ]
```

**Return Dialog**:
```
Return Item

What happened to the returned product?

( ) Resellable - return to inventory
( ) Damaged - do not restock

Reason *
[ Customer changed mind ]

[ Cancel ]       [ Process Return ]
```

**On Submit**:
- If `Resellable`: Creates **Return** movement (+1 stock)
- If `Damaged`: Creates **Damage** movement (no stock change)
- Updates original sale record
- May process refund (future feature)

---

## Data Flow

```
         SUPPLIER
             │
             │ provides stock
             ↓
         STOCK IN
             │
             │ increases
             ↓
         INVENTORY
             │
   ┌─────────┼─────────┐
   ↓         ↓         ↓
 SALE     RETURN     LOSS
   ↓         ↓         ↓
   └─────────┼─────────┘
             ↓
      STOCK MOVEMENTS
       (Audit Trail)
```

**Single source of truth**: Everything flows through StockLedger.

---

## Database Schema

### Supplier
```typescript
{
  userId: ObjectId           // tenant owner
  name: string               // required
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  isActive: boolean          // default: true
  createdAt: Date
  updatedAt: Date
}
```

### StockLedger (Enhanced)
```typescript
{
  userId: ObjectId           // tenant owner
  productId: ObjectId        // required
  saleId?: ObjectId          // set on sale
  staffId?: ObjectId         // who performed action
  
  type: enum [               // movement type
    'STOCK_IN',
    'SALE',
    'RETURN',
    'DAMAGE',
    'WASTAGE',
    'EXPIRED',             // future
    'LOSS',
    'ADJUSTMENT',
    'IMPORT',              // CSV import
    'MANUAL'               // manual entry
  ]
  
  quantity: number           // negative = out, positive = in
  previousStock: number      // stock before movement
  newStock: number           // stock after movement
  
  // Stock In specific
  supplierId?: ObjectId
  supplierName?: string      // denormalized for history
  unitCost?: number          // cost per unit
  totalCost?: number         // total value
  reference?: string         // invoice/PO number
  
  // General
  reason?: string            // required for manual movements
  notes?: string
  orderNumber?: string       // for sales
  timestamp: Date
}
```

### Product (No changes needed)
Existing fields are sufficient:
- productName
- stock
- buyingPrice
- sellingPrice
- category
- etc.

---

## API Endpoints

### Suppliers
```
GET    /api/suppliers           → list all
POST   /api/suppliers           → create
GET    /api/suppliers/[id]      → details + history
PUT    /api/suppliers/[id]      → update
DELETE /api/suppliers/[id]      → soft delete (isActive=false)
```

### Stock Movements
```
GET    /api/inventory/stock-ledger
  Query params:
    - type?: string (filter by movement type)
    - startDate?: string
    - endDate?: string
    - search?: string (product name)
    - productId?: string
    - supplierId?: string
    - limit?: number

POST   /api/inventory/stock-in
  Body: { supplierId, reference, items[], notes }

POST   /api/inventory/stock-count
  Body: { counts[], notes }

POST   /api/inventory/movements
  Body: { type, productId, quantity, reason, notes }

POST   /api/sales/[id]/return
  Body: { items[], reason, notes }
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- ✅ Enhance StockLedger schema
- ✅ Create Supplier schema
- ✅ Update model registry

### Phase 2: Suppliers (Week 1-2)
- ✅ Supplier API endpoints
- ✅ Suppliers list page
- ✅ Supplier detail page
- ✅ Add to sidebar

### Phase 3: Stock Movements (Week 2)
- ✅ Stock Movements page
- ✅ Enhanced stock-ledger API
- ✅ Add to sidebar

### Phase 4: Stock In (Week 3)
- ✅ Stock In modal
- ✅ Stock In API
- ✅ Integrate into Inventory

### Phase 5: Stock Count (Week 3)
- ✅ Stock Count modal
- ✅ Stock Count API
- ✅ Integrate into Inventory

### Phase 6: Manual Movements (Week 4)
- ✅ Record Movement modal
- ✅ Movement API
- ✅ Integrate into Stock Movements

### Phase 7: Returns (Week 4-5)
- ✅ Return modal
- ✅ Return API
- ✅ Integrate into Orders

### Phase 8: Polish (Week 5)
- ✅ Status badges
- ✅ Permissions
- ✅ Validation
- ✅ Edge cases

---

## Success Metrics

**User can answer**:
1. What stock do I have? → Inventory page
2. Where did it come from? → Supplier in movements
3. How much did I pay? → Unit cost in movements
4. Why did stock change? → Movement type + reason
5. Who made the change? → Staff in movements
6. When did it happen? → Timestamp

**System provides**:
- Complete audit trail
- Stock accountability
- Supplier tracking
- Cost tracking
- No manual stock edits

---

## Future Enhancements (Not in v1)

When business needs grow:
- Purchase orders
- Supplier payments/ledger
- Reorder alerts
- Cost analysis reports
- Supplier performance metrics
- Multi-location stock transfers
- Batch/lot tracking (beyond pharmacy)
- Barcode receiving
- Mobile stock counting app

---

**Document Version**: 1.0  
**Date**: August 30, 2026  
**Status**: Implementation in progress
