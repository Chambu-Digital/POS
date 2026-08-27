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

    const [brand, openBottlesCount] = await Promise.all([
      models.BarBrand.findById(item.brandId),
      models.BarBottle.countDocuments({ inventoryItemId: item._id, state: 'open' })
    ])
    
    // Calculate inventory metrics
    const sealedCount = item.stock
    const totalBottles = sealedCount + openBottlesCount
    const inventoryValue = totalBottles * item.buyingPrice
    const lowStockAlert = totalBottles > 0 && totalBottles <= item.lowStockThreshold

    // Note: servings are fetched separately by frontend from /api/bar/inventory-items/[id]/servings
    // to avoid duplicate data and potential inconsistencies
    return NextResponse.json({ 
      item, 
      brand, 
      sealedCount,
      openBottlesCount,
      totalBottles,
      inventoryValue,
      lowStockAlert 
    })
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.userId
    const { id } = await params

    const item = await models.BarInventoryItem.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    // Delete the item and its associated servings and bottles
    await Promise.all([
      models.BarInventoryItem.deleteOne({ _id: item._id }),
      models.BarServing.deleteMany({ inventoryItemId: item._id }),
      models.BarBottle.deleteMany({ inventoryItemId: item._id }),
    ])

    await models.BarAuditLog.create({
      userId:        ownerId,
      staffId:       ownerId,
      operation:     'INVENTORY_ADJUSTED',
      referenceId:   String(item._id),
      referenceType: 'BarInventoryItem',
      details: { action: 'deleted', name: item.name, size: item.size },
      timestamp:     new Date(),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[bar/inventory-items/[id] DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
