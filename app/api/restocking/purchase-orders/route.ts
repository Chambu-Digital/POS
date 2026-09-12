import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { generatePurchaseOrders, generatePONumber } from '@/lib/restocking/po-generator'
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
    const { basketItems, notes, restockPlanId } = body as {
      basketItems: BasketItem[]
      notes?: string
      restockPlanId?: string
    }

    if (!basketItems || basketItems.length === 0) {
      return NextResponse.json(
        { error: 'Basket is empty' },
        { status: 400 }
      )
    }

    // Generate POs grouped by supplier
    const poTemplates = generatePurchaseOrders(basketItems, notes || '')

    // Get last PO number for this user
    const lastPO = await models.PurchaseOrder
      .findOne({ userId: ownerId })
      .sort({ createdAt: -1 })
      .select('poNumber')
      .lean()

    let currentPONumber = lastPO?.poNumber || null
    const createdPOs = []

    // Create PO documents
    for (const poTemplate of poTemplates) {
      currentPONumber = generatePONumber(currentPONumber)

      const po = new models.PurchaseOrder({
        userId: ownerId,
        poNumber: currentPONumber,
        supplierId: poTemplate.supplierId,
        supplierName: poTemplate.supplierName,
        status: 'draft',
        items: poTemplate.items,
        subtotal: poTemplate.subtotal,
        total: poTemplate.total,
        notes: poTemplate.notes,
        createdBy: payload.userId
      })

      await po.save()
      createdPOs.push(po)
    }

    // If this was from a restock plan, link the POs
    if (restockPlanId) {
      await models.RestockPlan.findByIdAndUpdate(restockPlanId, {
        $push: { purchaseOrderIds: { $each: createdPOs.map(po => po._id) } }
      })
    }

    return NextResponse.json({
      success: true,
      purchaseOrders: createdPOs,
      count: createdPOs.length
    })
  } catch (error: any) {
    console.error('Create PO error:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase orders', details: error.message },
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')

    const query: any = { userId: ownerId }
    if (status) query.status = status
    if (supplierId) query.supplierId = supplierId

    const purchaseOrders = await models.PurchaseOrder
      .find(query)
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
    console.error('List POs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders', details: error.message },
      { status: 500 }
    )
  }
}
