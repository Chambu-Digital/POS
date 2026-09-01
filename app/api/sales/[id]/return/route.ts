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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null

    // Await params before accessing properties
    const { id } = await params

    // Parse request body with error handling
    let body: {
      items: ReturnItem[]
      reason: string
      notes?: string
    }
    
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { items, reason, notes } = body

    // Validate
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Return reason is required' }, { status: 400 })
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

    // Process returns
    const processedItems: any[] = []
    const returnEntries: any[] = []
    
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

      // Build return entry for sale document
      returnEntries.push({
        productId: productObjId,
        productName: returnItem.productName,
        quantity: returnItem.quantity,
        price: returnItem.price,
        condition: returnItem.condition,
        reason: reason.trim(),
        notes: notes?.trim() || '',
        returnedBy: staffId ? new Types.ObjectId(staffId) : null,
        returnedAt: new Date(),
      })

      processedItems.push({
        productName: returnItem.productName,
        quantity: returnItem.quantity,
        condition: returnItem.condition,
        restocked: returnItem.condition === 'resellable',
      })
    }

    // Calculate total returned value
    const totalReturnedValue = returnEntries.reduce((sum, entry) => {
      return sum + (entry.quantity * entry.price)
    }, 0)

    // Determine if this is a full or partial return
    const totalOriginalQuantity = sale.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const totalReturnedQuantity = returnEntries.reduce((sum, entry) => sum + entry.quantity, 0)
    const isFullyReturned = totalReturnedQuantity >= totalOriginalQuantity

    // Append returns to sale and update status
    const updateData: any = {
      $push: { returns: { $each: returnEntries } },
      $inc: { totalReturned: totalReturnedValue },
      $set: {
        isPartiallyReturned: !isFullyReturned,
        isFullyReturned: isFullyReturned,
        status: isFullyReturned ? 'refunded' : 'partially_refunded',
        updatedAt: new Date(),
      },
    }

    await models.Sale.findByIdAndUpdate(saleId, updateData)

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
