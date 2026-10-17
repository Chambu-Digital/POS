import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_STAFF_PERMISSIONS, DEFAULT_MANAGER_PERMISSIONS, normalisePermissions } from '@/lib/modules'
import { checkEmailExistsAcrossTenants } from '@/lib/auth/check-email-exists'
import { upsertEmailIndex } from '@/lib/email-index'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Only admin users can manage staff' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const staff = await models.Staff.find({ userId: payload.userId }).select('-password').sort({ createdAt: -1 }).lean()
    console.log('[staff GET] Returning staff count:', staff.length, 'Sample:', staff[0])
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
      branchId, managerOfBranches,
    } = await request.json()

    if (!email || !password || !role) return NextResponse.json({ error: 'Email, password and role are required' }, { status: 400 })
    if (!branchId) return NextResponse.json({ error: 'Branch assignment is required for all staff' }, { status: 400 })

    const displayName = name || [firstName, middleName, lastName].filter(Boolean).join(' ') || email

    if (!['cashier', 'manager', 'supervisor', 'employee'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Validate branchId if provided
    if (branchId) {
      const branch = await models.Branch.findOne({ _id: branchId, userId: payload.userId })
      if (!branch) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
      }
    }

    // Validate managerOfBranches if provided
    if (managerOfBranches && Array.isArray(managerOfBranches) && managerOfBranches.length > 0) {
      const branches = await models.Branch.find({ 
        _id: { $in: managerOfBranches }, 
        userId: payload.userId 
      })
      if (branches.length !== managerOfBranches.length) {
        return NextResponse.json({ error: 'Invalid branch in managerOfBranches' }, { status: 400 })
      }
    }

    // Check if email already exists in this tenant
    const existingInTenant = await models.Staff.findOne({ userId: payload.userId, email })
    if (existingInTenant) return NextResponse.json({ error: 'Email already in use in this business' }, { status: 409 })

    // Check if email already exists across all tenants
    const existingAccount = await checkEmailExistsAcrossTenants(email)
    if (existingAccount) {
      return NextResponse.json({ 
        error: 'An account with this email already exists in another business. Please use a different email.' 
      }, { status: 409 })
    }

    const defaultPermissions = role === 'manager'
      ? { ...DEFAULT_MANAGER_PERMISSIONS }
      : { ...DEFAULT_STAFF_PERMISSIONS }

    const staff = new models.Staff({
      userId: payload.userId, name: displayName, email, password, role,
      phone: phone || '', jobDescription: jobDescription || '',
      firstName: firstName || '', middleName: middleName || '', lastName: lastName || '',
      nationalId: nationalId || '', kraPin: kraPin || '', nhifNo: nhifNo || '', nssfNo: nssfNo || '',
      leaveDays: leaveDays ?? 14, salary: salary ?? 0,
      commissionStructure: commissionStructure || '', employmentType: employmentType || '',
      permissions: permissions ? normalisePermissions(permissions) : defaultPermissions,
      branchId: branchId,  // Required
      managerOfBranches: managerOfBranches || [],
    })
    await staff.save()

    // Update email index for fast login
    if (payload.mongoUri) {
      // Extract tenantId from the connection - we need to get it from admin DB
      const { getAdminModels } = await import('@/lib/admin-models')
      const { Tenant } = await getAdminModels()
      const tenant = await Tenant.findOne({ mongoUri: payload.mongoUri }).lean()
      
      if (tenant) {
        await upsertEmailIndex({
          email,
          tenantId: tenant._id.toString(),
          userType: 'staff',
          userId: staff._id.toString(),
          isActive: true
        })
      }
    }

    const staffData = staff.toObject()
    delete staffData.password
    return NextResponse.json(staffData, { status: 201 })
  } catch (error) {
    console.error('[staff] POST error:', error)
    return NextResponse.json({ error: 'Failed to create staff account' }, { status: 500 })
  }
}
