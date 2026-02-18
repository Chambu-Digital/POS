import { connectDB } from '@/lib/db'
import Staff from '@/lib/models/Staff'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin users can update staff
    if (payload.type !== 'user') {
      return NextResponse.json(
        { error: 'Only admin users can update staff accounts' },
        { status: 403 }
      )
    }

    await connectDB()
    const data = await request.json()
    const { id } = await params

    const staff = await Staff.findOne({
      _id: new Types.ObjectId(id),
      userId: payload.userId,
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff not found' },
        { status: 404 }
      )
    }

    // Only allow updating specific fields
    if (data.name) staff.name = data.name
    if (data.role) staff.role = data.role
    if (data.active !== undefined) staff.active = data.active
    if (data.permissions) staff.permissions = data.permissions

    await staff.save()

    const staffData = staff.toObject()
    delete staffData.password

    return NextResponse.json(staffData)
  } catch (error) {
    console.error('[v0] Staff PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update staff' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin users can delete staff
    if (payload.type !== 'user') {
      return NextResponse.json(
        { error: 'Only admin users can delete staff accounts' },
        { status: 403 }
      )
    }

    await connectDB()
    const { id } = await params

    const staff = await Staff.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: payload.userId,
    })

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Staff deleted' })
  } catch (error) {
    console.error('[v0] Staff DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete staff' },
      { status: 500 }
    )
  }
}
