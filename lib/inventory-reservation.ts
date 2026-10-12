// ─── Inventory Reservation System ────────────────────────────────────────────
// Pessimistic locking mechanism to prevent race conditions on stock transfers
// 
// Problem: Two concurrent transfers from same source can both pass stock checks
// Solution: Reserve stock when transfer is created, release if transfer fails/is rejected

import { Types } from 'mongoose'

export interface ReservationRecord {
  _id?: string | Types.ObjectId
  userId: string | Types.ObjectId
  branchId: string | Types.ObjectId
  itemId: string | Types.ObjectId // productId or drugId
  itemType: 'product' | 'drug'
  quantity: number
  transferId: string | Types.ObjectId
  status: 'reserved' | 'released' | 'consumed'
  createdAt?: Date
  releaseReason?: string
}

/**
 * Reserve inventory for a transfer
 * Deducts from available stock temporarily
 * Throws error if insufficient stock available
 */
export async function reserveInventory(
  models: any,
  userId: string | Types.ObjectId,
  branchId: string | Types.ObjectId,
  itemId: string | Types.ObjectId,
  itemType: 'product' | 'drug',
  quantity: number,
  transferId: string | Types.ObjectId,
  session?: any
): Promise<void> {
  if (itemType === 'product') {
    // Reserve retail product inventory
    const inventory = await models.ProductInventory.findOne({
      userId,
      branchId,
      productId: itemId,
    }).session(session)

    if (!inventory) {
      throw new Error('Inventory not found for this product')
    }

    const availableStock = inventory.stock - (inventory.reserved || 0)
    if (availableStock < quantity) {
      throw new Error(
        `Insufficient stock to reserve. Available: ${availableStock}, Requested: ${quantity}`
      )
    }

    // Deduct from stock immediately (pessimistic lock)
    inventory.stock -= quantity
    inventory.reserved = (inventory.reserved || 0) + quantity
    inventory.lastUpdated = new Date()
    await inventory.save({ session })

  } else if (itemType === 'drug') {
    // Reserve pharmacy drug inventory
    const inventory = await models.Inventory.findOne({
      userId,
      branchId,
      drugId: itemId,
    }).session(session)

    if (!inventory) {
      throw new Error('Inventory not found for this drug')
    }

    const availableStock = inventory.quantityAvailable - (inventory.quantityReserved || 0)
    if (availableStock < quantity) {
      throw new Error(
        `Insufficient stock to reserve. Available: ${availableStock}, Requested: ${quantity}`
      )
    }

    // Reserve stock (pessimistic lock)
    inventory.quantityAvailable -= quantity
    inventory.quantityReserved = (inventory.quantityReserved || 0) + quantity
    inventory.lastStockUpdate = new Date()
    await inventory.save({ session })
  }
}

/**
 * Release reservation (transfer failed, rejected, or cancelled)
 * Returns stock to available pool
 */
export async function releaseReservation(
  models: any,
  userId: string | Types.ObjectId,
  branchId: string | Types.ObjectId,
  itemId: string | Types.ObjectId,
  itemType: 'product' | 'drug',
  quantity: number,
  reason: string = 'transfer_cancelled',
  session?: any
): Promise<void> {
  if (itemType === 'product') {
    const inventory = await models.ProductInventory.findOne({
      userId,
      branchId,
      productId: itemId,
    }).session(session)

    if (!inventory) return

    inventory.stock += quantity
    inventory.reserved = Math.max(0, (inventory.reserved || 0) - quantity)
    inventory.lastUpdated = new Date()
    await inventory.save({ session })

  } else if (itemType === 'drug') {
    const inventory = await models.Inventory.findOne({
      userId,
      branchId,
      drugId: itemId,
    }).session(session)

    if (!inventory) return

    inventory.quantityAvailable += quantity
    inventory.quantityReserved = Math.max(0, (inventory.quantityReserved || 0) - quantity)
    inventory.lastStockUpdate = new Date()
    await inventory.save({ session })
  }
}

/**
 * Consume reservation (transfer completed successfully)
 * Creates transaction records for the transfer
 */
export async function consumeReservation(
  models: any,
  userId: string | Types.ObjectId,
  branchId: string | Types.ObjectId,
  itemId: string | Types.ObjectId,
  itemType: 'product' | 'drug',
  quantity: number,
  transferId: string | Types.ObjectId,
  transferNumber: string,
  staffId?: string | Types.ObjectId,
  session?: any
): Promise<void> {
  if (itemType === 'product') {
    const inventory = await models.ProductInventory.findOne({
      userId,
      branchId,
      productId: itemId,
    }).session(session)

    if (!inventory) return

    // Remove from reserved pool (already deducted from stock)
    inventory.reserved = Math.max(0, (inventory.reserved || 0) - quantity)
    inventory.lastUpdated = new Date()
    await inventory.save({ session })

    // Create ledger entry for audit trail
    if (models.StockLedger) {
      await models.StockLedger.create(
        [{
          userId,
          productId: itemId,
          branchId,
          type: 'TRANSFER_OUT',
          quantity: -quantity,
          previousStock: inventory.stock + quantity,
          newStock: inventory.stock,
          notes: `Transfer completed - ${transferNumber}`,
          staffId,
        }],
        { session }
      )
    }

  } else if (itemType === 'drug') {
    const inventory = await models.Inventory.findOne({
      userId,
      branchId,
      drugId: itemId,
    }).session(session)

    if (!inventory) return

    // Remove from reserved pool
    inventory.quantityReserved = Math.max(0, (inventory.quantityReserved || 0) - quantity)
    inventory.lastStockUpdate = new Date()
    await inventory.save({ session })

    // Create transaction entry for audit trail
    await models.InventoryTransaction.create(
      [{
        userId,
        branchId,
        drugId: itemId,
        type: 'TRANSFER',
        quantity: -quantity,
        previousBalance: inventory.quantityAvailable + quantity,
        newBalance: inventory.quantityAvailable,
        referenceId: transferId.toString(),
        referenceType: 'transfer',
        userIdPerformed: staffId,
        reason: `Transfer out - ${transferNumber}`,
      }],
      { session }
    )
  }
}

/**
 * Get available stock (accounting for reservations)
 */
export async function getAvailableStock(
  models: any,
  userId: string | Types.ObjectId,
  branchId: string | Types.ObjectId,
  itemId: string | Types.ObjectId,
  itemType: 'product' | 'drug'
): Promise<number> {
  if (itemType === 'product') {
    const inventory = await models.ProductInventory.findOne({
      userId,
      branchId,
      productId: itemId,
    })

    if (!inventory) return 0
    return inventory.stock - (inventory.reserved || 0)

  } else if (itemType === 'drug') {
    const inventory = await models.Inventory.findOne({
      userId,
      branchId,
      drugId: itemId,
    })

    if (!inventory) return 0
    return inventory.quantityAvailable - (inventory.quantityReserved || 0)
  }

  return 0
}
