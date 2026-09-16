import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

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

    const category = await models.HospitalityCategory.findOne({ 
      _id: new Types.ObjectId(id), 
      tenantId 
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for duplicate name
    if (body.name && body.name !== category.name) {
      const existing = await models.HospitalityCategory.findOne({
        tenantId,
        name: body.name,
        _id: { $ne: category._id }
      })
      if (existing) {
        return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
      }
    }

    const oldName = category.name
    Object.assign(category, body)
    await category.save()

    // Update menu items if category name changed
    if (body.name && body.name !== oldName) {
      await models.HospitalityMenuItem.updateMany(
        { tenantId, category: oldName },
        { $set: { category: body.name } }
      )
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('[hospitality/categories/[id] PUT]', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
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

    const category = await models.HospitalityCategory.findOne({ 
      _id: new Types.ObjectId(id), 
      tenantId 
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check if category has items
    const itemCount = await models.HospitalityMenuItem.countDocuments({
      tenantId,
      category: category.name
    })

    if (itemCount > 0) {
      return NextResponse.json({
        error: `Cannot delete category with ${itemCount} items. Please reassign or delete items first.`
      }, { status: 400 })
    }

    await models.HospitalityCategory.findByIdAndDelete(id)
    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('[hospitality/categories/[id] DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
