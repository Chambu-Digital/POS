/**
 * Inventory Engine
 *
 * Handles physical bottle lifecycle tracking and inventory deduction for the bar module.
 * All operations accept a mongoose.Connection and use getModels(conn) to access models,
 * following the per-tenant connection pattern used throughout the codebase.
 *
 * Lifecycle: sealed stock → open bottle → closed bottle (with difference tracking)
 *
 * Key constraints:
 * - At most one BarBottle with state 'open' can exist per inventory item (enforced by DB index)
 * - Opening a bottle closes any currently open bottle first
 * - Stock deductions are immediate and irreversible (no soft-undos at this layer)
 */

import type mongoose from 'mongoose'
import { getModels } from '@/lib/tenant/get-models'

export interface DeductResult {
  bottle: Record<string, unknown>
  remainingUnits: number
}

export class InventoryEngine {
  /**
   * Deduct serving units from the currently open bottle for an inventory item.
   *
   * Finds the open BarBottle, decrements remainingUnits by the given amount,
   * and inserts a SERVING_SOLD audit log entry.
   *
   * @param inventoryItemId - The BarInventoryItem _id
   * @param units - Number of serving units to deduct (must be >= 1)
   * @param staffId - Staff member performing the action (for audit log)
   * @param conn - Tenant mongoose connection
   * @returns { bottle, remainingUnits }
   * @throws Error('NO_OPEN_BOTTLE') if no open bottle exists for this item
   */
  static async deductServingUnits(
    inventoryItemId: string,
    units: number,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<DeductResult> {
    const models = getModels(conn)

    const bottle = await models.BarBottle.findOne({
      inventoryItemId,
      state: 'open',
    })

    if (!bottle) {
      throw new Error('NO_OPEN_BOTTLE')
    }

    // Fetch the inventory item to get userId/branchId for audit log
    const item = await models.BarInventoryItem.findById(inventoryItemId)

    const newRemainingUnits = (bottle.remainingUnits ?? 0) - units
    bottle.remainingUnits = newRemainingUnits
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
        inventoryItemId,
        unitsDeducted: units,
        remainingUnits: newRemainingUnits,
      },
      timestamp: new Date(),
    })

    return {
      bottle: bottle.toObject(),
      remainingUnits: newRemainingUnits,
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
   * If a bottle is currently open, it is closed first via closeCurrentBottle().
   * Decrements sealed stock by 1, creates a new BarBottle with state 'open',
   * sets expectedUnits from the item's first active serving's unitsProduced,
   * and inserts a BOTTLE_OPENED audit log entry.
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

    // Close any currently open bottle first
    const existingOpen = await models.BarBottle.findOne({
      inventoryItemId,
      state: 'open',
    })
    if (existingOpen) {
      await InventoryEngine.closeCurrentBottle(inventoryItemId, staffId, conn)
    }

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

    // Get expectedUnits from first active serving for this item
    const serving = await models.BarServing.findOne({
      inventoryItemId,
      isActive: true,
    }).sort({ createdAt: 1 })

    const expectedUnits = serving?.unitsProduced ?? 0

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
      expectedUnits,
      remainingUnits: expectedUnits,
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
        expectedUnits,
        remainingUnits: expectedUnits,
        previousStock: item.stock + 1,
        newStock: item.stock,
      },
      timestamp: now,
    })

    return newBottle.toObject()
  }

  /**
   * Close the currently open bottle for an inventory item.
   *
   * Finds the open bottle, sets state to 'closed', computes:
   *   actualUnitsSold = expectedUnits - remainingUnits
   *   difference      = expectedUnits - actualUnitsSold
   * Records closedAt and inserts a BOTTLE_CLOSED audit log entry.
   *
   * @param inventoryItemId - The BarInventoryItem _id
   * @param staffId - Staff member closing the bottle (for audit log)
   * @param conn - Tenant mongoose connection
   * @returns The updated (closed) BarBottle document
   * @throws Error('NO_OPEN_BOTTLE') if no open bottle exists for this item
   */
  static async closeCurrentBottle(
    inventoryItemId: string,
    staffId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown>> {
    const models = getModels(conn)

    const bottle = await models.BarBottle.findOne({
      inventoryItemId,
      state: 'open',
    })

    if (!bottle) {
      throw new Error('NO_OPEN_BOTTLE')
    }

    const expectedUnits = bottle.expectedUnits ?? 0
    const remainingUnits = bottle.remainingUnits ?? 0
    const actualUnitsSold = expectedUnits - remainingUnits
    const difference = expectedUnits - actualUnitsSold

    const now = new Date()
    bottle.state = 'closed'
    bottle.closedAt = now
    bottle.actualUnitsSold = actualUnitsSold
    bottle.difference = difference
    bottle.updatedAt = now
    await bottle.save()

    // Fetch item for userId/branchId (may differ from bottle if branchId is missing)
    const item = await models.BarInventoryItem.findById(inventoryItemId)

    // Insert immutable BOTTLE_CLOSED audit log
    await models.BarAuditLog.create({
      userId: item?.userId ?? bottle.userId,
      branchId: item?.branchId ?? bottle.branchId,
      staffId,
      operation: 'BOTTLE_CLOSED',
      referenceId: String(bottle._id),
      referenceType: 'BarBottle',
      details: {
        inventoryItemId,
        bottleNumber: bottle.bottleNumber,
        expectedUnits,
        remainingUnits,
        actualUnitsSold,
        difference,
      },
      timestamp: now,
    })

    return bottle.toObject()
  }

  /**
   * Get the currently open bottle for an inventory item, or null if none exists.
   *
   * @param inventoryItemId - The BarInventoryItem _id
   * @param conn - Tenant mongoose connection
   * @returns The open BarBottle document, or null
   */
  static async getOpenBottle(
    inventoryItemId: string,
    conn: mongoose.Connection
  ): Promise<Record<string, unknown> | null> {
    const models = getModels(conn)

    const bottle = await models.BarBottle.findOne({
      inventoryItemId,
      state: 'open',
    })

    return bottle ? bottle.toObject() : null
  }
}
