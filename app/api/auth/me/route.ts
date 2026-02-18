import { connectDB } from '@/lib/db'
import User from '@/lib/models/User'
import Staff from '@/lib/models/Staff'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()

    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()

    // Check if it's an admin user or staff
    if (payload.type === 'user') {
      const user = await User.findById(payload.userId)

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        user: {
          id: user._id,
          email: user.email,
          name: user.shopName,
          shopName: user.shopName,
          role: user.role,
          type: 'user',
        },
      })
    } else {
      // Staff user
      const staff = await Staff.findById(payload.userId).populate('userId')

      if (!staff) {
        return NextResponse.json(
          { error: 'Staff not found' },
          { status: 404 }
        )
      }

      // Get shop name from the admin user
      const adminUser = await User.findById(staff.userId)
      const shopName = adminUser?.shopName || 'Shop'

      return NextResponse.json({
        user: {
          id: staff._id,
          email: staff.email,
          name: staff.name,
          shopName: shopName,
          role: staff.role,
          type: 'staff',
          permissions: staff.permissions,
        },
      })
    }
  } catch (error) {
    console.error('[v0] Auth me error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}
