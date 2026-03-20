import { connectDB } from '@/lib/db'
import Sale from '@/lib/models/Sale'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const sales = await Sale.find({ userId: ownerId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'items.productId',
        select: 'productName',
      })
      .lean()

    return NextResponse.json({ sales })
  } catch (error) {
    console.error('[v0] Sales GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const data = await request.json()

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Update product stock
    for (const item of data.items) {
      await Product.findByIdAndUpdate(
        new Types.ObjectId(item.productId),
        { $inc: { stock: -item.quantity } }
      )
    }

    const sale = new Sale({
      ...data,
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
    })

    await sale.save()

    return NextResponse.json({ sale }, { status: 201 })
  } catch (error) {
    console.error('[v0] Sales POST error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create sale'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
