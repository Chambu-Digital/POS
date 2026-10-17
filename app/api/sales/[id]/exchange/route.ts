// ─── POST /api/sales/[id]/exchange ────────────────────────────────────────────
// Process item exchange: customer returns item + gets new one (possibly with price difference)
// Creates EXCHANGE_IN and EXCHANGE_OUT stock movements

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
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
  
  // Dynamic payment tracking
  paymentMethod?: string
  bankProviderId?: string
  bankProviderName?: string
  customMethodId?: string
  customMethodName?: string
  mpesaCode?: string
  mpesaPhone?: string
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
    const branchContext = await getBranchContext(request)
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
      bankProviderId,
      bankProviderName,
      customMethodId,
      customMethodName,
      mpesaCode,
      mpesaPhone,
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

    // Calculate price difference (positive = customer pays extra, negative = customer gets credit)
    const totalReturnedValue = quantityReturned * returnedPrice
    const totalNewValue = quantityReceived * newPrice
    const priceDifference = totalNewValue - totalReturnedValue

    // CREATE EXCHANGE AS PENDING (no stock changes or customer ledger updates yet)
    const exchangeEntry = {
      returnedProductId: new Types.ObjectId(returnedProductId),
      returnedProductName,
      quantityReturned,
      returnedPrice,
      newProductId: new Types.ObjectId(newProductId),
      newProductName,
      quantityReceived,
      newPrice,
      priceDifference,
      reason: reason.trim(),
      notes: notes?.trim() || '',
      processedBy: staffId ? new Types.ObjectId(staffId) : null,
      processedAt: new Date(),
      status: 'pending', // Awaiting approval
      paymentMethod: paymentMethod || '',
      bankProviderId: bankProviderId || null,
      bankProviderName: bankProviderName || '',
      customMethodId: customMethodId || null,
      customMethodName: customMethodName || '',
      mpesaCode: mpesaCode || '',
      mpesaPhone: mpesaPhone || '',
    }

    const updateData: any = {
      $push: { exchanges: exchangeEntry },
    }

    await models.Sale.findByIdAndUpdate(saleId, updateData)

    return NextResponse.json({
      success: true,
      saleNumber: sale.orderNumber,
      message: 'Exchange request submitted - awaiting approval',
      exchange: {
        returnedProduct: returnedProductName,
        newProduct: newProductName,
        priceDifference,
        status: 'pending',
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
