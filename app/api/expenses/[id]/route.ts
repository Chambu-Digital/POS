import { connectDB } from '@/lib/db'
import Expense from '@/lib/models/Expense'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Only admin/owner can approve or reject
    if (payload.type !== 'user') return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    await connectDB()
    const { status } = await request.json()
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: params.id, userId: payload.userId },
      { status, approvedBy: payload.userId, approvedAt: new Date() },
      { new: true }
    )
    if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ expense })
  } catch (error) {
    console.error('Expense PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    await Expense.findOneAndDelete({ _id: params.id, userId: ownerId })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Expense DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
