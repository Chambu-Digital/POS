// ─── /api/products/batches/[id] ───────────────────────────────────────────────
// Manage a single ProductBatch record.
//
// PUT  — update editable fields: lotLabel, quantity, status, notes, sellingPrice
//        Used by the inventory lot-management view for manual corrections.
//
// DELETE — hard-delete the batch and reverse its quantity from ProductInventory.
//          Intended for removing erroneously created lots only.

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { models }    = await getTenantDB(request)
    const ownerId       = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const staffId       = payload.type === 'staff' ? payload.userId : null

    const batch = await (models as any).ProductBatch.findOne({
      _id:    new Types.ObjectId(id),
      userId: ownerId,
    })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    const body = await request.json()

    // ── Allowed editable fields ───────────────────────────────────────────────
    const {
      lotLabel,
      quantity,
      status,
      notes,
      sellingPrice,
    } = body

    const prevQuantity = batch.quantity

    if (lotLabel    !== undefined) batch.lotLabel    = lotLabel.trim()
    if (notes       !== undefined) batch.notes       = notes
    if (sellingPrice !== undefined) batch.sellingPrice = sellingPrice

    // Quantity change — write a ledger ADJUSTMENT entry
    if (quantity !== undefined && quantity !== prevQuantity) {
      const newQty    = Number(quantity)
      const batchDiff = newQty - prevQuantity

      batch.quantity = newQty

      // Auto-manage status based on quantity
      if (newQty <= 0) {
        batch.status = 'depleted'
      } else if (batch.status === 'depleted') {
        // Revived from depleted when quantity is manually set above 0
        batch.status = 'active'
      }

      // Adjust aggregate inventory counters
      if (branchContext) {
        await models.ProductInventory.findOneAndUpdate(
          { userId: ownerId, branchId: branchContext, productId: batch.productId },
          { $inc: { stock: batchDiff }, lastUpdated: new Date() }
        )
      }
      await models.Product.findByIdAndUpdate(batch.productId, {
        $inc:      { stock: batchDiff },
        updatedAt: new Date(),
      })

      // Write audit entry
      await (models as any).StockLedger.create({
        userId:        ownerId,
        branchId:      branchContext ? new Types.ObjectId(branchContext) : null,
        productId:     batch.productId,
        staffId:       staffId ? new Types.ObjectId(staffId) : null,
        batchId:       batch._id,
        lotLabel:      batch.lotLabel || batch.lotId,
        type:          'ADJUSTMENT',
        quantity:      batchDiff,
        previousStock: prevQuantity,
        newStock:      newQty,
        reason:        body.reason || 'Manual lot adjustment',
        notes:         notes || '',
        timestamp:     new Date(),
      })
    }

    // Explicit status override (e.g. sealing a lot)
    if (status !== undefined) {
      const allowed = ['active', 'depleted', 'sealed']
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${allowed.join(', ')}` },
          { status: 400 }
        )
      }
      batch.status = status
    }

    batch.updatedAt = new Date()
    await batch.save()

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('[products/batches/[id]] PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update batch' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { models }    = await getTenantDB(request)
    const ownerId       = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const batch = await (models as any).ProductBatch.findOne({
      _id:    new Types.ObjectId(id),
      userId: ownerId,
    })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    const removedQty = batch.quantity

    // Reverse aggregate counters before deleting
    if (removedQty > 0) {
      if (branchContext) {
        await models.ProductInventory.findOneAndUpdate(
          { userId: ownerId, branchId: branchContext, productId: batch.productId },
          { $inc: { stock: -removedQty }, lastUpdated: new Date() }
        )
      }
      await models.Product.findByIdAndUpdate(batch.productId, {
        $inc:      { stock: -removedQty },
        updatedAt: new Date(),
      })
    }

    await batch.deleteOne()

    return NextResponse.json({ success: true, removedQuantity: removedQty })
  } catch (error) {
    console.error('[products/batches/[id]] DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete batch' },
      { status: 500 }
    )
  }
}
