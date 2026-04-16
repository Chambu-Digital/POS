import { getTenantDB } from '@/lib/tenant/get-db'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const { models } = await getTenantDB(request)

    const staff = await models.Staff.findOne({ email, active: true }).select('+password')
    if (!staff) return NextResponse.json({ error: 'Invalid credentials or account is inactive' }, { status: 401 })

    const isPasswordValid = await staff.comparePassword(password)
    if (!isPasswordValid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const owner = await models.User.findById(staff.userId)
    if (!owner) return NextResponse.json({ error: 'Shop owner not found' }, { status: 404 })

    const token = await createToken({
      userId: staff._id.toString(),
      email: staff.email,
      role: staff.role,
      type: 'staff',
      adminId: staff.userId.toString(),
      permissions: staff.permissions,
    })

    await setAuthCookie(token)
    return NextResponse.json({
      message: 'Login successful',
      staff: {
        id: staff._id, name: staff.name, email: staff.email,
        role: staff.role, permissions: staff.permissions, shopName: owner.shopName,
      },
    })
  } catch (error) {
    console.error('[staff-login] error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
