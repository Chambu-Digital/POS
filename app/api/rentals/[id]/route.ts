import { connectDB } from '@/lib/db'
import Rental from '@/lib/models/Rental'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const rental = await Rental.findOne({ _id: id, userId: new Types.ObjectId(ownerId) })
    if (!rental) return NextResponse.json({ error: 'Rental not found' }, { status: 404 })

    return NextResponse.json({ rental })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rental' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const data = await request.json()

    const rental = await Rental.findOne({ _id: id, userId: new Types.ObjectId(ownerId) })
    if (!rental) return NextResponse.json({ error: 'Rental not found' }, { status: 404 })
    if (rental.status === 'returned') {
      return NextResponse.json({ error: 'Rental already returned' }, { status: 400 })
    }

    const endTime = new Date()
    const durationMinutes = Math.ceil(
      (endTime.getTime() - new Date(rental.startTime).getTime()) / (1000 * 60)
    )

    // Restore stock
    for (const item of rental.items) {
      await Product.findByIdAndUpdate(
        new Types.ObjectId(item.productId),
        { $inc: { stock: item.quantity } }
      )
    }

    rental.endTime = endTime
    rental.duration = durationMinutes
    rental.totalAmount = data.totalAmount
    rental.paymentMethod = data.paymentMethod
    rental.mpesaCode = data.mpesaCode
    rental.mpesaPhone = data.mpesaPhone
    rental.status = 'returned'
    await rental.save()

    return NextResponse.json({ rental })
  } catch (error) {
    console.error('[Rentals] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to process return' }, { status: 500 })
  }
}
