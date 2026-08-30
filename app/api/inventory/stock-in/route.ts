// ─── /api/inventory/stock-in ──────────────────────────────────────────────────
// Receive stock from suppliers
// Creates STOCK_IN movements in ledger and updates product stock

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

interface StockInItem {
  productId: string
  quantity: number
  unitCost: number
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.type === 'staff' ? payload.userId : null
    
    const body = await request.json()
    const { supplierId, reference, notes, items } = body

    // Validate required fields
    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Supplier and at least one item are required' },
        { status: 400 }
      )
    }

    // Validate supplier exists
    const supplier = await models.Supplier.findOne({
      _id: supplierId,
      userId: ownerId,
      isActive: true,
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Validate all products exist
    const productIds = items.map((item: StockInItem) => new Types.ObjectId(item.productId))
    const products = await models.Product.find({
      _id: { $in: productIds },
      userId: ownerId,
    })
    if (products.length !== items.length) {
      return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
    }

    // Process each item
    const movements = []
    const totalCost = items.reduce((sum: number, item: StockInItem) => 
      sum + (item.quantity * item.unitCost), 0
    )

    for (const item of items) {
      const productObjId = new Types.ObjectId(item.productId)
      
      // Get current product for stock tracking
      const product = await models.Product.findById(productObjId)
      if (!product) continue

      const previousStock = product.stock || 0
      const newStock = previousStock + item.quantity

      // Update product stock
      await models.Product.findByIdAndUpdate(
        productObjId,
        {
          stock: newStock,
          updatedAt: new Date(),
        }
      )

      // Create stock ledger entry
      const movement = await (models as any).StockLedger.create({
        userId: ownerId,
        productId: productObjId,
        staffId: staffId ? new Types.ObjectId(staffId) : null,
        type: 'STOCK_IN',
        quantity: item.quantity,
        previousStock,
        newStock,
        supplierId: new Types.ObjectId(supplierId),
        supplierName: supplier.name,
        unitCost: item.unitCost,
        totalCost: item.quantity * item.unitCost,
        reference: reference || '',
        notes: notes || '',
        timestamp: new Date(),
      })

      movements.push({
        productId: item.productId,
        productName: product.productName,
        quantity: item.quantity,
        previousStock,
        newStock,
        unitCost: item.unitCost,
        totalCost: item.quantity * item.unitCost,
      })
    }

    return NextResponse.json({
      success: true,
      supplier: supplier.name,
      reference,
      itemCount: items.length,
      totalCost,
      movements,
    }, { status: 201 })

  } catch (error) {
    console.error('[inventory/stock-in] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process stock in' },
      { status: 500 }
    )
  }
}
