import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const category = await models.Category.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    const oldName = category.name
    Object.assign(category, data)
    await category.save()

    if (data.name && data.name !== oldName) {
      await models.Product.updateMany({ userId: ownerId, category: oldName }, { $set: { category: data.name } })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('[category] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const { id } = await params
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const category = await models.Category.findOne({ _id: new Types.ObjectId(id), userId: ownerId })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    const productCount = await models.Product.countDocuments({ userId: ownerId, category: category.name })
    if (productCount > 0) {
      return NextResponse.json({ error: `Cannot delete category with ${productCount} products. Please reassign or delete products first.` }, { status: 400 })
    }

    await models.Category.findByIdAndDelete(id)
    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('[category] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
