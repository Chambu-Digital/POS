import { connectDB } from '@/lib/db'
import Category from '@/lib/models/Category'
import Product from '@/lib/models/Product'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Sync categories from existing products
 * This endpoint creates category records for all unique categories found in products
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Use adminId for staff members, userId for admin/owner
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Get all unique categories from products
    const products = await Product.find({ userId: ownerId }).distinct('category')

    let created = 0
    let updated = 0

    for (const categoryName of products) {
      if (!categoryName || categoryName.trim() === '') continue

      // Check if category exists
      const existing = await Category.findOne({
        userId: ownerId,
        name: categoryName,
      })

      if (!existing) {
        // Create new category
        await Category.create({
          userId: ownerId,
          name: categoryName,
          productCount: await Product.countDocuments({
            userId: ownerId,
            category: categoryName,
          }),
        })
        created++
      } else {
        // Update product count
        existing.productCount = await Product.countDocuments({
          userId: ownerId,
          category: categoryName,
        })
        await existing.save()
        updated++
      }
    }

    return NextResponse.json({
      message: 'Categories synced successfully',
      created,
      updated,
    })
  } catch (error) {
    console.error('[v0] Category sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync categories' },
      { status: 500 }
    )
  }
}

