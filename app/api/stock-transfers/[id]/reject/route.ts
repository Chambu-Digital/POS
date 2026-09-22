import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── PUT: Reject stock transfer ─────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check permission
    if (payload.type === 'staff' && !payload.permissions?.['stock-transfers.receive']) {
      return NextResponse.json({ error: 'No permission to reject transfers' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

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
    }).populate('fromBranchId', 'name code')

    if (!transfer) {
      return NextResponse.json({ 
        error: 'Transfer not found or already processed' 
      }, { status: 404 })
    }

    // Start transaction to restore stock
    const session = await models.StockTransfer.db.startSession()
    session.startTransaction()

    try {
      // Restore stock to source branch for each item
      for (const item of transfer.items) {
        if (item.productId) {
          // Restore retail product stock in ProductInventory
          const inventory = await models.ProductInventory.findOne({
            userId: ownerId,
            branchId: transfer.fromBranchId,
            productId: item.productId,
          }).session(session)

          if (inventory) {
            const previousStock = inventory.stock
            inventory.stock += item.quantitySent
            inventory.lastUpdated = new Date()
            await inventory.save({ session })

            // Create ledger entry for restoration
            await models.StockLedger.create([{
              userId: ownerId,
              productId: item.productId,
              type: 'ADJUSTMENT',
              quantity: item.quantitySent,
              previousStock,
              newStock: inventory.stock,
              notes: `Transfer rejected - ${transfer.transferNumber}. Reason: ${reason}`,
              staffId: payload.type === 'staff' ? payload.userId : undefined,
            }], { session })
          }

        } else if (item.drugId) {
          // Restore pharmacy inventory
          const inventory = await models.Inventory.findOne({
            userId: ownerId,
            branchId: transfer.fromBranchId,
            drugId: item.drugId,
          }).session(session)

          if (inventory) {
            const previousBalance = inventory.quantityAvailable
            inventory.quantityAvailable += item.quantitySent
            inventory.lastStockUpdate = new Date()
            await inventory.save({ session })

            // Create transaction entry
            await models.InventoryTransaction.create([{
              userId: ownerId,
              branchId: transfer.fromBranchId,
              drugId: item.drugId,
              type: 'ADJUSTMENT',
              quantity: item.quantitySent,
              previousBalance,
              newBalance: inventory.quantityAvailable,
              referenceId: transfer._id.toString(),
              referenceType: 'transfer',
              userIdPerformed: payload.type === 'staff' ? payload.userId : ownerId,
              reason: `Transfer rejected - ${transfer.transferNumber}. Reason: ${reason}`,
            }], { session })
          }
        }
      }

      // Update transfer status
      transfer.status = 'rejected'
      transfer.rejectedBy = payload.type === 'staff' ? new Types.ObjectId(payload.userId) : null
      transfer.rejectedAt = new Date()
      transfer.rejectionReason = reason
      await transfer.save({ session })

      // Create notification for sender
      if (transfer.createdBy) {
        await models.Notification.create([{
          userId: ownerId,
          recipientId: transfer.createdBy,
          recipientType: transfer.createdByModel === 'Staff' ? 'staff' : 'user',
          type: 'transfer_rejected',
          title: 'Transfer Rejected',
          message: `Transfer ${transfer.transferNumber} was rejected. Reason: ${reason}`,
          referenceId: transfer._id,
          referenceType: 'stock_transfer',
        }], { session })
      }

      await session.commitTransaction()

      return NextResponse.json({
        transfer,
        message: 'Transfer rejected and stock restored',
      })

    } catch (error: any) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }

  } catch (error: any) {
    console.error('[stock-transfers/reject] PUT error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to reject transfer' 
    }, { status: 500 })
  }
}
