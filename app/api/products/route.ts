import { connectDB } from '@/lib/db'
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

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    let query: any = { userId: ownerId }

    if (category && category !== 'all') {
      query.category = category
    }

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
      ]
    }

    const products = await Product.find(query).sort({ createdAt: -1 })

    return NextResponse.json({ products })
  } catch (error) {
    console.error('[v0] Products GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
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

    const product = new Product({
      ...data,
      userId: ownerId,
    })

    await product.save()

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[v0] Products POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
