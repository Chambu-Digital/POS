// ─── /api/inventory/movements ─────────────────────────────────────────────────
// Record manual stock movements (Damage, Wastage, Loss, Expired)
// Creates typed movements in ledger and updates product stock

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

type ManualMovementType = 'DAMAGE' | 'WASTAGE' | 'EXPIRED' | 'LOSS'

const VALID_TYPES: ManualMovementType[] = ['DAMAGE', 'WASTAGE', 'EXPIRED', 'LOSS']

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null
    
    const body = await request.json()
    const { type, productId, quantity, reason, notes } = body

    // Validate required fields
    if (!type || !productId || !quantity || !reason) {
      return NextResponse.json(
        { error: 'Type, product, quantity, and reason are required' },
        { status: 400 }
      )
    }

    // Validate movement type
    if (!VALID_TYPES.includes(type as ManualMovementType)) {
      return NextResponse.json(
        { error: `Invalid movement type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate quantity is positive
    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      )
    }

    // Get product
    const productObjId = new Types.ObjectId(productId)
    const product = await models.Product.findOne({
      _id: productObjId,
      userId: ownerId,
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const previousStock = product.stock || 0

    // Validate sufficient stock
    if (quantity > previousStock) {
      return NextResponse.json(
        { error: `Insufficient stock. Current stock: ${previousStock}, requested: ${quantity}` },
        { status: 400 }
      )
    }

    const newStock = previousStock - quantity

    // Update product stock
    await models.Product.findByIdAndUpdate(
      productObjId,
      {
        stock: newStock,
        updatedAt: new Date(),
      }
    )

    // Create movement entry (quantity is negative for stock reduction)
    const movement = await (models as any).StockLedger.create({
      userId: ownerId,
      productId: productObjId,
      staffId: staffId ? new Types.ObjectId(staffId) : null,
      type,
      quantity: -quantity, // negative because stock is being reduced
      previousStock,
      newStock,
      reason: reason.trim(),
      notes: notes?.trim() || '',
      timestamp: new Date(),
    })

    return NextResponse.json({
      success: true,
      movement: {
        _id: movement._id,
        type,
        productName: product.productName,
        quantity,
        previousStock,
        newStock,
        reason,
      },
    }, { status: 201 })

  } catch (error) {
    console.error('[inventory/movements] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record movement' },
      { status: 500 }
    )
  }
}
