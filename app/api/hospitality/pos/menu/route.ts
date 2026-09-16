import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.pos']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || ''

    // Get all active for-sale items (regardless of inventory mode)
    const query: any = {
      tenantId,
      itemType: 'for-sale',
      status: 'active'
    }

    if (category) query.category = category

    const menuItems = await models.HospitalityMenuItem.find(query)
      .sort({ name: 1 })
      .lean()

    // Enrich with serving types and inventory data
    for (const item of menuItems) {
      // Get serving types if servable
      if (item.isServable) {
        const servingTypes = await models.HospitalityServingType.find({
          tenantId,
          menuItemId: item._id
        }).sort({ displayOrder: 1 }).lean()
        item.servingTypes = servingTypes
      }

      // Get inventory if tracked
      if (item.inventoryMode === 'tracked') {
        const inventory = await models.HospitalityServingInventory.findOne({
          tenantId,
          menuItemId: item._id
        }).lean()

        item.inventory = inventory || {
          wholeUnits: 0,
          partialUnits: [],
          totalAvailableServings: {}
        }

        // Add availability flags for UI
        item.isInStock = inventory && inventory.wholeUnits > 0
        item.isLowStock = inventory && inventory.wholeUnits > 0 && 
                         inventory.wholeUnits <= item.reorderPoint
        item.isOutOfStock = !inventory || inventory.wholeUnits === 0
      } else {
        // Untracked items are always available
        item.isInStock = true
        item.isLowStock = false
        item.isOutOfStock = false
        item.isMadeToOrder = true
      }
    }

    // Get categories for filtering
    const categories = await models.HospitalityCategory.find({ tenantId, isVisible: true })
      .sort({ displayOrder: 1 })
      .lean()

    return NextResponse.json({ menuItems, categories })
  } catch (error) {
    console.error('[hospitality/pos/menu GET]', error)
    return NextResponse.json({ error: 'Failed to fetch POS menu' }, { status: 500 })
  }
}
