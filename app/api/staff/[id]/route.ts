import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { activateEmailIndex, deactivateEmailIndex, removeEmailIndex } from '@/lib/email-index'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Only admin users can view staff' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const { id } = await params

    const staff = await models.Staff.findOne({ _id: new Types.ObjectId(id), userId: payload.userId }).select('-password')
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('[staff] GET by id error:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Only admin users can update staff accounts' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const { id } = await params

    console.log('[staff PUT] Updating staff:', id, 'with data:', JSON.stringify(data, null, 2))

    const staff = await models.Staff.findOne({ _id: new Types.ObjectId(id), userId: payload.userId })
      .select(data.password ? '+password' : '')
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    // Validate branchId if being updated
    if (data.branchId !== undefined) {
      if (!data.branchId) {
        return NextResponse.json({ error: 'Branch assignment is required for all staff' }, { status: 400 })
      }
      const branch = await models.Branch.findOne({ _id: data.branchId, userId: payload.userId })
      if (!branch) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
      }
    }

    const fields = ['name','role','active','permissions','phone','jobDescription','firstName','middleName',
      'lastName','nationalId','kraPin','nhifNo','nssfNo','leaveDays','salary','commissionStructure',
      'employmentType','branchId','managerOfBranches']
    
    // Track if active status is changing
    const oldActive = staff.active
    
    // Validate managerOfBranches if being updated
    if (data.managerOfBranches !== undefined && Array.isArray(data.managerOfBranches) && data.managerOfBranches.length > 0) {
      const branches = await models.Branch.find({ 
        _id: { $in: data.managerOfBranches }, 
        userId: payload.userId 
      })
      if (branches.length !== data.managerOfBranches.length) {
        return NextResponse.json({ error: 'Invalid branch in managerOfBranches' }, { status: 400 })
      }
    }
    
    fields.forEach(f => { if (data[f] !== undefined) (staff as any)[f] = data[f] })
    if (data.password) staff.password = data.password

    await staff.save()
    
    // Update email index if active status changed
    if (data.active !== undefined && oldActive !== data.active && payload.mongoUri) {
      const { getAdminModels } = await import('@/lib/admin-models')
      const { Tenant } = await getAdminModels()
      const tenant = await Tenant.findOne({ mongoUri: payload.mongoUri }).lean()
      
      if (tenant) {
        if (data.active) {
          await activateEmailIndex({
            email: staff.email,
            tenantId: tenant._id.toString(),
            userType: 'staff'
          })
        } else {
          await deactivateEmailIndex({
            email: staff.email,
            tenantId: tenant._id.toString(),
            userType: 'staff'
          })
        }
      }
    }
    
    console.log('[staff PUT] Updated staff successfully:', staff._id)
    
    const staffData = staff.toObject()
    delete staffData.password
    return NextResponse.json(staffData)
  } catch (error) {
    console.error('[staff] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Only admin users can delete staff accounts' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const { id } = await params

    const staff = await models.Staff.findOneAndDelete({ _id: new Types.ObjectId(id), userId: payload.userId })
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    
    // Remove from email index
    if (payload.mongoUri) {
      const { getAdminModels } = await import('@/lib/admin-models')
      const { Tenant } = await getAdminModels()
      const tenant = await Tenant.findOne({ mongoUri: payload.mongoUri }).lean()
      
      if (tenant) {
        await removeEmailIndex({
          email: staff.email,
          tenantId: tenant._id.toString(),
          userType: 'staff'
        })
      }
    }
    
    return NextResponse.json({ message: 'Staff deleted' })
  } catch (error) {
    console.error('[staff] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}
