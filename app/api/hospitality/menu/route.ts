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
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const itemType = searchParams.get('itemType') || '' // 'for-sale' or 'ingredient'
    const status = searchParams.get('status') || 'active'

    const query: any = { tenantId, status }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ]
    }
    
    if (category) query.category = category
    if (itemType) query.itemType = itemType

    const menuItems = await models.HospitalityMenuItem.find(query).sort({ name: 1 }).lean()
    
    // Get serving types for servable items
    for (const item of menuItems) {
      if (item.isServable) {
        const servingTypes = await models.HospitalityServingType.find({
          tenantId,
          menuItemId: item._id
        }).sort({ displayOrder: 1 }).lean()
        item.servingTypes = servingTypes
      }
    }

    return NextResponse.json({ menuItems })
  } catch (error) {
    console.error('[hospitality/menu GET]', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
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

    // Validate required fields
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 })
    }

    // Check for duplicate name
    const existing = await models.HospitalityMenuItem.findOne({ tenantId, name: body.name })
    if (existing) {
      return NextResponse.json({ error: 'Menu item with this name already exists' }, { status: 400 })
    }

    // Create menu item
    const menuItem = new models.HospitalityMenuItem({
      tenantId,
      name: body.name,
      description: body.description || '',
      category: body.category,
      sku: body.sku || '',
      barcode: body.barcode || '',
      images: body.images || [],
      itemType: body.itemType || 'for-sale',
      isServable: body.isServable || false,
      servingMode: body.servingMode || null,
      baseUnit: body.baseUnit || 'unit',
      wholePriceIfNotServable: body.wholePriceIfNotServable || 0,
      costPrice: body.costPrice || 0,
      reorderPoint: body.reorderPoint || 10,
      inventoryMode: body.inventoryMode || 'tracked',
      canConsolidate: body.canConsolidate || false,
      status: 'active'
    })

    await menuItem.save()

    // Create serving types if provided
    if (body.isServable && body.servingTypes && body.servingTypes.length > 0) {
      const servingTypes = body.servingTypes.map((st: any, index: number) => ({
        tenantId,
        menuItemId: menuItem._id,
        name: st.name,
        servingsPerUnit: st.servingsPerUnit,
        pricePerServing: st.pricePerServing,
        volume: st.volume || null,
        isDefault: st.isDefault || index === 0,
        displayOrder: index
      }))

      await models.HospitalityServingType.insertMany(servingTypes)
    }

    // Create inventory record if tracked
    if (body.inventoryMode === 'tracked') {
      await models.HospitalityServingInventory.create({
        tenantId,
        menuItemId: menuItem._id,
        wholeUnits: 0,
        partialUnits: [],
        totalAvailableServings: {},
        lastCountedAt: new Date()
      })
    }

    return NextResponse.json({ menuItem }, { status: 201 })
  } catch (error) {
    console.error('[hospitality/menu POST]', error)
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 })
  }
}
