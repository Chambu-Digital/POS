import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const includeCount = new URL(request.url).searchParams.get('includeCount') === 'true'

    const categories = await models.Category.find({ userId: ownerId }).sort({ name: 1 })

    if (includeCount) {
      for (const category of categories) {
        category.productCount = await models.Product.countDocuments({ userId: ownerId, category: category.name })
        await category.save()
      }
    }

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[categories] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const existing = await models.Category.findOne({ userId: ownerId, name: data.name })
    if (existing) return NextResponse.json({ error: 'Category already exists' }, { status: 400 })

    const category = new models.Category({ ...data, userId: ownerId })
    await category.save()
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('[categories] POST error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
