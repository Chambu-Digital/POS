import { connectDB } from '@/lib/db'
import RentalService from '@/lib/models/RentalService'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const data = await request.json()

    const service = await RentalService.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: ownerId },
      { $set: data },
      { new: true }
    )
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    return NextResponse.json({ service })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const service = await RentalService.findOneAndDelete({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    return NextResponse.json({ message: 'Service deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}
