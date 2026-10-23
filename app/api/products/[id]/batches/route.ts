// ─── /api/products/[id]/batches ───────────────────────────────────────────────
// GET  — returns all ProductBatch records for a given product.
//        Used by the sales lot-picker modal and the inventory lot management view.
//        ?status=active|depleted|sealed|all  (default: active)
//        &branchId=<id>  (optional — falls back to branch context header)
//
// POST — creates opening-balance lots directly (no supplier needed).
//        Used by the Create Item form when the user defines initial lots at
//        product creation time.
//        Body: { lots: [{ label, quantity }], buyingPrice?, notes? }

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { models } = await getTenantDB(request)
    const ownerId       = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const { searchParams } = new URL(request.url)
    const statusParam   = searchParams.get('status') || 'active'
    const branchOverride = searchParams.get('branchId') || branchContext

    // Verify the product exists and belongs to this owner
    const product = await models.Product.findOne({ _id: id, userId: ownerId }).lean() as any
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (!product.trackLots) {
      return NextResponse.json({
        batches:  [],
        trackLots: false,
        message:  'This product does not use lot tracking',
      })
    }

    const query: any = {
      userId:    ownerId,
      productId: new Types.ObjectId(id),
    }
    if (branchOverride) query.branchId = new Types.ObjectId(branchOverride)
    if (statusParam !== 'all') {
      const statuses = statusParam.split(',').map(s => s.trim())
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses }
    }

    // FIFO — oldest received lot first
    const batches = await (models as any).ProductBatch.find(query)
      .sort({ receivedDate: 1 })
      .lean()

    const totalRemaining = batches.reduce((s: number, b: any) => s + (b.quantity || 0), 0)
    const activeLots     = batches.filter((b: any) => b.status === 'active').length

    return NextResponse.json({
      batches,
      trackLots: true,
      lotUnit:   product.lotUnit || 'pieces',
      summary: { totalRemaining, activeLots, totalLots: batches.length },
    })
  } catch (error) {
    console.error('[products/[id]/batches] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
  }
}

export async function POST(
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

    const product = await models.Product.findOne({ _id: id, userId: ownerId })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (!product.trackLots) {
      return NextResponse.json({ error: 'Product does not use lot tracking' }, { status: 400 })
    }

    const body = await request.json()
    const { lots, buyingPrice, notes } = body as {
      lots: Array<{ label: string; quantity: number }>
      buyingPrice?: number
      notes?: string
    }

    if (!lots || lots.length === 0) {
      return NextResponse.json({ error: 'At least one lot is required' }, { status: 400 })
    }

    // Resolve effective branch
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

    const createdBatches: any[] = []
    let totalQty = 0

    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i]
      const qty = Number(lot.quantity) || 0
      if (qty <= 0) continue

      const dateStr  = new Date().toISOString().slice(2, 10).replace(/-/g, '')
      const rand     = Math.random().toString(36).substring(2, 6).toUpperCase()
      const lotId    = `LOT-${dateStr}-${rand}`
      const lotLabel = lot.label?.trim() || `Lot ${i + 1}`

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
        buyingPrice:      buyingPrice ?? product.buyingPrice,
        receivedDate:     new Date(),
        status:           'active',
        notes:            notes || 'Opening balance',
      })

      totalQty += qty
      createdBatches.push({ lotId, lotLabel, quantity: qty, _id: batch._id })
    }

    // Update aggregate stock counters
    await models.Product.findByIdAndUpdate(id, {
      $inc: { stock: totalQty }, updatedAt: new Date(),
    })
    if (effectiveBranchId) {
      await models.ProductInventory.findOneAndUpdate(
        { userId: ownerId, branchId: effectiveBranchId, productId: new Types.ObjectId(id) },
        { $inc: { stock: totalQty }, lastUpdated: new Date() },
        { upsert: true }
      )
    }

    // Single STOCK_IN ledger entry for the whole opening balance
    await (models as any).StockLedger.create({
      userId:        ownerId,
      branchId:      effectiveBranchId ? new Types.ObjectId(effectiveBranchId) : null,
      productId:     new Types.ObjectId(id),
      staffId:       staffId ? new Types.ObjectId(staffId) : null,
      type:          'STOCK_IN',
      quantity:      totalQty,
      previousStock: 0,
      newStock:      totalQty,
      reason:        'Opening balance — lot tracking setup',
      notes:         notes || '',
      timestamp:     new Date(),
    })

    return NextResponse.json({
      success:        true,
      batchesCreated: createdBatches.length,
      totalQuantity:  totalQty,
      batches:        createdBatches,
    }, { status: 201 })

  } catch (error) {
    console.error('[products/[id]/batches] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create batches' },
      { status: 500 }
    )
  }
}
