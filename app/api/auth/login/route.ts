import { connectDB } from '@/lib/db'
import User from '@/lib/models/User'
import Staff from '@/lib/models/Staff'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, getDemoUser } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // --- Demo account shortcut ---
    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const token = await createToken({
        userId: DEMO_USER_ID,
        email: DEMO_EMAIL,
        role: 'admin',
        type: 'user',
        isDemo: true,
      })
      await setAuthCookie(token)
      const demoUser = getDemoUser()
      return NextResponse.json({
        message: 'Login successful',
        user: { ...demoUser, isDemo: true },
      })
    }
    // --- End demo ---

    await connectDB()
    // Find user and select password
    let user = await User.findOne({ email }).select('+password')
    let userType: 'user' | 'staff' = 'user'
    let userName = ''

    console.log('[v0] Login attempt for:', email)
    console.log('[v0] Admin user found:', !!user)

    // If not found in User model, check Staff model
    if (!user) {
      user = await Staff.findOne({ email }).select('+password')
      userType = 'staff'
      console.log('[v0] Staff user found:', !!user)
      
      // Debug: Check what's in the database
      if (!user) {
        const userCount = await User.countDocuments()
        const staffCount = await Staff.countDocuments()
        console.log('[v0] Total users in database:', userCount)
        console.log('[v0] Total staff in database:', staffCount)
      }
    }

    if (!user) {
      console.log('[v0] User not found in database')
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const isPasswordValid = await user.comparePassword(password)
    console.log('[v0] Password valid:', isPasswordValid)

    if (!isPasswordValid) {
      console.log('[v0] Password comparison failed')
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login for admin users
    if (userType === 'user') {
      user.lastLogin = new Date()
      await user.save()
    }

    // Get user name based on type
    if (userType === 'staff') {
      userName = (user as any).name
    } else {
      userName = (user as any).shopName
    }

    // Create token
    const token = await createToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      type: userType,
      adminId: userType === 'staff' ? (user as any).userId.toString() : undefined,
    })

    // Set cookie and return
    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          name: userName,
          role: user.role,
          type: userType,
        },
      },
      { status: 200 }
    )

    await setAuthCookie(token)
    return response
  } catch (error) {
    console.error('[v0] Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
