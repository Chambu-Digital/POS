# Servings System Architecture

**Version:** 2.0  
**Last Updated:** 2026-08-26  
**Purpose:** Universal fractional inventory tracking for divisible goods

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Core Concepts](#core-concepts)
3. [Mathematical Foundation](#mathematical-foundation)
4. [Data Model](#data-model)
5. [Engine Architecture](#engine-architecture)
6. [Seller Workflow](#seller-workflow)
7. [Multi-Container Support](#multi-container-support)
8. [Variance Tracking](#variance-tracking)
9. [Implementation Patterns](#implementation-patterns)
10. [Domain Applications](#domain-applications)
11. [API Design](#api-design)
12. [Migration Strategy](#migration-strategy)

---

## Philosophy

### The Single Source of Truth Principle

The servings system is built on one foundational insight:

> **A container does not "have" servings. It has a unified state that can be projected into any serving configuration.**

A bottle of whiskey doesn't contain "20 Tots AND 5 Quarters." It contains liquid that can be served as:
- 20 Tots **OR**
- 5 Quarters **OR**
- 2 Halfs **OR**
- Any mathematically valid combination

This prevents:
- ❌ Tracking multiple independent stocks per container
- ❌ Manual ratio maintenance between serving sizes
- ❌ Impossible states (e.g., 0 Tots but 2 Quarters remain)
- ❌ Seller confusion about "which number to update"

This enables:
- ✅ Automatic interdependency between all servings
- ✅ Mathematical impossibility of inconsistent states
- ✅ Zero seller complexity ("open, sell, close")
- ✅ Perfect audit trails with variance tracking

---

## Core Concepts

### 1. Container

A **Container** is a discrete, trackable unit of divisible inventory.

**Examples:**
- Bar: A physical bottle (Smirnoff 750ml)
- Pizza: A whole pizza (Large Margherita)
- Bakery: A whole cake (Chocolate Cake 2kg)
- Catering: A tray (Biryani Tray 5kg)

**Properties:**
- Has a **lifecycle** (full → open → closed)
- Has a **remaining fraction** (0.0 = empty, 1.0 = full)
- Belongs to an **inventory item** (product SKU)
- Has a **container number** (sequential per inventory item)
- Tracks **who opened it** and **when**
- Tracks **variance** when closed

**Key Rule:** A container's state is expressed as a **fraction of fullness**, never as discrete serving counts.

---

### 2. Serving Configuration

A **Serving** defines one way to divide a container.

**Examples:**
- Bar: "Tot" (1/20th of bottle)
- Pizza: "Slice" (1/8th of pizza)
- Cake: "Small Piece" (1/16th of cake)

**Properties:**
- Has a **name** (user-facing label)
- Has a **servings per container** count (how many servings a full container yields)
- Has a **selling price** (price per serving)
- Belongs to an **inventory item** (one product can have multiple servings)

**Key Rule:** The serving configuration is **metadata**. The container state is the **single source of truth**.

---

### 3. Fractional State

Every open container tracks its state as a **decimal fraction** between 0.0 and 1.0.

```
1.0  = Full container (just opened)
0.75 = 75% remaining
0.5  = Half consumed
0.25 = Quarter remaining
0.0  = Empty (nothing left to serve)
```

**Why fractions instead of discrete units?**

Because servings are **projections**, not independent stocks.

**Example:**

Container: Smirnoff 750ml  
Configured servings:
- Tot: 20 per bottle
- Quarter: 5 per bottle
- Half: 2 per bottle

State: `remainingFraction = 0.75` (75% full)

**Available servings (calculated on-demand):**
```
Tots     = floor(0.75 × 20) = 15
Quarters = floor(0.75 × 5)  = 3
Halfs    = floor(0.75 × 2)  = 1
```

**Sell 1 Quarter:**
```
Fraction consumed = 1 ÷ 5 = 0.2
New remainingFraction = 0.75 - 0.2 = 0.55
```

**New available servings:**
```
Tots     = floor(0.55 × 20) = 11
Quarters = floor(0.55 × 5)  = 2
Halfs    = floor(0.55 × 2)  = 1
```

Notice:
- Selling 1 Quarter automatically reduced available Tots
- No manual ratio maintenance required
- Mathematically impossible to have inconsistent states

---

## Mathematical Foundation

### Serving Fraction Formula

For a serving configuration with `S` servings per container:

```
fractionPerServing = 1 / S
```

**Examples:**
```
Tot (20/bottle):     1/20 = 0.05 per serving
Quarter (5/bottle):  1/5  = 0.2 per serving
Half (2/bottle):     1/2  = 0.5 per serving
Pizza Slice (8/pie): 1/8  = 0.125 per serving
```

### Multi-Quantity Sale Formula

Selling `Q` servings of type `S`:

```
totalFractionConsumed = Q × (1 / S)
newRemainingFraction = oldRemainingFraction - totalFractionConsumed
```

**Example: Sell 3 Tots from a 75% full bottle**
```
fractionConsumed = 3 × (1/20) = 0.15
newFraction = 0.75 - 0.15 = 0.6
```

### Availability Calculation Formula

Given a container with `remainingFraction` and a serving with `servingsPerContainer`:

```
availableServings = floor(remainingFraction × servingsPerContainer)
```

**Why floor?** You can't serve 2.7 Tots. Round down to 2 whole servings.

**Example: 55% full bottle, calculate all availabilities**
```
Tots:     floor(0.55 × 20) = 11
Quarters: floor(0.55 × 5)  = 2
Halfs:    floor(0.55 × 2)  = 1
```

### Validation Rule: Sufficient Quantity

Before allowing a sale of `Q` servings:

```
required = Q / servingsPerContainer
available = remainingFraction

ALLOW SALE if: required ≤ available
BLOCK SALE if: required > available
```

**Example: Can we sell 3 Halfs from a 60% full bottle?**
```
required = 3 / 2 = 1.5 (need 150% of bottle)
available = 0.6 (only 60% remains)
1.5 > 0.6 → BLOCK (insufficient)
```

---

## Data Model

### Container Schema

```typescript
interface Container {
  _id:               ObjectId
  userId:            ObjectId      // Owner (tenant)
  branchId:          ObjectId      // Optional branch
  inventoryItemId:   ObjectId      // Product SKU
  containerNumber:   number        // Sequential per inventoryItemId
  
  state:             'full' | 'open' | 'closed'
  
  // Core fractional state
  remainingFraction: number        // 0.0 to 1.0
  
  // Lifecycle tracking
  openedBy:          ObjectId      // Staff who opened
  openedAt:          Date
  closedBy?:         ObjectId      // Staff who closed
  closedAt?:         Date
  
  // Variance (calculated on close)
  expectedFraction:  number        // Always 1.0 for new containers
  actualFraction:    number        // remainingFraction at close
  varianceFraction:  number        // expectedFraction - actualFraction - totalSold
  
  createdAt:         Date
  updatedAt:         Date
}
```

**Indexes:**
```typescript
// Allow multiple open containers per item (removed unique constraint)
{ userId: 1, branchId: 1, inventoryItemId: 1, state: 1 }

// Fast lookups for open containers
{ userId: 1, branchId: 1, state: 1 }

// History queries
{ userId: 1, inventoryItemId: 1, createdAt: -1 }
```

**Migration Note:** Existing `expectedUnits`, `remainingUnits`, `actualUnitsSold` fields are deprecated but kept for backward compatibility.

---

### Serving Configuration Schema

```typescript
interface ServingConfig {
  _id:               ObjectId
  userId:            ObjectId
  branchId:          ObjectId
  inventoryItemId:   ObjectId      // Parent product
  
  name:              string        // "Tot", "Quarter", "Slice", etc.
  servingsPerContainer: number     // How many servings a full container yields
  sellingPrice:      number        // Price per serving
  
  isActive:          boolean       // Can be temporarily disabled
  
  createdAt:         Date
  updatedAt:         Date
}
```

**Validation Rules:**
- `servingsPerContainer` must be ≥ 1
- `name` must be unique per `inventoryItemId`
- Cannot delete serving if containers reference it (soft-delete via `isActive`)

**Indexes:**
```typescript
{ userId: 1, inventoryItemId: 1 }
{ userId: 1, branchId: 1 }
```

---

### Inventory Item Schema

```typescript
interface InventoryItem {
  _id:                  ObjectId
  userId:               ObjectId
  branchId:             ObjectId
  
  name:                 string         // "Smirnoff", "Margherita Pizza"
  variant:              string         // "750ml", "Large"
  
  // Sealed stock tracking
  stock:                number         // Count of unopened containers
  buyingPrice:          number
  containerSellingPrice: number        // Price for sealed container
  
  lowStockThreshold:    number
  isActive:             boolean
  
  createdAt:            Date
  updatedAt:            Date
}
```

**Relationships:**
- `InventoryItem` has many `ServingConfig` (serving options)
- `InventoryItem` has many `Container` (physical tracking)

---

### Sale Line Schema

```typescript
interface SaleLine {
  _id:               ObjectId
  userId:            ObjectId
  saleId:            ObjectId        // Parent sale/tab/order
  
  inventoryItemId:   ObjectId
  servingId?:        ObjectId        // If serving sale
  containerId?:      ObjectId        // Which container supplied this serving
  
  itemName:          string          // Snapshot for reporting
  servingName?:      string          // "Tot", "Quarter", etc.
  
  quantity:          number
  unitPrice:         number
  lineTotal:         number
  
  addedBy:           ObjectId        // Staff
  addedAt:           Date
  voided:            boolean
  voidedBy?:         ObjectId
  voidedAt?:         Date
}
```

**Key Field:** `containerId` — tracks which specific container supplied the serving. Essential for:
- Multi-container scenarios
- Variance attribution
- Audit trails
- Container history

---

### Audit Log Schema

```typescript
interface AuditLog {
  _id:           ObjectId
  userId:        ObjectId
  branchId:      ObjectId
  staffId:       ObjectId
  
  operation:     'CONTAINER_OPENED' | 'CONTAINER_CLOSED' | 
                 'SERVING_SOLD' | 'CONTAINER_SOLD'
  
  referenceId:   ObjectId           // Container or SaleLine
  referenceType: 'Container' | 'SaleLine'
  
  details:       {
    inventoryItemId?:     ObjectId
    containerId?:         ObjectId
    containerNumber?:     number
    fractionDeducted?:    number
    remainingFraction?:   number
    varianceFraction?:    number
    servingName?:         string
    quantity?:            number
    [key: string]:        any       // Flexible for domain-specific data
  }
  
  timestamp:     Date
}
```

**Immutability:** Audit logs are **never updated or deleted**. They form an immutable history.

---

## Engine Architecture

### ServingEngine: Core Computation

The `ServingEngine` is a **pure computation layer** with zero side effects.

```typescript
export class ServingEngine {
  /**
   * Compute fraction consumed and line total for a serving sale.
   * 
   * @param serving - Serving configuration
   * @param quantity - Number of servings being sold
   * @returns { lineTotal, fractionToDeduct }
   */
  static computeServing(
    serving: { sellingPrice: number; servingsPerContainer: number },
    quantity: number
  ): { lineTotal: number; fractionToDeduct: number } {
    if (quantity < 1 || !Number.isInteger(quantity)) {
      throw new Error('Quantity must be a positive integer')
    }
    
    return {
      lineTotal: serving.sellingPrice * quantity,
      fractionToDeduct: quantity / serving.servingsPerContainer,
    }
  }
  
  /**
   * Calculate available servings from a container's remaining fraction.
   * 
   * @param container - Container with remainingFraction
   * @param serving - Serving configuration
   * @returns Number of whole servings available (floored)
   */
  static getAvailableServings(
    container: { remainingFraction: number },
    serving: { servingsPerContainer: number }
  ): number {
    return Math.floor(container.remainingFraction * serving.servingsPerContainer)
  }
  
  /**
   * Check if container can provide requested quantity.
   * 
   * @param container - Container with remainingFraction
   * @param serving - Serving configuration
   * @param quantity - Requested serving count
   * @returns true if sufficient, false otherwise
   */
  static canProvideServings(
    container: { remainingFraction: number },
    serving: { servingsPerContainer: number },
    quantity: number
  ): boolean {
    const required = quantity / serving.servingsPerContainer
    return container.remainingFraction >= required
  }
  
  /**
   * Project container state into all configured servings.
   * 
   * @param container - Container with remainingFraction
   * @param servings - Array of serving configurations
   * @returns Object mapping serving IDs to available counts
   */
  static projectAvailability(
    container: { remainingFraction: number },
    servings: Array<{ _id: string; servingsPerContainer: number }>
  ): Record<string, number> {
    return servings.reduce((acc, serving) => {
      acc[serving._id] = this.getAvailableServings(container, serving)
      return acc
    }, {} as Record<string, number>)
  }
}
```

**Design Principles:**
1. **Pure functions** — no database access, no side effects
2. **Domain-agnostic** — works for bar, pizza, cake, any divisible inventory
3. **Mathematical correctness** — impossible to produce invalid states
4. **Testable** — easy to unit test with mock inputs

---

### ContainerEngine: Lifecycle Management

The `ContainerEngine` handles database operations for container lifecycle.

```typescript
export class ContainerEngine {
  /**
   * Open a new container for an inventory item.
   * 
   * DOES NOT auto-close existing open containers (multi-container support).
   * Decrements sealed stock by 1.
   * 
   * @param inventoryItemId - Product SKU
   * @param staffId - Who is opening the container
   * @param conn - Database connection
   * @returns Newly created container
   */
  static async openContainer(
    inventoryItemId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Container> {
    const models = getModels(conn)
    
    // Check sealed stock
    const item = await models.InventoryItem.findById(inventoryItemId)
    if (!item || item.stock <= 0) {
      throw new Error('INSUFFICIENT_STOCK')
    }
    
    // Deduct from sealed stock
    item.stock -= 1
    item.updatedAt = new Date()
    await item.save()
    
    // Generate sequential container number
    const containerCount = await models.Container.countDocuments({
      inventoryItemId,
    })
    const containerNumber = containerCount + 1
    
    // Create open container
    const now = new Date()
    const container = await models.Container.create({
      userId: item.userId,
      branchId: item.branchId,
      inventoryItemId,
      containerNumber,
      state: 'open',
      openedBy: staffId,
      openedAt: now,
      remainingFraction: 1.0,  // Full
      expectedFraction: 1.0,
      createdAt: now,
      updatedAt: now,
    })
    
    // Audit log
    await models.AuditLog.create({
      userId: item.userId,
      branchId: item.branchId,
      staffId,
      operation: 'CONTAINER_OPENED',
      referenceId: container._id,
      referenceType: 'Container',
      details: {
        inventoryItemId,
        containerNumber,
        remainingFraction: 1.0,
      },
      timestamp: now,
    })
    
    return container.toObject()
  }
  
  /**
   * Deduct a fraction from an open container.
   * 
   * Updates remainingFraction and creates audit log.
   * 
   * @param containerId - Specific container ID
   * @param fraction - Fraction to deduct (0.0 to 1.0)
   * @param staffId - Who is performing the sale
   * @param conn - Database connection
   * @returns Updated container
   */
  static async deductFraction(
    containerId: string,
    fraction: number,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Container> {
    const models = getModels(conn)
    
    const container = await models.Container.findOne({
      _id: containerId,
      state: 'open',
    })
    
    if (!container) {
      throw new Error('CONTAINER_NOT_FOUND_OR_CLOSED')
    }
    
    // Validate sufficient fraction
    if (container.remainingFraction < fraction) {
      throw new Error('INSUFFICIENT_CONTAINER_FRACTION')
    }
    
    // Deduct
    const newFraction = Math.max(0, container.remainingFraction - fraction)
    container.remainingFraction = newFraction
    container.updatedAt = new Date()
    await container.save()
    
    // Audit log
    await models.AuditLog.create({
      userId: container.userId,
      branchId: container.branchId,
      staffId,
      operation: 'SERVING_SOLD',
      referenceId: containerId,
      referenceType: 'Container',
      details: {
        inventoryItemId: container.inventoryItemId,
        containerId,
        containerNumber: container.containerNumber,
        fractionDeducted: fraction,
        remainingFraction: newFraction,
      },
      timestamp: new Date(),
    })
    
    return container.toObject()
  }
  
  /**
   * Close a specific container.
   * 
   * Calculates variance between expected and actual remaining fraction.
   * Does NOT restore stock — variance is tracked for reporting.
   * 
   * @param containerId - Specific container to close
   * @param staffId - Who is closing
   * @param conn - Database connection
   * @returns Closed container with variance
   */
  static async closeContainer(
    containerId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Container> {
    const models = getModels(conn)
    
    const container = await models.Container.findOne({
      _id: containerId,
      state: 'open',
    })
    
    if (!container) {
      throw new Error('CONTAINER_NOT_FOUND_OR_CLOSED')
    }
    
    // Calculate variance
    // variance = what we started with - what we sold - what remains
    // Negative variance = loss/waste, Positive = unexpected gain
    const totalSold = container.expectedFraction - container.remainingFraction
    const variance = container.remainingFraction  // What remains is the variance
    
    const now = new Date()
    container.state = 'closed'
    container.closedBy = staffId
    container.closedAt = now
    container.actualFraction = container.remainingFraction
    container.varianceFraction = variance
    container.updatedAt = now
    await container.save()
    
    // Audit log
    await models.AuditLog.create({
      userId: container.userId,
      branchId: container.branchId,
      staffId,
      operation: 'CONTAINER_CLOSED',
      referenceId: containerId,
      referenceType: 'Container',
      details: {
        inventoryItemId: container.inventoryItemId,
        containerNumber: container.containerNumber,
        expectedFraction: container.expectedFraction,
        remainingFraction: container.remainingFraction,
        varianceFraction: variance,
      },
      timestamp: now,
    })
    
    return container.toObject()
  }
  
  /**
   * Get all open containers for an inventory item.
   * 
   * @param inventoryItemId - Product SKU
   * @param conn - Database connection
   * @returns Array of open containers
   */
  static async getOpenContainers(
    inventoryItemId: string,
    conn: mongoose.Connection
  ): Promise<Container[]> {
    const models = getModels(conn)
    
    const containers = await models.Container.find({
      inventoryItemId,
      state: 'open',
    }).sort({ createdAt: 1 })  // FIFO order
    
    return containers.map(c => c.toObject())
  }
  
  /**
   * Sell a sealed container (no serving, direct container sale).
   * 
   * Decrements stock without opening a container.
   * 
   * @param inventoryItemId - Product SKU
   * @param staffId - Who is selling
   * @param conn - Database connection
   */
  static async sellSealedContainer(
    inventoryItemId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<void> {
    const models = getModels(conn)
    
    const item = await models.InventoryItem.findById(inventoryItemId)
    if (!item || item.stock <= 0) {
      throw new Error('INSUFFICIENT_STOCK')
    }
    
    item.stock -= 1
    item.updatedAt = new Date()
    await item.save()
    
    // Audit log
    await models.AuditLog.create({
      userId: item.userId,
      branchId: item.branchId,
      staffId,
      operation: 'CONTAINER_SOLD',
      referenceId: String(item._id),
      referenceType: 'InventoryItem',
      details: {
        inventoryItemId,
        previousStock: item.stock + 1,
        newStock: item.stock,
      },
      timestamp: new Date(),
    })
  }
}
```

---

## Seller Workflow

### The Three Physical Actions

From the seller's perspective, they interact with the system through **three physical actions**:

1. **"I opened this container"** → `openContainer()`
2. **"I'm pouring/serving from this container"** → sale with `containerId`
3. **"I'm done with this container"** → `closeContainer()`

Everything else (calculations, availability, variance) is invisible to them.

---

### Workflow 1: Single Open Container (Simple Case)

**Scenario:** Only one container is open for a product.

```
┌─────────────────────────────────────┐
│  Seller clicks "Tot" for Smirnoff  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  System checks: How many Smirnoff  │
│  containers are open?               │
└─────────────────────────────────────┘
              ↓
         [ 1 container ]
              ↓
┌─────────────────────────────────────┐
│  Auto-select that container         │
│  Deduct fraction                    │
│  Add to cart/sale                   │
└─────────────────────────────────────┘
              ↓
         DONE ✓
```

**No user interaction needed** — the system knows which container to use.

---

### Workflow 2: Multiple Open Containers (Selection Required)

**Scenario:** Two Smirnoff bottles are open.

```
┌─────────────────────────────────────┐
│  Seller clicks "Tot" for Smirnoff  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  System checks: How many containers │
│  are open?                          │
└─────────────────────────────────────┘
              ↓
         [ 2 containers ]
              ↓
┌─────────────────────────────────────┐
│  ⚠️  SHOW SELECTION MODAL           │
│                                     │
│  Select Smirnoff Container          │
│  ┌───────────────────────────────┐ │
│  │ Bottle #1 — 8:15 PM           │ │
│  │ 19 Tots / 4 Quarters          │ │
│  │        [ Select ]             │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ Bottle #2 — 9:42 PM           │ │
│  │ 20 Tots / 5 Quarters          │ │
│  │        [ Select ]             │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
              ↓
      [ Seller picks #2 ]
              ↓
┌─────────────────────────────────────┐
│  Deduct from Container #2           │
│  Add to cart/sale with containerId  │
└─────────────────────────────────────┘
              ↓
         DONE ✓
```

**User picks the physical container they're pouring from** — ensures accurate tracking.

---

### Workflow 3: No Open Container (Auto-Open)

**Scenario:** No containers are open (common at shift start).

```
┌─────────────────────────────────────┐
│  Seller clicks "Tot" for Smirnoff  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  System checks: Any open?           │
└─────────────────────────────────────┘
              ↓
         [ 0 containers ]
              ↓
┌─────────────────────────────────────┐
│  Auto-open a new container          │
│  (deduct from sealed stock)         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Deduct fraction from new container │
│  Add to cart/sale                   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  💡 Toast: "Opened new Smirnoff"   │
└─────────────────────────────────────┘
              ↓
         DONE ✓
```

**No seller action needed** — system handles opening automatically.

**Alternative:** Require explicit open action (more manual but prevents accidental opens).

---

### Workflow 4: Insufficient Fraction (Graceful Failure)

**Scenario:** Container doesn't have enough to fulfill the sale.

```
┌─────────────────────────────────────┐
│  Seller tries to sell 2 Halfs      │
│  from Bottle #1                     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  System checks:                     │
│  required = 2/2 = 1.0 (full bottle) │
│  available = 0.35 (35% remains)     │
└─────────────────────────────────────┘
              ↓
        [ 1.0 > 0.35 ]
              ↓
┌─────────────────────────────────────┐
│  ❌ BLOCK SALE                      │
│                                     │
│  Error: Insufficient Quantity       │
│  Bottle #1 can only provide:        │
│  - 0 Halfs                          │
│  - Select another bottle or         │
│    open a new one                   │
└─────────────────────────────────────┘
```

**System prevents impossible sales** — maintains data integrity.

---

### Workflow 5: Opening a Container (Explicit Action)

**Scenario:** Seller proactively opens a container before selling.

```
┌─────────────────────────────────────┐
│  Seller clicks "Open Container"    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  SHOW PRODUCT SEARCH MODAL          │
│                                     │
│  🔍 Search containers...            │
│  ┌───────────────────────────────┐ │
│  │ Smirnoff 750ml                │ │
│  │ Gilbey's 1L                   │ │
│  │ Chrome Gin 750ml              │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
              ↓
      [ Seller picks Smirnoff ]
              ↓
┌─────────────────────────────────────┐
│  System:                            │
│  1. Check sealed stock > 0          │
│  2. Deduct 1 from stock             │
│  3. Create open container record    │
│  4. Set remainingFraction = 1.0     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  ✓ Smirnoff bottle #3 opened        │
└─────────────────────────────────────┘
```

**Use Cases:**
- Prepping for rush hour
- Replacing an empty container
- Bar setup at shift start

---

### Workflow 6: Closing a Container (Explicit Action)

**Scenario:** Seller finishes with a container.

**Case A: Single Open Container**

```
┌─────────────────────────────────────┐
│  Seller clicks "Close Container"   │
│  on Smirnoff product card          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  System checks: How many open?      │
└─────────────────────────────────────┘
              ↓
         [ 1 container ]
              ↓
┌─────────────────────────────────────┐
│  Auto-close that container          │
│  Calculate variance                 │
└─────────────────────────────────────┘
              ↓
         DONE ✓
```

**Case B: Multiple Open Containers**

```
┌─────────────────────────────────────┐
│  Seller clicks "Close Container"   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  System checks: How many open?      │
└─────────────────────────────────────┘
              ↓
         [ 3 containers ]
              ↓
┌─────────────────────────────────────┐
│  SHOW CLOSE SELECTOR MODAL          │
│                                     │
│  Close Smirnoff Container           │
│  ┌───────────────────────────────┐ │
│  │ Bottle #1 — 8:15 PM      [×] │ │
│  │ Bottle #2 — 9:42 PM      [×] │ │
│  │ Bottle #3 — 10:30 PM     [×] │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
              ↓
      [ Seller clicks × on #1 ]
              ↓
┌─────────────────────────────────────┐
│  System:                            │
│  1. Set state = 'closed'            │
│  2. Record closedAt timestamp       │
│  3. Calculate variance              │
│  4. Create audit log                │
└─────────────────────────────────────┘
              ↓
         DONE ✓
```

**No manual counting** — seller just marks which physical container is done.

---

## Multi-Container Support

### The Core Rule

**Multiple containers of the same product CAN be open simultaneously.**

This mirrors physical reality:
- Bar: Multiple bottles of same brand open during rush
- Pizza: Two large Margheritas being served at once
- Bakery: Two chocolate cakes cut and being sold

**Previous system constraint (REMOVED):**
```typescript
// OLD: Unique index that prevented multiple open containers
barBottleSchema.index(
  { userId: 1, branchId: 1, inventoryItemId: 1, state: 1 },
  { unique: true, partialFilterExpression: { state: 'open' } }
)
```

**New index (ALLOWS multiple):**
```typescript
// NEW: Regular compound index (no uniqueness)
containerSchema.index(
  { userId: 1, branchId: 1, inventoryItemId: 1, state: 1 }
)
```

---

### Container Selection Strategy

When multiple containers are open, the system must decide **which container to use**.

**Strategy 1: FIFO (First In, First Out)**

Use oldest container first (by `createdAt`).

**Advantages:**
- Mimics physical "rotate stock" practice
- Reduces waste from forgotten containers
- Consistent, predictable behavior

**Code:**
```typescript
const containers = await models.Container.find({
  inventoryItemId,
  state: 'open',
}).sort({ createdAt: 1 })  // Oldest first

const selectedContainer = containers[0]
```

**Strategy 2: User Choice (Current Recommendation)**

Always ask the seller to select when multiple are open.

**Advantages:**
- Seller knows which physical container they're using
- Prevents mismatch between system and reality
- Better audit trail

**Code:**
```typescript
const containers = await models.Container.find({
  inventoryItemId,
  state: 'open',
})

if (containers.length > 1) {
  throw new Error('CONTAINER_SELECTION_REQUIRED')
  // Client shows selection modal
}
```

**Strategy 3: Hybrid**

Auto-select if only one open, ask if multiple.

```typescript
const containers = await models.Container.find({
  inventoryItemId,
  state: 'open',
}).sort({ createdAt: 1 })

if (containers.length === 0) {
  // Auto-open
  return await ContainerEngine.openContainer(inventoryItemId, staffId, conn)
} else if (containers.length === 1) {
  // Auto-select
  return containers[0]
} else {
  // User must choose
  throw new Error('CONTAINER_SELECTION_REQUIRED')
}
```

**Recommendation:** Use **Strategy 3 (Hybrid)** for best UX.

---

### Availability Filtering

When showing container selection, **only show containers that can fulfill the request**.

**Example: Selling 3 Halfs (requires 1.5 of bottle)**

```typescript
const serving = await models.ServingConfig.findById(servingId)
const requiredFraction = quantity / serving.servingsPerContainer

const availableContainers = await models.Container.find({
  inventoryItemId,
  state: 'open',
  remainingFraction: { $gte: requiredFraction },  // Only sufficient containers
}).sort({ createdAt: 1 })
```

**UI Display:**

```
Select Smirnoff Container

Bottle #1 — 8:15 PM
❌ Cannot provide 3 Halfs (only 35% remains)
[ Unavailable ]

Bottle #2 — 9:42 PM
✓ Can provide 3 Halfs (80% remains)
[ Select ]

Bottle #3 — 10:30 PM
✓ Can provide 3 Halfs (100% remains)
[ Select ]
```

---

## Variance Tracking

### What is Variance?

**Variance** is the difference between **expected** and **actual** container state at closure.

**Formula:**
```
variance = remainingFraction at close
```

If `variance > 0`: Container was closed with product remaining (waste, theft, or error).
If `variance = 0`: Container was perfectly consumed (rare).

**Example Scenarios:**

| Scenario | Fraction at Close | Interpretation |
|----------|------------------|----------------|
| Perfect consumption | 0.00 | Container empty (ideal) |
| Slight remainder | 0.05 | ~1 Tot worth left (acceptable) |
| Significant remainder | 0.25 | Quarter bottle wasted/unsold |
| Half full | 0.50 | Large discrepancy (investigate) |

---

### Why Track Variance?

1. **Accountability** — Identify patterns of waste or theft
2. **Operational Insights** — Which products have high waste?
3. **Training** — Highlight sellers who consistently waste
4. **Financial Impact** — Quantify revenue lost to variance

**Example Report:**

```
Container Variance Report — June 2026

Smirnoff 750ml
├─ 45 containers closed
├─ Average variance: 0.08 (8%)
├─ Total waste value: KSh 12,400
└─ Top contributor: Staff Member A (15% avg variance)

Gilbey's 1L
├─ 32 containers closed
├─ Average variance: 0.03 (3%)
├─ Total waste value: KSh 2,100
└─ Performing well ✓
```

---

### Handling Variance in Reports

**Don't restore stock.** Variance is a **permanent loss** tracked for accounting.

**Why not restore?**
- Product may be wasted (spillage, evaporation)
- Product may be stolen
- Seller may have made errors

**Instead:**
- Display in variance reports
- Alert on high variance (> threshold, e.g., 15%)
- Use for staff performance reviews

**API Example:**

```typescript
GET /api/bar/reports/container-variance
Query: { startDate, endDate, inventoryItemId?, staffId? }

Response:
{
  totalContainersClosed: 120,
  totalVarianceFraction: 9.6,  // Sum of all variance
  averageVariancePct: 8.0,     // 8% average waste
  totalValueLost: 45600,       // KSh
  byStaff: [
    { staffId: "abc", name: "John", variancePct: 12.5 },
    { staffId: "def", name: "Jane", variancePct: 3.2 },
  ],
  byProduct: [
    { itemId: "xyz", name: "Smirnoff", variancePct: 8.0 },
  ]
}
```

---

## Implementation Patterns

### Pattern 1: Sale with Auto-Container Selection

**Use Case:** Simple POS where seller just clicks serving buttons.

```typescript
async function sellServing(
  inventoryItemId: string,
  servingId: string,
  quantity: number,
  staffId: string,
  conn: mongoose.Connection
) {
  const serving = await models.ServingConfig.findById(servingId)
  
  // Compute fraction needed
  const { lineTotal, fractionToDeduct } = ServingEngine.computeServing(
    serving,
    quantity
  )
  
  // Get or open container (hybrid strategy)
  let container = await getOrOpenContainer(inventoryItemId, staffId, conn)
  
  // Validate sufficient fraction
  if (!ServingEngine.canProvideServings(container, serving, quantity)) {
    throw new Error('INSUFFICIENT_QUANTITY')
  }
  
  // Deduct from container
  await ContainerEngine.deductFraction(
    String(container._id),
    fractionToDeduct,
    staffId,
    conn
  )
  
  // Create sale line
  const saleLine = await models.SaleLine.create({
    saleId,
    inventoryItemId,
    servingId,
    containerId: container._id,
    quantity,
    unitPrice: serving.sellingPrice,
    lineTotal,
    addedBy: staffId,
  })
  
  return { saleLine, container }
}

async function getOrOpenContainer(
  inventoryItemId: string,
  staffId: string,
  conn: mongoose.Connection
) {
  const containers = await ContainerEngine.getOpenContainers(inventoryItemId, conn)
  
  if (containers.length === 0) {
    // Auto-open
    return await ContainerEngine.openContainer(inventoryItemId, staffId, conn)
  } else if (containers.length === 1) {
    // Auto-select
    return containers[0]
  } else {
    // User must choose
    throw new Error('CONTAINER_SELECTION_REQUIRED')
  }
}
```

---

### Pattern 2: Sale with Explicit Container Selection

**Use Case:** High-volume bar with multiple bottles open.

```typescript
async function sellServingFromContainer(
  inventoryItemId: string,
  servingId: string,
  containerId: string,  // Explicitly provided by user
  quantity: number,
  staffId: string,
  conn: mongoose.Connection
) {
  const serving = await models.ServingConfig.findById(servingId)
  
  // Compute fraction
  const { lineTotal, fractionToDeduct } = ServingEngine.computeServing(
    serving,
    quantity
  )
  
  // Fetch specific container
  const container = await models.Container.findOne({
    _id: containerId,
    state: 'open',
  })
  
  if (!container) {
    throw new Error('CONTAINER_NOT_FOUND')
  }
  
  // Validate
  if (!ServingEngine.canProvideServings(container, serving, quantity)) {
    throw new Error('INSUFFICIENT_QUANTITY')
  }
  
  // Deduct
  await ContainerEngine.deductFraction(
    containerId,
    fractionToDeduct,
    staffId,
    conn
  )
  
  // Create sale line
  const saleLine = await models.SaleLine.create({
    saleId,
    inventoryItemId,
    servingId,
    containerId,
    quantity,
    unitPrice: serving.sellingPrice,
    lineTotal,
    addedBy: staffId,
  })
  
  return { saleLine, container }
}
```

---

### Pattern 3: Batch Availability Check

**Use Case:** Display all servings with real-time availability on UI.

```typescript
async function getProductWithAvailability(
  inventoryItemId: string,
  conn: mongoose.Connection
) {
  const [item, servings, containers] = await Promise.all([
    models.InventoryItem.findById(inventoryItemId),
    models.ServingConfig.find({ inventoryItemId, isActive: true }),
    models.Container.find({ inventoryItemId, state: 'open' }),
  ])
  
  // Calculate availability for each serving across all containers
  const servingsWithAvailability = servings.map(serving => {
    const totalAvailable = containers.reduce((sum, container) => {
      return sum + ServingEngine.getAvailableServings(container, serving)
    }, 0)
    
    return {
      ...serving.toObject(),
      availableCount: totalAvailable,
      availableFromContainers: containers.map(c => ({
        containerId: c._id,
        containerNumber: c.containerNumber,
        available: ServingEngine.getAvailableServings(c, serving),
      })),
    }
  })
  
  return {
    item: item.toObject(),
    servings: servingsWithAvailability,
    openContainers: containers.map(c => c.toObject()),
  }
}
```

**Response Example:**

```json
{
  "item": {
    "_id": "abc123",
    "name": "Smirnoff",
    "variant": "750ml",
    "stock": 12
  },
  "servings": [
    {
      "_id": "serv1",
      "name": "Tot",
      "servingsPerContainer": 20,
      "sellingPrice": 50,
      "availableCount": 39,
      "availableFromContainers": [
        { "containerId": "c1", "containerNumber": 1, "available": 19 },
        { "containerId": "c2", "containerNumber": 2, "available": 20 }
      ]
    },
    {
      "_id": "serv2",
      "name": "Quarter",
      "servingsPerContainer": 5,
      "sellingPrice": 180,
      "availableCount": 9,
      "availableFromContainers": [
        { "containerId": "c1", "containerNumber": 1, "available": 4 },
        { "containerId": "c2", "containerNumber": 2, "available": 5 }
      ]
    }
  ],
  "openContainers": [
    { "_id": "c1", "containerNumber": 1, "remainingFraction": 0.95, "openedAt": "2026-08-26T08:15:00Z" },
    { "_id": "c2", "containerNumber": 2, "remainingFraction": 1.0, "openedAt": "2026-08-26T09:42:00Z" }
  ]
}
```

---

## Domain Applications

### Application 1: Bar / Wines & Spirits

**Inventory Item:** Bottle (e.g., Smirnoff 750ml, Jameson 1L)

**Servings:**
- Tot: 20 per bottle
- Double: 10 per bottle
- Quarter: 5 per bottle
- Half: 2 per bottle

**Workflow:**
1. Bartender opens bottle at start of shift
2. Orders come in: "2 Tots", "1 Quarter"
3. System auto-selects bottle or asks if multiple open
4. End of shift: Close bottle, variance tracked

**Key Metric:** Bottle variance (spillage, theft, over-pouring)

---

### Application 2: Pizzeria

**Inventory Item:** Whole Pizza (e.g., Large Margherita)

**Servings:**
- Slice: 8 per pizza
- Half: 2 per pizza
- Quarter: 4 per pizza

**Workflow:**
1. Kitchen bakes pizza, marks as "open" (ready to slice)
2. Orders: "2 slices", "1 half"
3. Waiter serves from available pizzas
4. Pizza finished: mark as "closed"

**Key Metric:** Pizza waste (unclaimed slices, customer returns)

---

### Application 3: Bakery / Cake Shop

**Inventory Item:** Whole Cake (e.g., Chocolate Cake 2kg)

**Servings:**
- Small Piece: 16 per cake
- Medium Piece: 10 per cake
- Large Piece: 6 per cake

**Workflow:**
1. Display cake marked as "open" when ready to cut
2. Customer orders: "1 medium piece"
3. Staff selects from available cakes
4. End of day: Close cakes, track leftovers

**Key Metric:** Cake waste percentage (unsold pieces)

---

### Application 4: Catering / Buffet

**Inventory Item:** Tray (e.g., Biryani Tray 5kg)

**Servings:**
- Small Plate: 20 per tray
- Regular Plate: 15 per tray
- Large Plate: 10 per tray

**Workflow:**
1. Open tray at buffet start
2. Guests served: portions tracked
3. Multiple trays open during peak hours
4. Event end: Close trays, calculate waste

**Key Metric:** Food waste per event (catering profitability)

---

### Application 5: Cheese / Deli Counter

**Inventory Item:** Whole Cheese Wheel (e.g., Parmesan 3kg)

**Servings:**
- Small Cut: 30 per wheel (100g each)
- Medium Cut: 20 per wheel (150g each)
- Large Cut: 12 per wheel (250g each)

**Workflow:**
1. Open cheese wheel when placed on counter
2. Customer orders by size
3. Multiple wheels open for variety
4. Week end: Close wheel, track consumption

**Key Metric:** Cheese waste (trimming, aging loss)

---

## API Design

### Endpoint Structure

```
/api/servings
├── /containers
│   ├── GET /               List containers (filter by state, inventoryItemId)
│   ├── POST /open          Open a new container
│   ├── GET /:id            Get container details
│   ├── POST /:id/close     Close a container
│   └── GET /:id/history    Container transaction history
│
├── /servings
│   ├── GET /               List serving configs (filter by inventoryItemId)
│   ├── POST /              Create serving config
│   ├── GET /:id            Get serving details
│   ├── PATCH /:id          Update serving config
│   └── DELETE /:id         Soft-delete serving (set isActive = false)
│
├── /availability
│   ├── GET /               Batch availability check
│   └── GET /:inventoryItemId  Product availability detail
│
└── /reports
    ├── GET /variance       Container variance report
    └── GET /consumption    Consumption patterns report
```

---

### API Examples

#### **POST /api/servings/containers/open**

Open a new container.

**Request:**
```json
{
  "inventoryItemId": "64a1b2c3d4e5f6789",
  "staffId": "staff123"
}
```

**Response:**
```json
{
  "container": {
    "_id": "cont456",
    "inventoryItemId": "64a1b2c3d4e5f6789",
    "containerNumber": 3,
    "state": "open",
    "remainingFraction": 1.0,
    "openedBy": "staff123",
    "openedAt": "2026-08-26T10:30:00Z"
  }
}
```

**Error Cases:**
- `400 Bad Request` — Missing inventoryItemId
- `409 Conflict` — Insufficient stock

---

#### **POST /api/servings/containers/:id/close**

Close a specific container.

**Request:**
```json
{
  "staffId": "staff123"
}
```

**Response:**
```json
{
  "container": {
    "_id": "cont456",
    "state": "closed",
    "remainingFraction": 0.15,
    "varianceFraction": 0.15,
    "closedBy": "staff123",
    "closedAt": "2026-08-26T18:45:00Z"
  }
}
```

**Error Cases:**
- `404 Not Found` — Container not found
- `409 Conflict` — Container already closed

---

#### **GET /api/servings/availability/:inventoryItemId**

Get real-time serving availability for a product.

**Response:**
```json
{
  "inventoryItemId": "64a1b2c3d4e5f6789",
  "productName": "Smirnoff 750ml",
  "sealedStock": 12,
  "openContainers": [
    {
      "containerId": "cont1",
      "containerNumber": 1,
      "remainingFraction": 0.95,
      "openedAt": "2026-08-26T08:15:00Z",
      "availability": {
        "Tot": 19,
        "Quarter": 4,
        "Half": 1
      }
    },
    {
      "containerId": "cont2",
      "containerNumber": 2,
      "remainingFraction": 1.0,
      "openedAt": "2026-08-26T09:42:00Z",
      "availability": {
        "Tot": 20,
        "Quarter": 5,
        "Half": 2
      }
    }
  ],
  "totalAvailability": {
    "Tot": 39,
    "Quarter": 9,
    "Half": 3
  }
}
```

---

#### **GET /api/servings/reports/variance**

Container variance report.

**Query Params:**
- `startDate` (ISO date)
- `endDate` (ISO date)
- `inventoryItemId` (optional)
- `staffId` (optional)

**Response:**
```json
{
  "period": {
    "start": "2026-08-01",
    "end": "2026-08-26"
  },
  "summary": {
    "totalContainersClosed": 120,
    "totalVarianceFraction": 9.6,
    "averageVariancePct": 8.0,
    "totalValueLost": 45600
  },
  "byProduct": [
    {
      "inventoryItemId": "prod1",
      "productName": "Smirnoff 750ml",
      "containersClosed": 45,
      "avgVariancePct": 8.0,
      "valueLost": 12400
    }
  ],
  "byStaff": [
    {
      "staffId": "staff1",
      "staffName": "John Doe",
      "containersClosed": 30,
      "avgVariancePct": 12.5,
      "valueLost": 8200
    }
  ]
}
```

---

## Migration Strategy

### Phase 1: Schema Extension (Non-Breaking)

Add new fields without removing old ones.

**Container Schema:**
```typescript
{
  // NEW fields
  remainingFraction: { type: Number, default: 1.0 },
  expectedFraction: { type: Number, default: 1.0 },
  actualFraction: { type: Number },
  varianceFraction: { type: Number },
  
  // OLD fields (kept for compatibility)
  expectedUnits: { type: Number },
  remainingUnits: { type: Number },
  actualUnitsSold: { type: Number },
  difference: { type: Number },
}
```

**ServingConfig Schema:**
```typescript
{
  // NEW field
  servingsPerContainer: { type: Number, required: true },
  
  // OLD field (kept for compatibility)
  unitsProduced: { type: Number },
}
```

---

### Phase 2: Data Migration Script

Convert existing data to new fractional model.

```typescript
async function migrateToFractionalModel() {
  // Migrate serving configs
  const servings = await ServingConfig.find({})
  for (const serving of servings) {
    // Map old unitsProduced to new servingsPerContainer
    // Assume 1:1 for initial migration (owner must review)
    serving.servingsPerContainer = serving.unitsProduced || 1
    await serving.save()
  }
  
  console.log(`Migrated ${servings.length} serving configs`)
  
  // Migrate open containers
  const containers = await Container.find({ state: 'open' })
  for (const container of containers) {
    if (container.expectedUnits > 0) {
      container.remainingFraction = container.remainingUnits / container.expectedUnits
      container.expectedFraction = 1.0
    } else {
      container.remainingFraction = 1.0  // Default to full
      container.expectedFraction = 1.0
    }
    await container.save()
  }
  
  console.log(`Migrated ${containers.length} open containers`)
  
  // Migrate closed containers (for historical reports)
  const closedContainers = await Container.find({ state: 'closed' })
  for (const container of closedContainers) {
    if (container.expectedUnits > 0) {
      container.expectedFraction = 1.0
      container.actualFraction = (container.expectedUnits - container.actualUnitsSold) / container.expectedUnits
      container.varianceFraction = container.actualFraction
    }
    await container.save()
  }
  
  console.log(`Migrated ${closedContainers.length} closed containers`)
}
```

---

### Phase 3: Engine Switch

Update `ServingEngine` and `ContainerEngine` to use new fields.

**Before:**
```typescript
static computeServing(serving, quantity) {
  return {
    lineTotal: serving.sellingPrice * quantity,
    unitsToDeduct: serving.unitsProduced * quantity,
  }
}
```

**After:**
```typescript
static computeServing(serving, quantity) {
  return {
    lineTotal: serving.sellingPrice * quantity,
    fractionToDeduct: quantity / serving.servingsPerContainer,
  }
}
```

---

### Phase 4: Index Update

Remove unique constraint on container state.

**Before:**
```typescript
containerSchema.index(
  { userId: 1, branchId: 1, inventoryItemId: 1, state: 1 },
  { unique: true, partialFilterExpression: { state: 'open' } }
)
```

**After:**
```typescript
containerSchema.index(
  { userId: 1, branchId: 1, inventoryItemId: 1, state: 1 }
)
```

**Run Migration:**
```typescript
await db.collection('containers').dropIndex('userId_1_branchId_1_inventoryItemId_1_state_1')
await db.collection('containers').createIndex({
  userId: 1,
  branchId: 1,
  inventoryItemId: 1,
  state: 1,
})
```

---

### Phase 5: UI Update

Deploy new UI with multi-container support.

**Changes:**
- Add "Open Container" general button
- Add "Close Container" button to product cards
- Add container selection modal for multi-container scenarios
- Remove old "no open bottle" warning modal
- Update product cards to show serving options only

---

### Phase 6: Deprecation

After migration is stable (1-2 months):

1. Mark old fields as deprecated in schema comments
2. Add console warnings when old fields are accessed
3. Schedule removal for next major version
4. Update documentation to remove references to old fields

**Timeline:**
- Week 1: Schema extension + data migration
- Week 2: Engine switch + testing
- Week 3: Index update + UI deployment
- Week 4-8: Monitor for issues
- Month 3: Mark old fields deprecated
- Month 6: Remove old fields (breaking change)

---

## Conclusion

The servings system provides a **universal, mathematically sound foundation** for tracking divisible inventory across any domain.

**Key Principles:**
1. **Fractional state** is the single source of truth
2. **Servings are projections**, not independent stocks
3. **Seller workflow** is simple: open, sell, close
4. **Multi-container support** mirrors physical reality
5. **Variance tracking** provides accountability and insights

**Benefits:**
- Zero math errors (impossible to create inconsistent states)
- Seller simplicity (no manual counting or unit tracking)
- Perfect audit trails (every action logged)
- Domain flexibility (works for bar, pizza, cake, cheese, etc.)
- Scalability (handles 1 or 100 open containers per product)

**This document is the source of truth for all future serving-based features.**

---

**End of Document**
