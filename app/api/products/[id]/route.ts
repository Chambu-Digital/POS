import { connectDB } from '@/lib/db'
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

    const product = await Product.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    Object.assign(product, data)
    product.updatedAt = new Date()
    await product.save()

    return NextResponse.json(product)
  } catch (error) {
    console.error('[v0] Product PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
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

    const product = await Product.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    console.error('[v0] Product DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}
