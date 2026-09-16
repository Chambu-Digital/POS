# Hospitality Module - API Endpoints

## Complete API Reference

All endpoints require authentication via JWT token.
All endpoints check for the appropriate `hospitality.*` feature flag.

---

## Menu Management

### Menu Items

**GET /api/hospitality/menu**
- List all menu items (for-sale or ingredients)
- Query params: `search`, `category`, `itemType`, `status`
- Returns: Menu items with serving types if servable

**POST /api/hospitality/menu**
- Create new menu item
- Body: Menu item data + optional servingTypes array
- Auto-creates inventory record if tracked
- Returns: Created menu item

**GET /api/hospitality/menu/[id]**
- Get single menu item with details
- Returns: Menu item + serving types + inventory (if tracked)

**PUT /api/hospitality/menu/[id]**
- Update menu item
- Can update serving types (deletes old, creates new)
- Body: Partial or full menu item data

**DELETE /api/hospitality/menu/[id]**
- Delete menu item
- Checks for usage in orders (prevents delete if used)
- Cascades delete to serving types, inventory, movements

---

### Categories

**GET /api/hospitality/categories**
- List all categories sorted by displayOrder
- Returns: Array of categories

**POST /api/hospitality/categories**
- Create new category
- Body: `{ name, description, color, icon, displayOrder, isVisible }`

**PUT /api/hospitality/categories/[id]**
- Update category
- Updates menu items if category name changes

**DELETE /api/hospitality/categories/[id]**
- Delete category
- Checks for items in category (prevents delete if has items)

**PUT /api/hospitality/categories/reorder**
- Reorder categories
- Body: `{ categoryIds: string[] }` (array in desired order)

---

## Inventory Management

### Inventory Queries

**GET /api/hospitality/inventory**
- Get all inventory (tracked items only)
- Query params: `itemType` (for-sale|ingredient), `lowStockOnly`
- Returns: Menu items with inventory + serving types

**GET /api/hospitality/inventory/[menuItemId]**
- Get detailed inventory for single item
- Returns: Menu item + inventory + serving types + recent movements (last 20)

---

### Stock Operations

**POST /api/hospitality/stock/receive**
- Receive stock for multiple items (batch operation)
- Body: 
  ```json
  {
    "items": [
      { "menuItemId": "...", "quantity": 10, "batchId": "..." }
    ],
    "reason": "Stock delivery",
    "reference": "INV-123"
  }
  ```
- Uses transaction for atomicity
- Returns: Results for each item + errors array

**POST /api/hospitality/stock/adjust**
- Manual inventory adjustment
- Body:
  ```json
  {
    "menuItemId": "...",
    "adjustmentType": "set-whole|add|subtract|set-partial",
    "value": 10,
    "reason": "Physical count correction",
    "servingTypeId": "..." // optional
  }
  ```
- Creates ADJUSTMENT or WASTE movement based on reason

**POST /api/hospitality/stock/consolidate**
- Consolidate multiple partial units
- Body:
  ```json
  {
    "menuItemId": "...",
    "partialIds": ["partial-1", "partial-2"]
  }
  ```
- Checks canConsolidate flag
- Creates whole units if possible
- Returns: New inventory state

**GET /api/hospitality/stock/history**
- Get stock movement history
- Query params: `menuItemId`, `movementType`, `startDate`, `endDate`, `limit`, `offset`
- Returns: Paginated movements with menu item names populated

---

## Production Management

**GET /api/hospitality/production**
- List production logs
- Query params: `status`, `startDate`, `endDate`, `limit`
- Returns: Production logs with item names populated

**POST /api/hospitality/production**
- Log new production session
- Body:
  ```json
  {
    "producedItemId": "...",
    "servingTypeId": "...", // optional
    "expectedYield": 100,
    "actualYield": 95,
    "ingredientsUsed": [
      { "itemId": "...", "itemName": "Flour", "quantityUsed": 5, "unit": "kg" }
    ],
    "notes": "..."
  }
  ```
- Auto-deducts ingredients (if tracked)
- Auto-adds produced items (if tracked)
- Calculates variance
- Auto-approves if variance <±20%, else requires approval
- Uses transaction

**POST /api/hospitality/production/[id]/approve**
- Approve or reject production log
- Body: `{ "action": "approve|reject", "notes": "..." }`
- Only works on pending production logs

---

## POS & Sales

### POS Menu

**GET /api/hospitality/pos/menu**
- Get menu for POS interface
- Query params: `category`
- Returns: All for-sale items (tracked and untracked) with:
  - Serving types (if servable)
  - Inventory data (if tracked)
  - Availability flags: `isInStock`, `isLowStock`, `isOutOfStock`, `isMadeToOrder`
  - Categories for filtering

---

### Sales/Orders

**GET /api/hospitality/sales**
- List orders
- Query params: `startDate`, `endDate`, `status`, `limit`
- Returns: Array of orders

**POST /api/hospitality/sales**
- Create new sale (POS checkout)
- Body:
  ```json
  {
    "items": [
      {
        "menuItemId": "...",
        "name": "Whiskey",
        "quantity": 1,
        "servingTypeId": "...", // if servable
        "servingTypeName": "Tot",
        "servingsOrdered": 5,
        "pricePerUnit": 12,
        "totalPrice": 60
      }
    ],
    "subtotal": 60,
    "tax": 0,
    "total": 60,
    "paymentMethod": "cash|card|mobile_money|credit",
    "customerId": "...", // optional
    "tableNumber": "5", // optional
    "orderType": "dine-in|takeaway|delivery"
  }
  ```
- Auto-deducts inventory for tracked items (uses FIFO for servings)
- No deduction for untracked items
- Uses transaction for atomicity
- Returns: Created order

**GET /api/hospitality/sales/[id]**
- Get single order details
- Returns: Complete order object

---

## Reports & Analytics

**GET /api/hospitality/reports/sales**
- Sales analytics for date range
- Query params: `startDate`, `endDate`
- Returns:
  ```json
  {
    "summary": {
      "totalOrders": 150,
      "totalRevenue": 45000,
      "averageOrderValue": 300,
      "period": { "startDate": "...", "endDate": "..." }
    },
    "paymentMethods": { "cash": 20000, "card": 15000, "mobile_money": 10000 },
    "orderTypes": { "dine-in": 30000, "takeaway": 10000, "delivery": 5000 },
    "topItems": [
      { "name": "Whiskey Tot", "quantity": 500, "revenue": 6000 },
      ...
    ]
  }
  ```

---

## Feature Flag Mapping

Each endpoint checks for specific permissions:

| Endpoint Pattern | Required Feature |
|-----------------|------------------|
| `/api/hospitality/menu/*` | `hospitality.menu` |
| `/api/hospitality/categories/*` | `hospitality.menu` |
| `/api/hospitality/inventory/*` | `hospitality.inventory` |
| `/api/hospitality/stock/*` | `hospitality.stock` |
| `/api/hospitality/production/*` | `hospitality.production` |
| `/api/hospitality/pos/*` | `hospitality.pos` |
| `/api/hospitality/sales` GET | `hospitality.orders` |
| `/api/hospitality/sales` POST | `hospitality.pos` |
| `/api/hospitality/reports/*` | `hospitality.reports` |

---

## Transaction Safety

The following endpoints use MongoDB transactions for atomicity:

- **POST /api/hospitality/stock/receive** - Multi-item receiving
- **POST /api/hospitality/stock/adjust** - Inventory adjustments
- **POST /api/hospitality/stock/consolidate** - Partial consolidation
- **POST /api/hospitality/production** - Production logging
- **POST /api/hospitality/production/[id]/approve** - Production approval
- **POST /api/hospitality/sales** - Sale creation with inventory deduction

All transactions support rollback on error, ensuring data consistency.

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Descriptive error message"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error, insufficient stock, etc.)
- `401` - Unauthorized (no JWT token)
- `403` - Forbidden (module not enabled)
- `404` - Not Found
- `500` - Internal Server Error

---

## Authentication

All endpoints require JWT authentication:
- Token must be in Authorization header: `Bearer <token>`
- Token extracted via `getAuthPayload()`
- `tenantId` derived from `payload.mongoUri || payload.userId`
- `performedBy` derived from `payload.userId` (staff or owner)

---

## Multi-Tenant Isolation

All queries are scoped to `tenantId`:
```typescript
const tenantId = payload.mongoUri || payload.userId
const query = { tenantId, ...otherFilters }
```

This ensures complete data isolation between tenants.

---

## Next Steps for Frontend

With all API endpoints complete, you can now build:

1. **Menu Management UI** - CRUD for items, categories, serving types
2. **Inventory Dashboard** - View stock levels, low stock alerts
3. **Stock Receiving UI** - Batch receiving workflow
4. **POS Interface** - Cart, serving selection, checkout
5. **Production Log UI** - Log production, approve variance
6. **Reports Dashboard** - Sales analytics, charts

All the business logic is handled by the API endpoints and core services.
Just make HTTP requests from your React components!

---

**Status**: All API Routes Complete ✅  
**Total Endpoints**: 20+  
**Ready for**: Phase 7-10 (Frontend Development)
