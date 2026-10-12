import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { releaseReservation } from '@/lib/inventory-reservation'
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

    // Only managers of the receiving branch or owners can reject transfers
    if (payload.type === 'staff') {
      const { models } = await getTenantDB(request)
      
      // Get the transfer to check destination branch
      const transfer = await models.StockTransfer.findOne({
        _id: id,
        userId: payload.adminId,
      })
      
      if (!transfer) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
      }
      
      // Staff must be a manager of the receiving branch
      const staff = await models.Staff.findById(payload.userId)
      const isManagerOfReceivingBranch = staff?.managerOfBranches?.some(
        (branchId: any) => branchId.toString() === transfer.toBranchId.toString()
      )
      
      if (!isManagerOfReceivingBranch) {
        return NextResponse.json({ 
          error: 'Only managers of the receiving branch can reject transfers' 
        }, { status: 403 })
      }
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
      // Release reserved stock to source branch for each item
      for (const item of transfer.items) {
        const itemType = item.productId ? 'product' : 'drug'
        const itemId = item.productId || item.drugId

        try {
          await releaseReservation(
            models,
            ownerId,
            transfer.fromBranchId,
            itemId,
            itemType,
            item.quantitySent,
            `transfer_rejected_${reason}`,
            session
          )
        } catch (error: any) {
          console.error(`Failed to release reservation for item ${item.itemName}:`, error)
          // Continue anyway - best effort
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
        message: 'Transfer rejected and stock reserved released',
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
