import { connectDB } from '@/lib/db'
import Category from '@/lib/models/Category'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const data = await request.json()
    const { id } = await params

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const category = await Category.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    const oldName = category.name

    // Update category
    Object.assign(category, data)
    await category.save()

    // If name changed, update all products with this category
    if (data.name && data.name !== oldName) {
      await Product.updateMany(
        { userId: ownerId, category: oldName },
        { $set: { category: data.name } }
      )
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('[v0] Category PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const { id } = await params

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const category = await Category.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if category has products
    const productCount = await Product.countDocuments({
      userId: ownerId,
      category: category.name,
    })

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${productCount} products. Please reassign or delete products first.` },
        { status: 400 }
      )
    }

    await Category.findByIdAndDelete(id)

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('[v0] Category DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}

