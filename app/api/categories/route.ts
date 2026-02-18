import { connectDB } from '@/lib/db'
import Category from '@/lib/models/Category'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const includeCount = searchParams.get('includeCount') === 'true'

    const categories = await Category.find({ userId: ownerId }).sort({ name: 1 })

    // Optionally update product counts
    if (includeCount) {
      for (const category of categories) {
        const count = await Product.countDocuments({
          userId: ownerId,
          category: category.name,
        })
        category.productCount = count
        await category.save()
      }
    }

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[v0] Categories GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const data = await request.json()

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Check if category already exists
    const existing = await Category.findOne({
      userId: ownerId,
      name: data.name,
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Category already exists' },
        { status: 400 }
      )
    }

    const category = new Category({
      ...data,
      userId: ownerId,
    })

    await category.save()

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('[v0] Categories POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

