import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { generateRFQ, generateRFQNumber } from '@/lib/restocking/po-generator'
import type { BasketItem } from '@/lib/restocking/basket'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await request.json()
    const { basketItems, notes } = body as {
      basketItems: BasketItem[]
      notes?: string
    }

    if (!basketItems || basketItems.length === 0) {
      return NextResponse.json(
        { error: 'Basket is empty' },
        { status: 400 }
      )
    }

    // Generate single RFQ (no supplier grouping)
    const rfqTemplate = generateRFQ(basketItems, notes || '')

    // Get last record number for this user
    const lastRecord = await models.PurchaseOrder
      .findOne({ userId: ownerId })
      .sort({ createdAt: -1 })
      .select('poNumber')
      .lean()

    const rfqNumber = generateRFQNumber(lastRecord?.poNumber || null)

    // Create the RFQ document
    const rfq = new models.PurchaseOrder({
      userId: ownerId,
      poNumber: rfqNumber,
      supplierId: rfqTemplate.supplierId,
      supplierName: rfqTemplate.supplierName,
      status: 'draft',
      items: rfqTemplate.items,
      subtotal: rfqTemplate.subtotal,
      total: rfqTemplate.total,
      notes: rfqTemplate.notes,
      createdBy: payload.userId
    })

    await rfq.save()

    // Return the created RFQ with stringified IDs for client use
    const serializedRFQ = {
      ...rfq.toObject(),
      _id: rfq._id.toString(),
      userId: rfq.userId.toString(),
      supplierId: rfq.supplierId?.toString() || null,
      createdBy: rfq.createdBy?.toString() || null
    }

    return NextResponse.json({
      success: true,
      rfq: serializedRFQ
    })
  } catch (error: any) {
    console.error('Create RFQ error:', error)
    return NextResponse.json(
      { error: 'Failed to create RFQ', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const purchaseOrders = await models.PurchaseOrder
      .find({ userId: ownerId })
      .sort({ createdAt: -1 })
      .lean()
      .then(docs => docs.map(doc => ({
        ...doc,
        _id: doc._id.toString(),
        userId: doc.userId.toString(),
        supplierId: doc.supplierId?.toString() || null,
        createdBy: doc.createdBy?.toString() || null
      })))

    return NextResponse.json({ purchaseOrders })
  } catch (error: any) {
    console.error('List RFQs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch RFQs', details: error.message },
      { status: 500 }
    )
  }
}
