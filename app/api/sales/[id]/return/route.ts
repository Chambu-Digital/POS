// ─── POST /api/sales/[id]/return ──────────────────────────────────────────────
// Process item returns from a sale
// Creates RETURN or DAMAGE movements based on item condition

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

interface ReturnItem {
  productId: string
  productName: string
  quantity: number
  price: number
  condition: 'resellable' | 'damaged'
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null

    const body = await request.json()
    const { items, reason, notes } = body as {
      items: ReturnItem[]
      reason: string
      notes?: string
    }

    // Validate
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Return reason is required' }, { status: 400 })
    }

    // Get sale
    const saleId = new Types.ObjectId(params.id)
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Process returns
    const processedItems: any[] = []
    
    for (const returnItem of items) {
      if (!returnItem.productId || returnItem.quantity <= 0) continue

      const productObjId = new Types.ObjectId(returnItem.productId)
      
      // Get current product stock
      const product = await models.Product.findOne({
        _id: productObjId,
        userId: ownerId,
      })

      if (!product) {
        console.warn(`[return] Product ${returnItem.productId} not found, skipping`)
        continue
      }

      const previousStock = product.stock || 0
      let newStock = previousStock
      let movementType = ''

      if (returnItem.condition === 'resellable') {
        // Return to inventory
        newStock = previousStock + returnItem.quantity
        movementType = 'RETURN'
        
        // Update product stock
        await models.Product.findByIdAndUpdate(
          productObjId,
          {
            stock: newStock,
            updatedAt: new Date(),
          }
        )
      } else if (returnItem.condition === 'damaged') {
        // Do not restock - record as damage
        newStock = previousStock // no change
        movementType = 'DAMAGE'
      }

      // Create movement entry
      await (models as any).StockLedger.create({
        userId: ownerId,
        productId: productObjId,
        saleId: saleId,
        staffId: staffId ? new Types.ObjectId(staffId) : null,
        type: movementType,
        quantity: returnItem.condition === 'resellable' ? returnItem.quantity : -returnItem.quantity,
        previousStock,
        newStock,
        orderNumber: sale.orderNumber,
        reason: reason.trim(),
        notes: notes?.trim() || `Returned from ${sale.orderNumber}`,
        timestamp: new Date(),
      })

      processedItems.push({
        productName: returnItem.productName,
        quantity: returnItem.quantity,
        condition: returnItem.condition,
        restocked: returnItem.condition === 'resellable',
      })
    }

    // Update sale status to refunded (or partially refunded if needed)
    await models.Sale.findByIdAndUpdate(saleId, {
      status: 'refunded',
      updatedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      saleNumber: sale.orderNumber,
      itemsReturned: processedItems.length,
      items: processedItems,
    }, { status: 200 })

  } catch (error) {
    console.error('[sales/[id]/return] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process return' },
      { status: 500 }
    )
  }
}
