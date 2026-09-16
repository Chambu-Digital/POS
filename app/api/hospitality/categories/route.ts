import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.menu']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const categories = await models.HospitalityCategory.find({ tenantId })
      .sort({ displayOrder: 1, name: 1 })
      .lean()

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[hospitality/categories GET]', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.menu']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // Check for duplicate
    const existing = await models.HospitalityCategory.findOne({ tenantId, name: body.name })
    if (existing) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
    }

    const category = new models.HospitalityCategory({
      tenantId,
      name: body.name,
      description: body.description || '',
      color: body.color || '#3b82f6',
      icon: body.icon || 'utensils',
      displayOrder: body.displayOrder || 0,
      isVisible: body.isVisible !== undefined ? body.isVisible : true
    })

    await category.save()
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('[hospitality/categories POST]', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
