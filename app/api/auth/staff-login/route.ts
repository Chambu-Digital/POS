import { connectDB } from '@/lib/db'
import Staff from '@/lib/models/Staff'
import User from '@/lib/models/User'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const { email, password } = await request.json()

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find staff member with password field
    const staff = await Staff.findOne({ email, active: true }).select('+password')
    if (!staff) {
      return NextResponse.json(
        { error: 'Invalid credentials or account is inactive' },
        { status: 401 }
      )
    }

    // Verify password
    const isPasswordValid = await staff.comparePassword(password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Get shop owner details
    const owner = await User.findById(staff.userId)
    if (!owner) {
      return NextResponse.json(
        { error: 'Shop owner not found' },
        { status: 404 }
      )
    }

    // Create token with staff info
    const token = await createToken({
      userId: staff._id.toString(),
      email: staff.email,
      role: staff.role,
      type: 'staff',
      adminId: staff.userId.toString(), // Reference to shop owner
      permissions: staff.permissions,
    })

    // Set cookie and return
    const response = NextResponse.json(
      {
        message: 'Login successful',
        staff: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          permissions: staff.permissions,
          shopName: owner.shopName,
        },
      },
      { status: 200 }
    )

    await setAuthCookie(token)
    return response
  } catch (error) {
    console.error('[Staff Login] Error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
