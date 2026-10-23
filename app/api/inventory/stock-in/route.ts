// ─── /api/inventory/stock-in ──────────────────────────────────────────────────
// Receive stock from suppliers.
// Creates STOCK_IN movements in ledger and updates product stock.
// For products with trackLots=true, also creates individual ProductBatch records
// — one per physical lot (roll, box, carton, etc.) — with a generated lotId.

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// Each item in the request body
interface StockInItem {
  productId: string
  quantity: number
  unitCost: number
  // Lot-tracked products: optional array of individual lots being received.
  // If omitted but product.trackLots===true, a single lot is auto-created for
  // the whole quantity.
  lots?: Array<{
    label: string      // e.g. "Roll A", "Box 2"  — editable by staff
    quantity: number   // how much this physical unit contains
  }>
}

/** Generates a unique lot identifier: LOT-YYMMDD-XXXX */
function generateLotId(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '') // YYMMDD
  const rand    = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LOT-${dateStr}-${rand}`
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId     = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const staffId     = payload.type === 'staff' ? payload.userId : null

    const body = await request.json()
    const { supplierId, reference, notes, items } = body

    // ── Validation ────────────────────────────────────────────────────────────
    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Supplier and at least one item are required' },
        { status: 400 }
      )
    }

    const supplier = await models.Supplier.findOne({
      _id: supplierId,
      userId: ownerId,
      isActive: true,
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const productIds = items.map((item: StockInItem) => new Types.ObjectId(item.productId))
    const products   = await models.Product.find({ _id: { $in: productIds }, userId: ownerId })
    if (products.length !== items.length) {
      return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
    }

    // ── Process each line item ────────────────────────────────────────────────
    const movements: any[]  = []
    const batchesCreated: any[] = []
    const totalCost = items.reduce(
      (sum: number, item: StockInItem) => sum + item.quantity * item.unitCost, 0
    )

    for (const item of items) {
      const productObjId = new Types.ObjectId(item.productId)
      const product      = products.find((p: any) => p._id.toString() === item.productId)
      if (!product) continue

      const previousStock = product.stock || 0
      const newStock      = previousStock + item.quantity

      // ── 1. Update aggregate stock counters (unchanged behaviour) ──────────
      if (branchContext) {
        const inventory = await models.ProductInventory.findOne({
          userId: ownerId,
          branchId: branchContext,
          productId: productObjId,
        })

        if (inventory) {
          inventory.stock   += item.quantity
          inventory.lastUpdated = new Date()
          await inventory.save()
        } else {
          await models.ProductInventory.create({
            userId:      ownerId,
            branchId:    branchContext,
            productId:   productObjId,
            stock:       item.quantity,
            reserved:    0,
            lastUpdated: new Date(),
          })
        }

        await models.Product.findByIdAndUpdate(productObjId, {
          stock:     newStock,
          updatedAt: new Date(),
        })
      } else {
        await models.Product.findByIdAndUpdate(productObjId, {
          stock:     newStock,
          updatedAt: new Date(),
        })
      }

      // ── 2. For lot-tracked products: create ProductBatch records ──────────
      const createdBatchIds: Types.ObjectId[] = []

      if (product.trackLots) {
        // Resolve the effective branch — required for ProductBatch
        let effectiveBranchId: string | null = branchContext

        if (!effectiveBranchId) {
          // Single-branch / legacy tenants: find or create default branch
          let defaultBranch = await models.Branch.findOne({ userId: ownerId, isDefault: true })
          if (!defaultBranch) {
            defaultBranch = await models.Branch.create({
              userId:    ownerId,
              name:      'Main Branch',
              code:      'MAIN',
              isDefault: true,
            })
          }
          effectiveBranchId = defaultBranch._id.toString()
        }

        // Build the list of lots to create.
        // If the caller did not supply a lots[] array, auto-create one lot for
        // the entire received quantity.
        const lotsToCreate: Array<{ label: string; quantity: number }> =
          item.lots && item.lots.length > 0
            ? item.lots
            : [{ label: '', quantity: item.quantity }]

        for (let i = 0; i < lotsToCreate.length; i++) {
          const lot = lotsToCreate[i]
          const lotId = generateLotId()

          // Auto-generate a label when the caller left it blank
          const lotLabel = lot.label?.trim()
            || `Lot ${i + 1} — ${new Date().toLocaleDateString()}`

          const batch = await (models as any).ProductBatch.create({
            userId:          ownerId,
            branchId:        new Types.ObjectId(effectiveBranchId),
            productId:       productObjId,
            lotId,
            lotLabel,
            supplierLot:     reference || '',
            quantity:        lot.quantity,
            initialQuantity: lot.quantity,
            reservedQuantity: 0,
            buyingPrice:     item.unitCost,
            supplier:        supplier.name,
            invoiceNumber:   reference || '',
            receivedDate:    new Date(),
            status:          'active',
            notes:           notes || '',
          })

          createdBatchIds.push(batch._id)
          batchesCreated.push({
            productId:  item.productId,
            lotId,
            lotLabel,
            quantity:   lot.quantity,
          })
        }
      }

      // ── 3. Write stock ledger entry ───────────────────────────────────────
      // For lot-tracked products with a single auto-created batch, link the
      // ledger entry to that batch for full traceability.
      const singleBatchId =
        product.trackLots && createdBatchIds.length === 1 ? createdBatchIds[0] : undefined

      await (models as any).StockLedger.create({
        userId:       ownerId,
        branchId:     branchContext ? new Types.ObjectId(branchContext) : null,
        productId:    productObjId,
        staffId:      staffId ? new Types.ObjectId(staffId) : null,
        type:         'STOCK_IN',
        quantity:     item.quantity,
        previousStock,
        newStock,
        supplierId:   new Types.ObjectId(supplierId),
        supplierName: supplier.name,
        unitCost:     item.unitCost,
        totalCost:    item.quantity * item.unitCost,
        reference:    reference || '',
        notes:        notes || '',
        // lot fields — only populated for lot-tracked products
        ...(singleBatchId && { batchId: singleBatchId }),
        timestamp:    new Date(),
      })

      movements.push({
        productId:    item.productId,
        productName:  product.productName,
        quantity:     item.quantity,
        previousStock,
        newStock,
        unitCost:     item.unitCost,
        totalCost:    item.quantity * item.unitCost,
        trackLots:    product.trackLots,
        batchesCreated: createdBatchIds.length,
      })
    }

    return NextResponse.json({
      success: true,
      supplier:     supplier.name,
      reference,
      itemCount:    items.length,
      totalCost,
      movements,
      batchesCreated,
    }, { status: 201 })

  } catch (error) {
    console.error('[inventory/stock-in] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process stock in' },
      { status: 500 }
    )
  }
}
