import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    await models.Rental.updateMany(
      { userId: ownerId, status: 'active', startTime: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      { $set: { status: 'overdue' } }
    )

    const rentals = await models.Rental.find({ userId: ownerId }).sort({ createdAt: -1 })
    return NextResponse.json({ rentals })
  } catch (error) {
    console.error('[Rentals] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch rentals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    for (const item of data.items) {
      if (!item.productId || item.productId.toString().startsWith('demo_')) continue
      const product = await models.Product.findById(new Types.ObjectId(item.productId))
      if (!product) return NextResponse.json({ error: `Product not found: ${item.productName}` }, { status: 404 })
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.productName}. Available: ${product.stock}` }, { status: 400 })
      }
    }

    for (const item of data.items) {
      if (!item.productId || item.productId.toString().startsWith('demo_')) continue
      await models.Product.findByIdAndUpdate(new Types.ObjectId(item.productId), { $inc: { stock: -item.quantity } })
    }

    const rental = new models.Rental({
      customer: data.customer, items: data.items,
      startTime: data.startTime || new Date(),
      deposit: data.deposit || 0, depositPaymentMethod: data.depositPaymentMethod || '',
      status: 'active', userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
      notes: data.notes,
    })
    await rental.save()
    return NextResponse.json({ rental }, { status: 201 })
  } catch (error) {
    console.error('[Rentals] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create rental' }, { status: 500 })
  }
}
