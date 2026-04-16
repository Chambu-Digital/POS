import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Only admin users can manage staff' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const staff = await models.Staff.find({ userId: payload.userId }).select('-password').sort({ createdAt: -1 })
    return NextResponse.json({ staff })
  } catch (error) {
    console.error('[staff] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Only admin users can create staff accounts' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const {
      name, email, password, role, permissions, phone, jobDescription,
      firstName, middleName, lastName, nationalId, kraPin, nhifNo, nssfNo,
      leaveDays, salary, commissionStructure, employmentType,
    } = await request.json()

    if (!email || !password || !role) return NextResponse.json({ error: 'Email, password and role are required' }, { status: 400 })

    const displayName = name || [firstName, middleName, lastName].filter(Boolean).join(' ') || email

    if (!['cashier', 'manager', 'supervisor', 'employee'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const existing = await models.Staff.findOne({ userId: payload.userId, email })
    if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const defaultPermissions = role === 'manager'
      ? { canMakeSales: true, canViewInventory: true, canEditInventory: true, canAddProducts: true, canDeleteProducts: true, canViewSalesReports: true, canManageStaff: false, canEditSettings: false, canProcessRefunds: true, canApplyDiscounts: true }
      : { canMakeSales: true, canViewInventory: true, canEditInventory: false, canAddProducts: false, canDeleteProducts: false, canViewSalesReports: false, canManageStaff: false, canEditSettings: false, canProcessRefunds: false, canApplyDiscounts: true }

    const staff = new models.Staff({
      userId: payload.userId, name: displayName, email, password, role,
      phone: phone || '', jobDescription: jobDescription || '',
      firstName: firstName || '', middleName: middleName || '', lastName: lastName || '',
      nationalId: nationalId || '', kraPin: kraPin || '', nhifNo: nhifNo || '', nssfNo: nssfNo || '',
      leaveDays: leaveDays ?? 14, salary: salary ?? 0,
      commissionStructure: commissionStructure || '', employmentType: employmentType || '',
      permissions: permissions || defaultPermissions,
    })
    await staff.save()

    const staffData = staff.toObject()
    delete staffData.password
    return NextResponse.json(staffData, { status: 201 })
  } catch (error) {
    console.error('[staff] POST error:', error)
    return NextResponse.json({ error: 'Failed to create staff account' }, { status: 500 })
  }
}
