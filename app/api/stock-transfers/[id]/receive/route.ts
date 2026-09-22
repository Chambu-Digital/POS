import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── PUT: Receive stock transfer ────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check permission
    if (payload.type === 'staff' && !payload.permissions?.['stock-transfers.receive']) {
      return NextResponse.json({ error: 'No permission to receive transfers' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params
    const body = await request.json()
    const { items: receivedItems } = body // Array with quantityReceived per item

    // Validate current branch context
    const branchContext = await getBranchContext(request)
    if (!branchContext) {
      return NextResponse.json({ error: 'Branch context is required' }, { status: 400 })
    }

    // Find transfer
    const transfer = await models.StockTransfer.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
      toBranchId: branchContext,
      status: 'pending_receipt',
    })

    if (!transfer) {
      return NextResponse.json({ 
        error: 'Transfer not found or already processed' 
      }, { status: 404 })
    }

    // Start transaction
    const session = await models.StockTransfer.db.startSession()
    session.startTransaction()

    try {
      // Process each item
      for (const receivedItem of receivedItems) {
        const transferItem = transfer.items.find(
          (item: any) => 
            (item.productId && item.productId.toString() === receivedItem.itemId) ||
            (item.drugId && item.drugId.toString() === receivedItem.itemId)
        )

        if (!transferItem) {
          throw new Error(`Item ${receivedItem.itemId} not found in transfer`)
        }

        const quantityReceived = receivedItem.quantityReceived || transferItem.quantitySent

        if (transferItem.productId) {
          // Handle retail products - use ProductInventory
          let inventory = await models.ProductInventory.findOne({
            userId: ownerId,
            branchId: branchContext,
            productId: transferItem.productId,
          }).session(session)

          if (!inventory) {
            // Create inventory record if it doesn't exist
            inventory = await models.ProductInventory.create([{
              userId: ownerId,
              branchId: branchContext,
              productId: transferItem.productId,
              stock: quantityReceived,
              reserved: 0,
            }], { session })
            inventory = inventory[0]
          } else {
            // Update existing inventory
            const previousStock = inventory.stock
            inventory.stock += quantityReceived
            inventory.lastUpdated = new Date()
            await inventory.save({ session })

            // Create ledger entry
            await models.StockLedger.create([{
              userId: ownerId,
              productId: transferItem.productId,
              type: 'TRANSFER_IN',
              quantity: quantityReceived,
              previousStock,
              newStock: inventory.stock,
              notes: `Transfer received from branch - ${transfer.transferNumber}`,
              staffId: payload.type === 'staff' ? payload.userId : undefined,
            }], { session })
          }

        } else if (transferItem.drugId) {
          // Handle pharmacy drugs - find or create inventory record
          let inventory = await models.Inventory.findOne({
            userId: ownerId,
            branchId: branchContext,
            drugId: transferItem.drugId,
          }).session(session)

          if (!inventory) {
            // Create new inventory record for this branch
            inventory = await models.Inventory.create([{
              userId: ownerId,
              branchId: branchContext,
              drugId: transferItem.drugId,
              quantityAvailable: quantityReceived,
              quantityReserved: 0,
            }], { session })
            inventory = inventory[0]
          } else {
            // Update existing inventory
            const previousBalance = inventory.quantityAvailable
            inventory.quantityAvailable += quantityReceived
            inventory.lastStockUpdate = new Date()
            await inventory.save({ session })

            // Create transaction entry
            await models.InventoryTransaction.create([{
              userId: ownerId,
              branchId: branchContext,
              drugId: transferItem.drugId,
              type: 'TRANSFER',
              quantity: quantityReceived,
              previousBalance,
              newBalance: inventory.quantityAvailable,
              referenceId: transfer._id.toString(),
              referenceType: 'transfer',
              userIdPerformed: payload.type === 'staff' ? payload.userId : ownerId,
              reason: `Transfer received - ${transfer.transferNumber}`,
            }], { session })
          }
        }

        // Update received quantity in transfer item
        transferItem.quantityReceived = quantityReceived
      }

      // Update transfer status
      transfer.status = 'received'
      transfer.receivedBy = payload.type === 'staff' ? new Types.ObjectId(payload.userId) : null
      transfer.receivedAt = new Date()
      await transfer.save({ session })

      // Create notification for sender
      if (transfer.createdBy) {
        await models.Notification.create([{
          userId: ownerId,
          recipientId: transfer.createdBy,
          recipientType: transfer.createdByModel === 'Staff' ? 'staff' : 'user',
          type: 'info',
          title: 'Transfer Received',
          message: `Transfer ${transfer.transferNumber} has been received`,
          referenceId: transfer._id,
          referenceType: 'stock_transfer',
        }], { session })
      }

      await session.commitTransaction()

      return NextResponse.json({
        transfer,
        message: 'Transfer received successfully',
      })

    } catch (error: any) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }

  } catch (error: any) {
    console.error('[stock-transfers/receive] PUT error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to receive transfer' 
    }, { status: 500 })
  }
}
