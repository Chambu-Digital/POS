import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.menu']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { id } = await params

    const menuItem = await models.HospitalityMenuItem.findOne({ 
      _id: new Types.ObjectId(id), 
      tenantId 
    }).lean()

    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // Get serving types if servable
    if (menuItem.isServable) {
      const servingTypes = await models.HospitalityServingType.find({
        tenantId,
        menuItemId: menuItem._id
      }).sort({ displayOrder: 1 }).lean()
      menuItem.servingTypes = servingTypes
    }

    // Get inventory if tracked
    if (menuItem.inventoryMode === 'tracked') {
      const inventory = await models.HospitalityServingInventory.findOne({
        tenantId,
        menuItemId: menuItem._id
      }).lean()
      menuItem.inventory = inventory
    }

    return NextResponse.json({ menuItem })
  } catch (error) {
    console.error('[hospitality/menu/[id] GET]', error)
    return NextResponse.json({ error: 'Failed to fetch menu item' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.menu']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { id } = await params
    const body = await request.json()

    const menuItem = await models.HospitalityMenuItem.findOne({ 
      _id: new Types.ObjectId(id), 
      tenantId 
    })

    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // Check for duplicate name (excluding current item)
    if (body.name && body.name !== menuItem.name) {
      const existing = await models.HospitalityMenuItem.findOne({ 
        tenantId, 
        name: body.name,
        _id: { $ne: menuItem._id }
      })
      if (existing) {
        return NextResponse.json({ error: 'Menu item with this name already exists' }, { status: 400 })
      }
    }

    // Update menu item fields
    Object.assign(menuItem, {
      name: body.name !== undefined ? body.name : menuItem.name,
      description: body.description !== undefined ? body.description : menuItem.description,
      category: body.category !== undefined ? body.category : menuItem.category,
      sku: body.sku !== undefined ? body.sku : menuItem.sku,
      barcode: body.barcode !== undefined ? body.barcode : menuItem.barcode,
      images: body.images !== undefined ? body.images : menuItem.images,
      itemType: body.itemType !== undefined ? body.itemType : menuItem.itemType,
      isServable: body.isServable !== undefined ? body.isServable : menuItem.isServable,
      servingMode: body.servingMode !== undefined ? body.servingMode : menuItem.servingMode,
      baseUnit: body.baseUnit !== undefined ? body.baseUnit : menuItem.baseUnit,
      wholePriceIfNotServable: body.wholePriceIfNotServable !== undefined ? body.wholePriceIfNotServable : menuItem.wholePriceIfNotServable,
      costPrice: body.costPrice !== undefined ? body.costPrice : menuItem.costPrice,
      reorderPoint: body.reorderPoint !== undefined ? body.reorderPoint : menuItem.reorderPoint,
      inventoryMode: body.inventoryMode !== undefined ? body.inventoryMode : menuItem.inventoryMode,
      canConsolidate: body.canConsolidate !== undefined ? body.canConsolidate : menuItem.canConsolidate,
      status: body.status !== undefined ? body.status : menuItem.status
    })

    await menuItem.save()

    // Update serving types if provided
    if (body.servingTypes !== undefined) {
      // Delete existing serving types
      await models.HospitalityServingType.deleteMany({
        tenantId,
        menuItemId: menuItem._id
      })

      // Create new serving types
      if (body.servingTypes.length > 0) {
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
    }

    return NextResponse.json({ menuItem })
  } catch (error) {
    console.error('[hospitality/menu/[id] PUT]', error)
    return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, features } = await getTenantDB(request)
    if (!features['hospitality.menu']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const { id } = await params

    const menuItem = await models.HospitalityMenuItem.findOne({ 
      _id: new Types.ObjectId(id), 
      tenantId 
    })

    if (!menuItem) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    // Check if item has been used in orders
    const orderCount = await models.HospitalityOrder.countDocuments({
      tenantId,
      'items.menuItemId': menuItem._id
    })

    if (orderCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete menu item that has been used in ${orderCount} orders. Consider marking it as inactive instead.` 
      }, { status: 400 })
    }

    // Delete related records
    await models.HospitalityServingType.deleteMany({ tenantId, menuItemId: menuItem._id })
    await models.HospitalityServingInventory.deleteOne({ tenantId, menuItemId: menuItem._id })
    await models.HospitalityServingMovement.deleteMany({ tenantId, menuItemId: menuItem._id })
    
    // Delete the menu item
    await models.HospitalityMenuItem.findByIdAndDelete(id)

    return NextResponse.json({ message: 'Menu item deleted successfully' })
  } catch (error) {
    console.error('[hospitality/menu/[id] DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 })
  }
}
