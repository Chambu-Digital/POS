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

    const item = await models.BarInventoryItem.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!item) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })

    const brand = await models.BarBrand.findById(item.brandId)
    const openBottle = await models.BarBottle.findOne({ inventoryItemId: item._id, state: 'open' })
    const servings = await models.BarServing.find({ inventoryItemId: item._id, isActive: true })
    const lowStockAlert = item.stock <= item.lowStockThreshold

    return NextResponse.json({ item, brand, openBottle, servings, lowStockAlert })
  } catch (error) {
    console.error('[bar/inventory-items/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch inventory item' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    const item = await models.BarInventoryItem.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!item) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })

    const body = await request.json()
    const allowed = ['name', 'buyingPrice', 'bottleSellingPrice', 'lowStockThreshold', 'isActive'] as const
    for (const field of allowed) {
      if (field in body) {
        (item as Record<string, unknown>)[field] = body[field]
      }
    }
    item.updatedAt = new Date()
    await item.save()

    return NextResponse.json({ item })
  } catch (error) {
    console.error('[bar/inventory-items/[id]]', error)
    return NextResponse.json({ error: 'Failed to update inventory item' }, { status: 500 })
  }
}
