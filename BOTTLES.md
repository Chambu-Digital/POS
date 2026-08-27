# Bar Bottle Management — UI/UX Specification

## Core Principles

### 1. Separation of Concerns

**Inventory = Physical Stock**  
Answers: *"How much product do I have?"*

**Sales/Tabs = Operations**  
Answers: *"What am I selling right now?"*

**Reports = Accountability**  
Answers: *"What happened to each opened bottle?"*

### 2. The Fundamental Distinction

**Sealed Stock**
- Traditional inventory tracking
- Counted in whole bottles
- Standard receiving, stock adjustments, reordering

**Open Bottles**
- Individual bottle tracking with lifecycle
- Each bottle has a number, timeline, and state
- Servings are **projections** from fractional state, not separate inventory

### 3. The Anti-Pattern to Avoid

**DON'T** show this on the Inventory page:

```
Smirnoff 750ml

Tots: 37 remaining
Quarters: 9 remaining
Halfs: 4 remaining
```

This treats servings as independent stock levels, which is fundamentally wrong.

**DO** show this instead:

```
Smirnoff 750ml

Sealed bottles: 12
Open bottles: 2
Total bottles: 14
```

This shows actual physical inventory without exposing internal serving mathematics.

---

## Page 1: Inventory Page

### Purpose
Show the business owner their **physical stock** in sealed and open bottles, without overwhelming them with serving-level projections.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ BAR INVENTORY                                               │
│                                                             │
│ [ All Products ▼ ]  [ All Brands ▼ ]  🔍 Search...         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Smirnoff 750ml                             🍾 Vodka         │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│ │ Sealed      │ │ Open        │ │ Total       │          │
│ │    12       │ │     2       │ │    14       │          │
│ └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│                           [ View Details ] [ Open Bottle ]  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Gilbey's Gin 750ml                         🍾 Gin           │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│ │ Sealed      │ │ Open        │ │ Total       │          │
│ │     8       │ │     1       │ │     9       │          │
│ └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│                           [ View Details ] [ Open Bottle ]  │
└─────────────────────────────────────────────────────────────┘
```

### Data Requirements

**Endpoint:** `GET /api/bar/inventory-items`

**Response per product:**
```json
{
  "_id": "...",
  "productName": "Smirnoff 750ml",
  "brandName": "Smirnoff",
  "category": "Vodka",
  "sealedCount": 12,
  "openBottlesCount": 2,
  "totalBottles": 14,
  "costPerBottle": 800,
  "inventoryValue": 11200
}
```

### User Actions

**1. View Details**
- Opens a drawer/modal showing:
  - Full product details (cost, servings configured, etc.)
  - List of open bottles (see below)
  - Stock movement history

**2. Open Bottle**
- Explicit action to open a new bottle
- Decrements sealed stock by 1
- Creates a new `BarBottle` record with `state: 'open'`
- Records `openedBy` (current staff) and `openedAt` (now)
- Shows toast: *"Bottle #13 opened"*

---

## Expanded View: Open Bottles

When the user clicks **"View Details"** or the **"2"** in the "Open" card:

```
┌─────────────────────────────────────────────────────────────┐
│ ← Smirnoff 750ml                                            │
│                                                             │
│ OPEN BOTTLES                                              2 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🍾 Bottle #12                              ● Open       │ │
│ │                                                         │ │
│ │ Opened 8:15 PM · Aug 26                                 │ │
│ │ Opened by John                                          │ │
│ │                                                         │ │
│ │                                     [ View ] [ Close ]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🍾 Bottle #13                              ● Open       │ │
│ │                                                         │ │
│ │ Opened 9:42 PM · Aug 26                                 │ │
│ │ Opened by Jane                                          │ │
│ │                                                         │ │
│ │                                     [ View ] [ Close ]  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Requirements

**Endpoint:** `GET /api/bar/bottles?inventoryItemId={id}&state=open`

**Response:**
```json
{
  "bottles": [
    {
      "_id": "...",
      "bottleNumber": 12,
      "state": "open",
      "remainingFraction": 0.75,
      "openedAt": "2026-08-26T20:15:00Z",
      "openedBy": { "_id": "...", "name": "John" }
    },
    {
      "_id": "...",
      "bottleNumber": 13,
      "state": "open",
      "remainingFraction": 0.90,
      "openedAt": "2026-08-26T21:42:00Z",
      "openedBy": { "_id": "...", "name": "Jane" }
    }
  ]
}
```

### User Actions

**1. View**
- Opens the **Bottle Timeline** drawer (see below)

**2. Close**
- Explicit action to close the bottle
- Sets `state: 'closed'`, records `closedBy` and `closedAt`
- Computes `varianceFraction = remainingFraction` (waste/loss tracking)
- Shows toast: *"Bottle #12 closed"*

---

## Bottle Timeline Drawer

When the user clicks **"View"** on an open bottle:

```
┌─────────────────────────────────────────────────────────────┐
│ ✕                                                           │
│                                                             │
│ Smirnoff 750ml                                    Bottle #12│
│ ● Open                                                      │
│                                                             │
│ ────────────────────────────────────────────────────────────│
│                                                             │
│ OPENED                                                      │
│ 8:15 PM · Aug 26, 2026                                      │
│ By John                                                     │
│                                                             │
│ ────────────────────────────────────────────────────────────│
│                                                             │
│ BOTTLE ACTIVITY                                             │
│                                                             │
│ 8:17 PM                                                     │
│ Tot × 1                                  Tab #127 (John)    │
│                                                             │
│ 8:25 PM                                                     │
│ Tot × 2                                  Tab #128 (Mary)    │
│                                                             │
│ 8:41 PM                                                     │
│ Quarter × 1                              Tab #127 (John)    │
│                                                             │
│ 9:03 PM                                                     │
│ Tot × 1                                  Tab #130 (Peter)   │
│                                                             │
│ ────────────────────────────────────────────────────────────│
│                                                             │
│ CURRENT STATUS                                              │
│ Bottle still open                                           │
│                                                             │
│                                           [ Close Bottle ]  │
└─────────────────────────────────────────────────────────────┘
```

### Data Requirements

**Endpoint:** `GET /api/bar/bottles/{bottleId}/activity`

**Response:**
```json
{
  "bottle": {
    "_id": "...",
    "bottleNumber": 12,
    "state": "open",
    "remainingFraction": 0.60,
    "openedAt": "2026-08-26T20:15:00Z",
    "openedBy": { "_id": "...", "name": "John" }
  },
  "activity": [
    {
      "timestamp": "2026-08-26T20:17:00Z",
      "type": "serving_sold",
      "servingName": "Tot",
      "quantity": 1,
      "tabNumber": "BAR-127",
      "staffName": "John"
    },
    {
      "timestamp": "2026-08-26T20:25:00Z",
      "type": "serving_sold",
      "servingName": "Tot",
      "quantity": 2,
      "tabNumber": "BAR-128",
      "staffName": "Mary"
    },
    {
      "timestamp": "2026-08-26T20:41:00Z",
      "type": "serving_sold",
      "servingName": "Quarter",
      "quantity": 1,
      "tabNumber": "BAR-127",
      "staffName": "John"
    },
    {
      "timestamp": "2026-08-26T21:03:00Z",
      "type": "serving_sold",
      "servingName": "Tot",
      "quantity": 1,
      "tabNumber": "BAR-130",
      "staffName": "Peter"
    }
  ]
}
```

**Backend Implementation:**
1. Fetch `BarBottle` document by `_id`
2. Query `BarTabLine.find({ bottleId })`
3. Query `BarAuditLog.find({ referenceId: bottleId, referenceType: 'BarBottle' })`
4. Merge and sort by timestamp
5. Populate staff names and tab numbers

---

## Page 2: Reports → Bottles

### Purpose
Provide operational visibility into:
- What bottles are currently open
- What bottles were closed today
- Which bottles have discrepancies (variance)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ REPORTS                                                     │
│                                                             │
│ [ Bottles ]  Sales  Payments  Staff                        │
│                                                             │
│ [ Today ▼ ]  [ All Products ▼ ]  [ All Staff ▼ ]  🔍       │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ OPEN BOTTLES │ │ CLOSED TODAY │ │ VARIANCES    │
│              │ │              │ │              │
│      7       │ │     18       │ │      3       │
│              │ │              │ │   ⚠ Review   │
└──────────────┘ └──────────────┘ └──────────────┘

────────────────────────────────────────────────────────────────

OPEN BOTTLES                                                  7

┌─────────────────────────────────────────────────────────────┐
│ 🍾 Smirnoff 750ml                            Bottle #12     │
│                                                             │
│ Opened 8:15 PM · John                                       │
│                                                             │
│                                             [ View Bottle ] │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🍾 Smirnoff 750ml                            Bottle #13     │
│                                                             │
│ Opened 9:42 PM · Jane                                       │
│                                                             │
│                                             [ View Bottle ] │
└─────────────────────────────────────────────────────────────┘

────────────────────────────────────────────────────────────────

BOTTLE VARIANCES                                              3

┌─────────────────────────────────────────────────────────────┐
│ Smirnoff 750ml                                Bottle #126   │
│                                            ⚠ Variance       │
│                                                             │
│ Closed 9:18 PM · John                                       │
│ Expected remaining: 0%                                      │
│ Unaccounted: 10% (2 Tots)                                   │
│                                                             │
│                                             [ View Bottle ] │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Gilbey's Gin 750ml                            Bottle #87    │
│                                            ⚠ Variance       │
│                                                             │
│ Closed 10:02 PM · Mary                                      │
│ Expected remaining: 0%                                      │
│ Unaccounted: 5% (1 Tot)                                     │
│                                                             │
│                                             [ View Bottle ] │
└─────────────────────────────────────────────────────────────┘

────────────────────────────────────────────────────────────────

CLOSED BOTTLES                                               18

┌──────┬─────────────────┬──────────┬──────────┬────────────┐
│ #    │ Product         │ Opened   │ Closed   │ Status     │
├──────┼─────────────────┼──────────┼──────────┼────────────┤
│ #127 │ Smirnoff 750ml  │ 8:15 PM  │ 10:42 PM │ ✓ Normal   │
│ #126 │ Smirnoff 750ml  │ 7:20 PM  │ 9:18 PM  │ ⚠ Variance │
│ #125 │ Gilbey's Gin    │ 6:40 PM  │ 8:50 PM  │ ✓ Normal   │
│ #124 │ Smirnoff 750ml  │ 5:15 PM  │ 7:30 PM  │ ✓ Normal   │
│ ...  │ ...             │ ...      │ ...      │ ...        │
└──────┴─────────────────┴──────────┴──────────┴────────────┘
```

### Data Requirements

**Endpoint:** `GET /api/bar/reports/bottles?date={YYYY-MM-DD}&productId={id}&staffId={id}`

**Response:**
```json
{
  "summary": {
    "openBottles": 7,
    "closedToday": 18,
    "variancesCount": 3
  },
  "openBottles": [
    {
      "_id": "...",
      "bottleNumber": 12,
      "productName": "Smirnoff 750ml",
      "openedAt": "2026-08-26T20:15:00Z",
      "openedBy": { "name": "John" }
    },
    // ...
  ],
  "variances": [
    {
      "_id": "...",
      "bottleNumber": 126,
      "productName": "Smirnoff 750ml",
      "closedAt": "2026-08-26T21:18:00Z",
      "closedBy": { "name": "John" },
      "varianceFraction": 0.10,
      "servingsPerContainer": 20,
      "unaccountedServings": 2,
      "servingUnit": "Tot"
    },
    // ...
  ],
  "closedBottles": [
    {
      "_id": "...",
      "bottleNumber": 127,
      "productName": "Smirnoff 750ml",
      "openedAt": "2026-08-26T20:15:00Z",
      "closedAt": "2026-08-26T22:42:00Z",
      "hasVariance": false
    },
    // ...
  ]
}
```

**Backend Query Logic:**
```typescript
// Open bottles (all, not filtered by date)
const openBottles = await models.BarBottle.find({
  userId: ownerId,
  state: 'open'
}).populate('inventoryItemId openedBy')

// Closed bottles (filtered by date range)
const closedBottles = await models.BarBottle.find({
  userId: ownerId,
  state: 'closed',
  closedAt: { $gte: startOfDay, $lte: endOfDay }
}).populate('inventoryItemId closedBy')

// Variances (bottles with varianceFraction > 0)
const variances = closedBottles.filter(b => b.varianceFraction > 0)
```

### UI Behavior

**Top Cards:**
- Show live counts
- "Variances" card has ⚠ icon and "Review" label if count > 0

**Open Bottles Section:**
- Card-based display (not table)
- Each card shows product name, bottle number, opened time, staff
- Click "View Bottle" → opens **Bottle Timeline Drawer**

**Bottle Variances Section:**
- Only shown if variances exist
- Card-based display with prominent ⚠ icon
- Shows human-readable variance: *"Unaccounted: 10% (2 Tots)"*
- Calculation: `unaccountedServings = floor(varianceFraction × servingsPerContainer)`

**Closed Bottles Section:**
- Table format (compact, many rows expected)
- Click any row → opens **Bottle Timeline Drawer**
- Status column: ✓ Normal or ⚠ Variance

**Empty States:**
- Open Bottles: *"No bottles currently open"*
- Variances: *"No bottle variances · All closed bottles are reconciled"*
- Closed Bottles: *"No bottles closed today"*

---

## Design Decisions

### 1. Bottle Opening Flow

**Decision:** **Explicit bottle opening** (UI button triggers bottle creation)

**Rationale:**
- Gives staff control over when bottles are opened
- Clear audit trail: "John opened bottle #12 at 8:15 PM"
- Prevents confusion when multiple staff are working
- Matches real-world behavior: opening a bottle is a deliberate action

**Implementation:**
- Inventory page has **"Open Bottle"** button per product
- POST `/api/bar/bottles/open` with `{ inventoryItemId, staffId }`
- Auto-open fallback remains in `TabManager.addLine()` for backward compatibility

### 2. Bottle Closing Flow

**Decision:** **Manual closure** via UI (not automatic when empty)

**Rationale:**
- A bottle reaching 0% remaining doesn't mean it's physically closed
- Staff may continue using it (spillage, waste) or set it aside
- End-of-shift inventory reconciliation requires explicit closure
- Variance tracking only meaningful when staff intentionally closes bottle

**Implementation:**
- Open bottles list has **"Close"** button
- POST `/api/bar/bottles/{bottleId}/close` with `{ staffId }`
- Records `varianceFraction = remainingFraction` at close time

### 3. Multi-Bottle Selection During Sale

**Decision:** **Auto-select oldest bottle** (FIFO), with explicit selection if needed

**Rationale:**
- Forcing staff to choose on every sale is too slow
- FIFO matches bar best practices (use oldest stock first)
- If multiple bottles open, POS can show a selector for edge cases

**Current Implementation:**
- `TabManager.addLine()` already implements this logic
- Throws `BOTTLE_SELECTION_REQUIRED` if multiple bottles open and no `bottleId` provided
- Frontend can handle this by showing bottle selector modal

### 4. Serving Display in Inventory

**Decision:** **Do NOT show serving-level stock** on main inventory page

**Rationale:**
- Servings are projections, not inventory
- "37 Tots remaining" confuses sealed vs. open stock
- Physical bottle count is more intuitive for inventory management
- Serving math is internal implementation detail

**Implementation:**
- Main inventory cards show: Sealed / Open / Total
- Serving availability computed on-demand in POS/sales interface
- `ServingEngine.getAvailableServings()` used only in tab/sales context

---

## API Endpoints Summary

### New Endpoints Required

```
GET  /api/bar/inventory-items
→ Returns aggregated sealed/open counts per product

GET  /api/bar/bottles/{bottleId}/activity
→ Returns bottle timeline (audit logs + tab lines)

GET  /api/bar/reports/bottles?date={date}&productId={id}&staffId={id}
→ Returns open/closed/variances aggregation for reports page

POST /api/bar/bottles/open
→ Explicit bottle opening (decrements sealed stock, creates bottle)

POST /api/bar/bottles/{bottleId}/close
→ Explicit bottle closing (records variance, sets state closed)
```

### Existing Endpoints to Enhance

```
GET /api/bar/bottles?inventoryItemId={id}&state={state}
→ Already exists, needs population of staff names

GET /api/bar/inventory-items/{id}
→ Enhance to include open bottles list in response
```

---

## Variance Calculation Logic

When a bottle is closed, variance is computed as:

```typescript
const varianceFraction = bottle.remainingFraction
const expectedFraction = 0.0  // Should be empty when closed

// Human-readable display
const servingsPerContainer = 20  // from BarServing config
const unaccountedServings = Math.floor(varianceFraction * servingsPerContainer)

// UI shows: "Unaccounted: 10% (2 Tots)"
```

**Interpretation:**
- `varianceFraction = 0.10` means 10% of the bottle remains when closed
- This represents **waste**, **spillage**, **theft**, or **unrecorded sales**
- Owner can investigate via bottle timeline to see all recorded servings

---

## Lifecycle Visualization

```
Sealed Stock                Open Bottle                  Closed Bottle
════════════                ════════════                 ═════════════

┌────────┐                  ┌────────┐                   ┌────────┐
│ ██████ │   [Open Bottle]  │ ░░░░░░ │   [Servings      │ ░░     │
│ ██████ │   ─────────────> │ ░░░░░░ │    sold from]    │        │
│ ██████ │    Staff: John   │ ░░░░░░ │   ─────────────> │        │
└────────┘    8:15 PM       │ ░░░░░░ │    this bottle   │        │
                            │ ░░░░░░ │                   │        │
Stock: 12                   └────────┘   [Close Bottle]  └────────┘
                            State: open  ─────────────>  State: closed
                            Fraction: 1.0 Staff: John    Variance: 0.10
                                         10:42 PM
```

---

## Implementation Checklist

### Backend
- [ ] Create `GET /api/bar/inventory-items` with sealed/open aggregation
- [ ] Create `GET /api/bar/bottles/{id}/activity` with timeline merge
- [ ] Create `GET /api/bar/reports/bottles` with filtering
- [ ] Create `POST /api/bar/bottles/open` for explicit opening
- [ ] Create `POST /api/bar/bottles/{id}/close` for explicit closing
- [ ] Add staff/product population to existing bottle endpoints

### Frontend - Inventory Page
- [ ] Redesign product cards to show Sealed/Open/Total
- [ ] Add "Open Bottle" button per product
- [ ] Create Open Bottles drawer component
- [ ] Create Bottle Timeline drawer component
- [ ] Remove serving-level stock displays

### Frontend - Reports Page
- [ ] Create Reports → Bottles tab
- [ ] Implement three summary cards (Open/Closed/Variances)
- [ ] Implement Open Bottles card list
- [ ] Implement Variances card list with human-readable text
- [ ] Implement Closed Bottles table
- [ ] Wire all "View Bottle" actions to timeline drawer

### Testing
- [ ] Test bottle lifecycle: sealed → open → servings sold → closed
- [ ] Test variance calculation and display
- [ ] Test multi-bottle scenarios (2+ open simultaneously)
- [ ] Test FIFO bottle selection in POS
- [ ] Test explicit bottle opening/closing flows
- [ ] Test report filters (date, product, staff)

---

## Notes

This specification reflects the **actual data model** already implemented in:
- `lib/bar/inventory-engine.ts` (bottle lifecycle)
- `lib/bar/serving-engine.ts` (fractional projections)
- `lib/bar/tab-manager.ts` (multi-bottle support)
- `lib/models/schemas.ts` (bottle schema with fractions)

**The work is NOT a data model rewrite — it's exposing the existing model through the right UI/API surface.**


---

## V2 Multi-Bottle Fractional Tracking + Unified Direct Sales

### V2 Enhancements

1. **Multi-Bottle Support:** Multiple bottles of the same item can be open simultaneously (FIFO selection by default)
2. **Fractional Tracking:** Each bottle tracks `remainingFraction` (0.0 to 1.0) instead of integer units
3. **Bottle Selection:** UI can specify which bottle to use, or auto-select/auto-open
4. **Unified Direct Sales:** ALL serving sales (tab or direct) now flow through TabManager

### Key Changes

- `BarBottle.remainingFraction` replaces `remainingUnits` (decimal 0.0-1.0)
- `BarTabLine.bottleId` tracks which specific bottle supplied each serving
- `getOpenBottles()` returns array of open bottles (sorted by openedAt)
- `TabManager.addLine()` handles bottle selection logic (explicit → single → auto-open)
- **NEW:** Direct sales (`/api/bar/pos-sale`, `/api/bar/sale`) create synthetic tabs
- Synthetic tabs marked with `isSyntheticDirectSale: true` for filtering

### Synthetic Tab Approach

**Purpose:** Ensure ALL serving sales (tab-based or direct) track bottles properly

**Implementation:**
- Direct sales create instant-closed tabs that flow through TabManager
- Every serving sale creates `BarTabLine` with `bottleId` tracking
- Unified audit logging via `BarAuditLog`
- Complete activity timeline for all bottle usage

**Query Filtering:**
```typescript
// Tab Management UI (exclude synthetic tabs)
const tabs = await BarTab.find({
  userId: ownerId,
  isSyntheticDirectSale: { $ne: true },
  status: { $in: ['open', 'hold', 'billing'] }
})

// Bottle Reports (include all BarTabLine records)
const timeline = await BarTabLine.find({
  bottleId: bottleId,
  voided: false
})
// ✅ Includes lines from both regular and synthetic tabs
```

**Benefits:**
- ✅ Single bottle tracking implementation (no duplicate logic)
- ✅ Complete audit trail for every serving sold
- ✅ Activity timeline shows all bottle usage
- ✅ Backward compatible (Sale records still created)
- ✅ Clean separation (synthetic tabs filtered from UI)

See `UNIFIED_BOTTLE_TRACKING.md` for complete implementation details.
