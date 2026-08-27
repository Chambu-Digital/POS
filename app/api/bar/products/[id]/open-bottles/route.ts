import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { InventoryEngine } from '@/lib/bar/inventory-engine'
import { Types } from 'mongoose'

/**
 * GET /api/bar/products/[id]/open-bottles
 * 
 * Get all open bottles for a specific inventory item (product).
 * Used by CloseBottleModal to show which bottles can be closed.
 * 
 * Response:
 *   - productId: string
 *   - productName: string
 *   - bottles: Array of open bottles with basic info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id: inventoryItemId } = await params

    if (!inventoryItemId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Fetch the inventory item for product name
    const item = await models.BarInventoryItem.findOne({
      _id: new Types.ObjectId(inventoryItemId),
      userId: ownerId,
    }).lean()

    if (!item) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Fetch brand info for complete product name
    const brand = item.brandId 
      ? await models.BarBrand.findById(item.brandId).lean()
      : null

    const productName = (item as any).name || brand?.name || 'Unknown Product'

    // Fetch all open bottles for this product
    const openBottles = await InventoryEngine.getOpenBottles(inventoryItemId, conn)

    const bottles = openBottles.map((bottle: any) => ({
      bottleId: String(bottle._id),
      bottleNumber: bottle.bottleNumber,
      remainingFraction: bottle.remainingFraction,
      openedAt: bottle.openedAt,
      openedBy: String(bottle.openedBy),
    }))

    return NextResponse.json({
      productId: inventoryItemId,
      productName,
      bottles,
    })
  } catch (error: any) {
    console.error('[bar/products/[id]/open-bottles] GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch open bottles' }, { status: 500 })
  }
}
