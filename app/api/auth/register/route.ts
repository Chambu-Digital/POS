import { connectDB } from '@/lib/db'
import User from '@/lib/models/User'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    const { email, password, shopName, secretCode, phone } = await request.json()

    // Validation
    if (!email || !password || !shopName) {
      return NextResponse.json(
        { error: 'Email, password, and shop name are required' },
        { status: 400 }
      )
    }

    // Validate secret code
    const adminSecretCode = process.env.ADMIN_SECRET_CODE || '@ChambuDIGITAL'
    if (secretCode !== adminSecretCode) {
      return NextResponse.json(
        { error: 'Invalid secret code. Only authorized admins can register.' },
        { status: 403 }
      )
    }

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Create user
    const user = new User({
      email,
      password,
      shopName,
      phone: phone || '',
    })

    await user.save()

    // Create token
    const token = await createToken({
      userId: user._id.toString(),
      email: user.email,
      role: 'admin',
      type: 'user',
    })

    // Set cookie and return
    const response = NextResponse.json(
      {
        message: 'Registration successful',
        user: {
          id: user._id,
          email: user.email,
          shopName: user.shopName,
          role: user.role,
        },
      },
      { status: 201 }
    )

    await setAuthCookie(token)
    return response
  } catch (error) {
    console.error('[v0] Register error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
