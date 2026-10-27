// POST /api/stock-receipts/[id]/receive
// Links goods received to an existing prepaid (advance) stock receipt.
// Updates the receipt's items and totalCost. Marks it settled.
// Handles variance between advance amount and actual goods cost:
//   - shortfall (actual > advance): varianceAction = 'payable' | 'pay_now'
//   - surplus  (actual < advance): varianceAction = 'refund'   | 'credit'
//
// Body:
// {
//   items: [{ productId, quantity, unitCost }],
//   notes?: string,
//   varianceAction?: 'none' | 'payable' | 'pay_now' | 'refund' | 'credit',
//   variancePaymentMethod?: string,   // for pay_now / refund
//   varianceBankProviderId?: string,
//   varianceBankProviderName?: string,
//   varianceCustomMethodId?: string,
//   varianceCustomMethodName?: string,
//   variancePaymentReference?: string,
// }

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { Types } from 'mongoose'

function generateReceiptNumber(lastNumber: string | null): string {
  const currentYear = new Date().getFullYear()
  if (!lastNumber) return `SR-${currentYear}-0001`
  const match = lastNumber.match(/^SR-(\d{4})-(\d+)$/)
  if (!match) return `SR-${currentYear}-0001`
  const lastYear = parseInt(match[1])
  const lastNum  = parseInt(match[2])
  if (lastYear < currentYear) return `SR-${currentYear}-0001`
  return `SR-${currentYear}-${(lastNum + 1).toString().padStart(4, '0')}`
}

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
    const {
      items,
      notes,
      varianceAction = 'none',
      variancePaymentMethod,
      varianceBankProviderId,
      varianceBankProviderName,
      varianceCustomMethodId,
      varianceCustomMethodName,
      variancePaymentReference,
    } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // ── Capture advance amount BEFORE we overwrite receipt.totalCost ──────────
    const advancePaid = receipt.totalCost as number

    // ── Load products ─────────────────────────────────────────────────────────
    const productIds = items.map((item: any) => new Types.ObjectId(item.productId))
    const products = await models.Product.find({ _id: { $in: productIds }, userId: ownerId })
    if (products.length !== items.length) {
      return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
    }

    const receiptItems: any[] = []
    let actualTotalCost = 0

    // ── Process each line item ────────────────────────────────────────────────
    for (const item of items) {
      const productObjId = new Types.ObjectId(item.productId)
      const product = products.find((p: any) => p._id.toString() === item.productId)
      if (!product) continue

      const previousStock = product.stock || 0
      const newStock = previousStock + item.quantity

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

    // ── Settle the original advance receipt ───────────────────────────────────
    const variance = actualTotalCost - advancePaid // positive = shortfall, negative = surplus

    receipt.items        = receiptItems
    receipt.totalCost    = actualTotalCost
    receipt.paymentStatus = 'paid'
    receipt.notes        = [receipt.notes, notes].filter(Boolean).join(' | ')
    receipt.updatedAt    = new Date()
    await receipt.save()

    // ── Handle variance ───────────────────────────────────────────────────────
    let varianceReceiptNumber: string | null = null

    if (Math.abs(variance) > 0.01 && varianceAction !== 'none') {

      const lastReceipt = await (models as any).StockReceipt
        .findOne({ userId: ownerId })
        .sort({ createdAt: -1 })
        .select('receiptNumber')
        .lean() as any
      const newReceiptNumber = generateReceiptNumber(lastReceipt?.receiptNumber || null)
      varianceReceiptNumber = newReceiptNumber

      if (variance > 0) {
        // ── SHORTFALL: actual cost > advance ─────────────────────────────────
        // payable  → new unpaid receipt for the shortfall
        // pay_now  → new paid receipt for the shortfall (paid with given method)
        await (models as any).StockReceipt.create({
          userId:           ownerId,
          branchId:         branchContext ? new Types.ObjectId(branchContext) : null,
          receiptNumber:    newReceiptNumber,
          date:             new Date(),
          supplierId:       receipt.supplierId || null,
          supplierName:     receipt.supplierName,
          reference:        receipt.receiptNumber, // links back to parent receipt
          items:            [],  // variance — no new items (goods already on parent)
          totalCost:        variance,
          paymentStatus:    varianceAction === 'pay_now' ? 'paid' : 'unpaid',
          paymentMethod:    varianceAction === 'pay_now' ? (variancePaymentMethod || '') : '',
          bankProviderId:   varianceAction === 'pay_now' && varianceBankProviderId
                              ? new Types.ObjectId(varianceBankProviderId) : null,
          bankProviderName: varianceAction === 'pay_now' ? (varianceBankProviderName || '') : '',
          customMethodId:   varianceAction === 'pay_now' && varianceCustomMethodId
                              ? new Types.ObjectId(varianceCustomMethodId) : null,
          customMethodName: varianceAction === 'pay_now' ? (varianceCustomMethodName || '') : '',
          paymentReference: varianceAction === 'pay_now' ? (variancePaymentReference || '') : '',
          paidAt:           varianceAction === 'pay_now' ? new Date() : null,
          notes:            `Shortfall against advance ${receipt.receiptNumber}`,
          createdBy:        staffId ? new Types.ObjectId(staffId) : new Types.ObjectId(ownerId),
          createdByModel:   payload.type === 'staff' ? 'Staff' : 'User',
        })

      } else {
        // ── SURPLUS: actual cost < advance (supplier owes us) ─────────────────
        const surplusAmount = Math.abs(variance)

        // refund  → supplier returned cash (record as a negative-cost receipt
        //           with paymentStatus='paid' to reflect cash came back in)
        // credit  → leave with supplier; store on the advance receipt as a note
        //           so it's visible but not yet collected
        if (varianceAction === 'refund') {
          await (models as any).StockReceipt.create({
            userId:           ownerId,
            branchId:         branchContext ? new Types.ObjectId(branchContext) : null,
            receiptNumber:    newReceiptNumber,
            date:             new Date(),
            supplierId:       receipt.supplierId || null,
            supplierName:     receipt.supplierName,
            reference:        receipt.receiptNumber,
            items:            [],
            totalCost:        -surplusAmount, // negative = money came back in
            paymentStatus:    'paid',
            paymentMethod:    variancePaymentMethod || '',
            bankProviderId:   varianceBankProviderId ? new Types.ObjectId(varianceBankProviderId) : null,
            bankProviderName: varianceBankProviderName || '',
            customMethodId:   varianceCustomMethodId ? new Types.ObjectId(varianceCustomMethodId) : null,
            customMethodName: varianceCustomMethodName || '',
            paymentReference: variancePaymentReference || '',
            paidAt:           new Date(),
            notes:            `Refund of surplus from advance ${receipt.receiptNumber}`,
            createdBy:        staffId ? new Types.ObjectId(staffId) : new Types.ObjectId(ownerId),
            createdByModel:   payload.type === 'staff' ? 'Staff' : 'User',
          })
        } else if (varianceAction === 'credit') {
          // Append credit note to the settled advance receipt
          const creditNote = `Supplier credit KES ${surplusAmount.toLocaleString()} — leave with ${receipt.supplierName} for next order`
          receipt.notes = [receipt.notes, creditNote].filter(Boolean).join(' | ')
          await receipt.save()
        }
      }
    }

    return NextResponse.json({
      success: true,
      receiptNumber:        receipt.receiptNumber,
      advancePaid,
      actualCost:           actualTotalCost,
      variance,
      varianceAction,
      varianceReceiptNumber,
    })
  } catch (error: any) {
    console.error('[stock-receipts/receive] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to receive goods', details: error.message },
      { status: 500 }
    )
  }
}
