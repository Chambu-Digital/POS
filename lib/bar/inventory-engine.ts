/**
 * Inventory Engine
 *
 * Handles physical bottle lifecycle tracking and inventory deduction for the bar module.
 * All operations accept a mongoose.Connection and use getModels(conn) to access models,
 * following the per-tenant connection pattern used throughout the codebase.
 *
 * V2 FRACTIONAL MODEL:
 * Lifecycle: sealed stock → open bottle(s) → closed bottle (with variance tracking)
 *
 * Key changes from V1:
 * - Multiple bottles can be open simultaneously
 * - Bottles track fractional state (0.0 to 1.0) instead of discrete units
 * - Opening a bottle does NOT auto-close existing bottles
 * - Servings are projections from fractional state
 * - Variance is tracked as fraction remaining at close
 */

import type mongoose from 'mongoose'
import { getModels } from '@/lib/tenant/get-models'

export interface DeductResult {
  bottle: Record<string, unknown>
  remainingFraction: number
}

export class InventoryEngine {
  /**
   * Deduct a fraction from the currently open bottle for an inventory item.
   *
   * Finds a specific bottle by ID, decrements remainingFraction by the given amount,
   * and inserts a SERVING_SOLD audit log entry.
   *
   * @param bottleId - The BarBottle _id (specific bottle to deduct from)
   * @param fraction - Fraction to deduct (0.0 to 1.0, e.g., 0.05 for 5%)
   * @param staffId - Staff member performing the action (for audit log)
   * @param conn - Tenant mongoose connection
   * @returns { bottle, remainingFraction }
   * @throws Error('BOTTLE_NOT_FOUND_OR_CLOSED') if bottle not found or not open
   * @throws Error('INSUFFICIENT_FRACTION') if bottle doesn't have enough remaining
   */
  static async deductFraction(
    bottleId: string,
    fraction: number,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<DeductResult> {
    const models = getModels(conn)

    const bottle = await models.BarBottle.findOne({
      _id: bottleId,
      state: 'open',
    })

    if (!bottle) {
      throw new Error('BOTTLE_NOT_FOUND_OR_CLOSED')
    }

    // Validate sufficient fraction
    const currentFraction = bottle.remainingFraction ?? 1.0
    if (currentFraction < fraction) {
      throw new Error('INSUFFICIENT_FRACTION')
    }

    // Fetch the inventory item to get userId/branchId for audit log
    const item = await models.BarInventoryItem.findById(bottle.inventoryItemId)

    const newRemainingFraction = Math.max(0, currentFraction - fraction)
    bottle.remainingFraction = newRemainingFraction
    bottle.updatedAt = new Date()
    await bottle.save()

    // Insert immutable SERVING_SOLD audit log
    await models.BarAuditLog.create({
      userId: item?.userId ?? bottle.userId,
      branchId: item?.branchId ?? bottle.branchId,
      staffId,
      operation: 'SERVING_SOLD',
      referenceId: String(bottle._id),
      referenceType: 'BarBottle',
      details: {
        inventoryItemId: bottle.inventoryItemId,
        bottleId: String(bottle._id),
        bottleNumber: bottle.bottleNumber,
        fractionDeducted: fraction,
        remainingFraction: newRemainingFraction,
      },
      timestamp: new Date(),
    })

    return {
      bottle: bottle.toObject(),
      remainingFraction: newRemainingFraction,
    }
  }

  /**
   * Sell a sealed bottle directly (no serving, no bottle opened).
   *
   * Decrements BarInventoryItem.stock by 1 and inserts a BOTTLE_SOLD audit log entry.
   *
   * @param inventoryItemId - The BarInventoryItem _id
   * @param staffId - Staff member performing the sale (for audit log)
   * @param conn - Tenant mongoose connection
   * @throws Error('INSUFFICIENT_STOCK') if stock is 0
   */
  static async sellSealedBottle(
    inventoryItemId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<void> {
    const models = getModels(conn)

    const item = await models.BarInventoryItem.findById(inventoryItemId)
    if (!item) {
      throw new Error('INSUFFICIENT_STOCK')
    }

    if (item.stock <= 0) {
      throw new Error('INSUFFICIENT_STOCK')
    }

    item.stock -= 1
    item.updatedAt = new Date()
    await item.save()

    // Insert immutable BOTTLE_SOLD audit log
    await models.BarAuditLog.create({
      userId: item.userId,
      branchId: item.branchId,
      staffId,
      operation: 'BOTTLE_SOLD',
      referenceId: String(item._id),
      referenceType: 'BarInventoryItem',
      details: {
        inventoryItemId,
        previousStock: item.stock + 1,
        newStock: item.stock,
      },
      timestamp: new Date(),
    })
  }

  /**
   * Open a new bottle for an inventory item.
   *
   * V2 CHANGE: Does NOT auto-close existing open bottles (multi-bottle support).
   * Decrements sealed stock by 1, creates a new BarBottle with state 'open',
   * sets remainingFraction to 1.0 (full), and inserts a BOTTLE_OPENED audit log entry.
   *
   * @param inventoryItemId - The BarInventoryItem _id
   * @param staffId - Staff member opening the bottle (for audit log + openedBy)
   * @param conn - Tenant mongoose connection
   * @returns The newly created BarBottle document
   * @throws Error('INSUFFICIENT_STOCK') if sealed stock is 0
   */
  static async openBottle(
    inventoryItemId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    // V2 CHANGE: No auto-close of existing open bottles
    // Multiple bottles can be open simultaneously

    // Check sealed stock
    const item = await models.BarInventoryItem.findById(inventoryItemId)
    if (!item) {
      throw new Error('INSUFFICIENT_STOCK')
    }
    if (item.stock <= 0) {
      throw new Error('INSUFFICIENT_STOCK')
    }

    // Deduct 1 from sealed stock
    item.stock -= 1
    item.updatedAt = new Date()
    await item.save()

    // Generate sequential bottleNumber for this inventoryItemId
    const existingCount = await models.BarBottle.countDocuments({ inventoryItemId })
    const bottleNumber = existingCount + 1

    const now = new Date()
    const newBottle = await models.BarBottle.create({
      userId: item.userId,
      branchId: item.branchId,
      inventoryItemId,
      bottleNumber,
      state: 'open',
      openedBy: staffId,
      openedAt: now,
      remainingFraction: 1.0,  // Full bottle
      expectedFraction: 1.0,
      createdAt: now,
      updatedAt: now,
    })

    // Insert immutable BOTTLE_OPENED audit log
    await models.BarAuditLog.create({
      userId: item.userId,
      branchId: item.branchId,
      staffId,
      operation: 'BOTTLE_OPENED',
      referenceId: String(newBottle._id),
      referenceType: 'BarBottle',
      details: {
        inventoryItemId,
        bottleNumber,
        remainingFraction: 1.0,
        previousStock: item.stock + 1,
        newStock: item.stock,
      },
      timestamp: now,
    })

    return newBottle.toObject()
  }

  /**
   * Close a specific bottle by ID.
   *
   * V2 CHANGE: Closes a SPECIFIC bottle (not "the open bottle").
   * Sets state to 'closed', computes variance as remainingFraction at close,
   * records closedAt and inserts a BOTTLE_CLOSED audit log entry.
   *
   * V2.1 ENHANCEMENT: Calculates expected vs actual servings for variance tracking.
   * Creates BarBottleAudit record for theft detection, spillage analysis, and accountability.
   *
   * Variance = what remains when closed (waste/loss/theft tracking)
   *
   * @param bottleId - The BarBottle _id to close
   * @param staffId - Staff member closing the bottle (for audit log)
   * @param conn - Tenant mongoose connection
   * @returns The updated (closed) BarBottle document
   * @throws Error('BOTTLE_NOT_FOUND_OR_CLOSED') if bottle not found or already closed
   */
  static async closeBottle(
    bottleId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    const bottle = await models.BarBottle.findOne({
      _id: bottleId,
      state: 'open',
    })

    if (!bottle) {
      throw new Error('BOTTLE_NOT_FOUND_OR_CLOSED')
    }

    const expectedFraction = bottle.expectedFraction ?? 1.0
    const remainingFraction = bottle.remainingFraction ?? 0.0
    
    // Variance = what remains at close (waste/loss)
    const varianceFraction = remainingFraction

    const now = new Date()
    bottle.state = 'closed'
    bottle.closedBy = staffId
    bottle.closedAt = now
    bottle.actualFraction = remainingFraction
    bottle.varianceFraction = varianceFraction
    bottle.updatedAt = now
    await bottle.save()

    // Fetch item for userId/branchId (may differ from bottle if branchId is missing)
    const item = await models.BarInventoryItem.findById(bottle.inventoryItemId).populate('brandId')

    // ─── V2.1: Calculate Expected vs Actual Servings ─────────────────────────────
    
    // Fetch all servings for this inventory item
    const servings = await models.BarServing.find({
      inventoryItemId: bottle.inventoryItemId,
      isActive: true,
    }).lean()

    // Calculate expected servings (based on fraction consumed)
    const fractionConsumed = 1.0 - remainingFraction
    const expectedServings = servings
      .filter((s: any) => s.servingsPerContainer)
      .map((s: any) => ({
        servingId: s._id,
        servingName: s.name,
        quantity: Math.floor(fractionConsumed * s.servingsPerContainer),
      }))
      .filter((s) => s.quantity > 0)

    const totalExpected = expectedServings.reduce((sum, s) => sum + s.quantity, 0)

    // Calculate actual servings sold (from BarTabLine)
    const tabLines = await models.BarTabLine.aggregate([
      {
        $match: {
          bottleId: bottle._id,
          voided: false,
          servingId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$servingId',
          quantity: { $sum: '$quantity' },
        },
      },
    ])

    // Map to serving details
    const actualServingsMap = new Map(tabLines.map((line: any) => [String(line._id), line.quantity]))
    const actualServings = servings
      .filter((s: any) => actualServingsMap.has(String(s._id)))
      .map((s: any) => ({
        servingId: s._id,
        servingName: s.name,
        quantity: actualServingsMap.get(String(s._id)) || 0,
      }))

    const totalActual = actualServings.reduce((sum, s) => sum + s.quantity, 0)

    // Calculate variance
    const varianceQuantity = totalExpected - totalActual
    const variancePercentage = totalExpected > 0 ? (varianceQuantity / totalExpected) * 100 : 0

    // Determine variance flag
    let varianceFlag: 'normal' | 'warning' | 'critical' = 'normal'
    const absVariancePercentage = Math.abs(variancePercentage)
    if (absVariancePercentage >= 15) {
      varianceFlag = 'critical'
    } else if (absVariancePercentage >= 5) {
      varianceFlag = 'warning'
    }

    // Create BarBottleAudit record
    await models.BarBottleAudit.create({
      userId: item?.userId ?? bottle.userId,
      branchId: item?.branchId ?? bottle.branchId,
      bottleId: bottle._id,
      inventoryItemId: bottle.inventoryItemId,
      productName: (item as any)?.name || (item as any)?.brandId?.name || 'Unknown',
      productSize: (item as any)?.size || '',
      brandCategory: (item as any)?.brandId?.category || '',
      bottleNumber: bottle.bottleNumber,
      remainingFraction,
      expectedServings,
      totalExpected,
      actualServings,
      totalActual,
      varianceQuantity,
      variancePercentage,
      varianceFlag,
      closedBy: staffId,
      closedAt: now,
      notes: '',
    })

    // Insert immutable BOTTLE_CLOSED audit log
    await models.BarAuditLog.create({
      userId: item?.userId ?? bottle.userId,
      branchId: item?.branchId ?? bottle.branchId,
      staffId,
      operation: 'BOTTLE_CLOSED',
      referenceId: String(bottle._id),
      referenceType: 'BarBottle',
      details: {
        inventoryItemId: bottle.inventoryItemId,
        bottleId: String(bottle._id),
        bottleNumber: bottle.bottleNumber,
        expectedFraction,
        remainingFraction,
        varianceFraction,
        // Include serving variance summary
        totalExpected,
        totalActual,
        varianceQuantity,
        variancePercentage,
        varianceFlag,
      },
      timestamp: now,
    })

    return bottle.toObject()
  }

  /**
   * Get all open bottles for an inventory item.
   *
   * V2 NEW METHOD: Returns array (multi-bottle support).
   * Sorted by createdAt (FIFO order).
   *
   * @param inventoryItemId - The BarInventoryItem _id
   * @param conn - Tenant mongoose connection
   * @returns Array of open BarBottle documents
   */
  static async getOpenBottles(
    inventoryItemId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>[]> {
    const models = getModels(conn)

    const bottles = await models.BarBottle.find({
      inventoryItemId,
      state: 'open',
    }).sort({ createdAt: 1 })  // FIFO order

    return bottles.map((b: any) => b.toObject())
  }

  /**
   * Get a single open bottle (legacy compatibility).
   *
   * Returns the first open bottle (FIFO). Used for backward compatibility.
   *
   * @param inventoryItemId - The BarInventoryItem _id
   * @param conn - Tenant mongoose connection
   * @returns The first open BarBottle document, or null
   */
  static async getOpenBottle(
    inventoryItemId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown> | null> {
    const models = getModels(conn)

    const bottle = await models.BarBottle.findOne({
      inventoryItemId,
      state: 'open',
    }).sort({ createdAt: 1 })  // Oldest first

    return bottle ? bottle.toObject() : null
  }

  /**
   * DEPRECATED: Old method name for closing bottles.
   * Use closeBottle() instead.
   */
  static async closeCurrentBottle(
    inventoryItemId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    // Find the oldest open bottle for this item
    const bottles = await this.getOpenBottles(inventoryItemId, conn)
    if (bottles.length === 0) {
      throw new Error('NO_OPEN_BOTTLE')
    }
    
    // Close the first (oldest) bottle
    return this.closeBottle(String((bottles[0] as any)._id), staffId, conn)
  }

  /**
   * DEPRECATED: Old unit-based deduction method.
   * Use deductFraction() instead.
   */
  static async deductServingUnits(
    inventoryItemId: string,
    units: number,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<DeductResult> {
    // Find the first open bottle
    const bottle = await this.getOpenBottle(inventoryItemId, conn)
    if (!bottle) {
      throw new Error('NO_OPEN_BOTTLE')
    }

    // Convert units to fraction (assume 20 units per bottle as default)
    // This is a compatibility shim - real code should use fractions
    const fraction = units / 20

    return this.deductFraction(String((bottle as any)._id), fraction, staffId, conn)
  }
}
