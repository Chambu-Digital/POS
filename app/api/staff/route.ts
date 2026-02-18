import { connectDB } from '@/lib/db'
import Staff from '@/lib/models/Staff'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin users can view staff
    if (payload.type !== 'user') {
      return NextResponse.json(
        { error: 'Only admin users can manage staff' },
        { status: 403 }
      )
    }

    await connectDB()

    const staff = await Staff.find({ userId: payload.userId })
      .select('-password')
      .sort({ createdAt: -1 })

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('[v0] Staff GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
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

    // Only admin users can create staff
    if (payload.type !== 'user') {
      return NextResponse.json(
        { error: 'Only admin users can create staff accounts' },
        { status: 403 }
      )
    }

    await connectDB()
    const { name, email, password, role, permissions } = await request.json()

    // Validate
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (!['cashier', 'manager'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Check if email already exists for this user
    const existing = await Staff.findOne({ userId: payload.userId, email })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      )
    }

    // Set default permissions based on role if not provided
    const defaultPermissions = role === 'manager' ? {
      canMakeSales: true,
      canViewInventory: true,
      canEditInventory: true,
      canAddProducts: true,
      canDeleteProducts: true,
      canViewSalesReports: true,
      canManageStaff: false,
      canEditSettings: false,
      canProcessRefunds: true,
      canApplyDiscounts: true,
    } : {
      canMakeSales: true,
      canViewInventory: true,
      canEditInventory: false,
      canAddProducts: false,
      canDeleteProducts: false,
      canViewSalesReports: false,
      canManageStaff: false,
      canEditSettings: false,
      canProcessRefunds: false,
      canApplyDiscounts: true,
    }

    // Create staff
    const staff = new Staff({
      userId: payload.userId,
      name,
      email,
      password,
      role,
      permissions: permissions || defaultPermissions,
    })

    await staff.save()

    const staffData = staff.toObject()
    delete staffData.password

    return NextResponse.json(staffData, { status: 201 })
  } catch (error) {
    console.error('[v0] Staff POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create staff account' },
      { status: 500 }
    )
  }
}
