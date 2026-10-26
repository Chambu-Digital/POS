// POST /api/stock-receipts/[id]/receive
// Links goods received to an existing prepaid (advance) stock receipt.
// Updates the receipt's items and totalCost. Marks it settled.
// Also updates product stock and buyingPrice, same as the normal stock-in flow.

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { Types } from 'mongoose'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null
    const branchContext = await getBranchContext(request)
    const params = await context.params
    const { id } = params

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 })
    }

    const receipt = await (models as any).StockReceipt.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(ownerId),
    })

    if (!receipt) {
      return NextResponse.json({ error: 'Stock receipt not found' }, { status: 404 })
    }

    if (receipt.paymentStatus !== 'prepaid') {
      return NextResponse.json(
        { error: 'Only prepaid receipts can receive goods' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { items, notes, varianceAction } = body
    // varianceAction: 'ignore' | 'record' — what to do if actual cost != advance amount

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Load products
    const productIds = items.map((item: any) => new Types.ObjectId(item.productId))
    const products = await models.Product.find({ _id: { $in: productIds }, userId: ownerId })
    if (products.length !== items.length) {
      return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
    }

    const receiptItems: any[] = []
    let actualTotalCost = 0

    for (const item of items) {
      const productObjId = new Types.ObjectId(item.productId)
      const product = products.find((p: any) => p._id.toString() === item.productId)
      if (!product) continue

      const previousStock = product.stock || 0
      const newStock = previousStock + item.quantity

      // Update stock
      const productUpdate: any = { stock: newStock, updatedAt: new Date() }
      if (item.unitCost > 0) productUpdate.buyingPrice = item.unitCost

      if (branchContext) {
        const inventory = await models.ProductInventory.findOne({
          userId: ownerId,
          branchId: branchContext,
          productId: productObjId,
        })
        if (inventory) {
          inventory.stock += item.quantity
          inventory.lastUpdated = new Date()
          await inventory.save()
        } else {
          await models.ProductInventory.create({
            userId: ownerId,
            branchId: branchContext,
            productId: productObjId,
            stock: item.quantity,
            reserved: 0,
            lastUpdated: new Date(),
          })
        }
      }
      await models.Product.findByIdAndUpdate(productObjId, productUpdate)

      // Write ledger entry
      await (models as any).StockLedger.create({
        userId:       ownerId,
        branchId:     branchContext ? new Types.ObjectId(branchContext) : null,
        productId:    productObjId,
        staffId:      staffId ? new Types.ObjectId(staffId) : null,
        type:         'STOCK_IN',
        quantity:     item.quantity,
        previousStock,
        newStock,
        supplierId:   receipt.supplierId || null,
        supplierName: receipt.supplierName,
        unitCost:     item.unitCost || 0,
        totalCost:    item.quantity * (item.unitCost || 0),
        reference:    receipt.receiptNumber,
        notes:        notes || '',
        timestamp:    new Date(),
      })

      const lineTotal = item.quantity * (item.unitCost || 0)
      actualTotalCost += lineTotal

      const descriptor = [product.brand, product.model, product.variant].filter(Boolean).join(' ')
      receiptItems.push({
        moduleItemId: item.productId,
        module:       'retail',
        itemName:     descriptor ? `${product.productName} (${descriptor})` : product.productName,
        quantity:     item.quantity,
        unitPrice:    item.unitCost || 0,
        lineTotal,
      })
    }

    // Update the receipt with received items and mark settled
    receipt.items = receiptItems
    receipt.totalCost = actualTotalCost
    receipt.paymentStatus = 'paid'
    receipt.notes = [receipt.notes, notes].filter(Boolean).join(' | ')
    receipt.updatedAt = new Date()
    await receipt.save()

    return NextResponse.json({
      success: true,
      receiptNumber: receipt.receiptNumber,
      advancePaid: receipt.paidAt ? receipt.totalCost : 0,
      actualCost: actualTotalCost,
      variance: actualTotalCost - (receipt.totalCost || 0),
    })
  } catch (error: any) {
    console.error('[stock-receipts/receive] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to receive goods', details: error.message },
      { status: 500 }
    )
  }
}
