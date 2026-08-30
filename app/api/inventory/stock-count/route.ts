// ─── /api/inventory/stock-count ───────────────────────────────────────────────
// Physical inventory count and automatic adjustments
// Compares system stock vs physical count and creates ADJUSTMENT movements

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

interface CountItem {
  productId: string
  systemStock: number
  physicalStock: number
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null
    
    const body = await request.json()
    const { counts, reason, notes } = body

    // Validate
    if (!counts || counts.length === 0) {
      return NextResponse.json(
        { error: 'At least one product count is required' },
        { status: 400 }
      )
    }

    // Process adjustments for products with differences
    const adjustments = []
    const movements = []
    let totalDifference = 0

    for (const count of counts) {
      const difference = count.physicalStock - count.systemStock
      
      // Skip if no difference
      if (difference === 0) continue

      totalDifference += Math.abs(difference)
      const productObjId = new Types.ObjectId(count.productId)

      // Get product details
      const product = await models.Product.findById(productObjId)
      if (!product) continue

      // Update product stock to physical count
      await models.Product.findByIdAndUpdate(
        productObjId,
        {
          stock: count.physicalStock,
          updatedAt: new Date(),
        }
      )

      // Create adjustment movement
      const movement = await (models as any).StockLedger.create({
        userId: ownerId,
        productId: productObjId,
        staffId: staffId ? new Types.ObjectId(staffId) : null,
        type: 'ADJUSTMENT',
        quantity: difference, // can be positive or negative
        previousStock: count.systemStock,
        newStock: count.physicalStock,
        reason: reason || 'Stock count adjustment',
        notes: notes || '',
        timestamp: new Date(),
      })

      adjustments.push({
        productId: count.productId,
        productName: product.productName,
        systemStock: count.systemStock,
        physicalStock: count.physicalStock,
        difference,
      })

      movements.push(movement)
    }

    // If no adjustments needed
    if (adjustments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All counts match system stock. No adjustments needed.',
        adjustments: [],
      })
    }

    return NextResponse.json({
      success: true,
      message: `Stock count complete. ${adjustments.length} adjustments made.`,
      adjustmentCount: adjustments.length,
      totalDifference,
      adjustments,
    }, { status: 201 })

  } catch (error) {
    console.error('[inventory/stock-count] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process stock count' },
      { status: 500 }
    )
  }
}
