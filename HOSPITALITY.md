# Hospitality Module Documentation

## Overview

The Hospitality module is a specialized inventory and sales system designed for food and beverage businesses (restaurants, bars, cafes, clubs, juice bars, etc.) that need to track inventory in **servings** rather than just whole units.

Unlike standard retail inventory that tracks complete items, the Hospitality module handles:
- **Fractional inventory** (partial bottles, sliced fruits, measured liquids)
- **Multiple serving types** from the same item (tots, primes, quicks from one bottle)
- **Automatic deduction** when sales are made
- **Manual production tracking** (converting raw materials to prepared servings)
- **Yield variance** (when actual servings differ from expected)

---

## Module Architecture

### Module Key
- **Code:** `hospitality`
- **Display Name:** Configurable per tenant (e.g., "Restaurant System", "Bar Management", "Juice Bar")
- **Routes:** `/dashboard/hospitality/*`, `/api/hospitality/*`
- **Database Collections:** Tenant-isolated with `hospitality_` prefix

### Features
- `hospitality.pos` - Point of Sale interface
- `hospitality.orders` - Order history and management
- `hospitality.menu` - Menu configuration (what can be sold)
- `hospitality.inventory` - Stock management (what you have)
- `hospitality.production` - Kitchen/bar production tracking
- `hospitality.stock` - Stock movements and adjustments
- `hospitality.reports` - Analytics and reporting

---

## Core Concepts

### 2. Servable vs Whole-Only Items (For Sale)

**Servable Items:**
- Can be sold in portions/servings
- Support multiple serving types
- Track whole + partial units
- Example: Bottles (sold by tots, primes), Fruits (sold by slices), Juice (sold by ml)

**Whole-Only Items:**
- Sold as complete units only
- No serving configuration needed
- Example: Packaged snacks, canned drinks, bottled water

**Ingredients:**
- Never sold to customers
- Used only in production
- Track quantities and units (bars, litres, kg)
- Example: Soap bars, cooking oil, raw chicken, flour

**Inventory Mode:**
- **Tracked** - requires stock before selling (pre-made items like mandazi, drinks)
- **Untracked** - made-to-order, no stock check (fresh burgers, custom salads)
  - Order goes to kitchen display
  - Optional production log for cost tracking only

### 2. Serving Types

Each servable item can have multiple serving types defined:

**Example: Whiskey Bottle**
- 1 bottle = 20 tots
- 1 bottle = 12 primes
- 1 bottle = 8 quicks

**Example: Watermelon**
- 1 fruit = 8 slices
- 1 fruit = 4 quarters

**Example: Fresh Juice (50L batch)**
- 50L = 400 servings of 125ml
- 50L = 200 servings of 250ml
- 50L = 166 servings of 300ml

### 3. Calculation Modes

**Fraction-Based (Portions)**
- Used for discrete servings (bottle servings, fruit slices)
- Calculates using fractions: 1 tot = 1/20 of bottle
- System prevents overselling across different serving types
- Example: Can't sell 15 tots if only 10 remain, even if 12 primes theoretically available

**Volume-Based (Metric)**
- Used for liquids measured in ml/L
- Calculates actual volumes: 250ml removes 0.25L
- Natural metric decrementation
- Example: 50L juice → sell 250ml → 49.75L remaining

### 4. Inventory Tracking

**Structure:**
```
Item: Whiskey Bottle
├─ Whole Units: 5 bottles
├─ Partial Units:
│   ├─ Bottle #1: 15/20 tots remaining (75% full)
│   └─ Bottle #2: 8/20 tots remaining (40% full)
└─ Total Available:
    ├─ 123 tots (5×20 + 15 + 8)
    ├─ 73 primes (5×12 + 9 + 4)
    └─ 48 quicks (5×8 + 6 + 3)
```

**Key Principles:**
- FIFO (First In, First Out) for partial units
- Oldest partials consumed first to minimize waste
- Real-time availability checks before sales
- No overselling possible

### 5. Movement Types

**Automatic Movements:**
- **Sales Consumption:** POS transaction automatically deducts servings
- Triggers: Sale completed and paid

**Manual Movements:**
- **Receive Stock:** Adding new whole units (deliveries)
- **Production:** Converting raw materials to prepared servings
- **Adjustment:** Manual corrections with reason codes
- **Waste/Spillage:** Logging losses
- **Consolidation:** Merging partial units

All movements create audit trail entries with timestamp, user, reason, before/after states.

---

## Database Schema

### menu_items
Primary inventory items (products and ingredients)

```
{
  _id: ObjectId,
  tenantId: string,
  name: string,
  description: string,
  category: string,
  sku: string,
  barcode: string,
  images: string[],
  itemType: 'for-sale' | 'ingredient',  // for-sale = sold to customers, ingredient = used in production
  isServable: boolean,           // true = supports servings, false = whole-only (only for for-sale items)
  servingMode: 'fraction' | 'volume' | null,  // calculation mode (only for servable items)
  baseUnit: string,              // 'bottle', 'fruit', 'liter', 'bar', etc.
  wholePriceIfNotServable: number,  // price when sold as whole (if not servable)
  costPrice: number,
  reorderPoint: number,
  inventoryMode: 'tracked' | 'untracked',  // tracked = requires stock, untracked = made-to-order
  canConsolidate: boolean,       // whether partial units can physically be consolidated
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

### serving_types
Serving definitions per menu item

```
{
  _id: ObjectId,
  tenantId: string,
  menuItemId: ObjectId,
  name: string,                  // 'Tot', 'Prime', 'Quick', '250ml', 'Slice'
  servingsPerUnit: number,       // 20 tots per bottle, 8 slices per fruit
  pricePerServing: number,
  volume: number | null,         // for volume-based: 250 (ml)
  isDefault: boolean,            // default serving type in POS
  displayOrder: number,
  createdAt: Date,
  updatedAt: Date
}
```

### serving_inventory
Current stock levels

```
{
  _id: ObjectId,
  tenantId: string,
  menuItemId: ObjectId,
  wholeUnits: number,            // complete unopened units
  partialUnits: [{
    id: string,                  // unique identifier for this partial
    servingsRemaining: {
      [servingTypeId]: number    // remaining servings by type
    },
    openedAt: Date,
    batchId: string | null       // for traceability
  }],
  totalAvailableServings: {
    [servingTypeId]: number      // calculated total available
  },
  lastUpdated: Date,
  lastCountedAt: Date,           // physical stock count
  variance: number               // difference from expected
}
```

### serving_movements
Audit trail for all inventory changes

```
{
  _id: ObjectId,
  tenantId: string,
  menuItemId: ObjectId,
  movementType: 'sale' | 'receive' | 'production' | 'adjustment' | 'waste' | 'consolidation',
  servingTypeId: ObjectId | null,
  quantity: number,              // servings moved
  wholeUnitsChanged: number,
  beforeState: {
    wholeUnits: number,
    partialUnits: number,
    totalServings: object
  },
  afterState: {
    wholeUnits: number,
    partialUnits: number,
    totalServings: object
  },
  reason: string,                // for manual movements
  referenceType: 'sale' | 'production' | 'adjustment',
  referenceId: ObjectId,         // link to source transaction
  performedBy: ObjectId,         // staff/user who performed action
  approvedBy: ObjectId | null,   // for adjustments requiring approval
  timestamp: Date,
  metadata: object               // additional context
}
```

### production_logs
Kitchen/bar production tracking

```
{
  _id: ObjectId,
  tenantId: string,
  productionDate: Date,
  producedItemId: ObjectId,      // menu item produced
  servingTypeId: ObjectId | null,
  expectedYield: number,         // servings expected
  actualYield: number,           // servings actually produced
  variance: number,              // actualYield - expectedYield
  variancePercentage: number,
  ingredientsUsed: [{
    itemId: ObjectId,
    quantityUsed: number,
    unit: string
  }],
  notes: string,
  producedBy: ObjectId,
  approvedBy: ObjectId | null,
  status: 'pending' | 'approved' | 'rejected',
  createdAt: Date
}
```

### hospitality_orders
Sales orders (links to main sales system)

```
{
  _id: ObjectId,
  tenantId: string,
  orderNumber: string,
  items: [{
    menuItemId: ObjectId,
    name: string,
    quantity: number,            // whole units ordered
    servingTypeId: ObjectId | null,
    servingTypeName: string | null,
    servingsOrdered: number | null,
    pricePerUnit: number,
    totalPrice: number
  }],
  subtotal: number,
  tax: number,
  total: number,
  paymentMethod: string,
  paymentStatus: 'pending' | 'paid' | 'refunded',
  customerId: ObjectId | null,
  servedBy: ObjectId,
  tableNumber: string | null,
  orderType: 'dine-in' | 'takeaway' | 'delivery',
  status: 'pending' | 'completed' | 'cancelled',
  createdAt: Date,
  completedAt: Date
}
```

---

## Business Logic

### Serving Availability Calculation

When calculating available servings across multiple serving types from the same item:

**Example: Bottle Inventory**
- 3 whole bottles
- 1 partial with 10/20 tots remaining

**Available Servings:**
- Tots (20/bottle): 3×20 + 10 = **70 tots**
- Primes (12/bottle): 3×12 + 6 = **42 primes** (10 tots = 50% bottle = 6 primes)
- Quicks (8/bottle): 3×8 + 4 = **28 quicks** (10 tots = 50% bottle = 4 quicks)

**Algorithm:**
```
For each serving type:
  1. Calculate from whole units: wholeUnits × servingsPerUnit
  2. Calculate from each partial:
     - Convert partial's remaining amount to percentage
     - Apply percentage to this serving type's servingsPerUnit
  3. Sum all servings
  4. Floor result (can't sell fractional servings)
```

### Cross-Serving Validation

Prevent impossible combinations when multiple serving types share the same inventory:

**Scenario:**
- 1 bottle = 20 tots OR 12 primes
- Inventory: 0.5 bottles (10 tots OR 6 primes)
- Customer A orders 10 tots → Order accepted, 0 bottles remain
- Customer B orders 6 primes → **Order rejected** (no inventory left)

**Validation Rule:**
Before accepting order, recalculate available servings after proposed deduction to ensure no negative inventory.

### FIFO Partial Consumption

When consuming servings, always use oldest partial first:

**Inventory:**
- Partial A: opened 3 days ago, 5 tots remaining
- Partial B: opened 1 day ago, 15 tots remaining
- Whole: 2 full bottles

**Order: 10 tots**

**Deduction:**
1. Use all 5 tots from Partial A (oldest) → Partial A depleted, removed
2. Use 5 tots from Partial B → Partial B now has 10 tots remaining
3. Whole bottles untouched

### Yield Variance Handling

When production yields differ from expected:

**Expected:** 1 fruit = 8 slices
**Actual:** 1 fruit = 9 slices (variance: +1 slice, +12.5%)

**Actions:**
1. Log variance in production_logs
2. Update inventory with actual yield
3. If variance exceeds threshold (e.g., ±20%), flag for approval
4. Track variance patterns over time
5. Suggest updating expected yield if consistent variance

---

## API Endpoints

### Menu Items
- `GET /api/hospitality/menu` - List all menu items (product catalog)
- `POST /api/hospitality/menu` - Create menu item
- `GET /api/hospitality/menu/:id` - Get menu item details
- `PUT /api/hospitality/menu/:id` - Update menu item
- `DELETE /api/hospitality/menu/:id` - Delete menu item

### Menu Categories
- `GET /api/hospitality/menu/categories` - List all categories
- `POST /api/hospitality/menu/categories` - Create category
- `PUT /api/hospitality/menu/categories/:id` - Update category
- `DELETE /api/hospitality/menu/categories/:id` - Delete category
- `PUT /api/hospitality/menu/categories/reorder` - Reorder categories

### Serving Types
- `GET /api/hospitality/servings/:menuItemId` - Get serving types for item
- `POST /api/hospitality/servings` - Create serving type
- `PUT /api/hospitality/servings/:id` - Update serving type
- `DELETE /api/hospitality/servings/:id` - Delete serving type

### Inventory
- `GET /api/hospitality/inventory` - Get current inventory levels (tracked items only)
- `GET /api/hospitality/inventory/:menuItemId` - Get item inventory detail
- `GET /api/hospitality/inventory/ingredients` - Get ingredient inventory
- `POST /api/hospitality/inventory/check` - Check serving availability

### Stock Movements
- `POST /api/hospitality/stock/receive` - Receive new stock (batch operation)
- `POST /api/hospitality/stock/adjust` - Manual adjustment
- `POST /api/hospitality/stock/waste` - Log waste/spillage
- `POST /api/hospitality/stock/consolidate` - Consolidate partial units
- `GET /api/hospitality/stock/history` - Movement history with filters

### Production
- `POST /api/hospitality/production` - Log production (ingredients → produced items)
- `GET /api/hospitality/production` - Production history with filters
- `PUT /api/hospitality/production/:id/approve` - Approve production with variance

### Sales (POS)
- `GET /api/hospitality/pos/menu` - Get menu items for POS (all items regardless of tracking)
- `POST /api/hospitality/sales` - Create sale (auto-deducts inventory for tracked items)
- `GET /api/hospitality/sales` - Sales history
- `GET /api/hospitality/sales/:id` - Sale details
- `POST /api/hospitality/sales/hold` - Hold order
- `GET /api/hospitality/sales/held` - Get held orders
- `PUT /api/hospitality/sales/held/:id/resume` - Resume held order

### Reports
- `GET /api/hospitality/reports/sales` - Sales analytics
- `GET /api/hospitality/reports/wastage` - Wastage reports
- `GET /api/hospitality/reports/variance` - Yield variance reports
- `GET /api/hospitality/reports/inventory-value` - Inventory valuation

---

## User Interface Structure

### Main Navigation (Sidebar)

When Hospitality module is enabled, sidebar shows:
- **POS** - Point of sale interface
- **Orders** - Order history and management
- **Menu** - Menu configuration (product catalog)
- **Inventory** - Stock management (physical inventory)
- **Stock** - Movement history and audit trail
- **Production** - Kitchen/bar production logs
- **Reports** - Analytics and reporting

### Key Distinction

**Menu = Product Catalog** (what's available to sell)
- Defines all sellable items
- Configures serving types and pricing
- Sets inventory tracking mode (tracked/untracked)
- Items appear in POS regardless of stock

**Inventory = Physical Stock** (what you actually have)
- Tracks quantities of tracked items
- Manages ingredient supplies
- Stock receiving operations
- Only shows items with inventoryMode: 'tracked'

### Menu Page (2 Tabs)

**Tab 1: Menu Items**
- All items that can be sold to customers
- Card-based grid layout
- Each card displays:
  - Item name, image, category
  - Base price (or default serving price)
  - Serving configuration badge (if servable)
  - Inventory mode badge (Tracked/Made-to-Order)
  - [Edit] button
- Shows ALL menu items regardless of inventory tracking
- Search and filter by category
- "Add New Menu Item" button at top

**Menu Item Configuration:**
- Basic details (name, description, category, price, images)
- Item type: for-sale (always for menu items)
- Inventory mode: 'tracked' (requires stock) or 'untracked' (made-to-order)
- If tracked and servable:
  - Enable servings
  - Set serving mode (fraction/volume)
  - Configure serving types (name, yield, price)
  - Set default serving type for POS
- Reorder point (for tracked items)
- Can consolidate (for servable items)

**Tab 2: Categories**
- Manage menu categories (Drinks, Food, Snacks, Desserts, etc.)
- Add/edit/delete categories
- Drag to reorder (affects POS display order)
- Set category visibility
- Set category color/icon for POS

### Inventory Page (3 Tabs)

**Tab 1: For Sale**
- Card-based grid layout (2-3 cards per row on desktop)
- Shows only tracked menu items (items that require stock)
- Each card displays:
  - Item name, image, category
  - Stock level (whole units)
  - Available servings breakdown (for servable items)
  - Partial units count
  - Low stock indicator (visual warning)
  - [Edit] button (opens item detail page)
- Search and filter by category
- View-only for stock levels (use Receive Stock tab or Stock page for operations)
- Does NOT show untracked items (made-to-order)

**Tab 2: Ingredients**
- Card-based grid layout (same as For Sale)
- Shows backend supplies (flour, oil, soap, raw materials)
- Each card displays:
  - Ingredient name, category
  - Quantity and unit
  - Cost price
  - Reorder point
  - Low stock indicator
  - [Edit] button
- Search and filter by category
- "Add New Ingredient" button at top
- View-only for stock levels

**Tab 3: Receive Stock**
- Table-based layout (optimal for receiving workflow)
- Multi-item receiving session
- Columns: Item Name, Category, Current Stock, Qty Receiving, New Total, Actions
- Scan/search to add items to receiving list
- Can add from both For Sale items and Ingredients
- Shows current stock before receiving
- Enter quantity received per item
- Optional: Supplier reference, invoice number, notes
- "Complete Receiving" button at bottom
- Processes all items at once
- Creates single batch movement record for entire session
- Real-world workflow: unpack delivery, scan items, verify, submit

### POS Page (Main Sales Interface)

**Layout:**

**Left Side: Menu Item Grid**
- Card-based grid showing all menu items (from Menu page)
- Filter by category tabs at top (Drinks, Food, Snacks, etc.)
- Search bar
- Each card displays:
  - Item image
  - Item name
  - Price (base price or default serving price)
  - Stock indicator (for tracked items): "100 available" or "Made to Order"
  - Low stock warning (yellow border if < 10)
  - Out of stock (grayed out, can't select)

**Right Side: Cart**
- Line items with serving details
- Each line shows:
  - Item name
  - Serving type (if servable): "Whiskey (1 tot)"
  - Quantity with +/- controls
  - Price per unit
  - Line total
  - [🍳 Kitchen] badge for untracked items
  - Remove button
- Subtotal
- Tax (if applicable)
- Total
- [Hold Order] [Clear Cart] [Checkout] buttons

**Adding Items to Cart:**

**Servable Items (whiskey, pawpaw):**
1. Click item card
2. Modal opens: "Select Serving Type"
   - Lists all serving types with prices
   - Shows available quantity per type: "100 tots available"
   - Default serving type highlighted
   - Low stock warning if < 10
   - Grayed out if unavailable
3. Select serving type
4. Quantity picker: [- 1 +]
5. [Add to Cart]

**Whole-Only Items (oranges, sodas):**
1. Click item card
2. Quantity picker appears on card: [- 1 +]
3. Adds directly to cart (or click to confirm)
4. No modal needed

**Untracked Items (chicken & chips, fresh burgers):**
1. Click item card
2. Quantity picker appears
3. Adds to cart with no stock check
4. Shows "Made to Order" or kitchen icon badge

**Real-Time Validation:**
- For tracked items: system checks availability before adding
- If insufficient stock: error message "Only 5 tots available"
- Suggests alternatives: "8 primes available instead"
- Updates available quantities as items added to cart

**Checkout Flow:**
1. Review cart items
2. [Checkout] → Payment page
3. Select payment method
4. Enter customer details (optional)
5. Table/order number (optional)
6. Process payment
7. **System automatically:**
   - Deducts servings from tracked items (FIFO for partials)
   - No deduction for untracked items
   - Creates movement records
   - Sends untracked items to kitchen display (if enabled)
   - Generates receipt with serving details

**Held Orders:**
- Save incomplete order with name/table number
- Orders stored in memory/database
- Resume later from held orders panel
- Stock not reserved or deducted until payment completed

### Stock Page (Separate Top-Level)

- Movement history (read-only timeline)
- Shows all stock operations: receives, adjustments, waste, sales deductions, production
- Filter by: date range, item, movement type, user
- Each movement shows: timestamp, user, before/after states, reason, reference
- Export functionality for compliance
- Paginated for performance

**Stock Operations (Buttons at top):**
- [Log Adjustment] - Manual corrections with reason codes
- [Log Waste/Spillage] - Record losses
- [Consolidate Partials] - Merge partial units (only for items with canConsolidate=true)

### Production Page (Separate Top-Level)

- Production log entry form
- Select item being produced
- Enter ingredients used (with quantities)
- Enter actual servings/units produced
- System calculates variance vs expected yield
- Add notes if variance significant
- Submit for approval (if variance exceeds threshold)
- Production history view below form
- Filter by date, item, staff member
- Shows variance trends

## User Workflows

### Bartender/Server Workflow

**Opening Shift:**
1. Navigate to Inventory → For Sale tab
2. Visually scan cards for low-stock indicators
3. Report critical items to manager

**Taking Orders (POS):**
1. Navigate to POS page
2. Click menu item cards to add to cart
   - For servable items: select serving type in modal
   - For whole items: click to add
   - For made-to-order: adds without stock check
3. System validates tracked item availability in real-time
4. Review cart
5. [Checkout] → process payment
6. System auto-deducts servings from inventory

**If Breakage:**
1. Navigate to Stock page
2. Click [Log Waste/Spillage]
3. Search and select item
4. Enter quantity wasted
5. Enter reason
6. Submit (logs immediately, no approval needed for small amounts)

### Kitchen/Bar Staff Workflow

**Production Session:**
1. Navigate to Production page
2. Fill out production form:
   - Select item being produced
   - Add ingredients used (search and select, enter quantities)
   - Enter actual yield (servings/units produced)
3. System shows expected vs actual variance
4. Add notes if variance is significant
5. Submit for approval (if required by variance threshold)

**Check Ingredient Levels:**
1. Navigate to Inventory → Ingredients tab
2. View card grid
3. Note low-stock items

### Manager Workflow

**Daily Operations:**
1. Check Inventory → For Sale for low stock
2. Check Stock page for pending approvals
3. Review Production page for high variance entries
4. Approve/reject as needed

**Menu Management:**
1. Navigate to Menu → Menu Items tab
2. Add new menu items or edit existing
3. Configure serving types and pricing
4. Set inventory mode (tracked/untracked)
5. Organize categories in Menu → Categories tab

**Stock Receiving:**
1. Navigate to Inventory → Receive Stock tab
2. Scan or search items as delivered
3. Enter quantities received per item
4. Add supplier reference
5. Click "Complete Receiving" (updates all at once)

**Weekly Analysis:**
1. Navigate to Reports page
2. Run sales reports by serving type
3. Review wastage reports
4. Check yield variance trends
5. Adjust reorder points in Menu → Menu Items
6. Update expected yields if consistent variance

### Admin/Owner Workflow

**New Menu Item Setup:**
1. Navigate to Menu → Menu Items tab
2. Click "Add New Menu Item"
3. Fill in basic details (name, description, category, price, images)
4. Set inventory mode:
   - **Tracked**: requires stock before selling (pre-made items)
   - **Untracked**: made-to-order, no stock check
5. If tracked and sold in servings:
   - Enable "Supports Servings"
   - Select serving mode (fraction/volume)
   - Add serving types with yields and prices
   - Set default serving type for POS
6. Set reorder point (for tracked items)
7. Set canConsolidate (if applicable)
8. Save item
9. Item appears in:
   - POS (always)
   - Inventory → For Sale (only if tracked)

**New Ingredient Setup:**
1. Navigate to Inventory → Ingredients tab
2. Click "Add New Ingredient"
3. Fill in details (name, unit, cost price)
4. Set itemType: 'ingredient'
5. Set reorder point
6. Save ingredient
7. Ingredient appears only in Inventory → Ingredients (never in POS)

**Module Configuration:**
1. Admin panel → Tenant management
2. Enable Hospitality module
3. Set custom display name (e.g., "Restaurant System", "Bar Management")
4. Select features to enable
5. Save configuration

---

## Customization Per Tenant

### Display Name
Admin can customize module name during tenant provisioning:

**Examples:**
- "Restaurant System" (full-service restaurant)
- "Bar Management" (bar/pub)
- "Juice Bar" (juice bar, smoothie shop)
- "Cafe" (coffee shop)
- "Kitchen Operations" (catering business)

The display name appears in:
- Sidebar navigation
- Page headers
- Staff permission labels

Internal code always uses `hospitality` key.

### Feature Toggles
Admin can enable/disable specific features per tenant:

- POS (usually always enabled)
- Orders (can disable for counter-only service)
- Inventory (usually always enabled)
- Production (can disable if no on-site production)
- Stock Movements (usually always enabled)
- Reports (can disable for basic users)

---

## Staff Permissions

Permission keys follow pattern: `hospitality.{feature}`

**Bartender/Server Role:**
- `hospitality.pos` ✓ (can make sales)
- `hospitality.orders` ✓ (can view orders)
- `hospitality.inventory` ✓ (can view stock levels)
- `hospitality.production` ✗ (cannot log production)
- `hospitality.stock` ✓ (can log waste only, no adjustments)
- `hospitality.reports` ✗ (no access to reports)

**Kitchen Staff Role:**
- `hospitality.pos` ✗
- `hospitality.orders` ✓
- `hospitality.inventory` ✓
- `hospitality.production` ✓ (can log production)
- `hospitality.stock` ✓ (limited to waste and production-related)
- `hospitality.reports` ✗

**Manager Role:**
- All permissions ✓
- Additional: Can approve adjustments and production entries

**Owner Role:**
- All permissions ✓
- Can configure module settings
- Can modify serving configurations

---

## Integration Points

### With Core System

**Customers:**
- Hospitality orders can be linked to customer accounts
- Credit sales supported
- Customer purchase history includes hospitality orders

**Staff:**
- Staff permissions include hospitality features
- All transactions track which staff member performed action
- Audit trail includes staff information

**Reporting:**
- Dashboard stats include hospitality sales
- Financial reports aggregate all modules
- Tax calculations unified

### With Retail Module

**Coexistence:**
- Tenant can have both Retail and Hospitality modules enabled
- Retail = whole-item sales (shop, boutique)
- Hospitality = serving-based sales (bar, restaurant)
- Separate inventories, separate POS interfaces
- Unified customer and staff management

---

## Technical Notes

### Calculations Library
Location: `lib/servings/calculator.ts`

Core functions:
- `calculateAvailableServings()` - Compute servings from whole + partials
- `canSatisfyOrder()` - Validate order against inventory
- `deductServings()` - FIFO deduction algorithm
- `convertServingType()` - Convert between serving types
- `calculateYieldVariance()` - Compare expected vs actual

### Inventory Service
Location: `lib/servings/inventory.ts`

Core functions:
- `addWholeUnits()` - Receive stock
- `consumeServings()` - Process sale deduction
- `adjustInventory()` - Manual corrections
- `consolidatePartials()` - Merge partial units
- `getInventorySnapshot()` - Current state

### Transaction Handling
All serving movements use database transactions to ensure:
- Atomicity (all or nothing)
- Consistency (inventory always accurate)
- Isolation (concurrent orders don't conflict)
- Durability (changes persisted before confirmation)

### Performance Considerations
- Index on `tenantId`, `menuItemId`, `servingTypeId`
- Cache frequently accessed menu items
- Aggregate calculations run on read, not write
- Movement history paginated for large datasets

---

## Future Enhancements

### Planned Features
- **Table Management:** Assign orders to tables, track table status
- **Reservations:** Book tables, manage seating
- **Recipe Costing:** Calculate ingredient costs per serving
- **Kitchen Display System (KDS):** Real-time order display for kitchen
- **Delivery Integration:** Third-party delivery platform connections
- **Mobile App:** Server app for floor staff
- **Multi-Location Transfers:** Move inventory between branches
- **Batch/Lot Tracking:** Expiry management for perishables
- **Menu Engineering:** ABC analysis, profit optimization

### Advanced Analytics
- Best/worst performing serving types
- Peak demand times by serving
- Waste patterns and reduction opportunities
- Staff performance metrics
- Customer preferences and trends

---

## Troubleshooting

### Common Issues

**Issue: Inventory shows negative servings**
- Cause: Concurrent transactions or failed deduction
- Fix: Run inventory reconciliation script
- Prevention: Ensure proper transaction handling

**Issue: Serving type calculations don't match**
- Cause: Incorrect serving definitions or math error
- Fix: Review serving type configuration, verify calculations
- Prevention: Test calculations before going live

**Issue: High variance in production yields**
- Cause: Incorrect expected yields or inconsistent portioning
- Fix: Review and update expected yields, train staff
- Prevention: Monitor variance trends regularly

**Issue: Partial units accumulating (fragmentation)**
- Cause: Not enough consolidation, low sales velocity
- Fix: Run consolidation for affected items
- Prevention: Set up automated consolidation alerts

---

## Support & Maintenance

### Regular Tasks
- **Daily:** Review low stock alerts, approve pending adjustments
- **Weekly:** Run variance reports, check fragmentation levels
- **Monthly:** Physical stock count, reconcile discrepancies
- **Quarterly:** Review and update expected yields, analyze wastage

### Monitoring
- Watch for unusual variance patterns
- Track wastage percentages by item
- Monitor partial unit fragmentation
- Review system performance metrics

### Data Retention
- Keep movement history for 2 years (audit compliance)
- Archive old production logs after 1 year
- Maintain order history indefinitely
- Backup database daily

---

## Visual Design Considerations

### Menu Item Card (Menu Page)

```
┌─────────────────────────────────┐
│ 🥃 Whiskey Bottle              │
│ Drinks                          │
├─────────────────────────────────┤
│ Base Price: $200                │
│ [Servable] [Tracked]            │ ← badges
│ 3 serving types configured      │
│                                 │
│ [Edit]                          │
└─────────────────────────────────┘
```

```
┌─────────────────────────────────┐
│ 🍗 Chicken & Chips             │
│ Food                            │
├─────────────────────────────────┤
│ Price: $25                      │
│ [Made-to-Order]                 │ ← badge
│                                 │
│ [Edit]                          │
└─────────────────────────────────┘
```

### POS Item Card

**Servable Item:**
```
┌─────────────────┐
│ 🥃 Whiskey      │
│ $12/tot         │ ← default serving price
│ 100 available   │ ← total available (tots)
└─────────────────┘
```

**Whole-Only Item:**
```
┌─────────────────┐
│ 🍊 Orange       │
│ $5 each         │
│ 20 in stock     │
└─────────────────┘
```

**Made-to-Order Item:**
```
┌─────────────────┐
│ 🍗 Chicken&Chips│
│ $25             │
│ Made to Order   │ ← badge
└─────────────────┘
```

**Low Stock Warning:**
```
┌─────────────────┐ ← red/yellow border
│ ⚠️ Whiskey      │
│ $12/tot         │
│ 8 left          │
└─────────────────┘
```

### Serving Selection Modal (POS)

```
╔═══════════════════════════════╗
║ Select Serving - Whiskey      ║
╠═══════════════════════════════╣
║                               ║
║  ○ Tot - $12                  ║
║    100 available              ║ ← default, highlighted
║                               ║
║  ○ Prime - $28                ║
║    40 available               ║
║                               ║
║  ○ Whole Bottle - $200        ║
║    5 available                ║
║                               ║
║  Quantity: [−] 1 [+]          ║
║                               ║
║  [Cancel] [Add to Cart]       ║
╚═══════════════════════════════╝
```

### Cart Display (POS)

```
┌─────────────────────────────────┐
│ Cart                            │
├─────────────────────────────────┤
│ Whiskey (5 tots)                │
│ [−] 5 [+]          $60.00  [×]  │
│                                 │
│ Mandazi (3 pcs)                 │
│ [−] 3 [+]          $15.00  [×]  │
│                                 │
│ Chicken & Chips (1) 🍳          │ ← kitchen badge
│ [−] 1 [+]          $25.00  [×]  │
│                                 │
│ Pawpaw (4 slices)               │
│ [−] 4 [+]           $4.00  [×]  │
├─────────────────────────────────┤
│ Subtotal:          $104.00      │
│ Tax:                 $0.00      │
│ Total:             $104.00      │
├─────────────────────────────────┤
│ [Hold Order] [Clear] [Checkout] │
└─────────────────────────────────┘
```

### Inventory Card (For Sale)

**For Sale Items - Card Example:**
```
┌─────────────────────────────────┐
│ 🥃 Whiskey Bottle              │
│ Drinks • 4 bottles in stock    │
├─────────────────────────────────┤
│ Available Servings:             │
│ • 80 tots                       │
│ • 32 primes                     │
│ • 4 whole bottles               │
│                                 │
│ Partials: 3 opened bottles      │
│ [Edit]                          │
└─────────────────────────────────┘
```

**Ingredient - Card Example:**
```
┌─────────────────────────────────┐
│ 🧼 Soap Bar                     │
│ Cleaning Supplies • 4 in stock │
├─────────────────────────────────┤
│ Unit: bar                       │
│ Cost: $2.50 per bar             │
│ Reorder at: 10 bars             │
│                                 │
│ [Edit]                          │
└─────────────────────────────────┘
```

**Low Stock Visual Indicator:**
- Red border on card
- Warning icon
- "Low Stock" badge

### Receive Stock Table Layout

| Item Name | Category | Current Stock | Qty Receiving | New Total | Remove |
|-----------|----------|---------------|---------------|-----------|---------|
| Whiskey Bottle | Drinks | 4 bottles | 10 | 14 | [X] |
| Mandazi | Food | 20 | 50 | 70 | [X] |

- Search/scan adds items to table
- Edit quantity inline
- Remove unwanted items
- "Complete Receiving" processes all at once

### Stock Movement History

Timeline view with expandable entries:
```
[Received] 2026-09-14 10:30 AM by John
  10x Whiskey Bottle (4 → 14)
  Supplier: ABC Distributors, Invoice: INV-1234

[Waste] 2026-09-14 2:15 PM by Sarah
  1x Whiskey Bottle (14 → 13)
  Reason: Broken bottle during service

[Sale] 2026-09-14 5:45 PM by Mike
  5x Tot from Whiskey Bottle
  Order #: ORD-5678
```

---

## Version History

**v1.0.0** (Planned)
- Initial release
- Core serving management
- POS integration
- Basic reporting

**Future versions:**
- v1.1.0: Table management
- v1.2.0: Recipe costing
- v2.0.0: Kitchen display system

---

## Resources

- [Development Plan](./HOSPITALITY.md#development-plan)
- [API Documentation](./docs/api/hospitality.md)
- [User Guide](./docs/user/hospitality-guide.md)
- [Admin Guide](./docs/admin/hospitality-setup.md)

---

**Last Updated:** 2026-09-14  
**Module Status:** In Development  
**Target Release:** Q2 2027
