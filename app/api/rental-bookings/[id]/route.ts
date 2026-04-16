import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const data = await request.json()

    const booking = await models.RentalBooking.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status === 'completed') return NextResponse.json({ error: 'Booking already completed' }, { status: 400 })

    const endTime = new Date()
    booking.endTime = endTime
    booking.totalAmount = data.totalAmount
    booking.paymentMethod = data.paymentMethod
    booking.mpesaCode = data.mpesaCode
    booking.mpesaPhone = data.mpesaPhone
    booking.status = data.status || 'completed'
    await booking.save()

    if (booking.status === 'completed' && data.totalAmount > 0) {
      await models.Sale.create({
        userId: new Types.ObjectId(ownerId),
        staffId: payload.type === 'staff' ? new Types.ObjectId(payload.userId) : undefined,
        items: [{ productName: `${booking.serviceName} (${booking.pricingLabel})`, quantity: booking.guestCount || 1, price: data.totalAmount, discount: 0 }],
        subtotal: data.totalAmount, discount: 0, total: data.totalAmount,
        paymentMethod: data.paymentMethod, mpesaCode: data.mpesaCode, mpesaPhone: data.mpesaPhone,
        source: 'rental', status: 'completed', notes: booking.notes,
        rentalMeta: {
          bookingId: booking._id, serviceName: booking.serviceName, serviceCategory: booking.serviceCategory,
          pricingLabel: booking.pricingLabel, startTime: booking.startTime, endTime,
          guestCount: booking.guestCount, deposit: booking.deposit,
          customerName: booking.customer.name, customerPhone: booking.customer.phone, customerIdNo: booking.customer.idNo,
        },
      })
    }

    return NextResponse.json({ booking })
  } catch (error) {
    console.error('[rental-bookings] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const booking = await models.RentalBooking.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: ownerId },
      { $set: { status: 'cancelled' } },
      { new: true }
    )
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    return NextResponse.json({ booking })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
  }
}
