import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const category = url.searchParams.get('category')
    const archivedParam = url.searchParams.get('archived')
    const branchId = url.searchParams.get('branchId')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { userId: ownerId }

    if (branchId) {
      filter.branchId = branchId
    }

    if (archivedParam === 'true') {
      filter.isArchived = true
    } else {
      filter.isArchived = false
    }

    if (search) {
      filter.name = { $regex: new RegExp(search, 'i') }
    }

    if (category) {
      filter.category = category
    }

    const brands = await models.BarBrand.find(filter).sort({ name: 1 })
    return NextResponse.json({ brands })
  } catch (error) {
    console.error('[bar/brands] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const data = await request.json()
    const { name, description, category, branchId } = data

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const duplicate = await models.BarBrand.findOne({
      userId: ownerId,
      name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'BRAND_DUPLICATE', message: 'A brand with this name already exists' },
        { status: 409 }
      )
    }

    const brand = await models.BarBrand.create({
      userId: ownerId,
      name: name.trim(),
      description: description ?? '',
      category: category ?? '',
      branchId: branchId ?? undefined,
      isArchived: false,
    })

    await models.BarAuditLog.create({
      userId: ownerId,
      branchId: branchId ?? undefined,
      staffId: payload.userId,
      operation: 'INVENTORY_ADJUSTED',
      referenceId: String(brand._id),
      referenceType: 'BarBrand',
      details: { action: 'brand_created', name: brand.name },
      timestamp: new Date(),
    })

    return NextResponse.json({ brand }, { status: 201 })
  } catch (error) {
    console.error('[bar/brands] POST error:', error)
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 })
  }
}
