import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const categories = await models.ExpenseCategory.find({ userId: ownerId }).sort({ name: 1 })
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[expense-categories] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { name } = await request.json()

    const existing = await models.ExpenseCategory.findOne({ userId: ownerId, name })
    if (existing) return NextResponse.json({ error: 'Category already exists' }, { status: 400 })

    const category = new models.ExpenseCategory({ userId: ownerId, name })
    await category.save()
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('[expense-categories] POST error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
