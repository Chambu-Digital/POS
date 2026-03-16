import { connectDB } from '@/lib/db'
import Rental from '@/lib/models/Rental'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Auto-mark overdue (active rentals older than 24h with no endTime - configurable)
    await Rental.updateMany(
      {
        userId: ownerId,
        status: 'active',
        startTime: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      { $set: { status: 'overdue' } }
    )

    const rentals = await Rental.find({ userId: ownerId }).sort({ createdAt: -1 })
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

    await connectDB()
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Check stock
    for (const item of data.items) {
      const product = await Product.findById(new Types.ObjectId(item.productId))
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productName}` }, { status: 404 })
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.productName}. Available: ${product.stock}` },
          { status: 400 }
        )
      }
    }

    // Deduct stock
    for (const item of data.items) {
      await Product.findByIdAndUpdate(
        new Types.ObjectId(item.productId),
        { $inc: { stock: -item.quantity } }
      )
    }

    const rental = new Rental({
      customer: data.customer,
      items: data.items,
      startTime: data.startTime || new Date(),
      deposit: data.deposit || 0,
      depositPaymentMethod: data.depositPaymentMethod || '',
      status: 'active',
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
      notes: data.notes,
    })

    await rental.save()
    return NextResponse.json({ rental }, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create rental'
    console.error('[Rentals] POST error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
