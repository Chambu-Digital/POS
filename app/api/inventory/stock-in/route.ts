// ─── /api/inventory/stock-in ──────────────────────────────────────────────────
// Receive stock from suppliers.
// Creates STOCK_IN movements in ledger, updates product stock + buyingPrice,
// and creates a StockReceipt document for cost + payment tracking.
// For products with trackLots=true, also creates individual ProductBatch records.

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
  lots?: Array<{
    label: string
    quantity: number
  }>
}

/** Generates a unique lot identifier: LOT-YYMMDD-XXXX */
function generateLotId(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '') // YYMMDD
  const rand    = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LOT-${dateStr}-${rand}`
}

/** Generates a sequential receipt number: SR-YYYY-NNNN */
function generateReceiptNumber(lastNumber: string | null): string {
  const currentYear = new Date().getFullYear()
  if (!lastNumber) return `SR-${currentYear}-0001`
  const match = lastNumber.match(/^SR-(\d{4})-(\d+)$/)
  if (!match) return `SR-${currentYear}-0001`
  const lastYear = parseInt(match[1])
  const lastNum = parseInt(match[2])
  if (lastYear < currentYear) return `SR-${currentYear}-0001`
  return `SR-${currentYear}-${(lastNum + 1).toString().padStart(4, '0')}`
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
    const {
      supplierId,
      reference,
      notes,
      items,
      paymentStatus = 'paid',
      paymentMethod = '',
      bankProviderId = '',
      bankProviderName = '',
      customMethodId = '',
      customMethodName = '',
      paymentReference = '',
    } = body

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
    const receiptItems: any[] = []
    const totalCost = items.reduce(
      (sum: number, item: StockInItem) => sum + item.quantity * item.unitCost, 0
    )

    for (const item of items) {
      const productObjId = new Types.ObjectId(item.productId)
      const product      = products.find((p: any) => p._id.toString() === item.productId)
      if (!product) continue

      const previousStock = product.stock || 0
      const newStock      = previousStock + item.quantity

      // ── 1. Update stock + buyingPrice ────────────────────────────────────
      const productUpdate: any = {
        stock: newStock,
        updatedAt: new Date(),
      }
      // Update buyingPrice to the actual cost paid (if > 0)
      if (item.unitCost > 0) {
        productUpdate.buyingPrice = item.unitCost
      }

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

        await models.Product.findByIdAndUpdate(productObjId, productUpdate)
      } else {
        await models.Product.findByIdAndUpdate(productObjId, productUpdate)
      }

      // ── 2. For lot-tracked products: create ProductBatch records ──────────
      const createdBatchIds: Types.ObjectId[] = []

      if (product.trackLots) {
        let effectiveBranchId: string | null = branchContext

        if (!effectiveBranchId) {
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

        const lotsToCreate: Array<{ label: string; quantity: number }> =
          item.lots && item.lots.length > 0
            ? item.lots
            : [{ label: '', quantity: item.quantity }]

        for (let i = 0; i < lotsToCreate.length; i++) {
          const lot = lotsToCreate[i]
          const lotId = generateLotId()

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
        ...(singleBatchId && { batchId: singleBatchId }),
        timestamp:    new Date(),
      })

      // ── 4. Collect receipt line item ─────────────────────────────────────
      const itemBatchId = createdBatchIds.length === 1 ? createdBatchIds[0] : undefined

      // Build descriptive item name with brand/model/variant
      const descriptor = [product.brand, product.model, product.variant]
        .filter(Boolean).join(' ')
      const itemDisplayName = descriptor
        ? `${product.productName} (${descriptor})`
        : product.productName

      receiptItems.push({
        moduleItemId: item.productId,
        module:       'retail',
        itemName:     itemDisplayName,
        quantity:     item.quantity,
        unitPrice:    item.unitCost,
        lineTotal:    item.quantity * item.unitCost,
        ...(itemBatchId && { batchId: itemBatchId }),
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

    // ── Create StockReceipt ──────────────────────────────────────────────────
    const lastReceipt = await (models as any).StockReceipt
      .findOne({ userId: ownerId })
      .sort({ createdAt: -1 })
      .select('receiptNumber')
      .lean()

    const receiptNumber = generateReceiptNumber(lastReceipt?.receiptNumber || null)

    const receipt = await (models as any).StockReceipt.create({
      userId:          ownerId,
      branchId:        branchContext ? new Types.ObjectId(branchContext) : null,
      receiptNumber,
      date:            new Date(),
      supplierId:      new Types.ObjectId(supplierId),
      supplierName:    supplier.name,
      reference:       reference || '',
      items:           receiptItems,
      totalCost,
      paymentStatus,
      paymentMethod,
      bankProviderId:  bankProviderId ? new Types.ObjectId(bankProviderId) : null,
      bankProviderName: bankProviderName || '',
      customMethodId:  customMethodId ? new Types.ObjectId(customMethodId) : null,
      customMethodName: customMethodName || '',
      paymentReference,
      paidAt:          paymentStatus === 'paid' ? new Date() : null,
      notes:           notes || '',
      createdBy:       staffId ? new Types.ObjectId(staffId) : new Types.ObjectId(ownerId),
      createdByModel:  payload.type === 'staff' ? 'Staff' : 'User',
    })

    return NextResponse.json({
      success: true,
      supplier:     supplier.name,
      reference,
      itemCount:    items.length,
      totalCost,
      movements,
      batchesCreated,
      receiptNumber,
      receiptId:    receipt._id.toString(),
      paymentStatus,
    }, { status: 201 })

  } catch (error) {
    console.error('[inventory/stock-in] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process stock in' },
      { status: 500 }
    )
  }
}
