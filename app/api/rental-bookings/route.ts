import { connectDB } from '@/lib/db'
import RentalBooking from '@/lib/models/RentalBooking'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Auto-mark overdue: active bookings past their expected end time
    await RentalBooking.updateMany(
      {
        userId: ownerId,
        status: 'active',
        startTime: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      { $set: { status: 'overdue' } }
    )

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const query: Record<string, unknown> = { userId: ownerId }
    if (status && status !== 'all') query.status = status

    const bookings = await RentalBooking.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('[RentalBookings] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const data = await request.json()

    if (!data.serviceId) return NextResponse.json({ error: 'Service is required' }, { status: 400 })
    if (!data.customer?.name) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
    if (!data.customer?.phone) return NextResponse.json({ error: 'Customer phone is required' }, { status: 400 })

    const booking = new RentalBooking({
      ...data,
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : null,
      startTime: data.startTime || new Date(),
      status: 'active',
    })
    await booking.save()
    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    console.error('[RentalBookings] POST error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}
