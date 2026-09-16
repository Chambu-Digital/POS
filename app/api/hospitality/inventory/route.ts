import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.inventory']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { searchParams } = new URL(request.url)
    const itemType = searchParams.get('itemType') || 'for-sale' // 'for-sale' or 'ingredient'
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true'

    // Get all tracked menu items of specified type
    const menuItems = await models.HospitalityMenuItem.find({
      tenantId,
      itemType,
      inventoryMode: 'tracked',
      status: 'active'
    }).lean()

    const inventoryData = []

    for (const item of menuItems) {
      // Get inventory
      const inventory = await models.HospitalityServingInventory.findOne({
        tenantId,
        menuItemId: item._id
      }).lean()

      // Get serving types if servable
      let servingTypes = []
      if (item.isServable) {
        servingTypes = await models.HospitalityServingType.find({
          tenantId,
          menuItemId: item._id
        }).sort({ displayOrder: 1 }).lean()
      }

      const itemData = {
        ...item,
        inventory: inventory || {
          wholeUnits: 0,
          partialUnits: [],
          totalAvailableServings: {}
        },
        servingTypes
      }

      // Filter by low stock if requested
      if (lowStockOnly) {
        const isLowStock = inventory && inventory.wholeUnits < item.reorderPoint
        if (isLowStock) {
          inventoryData.push(itemData)
        }
      } else {
        inventoryData.push(itemData)
      }
    }

    return NextResponse.json({ inventory: inventoryData })
  } catch (error) {
    console.error('[hospitality/inventory GET]', error)
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  }
}
