// ─── PATCH /api/sales/[id]/returns/[returnId]/approve ─────────────────────────
// Approve or reject a pending return request
// On approval: processes stock changes and updates sale status

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Only owners can approve
    if (payload.type !== 'user') {
      return NextResponse.json({ error: 'Only owners can approve returns' }, { status: 403 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.userId
    const branchContext = await getBranchContext(request)

    const { id, returnId } = await params
    const data = await request.json()
    const { status } = data

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const saleId = new Types.ObjectId(id)
    
    // Get sale
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Find the return entry
    const returnIndex = sale.returns.findIndex((r: any) => r._id.toString() === returnId)
    if (returnIndex === -1) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    const returnEntry = sale.returns[returnIndex]

    // Check if already processed
    if (returnEntry.status !== 'pending') {
      return NextResponse.json({ error: 'Return already processed' }, { status: 400 })
    }

    // Update return status
    sale.returns[returnIndex].status = status
    sale.returns[returnIndex].approvedBy = new Types.ObjectId(ownerId)
    sale.returns[returnIndex].approvedAt = new Date()

    // If approved, process stock changes
    if (status === 'approved') {
      const productObjId = returnEntry.productId

      // Get current product stock
      const product = await models.Product.findOne({
        _id: productObjId,
        userId: ownerId,
      })

      if (product) {
        const previousStock = product.stock || 0
        let newStock = previousStock
        let movementType = ''

        if (returnEntry.condition === 'resellable') {
          // Return to inventory
          newStock = previousStock + returnEntry.quantity
          movementType = 'RETURN'
          
          // Update product stock
          await models.Product.findByIdAndUpdate(
            productObjId,
            {
              stock: newStock,
              updatedAt: new Date(),
            }
          )

          // Update ProductInventory if multi-branch
          if (branchContext) {
            await models.ProductInventory.findOneAndUpdate(
              {
                userId: ownerId,
                branchId: branchContext,
                productId: productObjId,
              },
              {
                $inc: { stock: returnEntry.quantity },
                lastUpdated: new Date(),
              }
            )
          }
        } else if (returnEntry.condition === 'damaged') {
          // Do not restock - record as damage
          newStock = previousStock
          movementType = 'DAMAGE'
        }

        // Create stock ledger entry
        await (models as any).StockLedger.create({
          userId: ownerId,
          branchId: branchContext ? new Types.ObjectId(branchContext) : null,
          productId: productObjId,
          saleId: saleId,
          staffId: returnEntry.returnedBy || null,
          type: movementType,
          quantity: returnEntry.condition === 'resellable' ? returnEntry.quantity : -returnEntry.quantity,
          previousStock,
          newStock,
          orderNumber: sale.orderNumber,
          reason: returnEntry.reason,
          notes: `Approved return: ${returnEntry.notes || ''}`,
          timestamp: new Date(),
        })
      }

      // Update sale totals and status
      const approvedReturns = sale.returns.filter((r: any) => r.status === 'approved')
      const totalReturnedValue = approvedReturns.reduce((sum: number, r: any) => sum + (r.refundAmount || 0), 0)
      
      const totalOriginalQuantity = sale.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
      const totalReturnedQuantity = approvedReturns.reduce((sum: number, r: any) => sum + r.quantity, 0)
      const isFullyReturned = totalReturnedQuantity >= totalOriginalQuantity

      sale.totalReturned = totalReturnedValue
      sale.isPartiallyReturned = !isFullyReturned && totalReturnedQuantity > 0
      sale.isFullyReturned = isFullyReturned
      sale.status = isFullyReturned ? 'refunded' : (totalReturnedQuantity > 0 ? 'partially_refunded' : sale.status)
    }

    await sale.save()

    return NextResponse.json({
      success: true,
      message: `Return ${status}`,
      returnEntry: sale.returns[returnIndex],
    })
  } catch (error) {
    console.error('[returns/approve] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to process return approval' }, { status: 500 })
  }
}
