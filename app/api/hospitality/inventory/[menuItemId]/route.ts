import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest, { params }: { params: Promise<{ menuItemId: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.inventory']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { menuItemId } = await params

    // Get menu item
    const menuItem = await models.HospitalityMenuItem.findOne({
      _id: new Types.ObjectId(menuItemId),
      tenantId
    }).lean()

    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // Get inventory
    const inventory = await models.HospitalityServingInventory.findOne({
      tenantId,
      menuItemId: new Types.ObjectId(menuItemId)
    }).lean()

    // Get serving types if servable
    let servingTypes = []
    if (menuItem.isServable) {
      servingTypes = await models.HospitalityServingType.find({
        tenantId,
        menuItemId: new Types.ObjectId(menuItemId)
      }).sort({ displayOrder: 1 }).lean()
    }

    // Get recent movements
    const movements = await models.HospitalityServingMovement.find({
      tenantId,
      menuItemId: new Types.ObjectId(menuItemId)
    }).sort({ timestamp: -1 }).limit(20).lean()

    return NextResponse.json({
      menuItem,
      inventory: inventory || {
        wholeUnits: 0,
        partialUnits: [],
        totalAvailableServings: {}
      },
      servingTypes,
      recentMovements: movements
    })
  } catch (error) {
    console.error('[hospitality/inventory/[menuItemId] GET]', error)
    return NextResponse.json({ error: 'Failed to fetch inventory details' }, { status: 500 })
  }
}
