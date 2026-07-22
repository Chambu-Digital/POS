// ─── Inventory Transaction Service ─────────────────────────────────────────────
// Immutable ledger operations for all stock movements

import type mongoose from 'mongoose'

export interface CreateTransactionParams {
  userId: string
  branchId: string
  drugId: string
  batchId?: string
  type: 'IN' | 'OUT' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER' | 'DISPOSAL' | 'RETURN'
  quantity: number
  referenceId?: string
  referenceType?: string
  userIdPerformed?: string
  reason?: string
}

export async function createInventoryTransaction(
  models: any,
  params: CreateTransactionParams
): Promise<void> {
  const { userId, branchId, drugId, type, quantity, referenceId, referenceType, userIdPerformed, reason } = params

  // Get current inventory balance
  const inventory = await models.Inventory.findOne({ userId, branchId, drugId })
  const previousBalance = inventory?.quantityAvailable || 0

  // Calculate new balance based on transaction type
  let newBalance = previousBalance
  switch (type) {
    case 'IN':
    case 'RETURN':
      newBalance = previousBalance + quantity
      break
    case 'OUT':
    case 'SALE':
    case 'TRANSFER':
    case 'DISPOSAL':
      newBalance = previousBalance - quantity
      break
    case 'ADJUSTMENT':
      // Adjustments can be positive or negative based on quantity
      newBalance = previousBalance + quantity
      break
  }

  // Create immutable transaction record
  const transaction = new models.InventoryTransaction({
    userId,
    branchId,
    drugId,
    batchId: params.batchId,
    type,
    quantity,
    previousBalance,
    newBalance,
    referenceId,
    referenceType,
    userIdPerformed,
    reason,
    timestamp: new Date(),
    createdAt: new Date(),
  })
  await transaction.save()

  // Update inventory record
  if (inventory) {
    inventory.quantityAvailable = newBalance
    inventory.lastStockUpdate = new Date()
    await inventory.save()
  } else {
    // Create new inventory record
    const newInventory = new models.Inventory({
      userId,
      branchId,
      drugId,
      quantityAvailable: newBalance,
      quantityReserved: 0,
      reorderLevel: 10,
      lastStockUpdate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await newInventory.save()
  }

  // Update Drug.stock (computed field for backward compatibility)
  await models.Drug.findByIdAndUpdate(drugId, { $inc: { stock: type === 'IN' || type === 'RETURN' ? quantity : -quantity } })
}

export async function getInventoryHistory(
  models: any,
  userId: string,
  branchId: string,
  drugId?: string,
  limit: number = 100
): Promise<any[]> {
  const query: any = { userId, branchId }
  if (drugId) query.drugId = drugId

  const transactions = await models.InventoryTransaction
    .find(query)
    .populate('drugId', 'genericName brandName unit')
    .populate('batchId', 'batchNumber')
    .populate('userIdPerformed', 'name')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()

  return transactions
}

export async function reconstructInventory(
  models: any,
  userId: string,
  branchId: string,
  drugId: string
): Promise<number> {
  // Get all transactions for this drug in this branch, ordered chronologically
  const transactions = await models.InventoryTransaction
    .find({ userId, branchId, drugId })
    .sort({ timestamp: 1 })
    .lean()

  // Start from 0 and apply each transaction
  let balance = 0
  for (const tx of transactions) {
    switch (tx.type) {
      case 'IN':
      case 'RETURN':
        balance += tx.quantity
        break
      case 'OUT':
      case 'SALE':
      case 'TRANSFER':
      case 'DISPOSAL':
        balance -= tx.quantity
        break
      case 'ADJUSTMENT':
        balance += tx.quantity
        break
    }
  }

  // Update inventory with reconstructed balance
  await models.Inventory.findOneAndUpdate(
    { userId, branchId, drugId },
    { quantityAvailable: balance, lastStockUpdate: new Date() },
    { upsert: true, new: true }
  )

  return balance
}
