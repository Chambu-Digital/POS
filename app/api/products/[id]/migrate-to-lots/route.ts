// ─── POST /api/products/[id]/migrate-to-lots ──────────────────────────────────
// Assigns existing flat stock into ProductBatch records without touching the
// stock counter.  This is a one-time migration for products that had stock
// before lot tracking was enabled.
//
// Rules:
//  • Product must have trackLots === true
//  • Product must have ZERO existing batches at this branch (migration only)
//  • Lot quantities must sum to exactly the branch-scoped stock (ProductInventory)
//  • Product.stock and ProductInventory.stock are NOT changed
//  • A single ADJUSTMENT StockLedger entry is written for audit trail
//
// Body: { lots: [{ label: string, quantity: number }] }

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

function generateLotId(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const rand    = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LOT-${dateStr}-${rand}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id }    = await params
    const { models } = await getTenantDB(request)
    const ownerId    = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId    = payload.type === 'staff' ? payload.userId : null
    const branchContext = await getBranchContext(request)

    // ── Resolve effective branch first ──────────────────────────────────────
    let effectiveBranchId: string | null = branchContext
    if (!effectiveBranchId) {
      let defaultBranch = await models.Branch.findOne({ userId: ownerId, isDefault: true })
      if (!defaultBranch) {
        defaultBranch = await models.Branch.create({
          userId: ownerId, name: 'Main Branch', code: 'MAIN', isDefault: true,
        })
      }
      effectiveBranchId = defaultBranch._id.toString()
    }

    // ── Load product ────────────────────────────────────────────────────────
    const product = await models.Product.findOne({ _id: id, userId: ownerId })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (!product.trackLots) {
      return NextResponse.json(
        { error: 'Product does not have lot tracking enabled' },
        { status: 400 }
      )
    }

    // ── Get branch-scoped stock ─────────────────────────────────────────────
    const inventory = await models.ProductInventory.findOne({
      userId:    ownerId,
      branchId:  new Types.ObjectId(effectiveBranchId),
      productId: new Types.ObjectId(id),
    }).lean() as any
    const systemStock = inventory ? (inventory.stock || 0) : (product.stock || 0)

    // ── Guard: must have zero existing batches at this branch ───────────────
    const existingCount = await (models as any).ProductBatch.countDocuments({
      userId:    ownerId,
      productId: new Types.ObjectId(id),
      branchId:  new Types.ObjectId(effectiveBranchId),
    })

    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Product already has batches. Use Stock In to add more stock.' },
        { status: 409 }
      )
    }

    // ── Validate body ───────────────────────────────────────────────────────
    const body = await request.json()
    const { lots } = body as { lots: Array<{ label: string; quantity: number }> }

    if (!lots || lots.length === 0) {
      return NextResponse.json(
        { error: 'At least one lot is required' },
        { status: 400 }
      )
    }

    const validLots = lots.filter(l => Number(l.quantity) > 0)
    if (validLots.length === 0) {
      return NextResponse.json(
        { error: 'All lot quantities are zero' },
        { status: 400 }
      )
    }

    const lotsTotal = validLots.reduce((s, l) => s + Number(l.quantity), 0)

    if (lotsTotal !== systemStock) {
      return NextResponse.json(
        {
          error: `Lot quantities sum to ${lotsTotal} but system stock is ${systemStock}. They must match exactly.`,
          lotsTotal,
          systemStock,
        },
        { status: 400 }
      )
    }

    // ── Create batches ──────────────────────────────────────────────────────
    const createdBatches: any[] = []

    for (let i = 0; i < validLots.length; i++) {
      const lot      = validLots[i]
      const lotId    = generateLotId()
      const lotLabel = lot.label?.trim() || `Batch ${i + 1}`
      const qty      = Number(lot.quantity)

      const batch = await (models as any).ProductBatch.create({
        userId:           ownerId,
        branchId:         new Types.ObjectId(effectiveBranchId),
        productId:        new Types.ObjectId(id),
        lotId,
        lotLabel,
        supplierLot:      '',
        quantity:         qty,
        initialQuantity:  qty,
        reservedQuantity: 0,
        buyingPrice:      product.buyingPrice || 0,
        receivedDate:     new Date(),
        status:           'active',
        notes:            'Migrated from flat stock',
      })

      createdBatches.push({ lotId, lotLabel, quantity: qty, _id: batch._id })
    }

    // ── Write audit ledger entry (no stock change — quantity delta = 0) ─────
    await (models as any).StockLedger.create({
      userId:        ownerId,
      branchId:      new Types.ObjectId(effectiveBranchId),
      productId:     new Types.ObjectId(id),
      staffId:       staffId ? new Types.ObjectId(staffId) : null,
      type:          'ADJUSTMENT',
      quantity:      0,
      previousStock: systemStock,
      newStock:      systemStock,
      reason:        'Lot migration — existing stock assigned to batches',
      notes:         `${createdBatches.length} batch${createdBatches.length !== 1 ? 'es' : ''} created`,
      timestamp:     new Date(),
    })

    return NextResponse.json({
      success:        true,
      batchesCreated: createdBatches.length,
      totalQuantity:  lotsTotal,
      batches:        createdBatches,
    }, { status: 201 })

  } catch (error) {
    console.error('[products/migrate-to-lots] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to migrate to lots' },
      { status: 500 }
    )
  }
}
