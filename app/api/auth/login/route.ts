import { getTenantDB } from '@/lib/tenant/get-db'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, getDemoUser } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Demo shortcut
    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const token = await createToken({ userId: DEMO_USER_ID, email: DEMO_EMAIL, role: 'admin', type: 'user', isDemo: true })
      await setAuthCookie(token)
      return NextResponse.json({ message: 'Login successful', user: { ...getDemoUser(), isDemo: true } })
    }

    const { models } = await getTenantDB(request)

    // Try admin user first
    let user: any = await models.User.findOne({ email }).select('+password')
    let userType: 'user' | 'staff' = 'user'

    // Fall back to staff
    if (!user) {
      user = await models.Staff.findOne({ email }).select('+password')
      userType = 'staff'
    }

    if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    if (userType === 'user') {
      user.lastLogin = new Date()
      await user.save()
    }

    const userName = userType === 'staff' ? user.name : user.shopName

    const token = await createToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      type: userType,
      adminId: userType === 'staff' ? user.userId.toString() : undefined,
    })

    await setAuthCookie(token)
    return NextResponse.json({
      message: 'Login successful',
      user: { id: user._id, email: user.email, name: userName, role: user.role, type: userType },
    })
  } catch (error) {
    console.error('[login] error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
