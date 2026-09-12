# Restocking & Purchase Order Module

## Overview

A **core module** that provides intelligent, data-driven restocking recommendations and purchase order generation across all inventory-enabled modules (Retail, Bar, Pharmacy, Kitchen, etc.).

### Purpose

Help business owners answer:
> **"What should I restock, how much should I buy, and how should I distribute my available capital?"**

The module analyzes sales velocity, stock coverage, and stockout risk to recommend purchases, then generates printable Purchase Orders grouped by supplier.

**IMPORTANT:** This module does **NOT** handle stock receiving. Creating a PO does not modify inventory. Receiving is handled by each module's existing receiving workflow.

---

## Module Architecture

### Core Principles

1. **Module-agnostic design**: Restocking module does not know about Product, Drug, BarInventoryItem, or any module-specific schemas
2. **Contract-based integration**: Each module provides two simple endpoints (low stock list + stock movements)
3. **Event-driven analysis**: Uses existing stock movement ledgers (StockLedger, InventoryTransaction, BarStockMovement)
4. **Objective recommendations**: Based solely on measurable data (velocity, coverage, urgency)
5. **User maintains control**: System recommends, user approves and adjusts

---

## Three Restocking Approaches

### 1. Low Stock (Static Threshold)

**Purpose:** Basic inventory visibility

Shows items where `currentStock < lowStockThreshold` (configured per item).

**Use case:** Quick inventory check, manual restocking decisions

**Data source:** Each module's `/restocking/low-stock` endpoint

---

### 2. Generate Restock (Velocity-Based)

**Purpose:** Intelligent low-stock detection

Calculates dynamic reorder points based on:
- Average daily sales velocity (from movement history)
- Lead time (user-configured restock cycle, e.g., 7 days)
- Current stock coverage

**Formula:**
```
Days Remaining = Current Stock ÷ Average Daily Sales
Dynamic Reorder Point = (Velocity × Lead Time) + Safety Buffer

If Days Remaining < Lead Time:
  → Item will run out before next restock opportunity
  → Flag for restocking
```

**Use case:** Data-driven restocking recommendations

**Data source:** 
- Module's `/restocking/items` endpoint (all items)
- Module's `/restocking/movements?itemId=X&days=30` endpoint (sales history)

---

### 3. Assisted Restock (Capital-Aware)

**Purpose:** Budget optimization

User enters available capital (e.g., KES 120,000). System allocates budget intelligently across items to **prevent as many stockouts as possible**.

**Allocation Strategy:**
1. Identify critical items (days remaining < lead time)
2. Prevent immediate stockouts (get all items above 2 days)
3. Extend critical items toward lead time coverage
4. Distribute remaining budget proportionally based on urgency

**Key Feature:** Accepts **partial fulfillment** — buy 4 hammers instead of ideal 10 if budget allows, so capital can cover more items.

**Use case:** "I have KES 50k. What's the smartest way to spend it?"

---

## User Workflow

```
┌─────────────────────────────────────────┐
│  Restocking Module Entry                │
├─────────────────────────────────────────┤
│  [ Low Stock ] [ Generate ] [ Assisted ]│
└─────────────────────────────────────────┘
              ↓
      ┌───────┴────────┐
      ↓                ↓
  Select Items    Auto Analysis
      ↓                ↓
      └────────┬───────┘
               ↓
        Restock Basket
               ↓
        Review/Adjust
               ↓
      Generate PO(s)
       (grouped by supplier)
               ↓
         Print/Download
```

---

## Module Integration Contract

Each inventory-enabled module (Retail, Bar, Pharmacy, Kitchen, etc.) must implement:

### Endpoint 1: Low Stock List
```
GET /api/{module}/restocking/low-stock
```

**Returns:**
```json
[
  {
    "moduleItemId": "unique-id-in-module-context",
    "name": "Product display name",
    "category": "Category name",
    "currentStock": 5,
    "lowStockThreshold": 10,
    "buyingPrice": 500,
    "sellingPrice": 800,
    "supplier": {
      "id": "supplier-id",
      "name": "Supplier Name"
    }
  }
]
```

**Notes:**
- `moduleItemId` must be unique within module context (e.g., `"product-123"` or `"drug-456-batch-789"`)
- For pharmacy, may include batch information in name: `"Paracetamol 500mg (Batch #B001)"`
- For bar, return items representing **restockable units** (bottles, not servings)

---

### Endpoint 2: Stock Movements
```
GET /api/{module}/restocking/movements?itemId=X&days=30
```

**Returns:**
```json
[
  {
    "timestamp": "2026-09-01T10:30:00Z",
    "type": "OUT",
    "quantity": -5,
    "reason": "SALE"
  },
  {
    "timestamp": "2026-09-05T14:00:00Z",
    "type": "IN",
    "quantity": 50,
    "reason": "STOCK_IN"
  }
]
```

**Notes:**
- `type`: "OUT" (stock decreased) or "IN" (stock increased)
- Module maps its internal movement types to these categories:
  - OUT: SALE, LOSS, DAMAGE, WASTAGE, EXPIRED, etc.
  - IN: PURCHASE, RETURN, ADJUSTMENT (positive), etc.
- Restocking module calculates velocity by counting OUT movements with reason=SALE

---

## Database Schema

### New Models Required

#### PurchaseOrder
```typescript
{
  _id: ObjectId
  userId: ObjectId (tenant)
  poNumber: string (auto-generated, e.g., "PO-2026-001")
  supplierId: ObjectId | null
  supplierName: string
  status: 'draft' | 'approved' | 'sent'
  items: [
    {
      moduleItemId: string  // reference back to source
      module: string        // 'retail', 'bar', 'pharmacy'
      itemName: string
      quantity: number
      unitPrice: number
      lineTotal: number
    }
  ]
  subtotal: number
  total: number
  notes: string
  createdBy: ObjectId (User or Staff)
  createdAt: Date
}
```

#### RestockPlan
```typescript
{
  _id: ObjectId
  userId: ObjectId (tenant)
  planType: 'low-stock' | 'generate' | 'assisted'
  leadTimeDays: number
  safetyBufferDays: number
  budget: number | null  // null for non-assisted plans
  recommendations: [
    {
      moduleItemId: string
      module: string
      itemName: string
      currentStock: number
      velocity: number
      daysRemaining: number
      urgency: number
      recommendedQty: number
      allocatedQty: number  // may differ from recommended (partial)
      unitPrice: number
      totalCost: number
      reason: string
    }
  ]
  totalRecommendedCost: number
  totalAllocatedCost: number
  itemsRecommended: number
  itemsDeferred: number
  createdBy: ObjectId
  createdAt: Date
  purchaseOrderIds: [ObjectId]  // POs generated from this plan
}
```

---

## Implementation Plan

### Phase 1: Foundation (Core Module Setup)

**Goal:** Establish module structure, register as core feature

**Tasks:**
1. Add to `lib/modules.ts`:
   ```typescript
   {
     key: 'core.restocking',
     label: 'Restocking',
     description: 'Purchase order generation and restocking analysis',
     href: '/dashboard/restocking',
     adminOnly: false,
     defaultOn: true
   }
   ```

2. Create directory structure:
   ```
   /app/dashboard/restocking/
   /app/api/restocking/
   /lib/restocking/
   ```

3. Add schemas to `lib/models/schemas.ts`:
   - `purchaseOrderSchema`
   - `restockPlanSchema`

4. Register models in `lib/tenant/get-models.ts`

5. Create main UI entry point:
   - `/app/dashboard/restocking/page.tsx`
   - Three-tab layout: Low Stock | Generate Restock | Assisted Restock

**Deliverable:** Module accessible at `/dashboard/restocking`, empty tabs visible

---

### Phase 2: Module Integration (Retail Only)

**Goal:** Implement contract for Retail module as proof of concept

**Tasks:**

1. **Create Retail adapters:**
   - `/app/api/retail/restocking/low-stock/route.ts`
     - Query `Product` where `stock < lowStockThreshold`
     - Return standardized format
   
   - `/app/api/retail/restocking/movements/route.ts`
     - Query `StockLedger` by `productId` and date range
     - Map ledger types to OUT/IN
     - Return standardized movement array

2. **Test endpoints manually:**
   - Verify low-stock returns correct products
   - Verify movements returns sales history

**Deliverable:** Retail module responds to restocking queries

---

### Phase 3: Tab 1 - Low Stock

**Goal:** Display static threshold-based low stock items

**Tasks:**

1. **API endpoint:**
   - `/app/api/restocking/low-stock/route.ts`
   - Queries all enabled modules' `/restocking/low-stock` endpoints
   - Aggregates results
   - Supports filtering by module, category, threshold override

2. **UI:**
   - `/app/dashboard/restocking/page.tsx` (Low Stock tab)
   - Table: Item | Module | Stock | Threshold | Supplier
   - Search/filter controls
   - Multi-select checkboxes
   - "Add Selected to Basket" button

3. **Basket state:**
   - Client-side state (React context or Zustand)
   - Stores selected items with quantities

**Deliverable:** User can view low stock items and add to basket

---

### Phase 4: Velocity Calculation Service

**Goal:** Build core analytics engine

**Tasks:**

1. **Create service:**
   - `/lib/restocking/velocity-analyzer.ts`
   - Function: `calculateVelocity(movements[], days)`
     - Filters OUT movements with reason=SALE
     - Sums quantities
     - Returns average daily sales
   
   - Function: `calculateCoverage(currentStock, velocity, leadTime)`
     - Returns days remaining
     - Returns urgency score (leadTime / daysRemaining)

2. **Create API:**
   - `/app/api/restocking/analyze/route.ts`
   - Accepts: `{ itemIds[], leadTimeDays, safetyBufferDays }`
   - For each item:
     - Fetches movements from module
     - Calculates velocity
     - Calculates dynamic reorder point
     - Determines if restock needed
   - Returns: Analysis results

**Deliverable:** Velocity analysis works for individual items

---

### Phase 5: Tab 2 - Generate Restock

**Goal:** Velocity-based recommendations

**Tasks:**

1. **API endpoint:**
   - `/app/api/restocking/generate/route.ts`
   - Accepts: `{ leadTimeDays, safetyBufferDays, modules[] }`
   - Steps:
     1. Fetch all items from selected modules
     2. Fetch movements for each item (last 30 days)
     3. Calculate velocity and coverage
     4. Filter items where `daysRemaining < leadTime`
     5. Sort by urgency (ascending days remaining)
     6. Return recommendations

2. **UI:**
   - Generate Restock tab
   - Input: Lead time (default 7 days), safety buffer (default 2 days)
   - Button: "Analyze"
   - Results table: Item | Current Stock | Velocity | Days Left | Urgency | Recommended Qty
   - "Add Selected to Basket" button

**Deliverable:** User gets intelligent restock recommendations based on velocity

---

### Phase 6: Capital Allocation Algorithm

**Goal:** Implement budget-aware allocation logic

**Tasks:**

1. **Create service:**
   - `/lib/restocking/capital-allocator.ts`
   - Function: `allocateBudget(items[], budget, leadTime)`
   - Algorithm:
     1. Filter critical items (daysRemaining < leadTime)
     2. Sort by urgency (days remaining ascending)
     3. **Round 1:** Prevent immediate stockouts
        - For items with < 2 days, allocate to reach 2 days
     4. **Round 2:** Extend to lead time
        - For items < leadTime, allocate full if budget allows
     5. **Round 3:** Proportional distribution
        - Distribute remaining budget proportionally based on urgency weights
     6. Stop when budget exhausted or no item can be improved

   - Returns: 
     ```typescript
     {
       allocated: [ { itemId, qty, cost } ],
       deferred: [ { itemId, reason } ],
       totalSpent: number,
       remaining: number
     }
     ```

2. **API endpoint:**
   - `/app/api/restocking/assisted/route.ts`
   - Accepts: `{ budget, leadTimeDays, safetyBufferDays, modules[] }`
   - Calls allocation algorithm
   - Returns allocation plan

**Deliverable:** Capital allocation algorithm works correctly

---

### Phase 7: Tab 3 - Assisted Restock

**Goal:** Budget-aware UI

**Tasks:**

1. **UI:**
   - Assisted Restock tab
   - Input: Budget (KES), lead time, safety buffer
   - Button: "Analyze"
   - Summary card:
     - Budget available
     - Recommended spend
     - Remaining
     - Items allocated
     - Items deferred
   - Allocated items table: Item | Ideal Qty | Allocated Qty | % | Cost | Reason
   - Deferred items collapsible section
   - "Add All to Basket" button

2. **User adjustments:**
   - Allow editing allocated quantities
   - Live recalculation of budget impact
   - Show warnings if budget exceeded

**Deliverable:** User can run assisted restock and review recommendations

---

### Phase 8: Restock Basket

**Goal:** Unified basket for all three tabs

**Tasks:**

1. **Basket state management:**
   - Persistent client state (survives tab switches)
   - Items: `{ moduleItemId, module, name, qty, unitPrice, supplier }`

2. **Basket UI component:**
   - Side panel or modal
   - Shows all items in basket
   - Edit quantity, remove item
   - Group preview by supplier
   - Total cost display

3. **API endpoint:**
   - `/app/api/restocking/basket/route.ts`
   - CRUD operations for basket items
   - Optional: persist basket to database for multi-session work

**Deliverable:** User can manage items in basket across tabs

---

### Phase 9: Purchase Order Generation

**Goal:** Create POs grouped by supplier

**Tasks:**

1. **Service:**
   - `/lib/restocking/po-generator.ts`
   - Function: `generatePOs(basketItems[])`
   - Groups items by supplier (by supplierId or supplierName)
   - Creates one PO per supplier
   - Generates PO numbers (e.g., PO-2026-001)
   - Calculates subtotals and totals

2. **API endpoint:**
   - `/app/api/restocking/purchase-orders/route.ts`
   - POST: Create POs from basket
   - GET: List POs
   - GET `/:id`: View single PO

3. **Database:**
   - Save PurchaseOrder documents
   - Link to RestockPlan if generated from analysis

**Deliverable:** POs created and saved to database

---

### Phase 10: PO Review & Print

**Goal:** User reviews and prints POs

**Tasks:**

1. **PO Review UI:**
   - `/app/dashboard/restocking/purchase-orders/page.tsx`
   - List all POs (filterable by status, supplier, date)
   - Click to view detail

2. **PO Detail UI:**
   - `/app/dashboard/restocking/purchase-orders/[id]/page.tsx`
   - Display PO header (number, supplier, date)
   - Line items table
   - Total
   - Notes section
   - Print button

3. **Print Layout:**
   - Print-friendly CSS (`@media print`)
   - Business header (tenant name, contact)
   - Supplier details
   - PO number and date
   - Line items table with quantities, prices, totals
   - Grand total
   - Terms/notes

4. **Optional: PDF Generation:**
   - Use library like `react-pdf` or server-side PDF generator
   - Download PO as PDF

**Deliverable:** User can review, print, and download POs

---

### Phase 11: Extend to Bar Module

**Goal:** Prove multi-module support

**Tasks:**

1. **Create Bar adapters:**
   - `/app/api/bar/restocking/low-stock/route.ts`
     - Query `BarInventoryItem` where `stock < lowStockThreshold`
     - Return sealed bottles only (ignore open bottles)
   
   - `/app/api/bar/restocking/movements/route.ts`
     - Query `BarStockMovement` or calculate from `BarTabLine`
     - Map to OUT (bottle sales, servings converted to bottle equivalents) and IN

2. **Test:**
   - Run all three restocking tabs with Bar items
   - Verify velocity calculation works
   - Verify mixed Retail + Bar basket works

**Deliverable:** Bar module integrated, restocking works across Retail + Bar

---

### Phase 12: Extend to Pharmacy Module

**Goal:** Handle batch-based inventory

**Tasks:**

1. **Create Pharmacy adapters:**
   - `/app/api/pharmacy/restocking/low-stock/route.ts`
     - Query `Drug` + aggregate `DrugBatch` quantities
     - May return drug-level or batch-level items depending on receiving strategy
   
   - `/app/api/pharmacy/restocking/movements/route.ts`
     - Query `InventoryTransaction`
     - Map to OUT/IN

2. **Considerations:**
   - Pharmacy may need special handling for upcoming expiries
   - PO might need to capture batch metadata (mfg date, expiry, lot number)
   - Start simple: just restock drug-level quantities

**Deliverable:** Pharmacy module integrated

---

### Phase 13: Restocking History

**Goal:** Track restocking decisions over time

**Tasks:**

1. **Save RestockPlan on analysis:**
   - When user runs Generate or Assisted, save plan to database
   - Link POs created from that plan

2. **History UI:**
   - `/app/dashboard/restocking/history/page.tsx`
   - List all plans (date, type, budget, items count)
   - Click to view plan details and linked POs

**Deliverable:** User can review past restocking decisions

---

### Phase 14: Permissions & Access Control

**Goal:** Respect staff permissions

**Tasks:**

1. **Add permission key:**
   - `'core.restocking'` in `lib/modules.ts`
   - Default: enabled for managers, disabled for cashiers

2. **Middleware:**
   - Check permission in `/app/api/restocking/*` routes
   - Check permission in dashboard pages

**Deliverable:** Only authorized users can access restocking module

---

### Phase 15: Refinements & UX Polish

**Goal:** Production-ready quality

**Tasks:**

1. **Loading states:**
   - Show spinners during analysis
   - Disable buttons during async operations

2. **Error handling:**
   - Handle module query failures gracefully
   - Show user-friendly error messages

3. **Empty states:**
   - "No low stock items" message
   - "No recommendations" when all items have adequate coverage

4. **Explanations:**
   - Tooltips explaining velocity, urgency, coverage
   - Help text for lead time and safety buffer inputs

5. **Responsive design:**
   - Mobile-friendly tables (horizontal scroll or cards)

6. **Performance:**
   - Cache movement queries (e.g., 5-minute TTL)
   - Paginate large item lists

**Deliverable:** Polished, production-ready module

---

## Testing Strategy

### Unit Tests
- Velocity calculation functions
- Coverage and urgency scoring
- Capital allocation algorithm
- PO grouping logic

### Integration Tests
- Module adapter endpoints return correct format
- Restocking APIs aggregate multi-module data correctly
- PO generation creates correct documents

### E2E Tests
- User flow: Low Stock → Add to Basket → Generate PO → Print
- User flow: Assisted Restock with budget → Review recommendations → Adjust → Generate PO
- Mixed-module restocking (Retail + Bar + Pharmacy in one basket)

---

## Future Enhancements (Post-MVP)

1. **Receiving workflow integration:**
   - "Receive against PO" feature per module
   - Track received vs ordered quantities
   - Partial receiving support

2. **Supplier management enhancements:**
   - Lead time per supplier
   - Minimum order quantities (MOQ)
   - Bulk discounts

3. **Advanced analytics:**
   - Seasonality detection (compare velocity across months)
   - Trend analysis (accelerating vs decelerating demand)
   - Forecasting (predict future demand)

4. **Email/SMS notifications:**
   - Alert when critical items reach stockout threshold
   - Send PO to supplier via email

5. **Approval workflows:**
   - Manager approval required before PO creation
   - Multi-level approval for large purchases

6. **Budget templates:**
   - Save common budget allocations
   - "Typical weekly restock: KES 50k"

7. **Supplier comparison:**
   - Same product from multiple suppliers
   - Suggest cheaper alternative

---

## Key Success Metrics

- **User can generate intelligent restock recommendations in under 30 seconds**
- **Capital allocation algorithm prevents more stockouts than naive greedy approach**
- **Module works seamlessly with Retail, Bar, and Pharmacy**
- **PO generation completes in < 2 seconds for 50 items**
- **Zero inventory modifications from PO creation (safety validation)**

---

## Implementation Notes

- **Start with Retail only** — validate architecture before extending
- **Test capital allocation with real-world scenarios** — edge cases are common
- **Keep UI simple initially** — focus on functionality over polish in early phases
- **Document module contract clearly** — other developers will implement adapters
- **Never modify inventory from PO creation** — enforce this constraint at API level

---

## Estimated Timeline

- Phase 1-2: 2 days (foundation + Retail integration)
- Phase 3-5: 4 days (Low Stock + velocity analysis + Generate Restock)
- Phase 6-7: 3 days (capital allocation + Assisted Restock)
- Phase 8-10: 3 days (basket + PO generation + print)
- Phase 11-12: 2 days (Bar + Pharmacy integration)
- Phase 13-15: 2 days (history + permissions + polish)

**Total: ~16 days (3.2 weeks) for full implementation**

---

## Conclusion

This module transforms restocking from a manual, gut-feeling process into a data-driven, capital-efficient operation. By respecting module boundaries and using objective metrics, it provides valuable insights without imposing business logic on the user.
