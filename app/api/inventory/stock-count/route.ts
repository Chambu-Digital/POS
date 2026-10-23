// ─── /api/inventory/stock-count ───────────────────────────────────────────────
// Physical inventory count and automatic adjustments.
// Compares system stock vs physical count and creates ADJUSTMENT movements.
//
// For lot-tracked products (trackLots===true), the request body can include a
// per-batch breakdown under each count item.  The route updates each
// ProductBatch individually, then recomputes ProductInventory.stock as the sum
// of all active batch quantities.  Non-lot products behave exactly as before.
//
// Request body shape:
// {
//   counts: [
//     {
//       productId: string,
//       systemStock: number,
//       physicalStock: number,          // used for non-lot products
//       batches?: [                     // supplied only for trackLots products
//         { batchId: string, physicalQuantity: number }
//       ]
//     }
//   ],
//   reason?: string,
//   notes?: string
// }

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

interface BatchCount {
  batchId: string
  physicalQuantity: number
}

interface CountItem {
  productId: string
  systemStock: number
  physicalStock: number
  batches?: BatchCount[]
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId       = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const staffId       = payload.type === 'staff' ? payload.userId : null

    const body = await request.json()
    const { counts, reason, notes } = body

    if (!counts || counts.length === 0) {
      return NextResponse.json(
        { error: 'At least one product count is required' },
        { status: 400 }
      )
    }

    const adjustments: any[]    = []
    const batchAdjustments: any[] = []
    let totalDifference = 0

    for (const count of counts as CountItem[]) {
      const productObjId = new Types.ObjectId(count.productId)

      const product = await models.Product.findById(productObjId)
      if (!product) continue

      // ── A. LOT-TRACKED PRODUCT ─────────────────────────────────────────────
      if (product.trackLots && count.batches && count.batches.length > 0) {

        for (const bc of count.batches) {
          const batch = await (models as any).ProductBatch.findOne({
            _id:    new Types.ObjectId(bc.batchId),
            userId: ownerId,
          })
          if (!batch) continue

          const prevQty  = batch.quantity
          const newQty   = bc.physicalQuantity
          const batchDiff = newQty - prevQty

          if (batchDiff === 0) continue

          totalDifference += Math.abs(batchDiff)

          // Update the batch
          batch.quantity  = newQty
          batch.status    = newQty <= 0 ? 'depleted' : 'active'
          batch.updatedAt = new Date()
          await batch.save()

          // Write a ledger entry per batch so history is traceable
          await (models as any).StockLedger.create({
            userId:        ownerId,
            branchId:      branchContext ? new Types.ObjectId(branchContext) : null,
            productId:     productObjId,
            staffId:       staffId ? new Types.ObjectId(staffId) : null,
            batchId:       batch._id,
            lotLabel:      batch.lotLabel || batch.lotId,
            type:          'ADJUSTMENT',
            quantity:      batchDiff,
            previousStock: prevQty,
            newStock:      newQty,
            reason:        reason || 'Stock count adjustment',
            notes:         notes  || '',
            timestamp:     new Date(),
          })

          batchAdjustments.push({
            batchId:   bc.batchId,
            lotLabel:  batch.lotLabel || batch.lotId,
            productId: count.productId,
            productName: product.productName,
            previousQuantity: prevQty,
            newQuantity:      newQty,
            difference:       batchDiff,
          })
        }

        // Recompute the aggregate stock from all active batches for this product
        const activeBatches = await (models as any).ProductBatch.find({
          userId:    ownerId,
          productId: productObjId,
          status:    'active',
          ...(branchContext ? { branchId: new Types.ObjectId(branchContext) } : {}),
        }).lean()

        const recomputedStock = activeBatches.reduce(
          (sum: number, b: any) => sum + (b.quantity || 0), 0
        )

        // Update branch inventory + legacy field with the recomputed total
        if (branchContext) {
          await models.ProductInventory.findOneAndUpdate(
            { userId: ownerId, branchId: branchContext, productId: productObjId },
            { stock: recomputedStock, lastUpdated: new Date() },
            { upsert: true }
          )
        }
        await models.Product.findByIdAndUpdate(productObjId, {
          stock:     recomputedStock,
          updatedAt: new Date(),
        })

        adjustments.push({
          productId:   count.productId,
          productName: product.productName,
          trackLots:   true,
          recomputedStock,
          batchesAdjusted: batchAdjustments.filter(
            (ba: any) => ba.productId === count.productId
          ).length,
        })

        continue  // skip the non-lot block below
      }

      // ── B. STANDARD (non-lot) PRODUCT ──────────────────────────────────────
      const difference = count.physicalStock - count.systemStock
      if (difference === 0) continue

      totalDifference += Math.abs(difference)

      if (branchContext) {
        const inventory = await models.ProductInventory.findOne({
          userId:    ownerId,
          branchId:  branchContext,
          productId: productObjId,
        })

        if (inventory) {
          inventory.stock      = count.physicalStock
          inventory.lastUpdated = new Date()
          await inventory.save()
        } else {
          await models.ProductInventory.create({
            userId:      ownerId,
            branchId:    branchContext,
            productId:   productObjId,
            stock:       count.physicalStock,
            lastUpdated: new Date(),
          })
        }
        await models.Product.findByIdAndUpdate(productObjId, {
          stock:     count.physicalStock,
          updatedAt: new Date(),
        })
      } else {
        await models.Product.findByIdAndUpdate(productObjId, {
          stock:     count.physicalStock,
          updatedAt: new Date(),
        })
      }

      await (models as any).StockLedger.create({
        userId:        ownerId,
        branchId:      branchContext ? new Types.ObjectId(branchContext) : null,
        productId:     productObjId,
        staffId:       staffId ? new Types.ObjectId(staffId) : null,
        type:          'ADJUSTMENT',
        quantity:      difference,
        previousStock: count.systemStock,
        newStock:      count.physicalStock,
        reason:        reason || 'Stock count adjustment',
        notes:         notes  || '',
        timestamp:     new Date(),
      })

      adjustments.push({
        productId:   count.productId,
        productName: product.productName,
        trackLots:   false,
        systemStock:   count.systemStock,
        physicalStock: count.physicalStock,
        difference,
      })
    }

    if (adjustments.length === 0 && batchAdjustments.length === 0) {
      return NextResponse.json({
        success: true,
        message:     'All counts match system stock. No adjustments needed.',
        adjustments: [],
      })
    }

    return NextResponse.json({
      success: true,
      message: `Stock count complete. ${adjustments.length} product(s) adjusted, ${batchAdjustments.length} lot(s) updated.`,
      adjustmentCount:      adjustments.length,
      batchAdjustmentCount: batchAdjustments.length,
      totalDifference,
      adjustments,
      batchAdjustments,
    }, { status: 201 })

  } catch (error) {
    console.error('[inventory/stock-count] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process stock count' },
      { status: 500 }
    )
  }
}
