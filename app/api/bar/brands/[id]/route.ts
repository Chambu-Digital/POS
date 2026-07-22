import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    const brand = await models.BarBrand.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    const inventoryItems = await models.BarInventoryItem.find({
      userId: ownerId,
      brandId: brand._id,
      isActive: true,
    })

    return NextResponse.json({ brand, inventoryItems })
  } catch (error) {
    console.error('[bar/brands/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    const brand = await models.BarBrand.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    const body = await request.json()
    const { name, description, category } = body

    if (name !== undefined && name.trim() !== brand.name) {
      const duplicate = await models.BarBrand.findOne({
        userId: ownerId,
        name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
        _id: { $ne: brand._id },
      })
      if (duplicate) {
        return NextResponse.json({ error: 'BRAND_DUPLICATE' }, { status: 409 })
      }
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description
    if (category !== undefined) updates.category = category

    Object.assign(brand, updates)
    await brand.save()

    await models.BarAuditLog.create({
      userId: ownerId,
      branchId: brand.branchId,
      staffId: payload.type === 'staff' ? payload.userId : ownerId,
      operation: 'INVENTORY_ADJUSTED',
      referenceId: brand._id.toString(),
      referenceType: 'BarBrand',
      details: { action: 'brand_updated', updates },
    })

    return NextResponse.json({ brand })
  } catch (error) {
    console.error('[bar/brands/[id]]', error)
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    const brand = await models.BarBrand.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    brand.isArchived = true
    await brand.save()

    return NextResponse.json({ message: 'Brand archived', brand })
  } catch (error) {
    console.error('[bar/brands/[id]]', error)
    return NextResponse.json({ error: 'Failed to archive brand' }, { status: 500 })
  }
}
