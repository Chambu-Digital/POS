import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Only admin users can update staff accounts' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const data = await request.json()
    const { id } = await params

    const staff = await models.Staff.findOne({ _id: new Types.ObjectId(id), userId: payload.userId })
      .select(data.password ? '+password' : '')
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    // Validate branchId if being updated
    if (data.branchId !== undefined) {
      if (data.branchId) {
        const branch = await models.Branch.findOne({ _id: data.branchId, userId: payload.userId })
        if (!branch) {
          return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
        }
      }
      
      // If setting as branch manager, check for existing manager
      if (data.isBranchManager && data.branchId) {
        const existingManager = await models.Staff.findOne({
          userId: payload.userId,
          branchId: data.branchId,
          isBranchManager: true,
          _id: { $ne: staff._id },  // Exclude current staff
        })
        if (existingManager) {
          return NextResponse.json({ 
            error: 'This branch already has a manager. Please remove the existing manager first.' 
          }, { status: 409 })
        }
      }
    }

    const fields = ['name','role','active','permissions','phone','jobDescription','firstName','middleName',
      'lastName','nationalId','kraPin','nhifNo','nssfNo','leaveDays','salary','commissionStructure',
      'employmentType','branchId','isBranchManager']
    fields.forEach(f => { if (data[f] !== undefined) (staff as any)[f] = data[f] })
    if (data.password) staff.password = data.password

    await staff.save()
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
    return NextResponse.json({ message: 'Staff deleted' })
  } catch (error) {
    console.error('[staff] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}
