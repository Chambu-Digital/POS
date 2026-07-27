import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Get all servings for this user
    const allServings = await models.BarServing.find({ userId: ownerId }).lean()
    
    // Get all inventory items for this user
    const allItems = await models.BarInventoryItem.find({ userId: ownerId }).lean()

    return NextResponse.json({
      user: ownerId,
      totalServings: allServings.length,
      totalItems: allItems.length,
      servings: allServings.map((s: any) => ({
        _id: s._id,
        name: s.name,
        inventoryItemId: s.inventoryItemId?.toString(),
        inventoryItemIdType: typeof s.inventoryItemId,
        sellingPrice: s.sellingPrice,
        unitsProduced: s.unitsProduced,
        isActive: s.isActive,
      })),
      items: allItems.map((i: any) => ({
        _id: i._id,
        name: i.name,
        size: i.size,
        brandId: i.brandId?.toString(),
      })),
    })
  } catch (error) {
    console.error('[debug/bar-servings] error:', error)
    return NextResponse.json({ error: 'Failed to fetch debug data' }, { status: 500 })
  }
}
