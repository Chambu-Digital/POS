// ─── POST /api/sales/[id]/exchange ────────────────────────────────────────────
// Process item exchange: customer returns item + gets new one (possibly with price difference)
// Creates EXCHANGE_IN and EXCHANGE_OUT stock movements

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

interface ExchangeRequest {
  returnedProductId: string
  returnedProductName: string
  quantityReturned: number
  returnedPrice: number
  
  newProductId: string
  newProductName: string
  quantityReceived: number
  newPrice: number
  
  reason: string
  notes?: string
  paymentMethod?: 'cash' | 'credit'  // how price difference is handled
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null

    const { id } = await params

    let body: ExchangeRequest
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const {
      returnedProductId,
      returnedProductName,
      quantityReturned,
      returnedPrice,
      newProductId,
      newProductName,
      quantityReceived,
      newPrice,
      reason,
      notes,
      paymentMethod,
    } = body

    // Validate inputs
    if (!returnedProductId || quantityReturned <= 0) {
      return NextResponse.json({ error: 'Invalid returned product data' }, { status: 400 })
    }

    if (!newProductId || quantityReceived <= 0) {
      return NextResponse.json({ error: 'Invalid new product data' }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Exchange reason is required' }, { status: 400 })
    }

    // Get sale
    const saleId = new Types.ObjectId(id)
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    const returnedProductObjId = new Types.ObjectId(returnedProductId)
    const newProductObjId = new Types.ObjectId(newProductId)

    // Verify returned product exists
    const returnedProduct = await models.Product.findOne({
      _id: returnedProductObjId,
      userId: ownerId,
    })

    if (!returnedProduct) {
      return NextResponse.json({ error: 'Returned product not found' }, { status: 404 })
    }

    // Verify new product exists and has stock
    const newProduct = await models.Product.findOne({
      _id: newProductObjId,
      userId: ownerId,
    })

    if (!newProduct) {
      return NextResponse.json({ error: 'New product not found' }, { status: 404 })
    }

    const newProductCurrentStock = newProduct.stock || 0
    if (newProductCurrentStock < quantityReceived) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${newProductCurrentStock}` },
        { status: 400 }
      )
    }

    // ── PROCESS EXCHANGE ─────────────────────────────────────────────────────

    // Calculate price difference (positive = customer pays extra, negative = customer gets credit)
    const totalReturnedValue = quantityReturned * returnedPrice
    const totalNewValue = quantityReceived * newPrice
    const priceDifference = totalNewValue - totalReturnedValue

    // Update stock for returned product (add back to inventory)
    const returnedPrevStock = returnedProduct.stock || 0
    const returnedNewStock = returnedPrevStock + quantityReturned

    await models.Product.findByIdAndUpdate(
      returnedProductObjId,
      {
        stock: returnedNewStock,
        updatedAt: new Date(),
      }
    )

    // Update stock for new product (remove from inventory)
    const newPrevStock = newProductCurrentStock
    const newNewStock = newPrevStock - quantityReceived

    await models.Product.findByIdAndUpdate(
      newProductObjId,
      {
        stock: newNewStock,
        updatedAt: new Date(),
      }
    )

    // ── CREATE STOCK LEDGER ENTRIES ──────────────────────────────────────────

    // EXCHANGE_IN: returned product back into stock
    await (models as any).StockLedger.create({
      userId: ownerId,
      productId: returnedProductObjId,
      saleId: saleId,
      staffId: staffId ? new Types.ObjectId(staffId) : null,
      type: 'EXCHANGE_IN',
      quantity: quantityReturned,
      previousStock: returnedPrevStock,
      newStock: returnedNewStock,
      orderNumber: sale.orderNumber,
      reason: reason.trim(),
      notes: notes?.trim() || `Exchanged for ${newProductName}`,
      timestamp: new Date(),
    })

    // EXCHANGE_OUT: new product sold out
    await (models as any).StockLedger.create({
      userId: ownerId,
      productId: newProductObjId,
      saleId: saleId,
      staffId: staffId ? new Types.ObjectId(staffId) : null,
      type: 'EXCHANGE_OUT',
      quantity: -quantityReceived,
      previousStock: newPrevStock,
      newStock: newNewStock,
      orderNumber: sale.orderNumber,
      reason: reason.trim(),
      notes: notes?.trim() || `Exchanged from ${returnedProductName}`,
      timestamp: new Date(),
    })

    // ── HANDLE CUSTOMER DEBT/PAYMENT ─────────────────────────────────────────

    if (sale.customerId && priceDifference !== 0) {
      const customer = await models.Customer.findById(sale.customerId)

      if (customer) {
        if (priceDifference > 0) {
          // Customer pays extra (or if using credit, add to their debt)
          if (paymentMethod === 'credit') {
            customer.creditBalance = (customer.creditBalance || 0) + priceDifference
            customer.ledger.push({
              date: new Date(),
              type: 'purchase',
              amount: priceDifference,
              balance: customer.creditBalance,
              saleId: saleId,
              note: `Exchange surcharge: ${returnedProductName} → ${newProductName}`,
            })
          }
          // If paymentMethod is 'cash', staff handles collection at UI level
        } else {
          // Customer receives credit (negative difference)
          const creditAmount = Math.abs(priceDifference)
          customer.creditBalance = (customer.creditBalance || 0) - creditAmount
          customer.ledger.push({
            date: new Date(),
            type: 'payment',
            amount: -creditAmount,
            balance: customer.creditBalance,
            saleId: saleId,
            note: `Exchange credit: ${returnedProductName} → ${newProductName}`,
          })
        }

        await customer.save()
      }
    }

    // ── UPDATE SALE DOCUMENT ─────────────────────────────────────────────────

    const exchangeEntry = {
      returnedProductId: returnedProductObjId,
      returnedProductName,
      quantityReturned,
      returnedPrice,
      newProductId: newProductObjId,
      newProductName,
      quantityReceived,
      newPrice,
      priceDifference,
      reason: reason.trim(),
      notes: notes?.trim() || '',
      processedBy: staffId ? new Types.ObjectId(staffId) : null,
      processedAt: new Date(),
    }

    const updateData: any = {
      $push: { exchanges: exchangeEntry },
      $inc: { totalExchanged: priceDifference },
      $set: {
        status: 'exchanged',
        updatedAt: new Date(),
      },
    }

    await models.Sale.findByIdAndUpdate(saleId, updateData)

    return NextResponse.json({
      success: true,
      saleNumber: sale.orderNumber,
      exchange: {
        returnedProduct: returnedProductName,
        newProduct: newProductName,
        priceDifference,
        priceDifferenceLabel: priceDifference > 0 ? `+${priceDifference}` : `${priceDifference}`,
      },
    }, { status: 200 })

  } catch (error) {
    console.error('[sales/[id]/exchange] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process exchange' },
      { status: 500 }
    )
  }
}
