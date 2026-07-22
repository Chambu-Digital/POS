import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { normalisePermissions } from '@/lib/modules'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)

    if (payload.type === 'user') {
      const user = await models.User.findById(payload.userId)
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      // Get branches for this user
      const branches = await models.Branch.find({ userId: payload.userId, status: 'active' }).lean()
      
      // Get selected branch or default
      let selectedBranch = null
      if (payload.branchId) {
        selectedBranch = branches.find(b => b._id.toString() === payload.branchId)
      } else {
        selectedBranch = branches.find(b => b.isDefault) || branches[0] || null
      }

      return NextResponse.json({
        user: {
          id: user._id, email: user.email, name: user.shopName, shopName: user.shopName,
          role: user.role, type: 'user', position: (user as any).position || 'OWNER',
          firstName: (user as any).firstName || '', middleName: (user as any).middleName || '',
          lastName: (user as any).lastName || '', phone: (user as any).phone || '',
          nationalId: (user as any).nationalId || '', kraPin: (user as any).kraPin || '',
          createdAt: (user as any).createdAt,
          branches,
          selectedBranch,
        },
      })
    } else {
      const staff = await models.Staff.findById(payload.userId)
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

      const adminUser = await models.User.findById(staff.userId)
      
      // Get branches for the admin (staff can only access branches assigned to them)
      const branches = await models.Branch.find({ userId: staff.userId, status: 'active' }).lean()
      
      // Get selected branch or default
      let selectedBranch = null
      if (payload.branchId) {
        selectedBranch = branches.find(b => b._id.toString() === payload.branchId)
      } else {
        selectedBranch = branches.find(b => b.isDefault) || branches[0] || null
      }

      return NextResponse.json({
        user: {
          id: staff._id, email: staff.email, name: staff.name,
          shopName: adminUser?.shopName || 'Shop',
          role: staff.role, type: 'staff',
          permissions: normalisePermissions(staff.permissions || {}),
          branches,
          selectedBranch,
        },
      })
    }
  } catch (error) {
    console.error('[me] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (payload.type !== 'user') return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { models } = await getTenantDB(request)
    const body = await request.json()
    const allowed = ['firstName', 'middleName', 'lastName', 'phone', 'nationalId', 'kraPin', 'shopName']
    const update: Record<string, string> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key]
    }

    const user = await models.User.findByIdAndUpdate(payload.userId, { $set: update }, { new: true })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({
      user: {
        id: user._id, email: user.email, name: user.shopName, shopName: user.shopName,
        role: user.role, type: 'user', position: (user as any).position || 'OWNER',
        firstName: (user as any).firstName || '', middleName: (user as any).middleName || '',
        lastName: (user as any).lastName || '', phone: (user as any).phone || '',
        nationalId: (user as any).nationalId || '', kraPin: (user as any).kraPin || '',
        createdAt: (user as any).createdAt,
      },
    })
  } catch (error) {
    console.error('[me] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
