import { connectDB } from '@/lib/db'
import Expense from '@/lib/models/Expense'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const query: Record<string, unknown> = { userId: ownerId }
    if (search) query.title = { $regex: search, $options: 'i' }

    const expenses = await Expense.find(query).sort({ createdAt: -1 })
    return NextResponse.json({ expenses })
  } catch (error) {
    console.error('Expenses GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const data = await request.json()

    const expense = new Expense({
      ...data,
      userId: ownerId,
      staffId: payload.type === 'staff' ? payload.userId : undefined,
    })
    await expense.save()

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Expenses POST error:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
