import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const available = searchParams.get('available')

    const query: any = { userId: ownerId }
    if (category && category !== 'all') query.category = category
    if (available === 'true') query.available = true

    const menuItems = await models.MenuItem.find(query)
      .populate('productId', 'name stock')
      .sort({ category: 1, name: 1 })
      .lean()

    const normalized = menuItems.map((item: any) => ({
      ...item,
      id: item._id.toString(),
      _id: undefined,
      productId: item.productId ? {
        id: item.productId._id.toString(),
        name: item.productId.name,
        stock: item.productId.stock,
      } : null,
    }))

    return NextResponse.json({ menuItems: normalized })
  } catch (err) {
    console.error('Menu GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const body = await req.json()

    console.log('Creating menu item:', { ownerId, body })

    // Clean up productId if it's 'none'
    const cleanedBody = { ...body }
    if (cleanedBody.productId === 'none' || !cleanedBody.productId) {
      delete cleanedBody.productId
    }

    console.log('Cleaned body:', cleanedBody)

    const menuItem = await models.MenuItem.create({
      ...cleanedBody,
      userId: ownerId,
    })

    console.log('Menu item created:', menuItem._id)

    return NextResponse.json({ 
      menuItem: { ...menuItem.toObject(), id: menuItem._id.toString() } 
    }, { status: 201 })
  } catch (err) {
    console.error('Menu POST error:', err)
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack')
    return NextResponse.json({ 
      error: 'Failed to create menu item',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id, ...updates } = await req.json()

    // Clean up productId if it's 'none'
    const cleanedUpdates = { ...updates }
    if (cleanedUpdates.productId === 'none' || cleanedUpdates.productId === '') {
      cleanedUpdates.productId = null
    }

    const menuItem = await models.MenuItem.findOneAndUpdate(
      { _id: id, userId: ownerId },
      { $set: cleanedUpdates },
      { new: true }
    )

    if (!menuItem) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })

    return NextResponse.json({ 
      menuItem: { ...menuItem.toObject(), id: menuItem._id.toString() } 
    })
  } catch (err) {
    console.error('Menu PATCH error:', err)
    return NextResponse.json({ 
      error: 'Failed to update menu item',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const result = await models.MenuItem.deleteOne({ _id: id, userId: ownerId })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Menu DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 })
  }
}
