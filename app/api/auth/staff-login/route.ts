import { connectDB } from '@/lib/db'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { getAdminModels } from '@/lib/admin-models'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find({ isActive: true }).lean() as Array<{
      _id: any; mongoUri: string; features: Record<string, boolean>
    }>

    let foundStaff: any = null
    let foundOwner: any = null
    let foundMongoUri = ''
    let foundFeatures: Record<string, boolean> = DEFAULT_MODULE_FEATURES

    for (const tenant of tenants) {
      try {
        const conn = await connectTenantDB(tenant.mongoUri)
        const models = getModels(conn)

        const staff = await models.Staff.findOne({ email, active: true }).select('+password')
        if (staff) {
          const owner = await models.User.findById(staff.userId)
          if (owner) {
            foundStaff = staff
            foundOwner = owner
            foundMongoUri = tenant.mongoUri
            foundFeatures = normaliseFeatures(tenant.features || {})
            break
          }
        }
      } catch {
        continue
      }
    }

    // Fallback: default DB
    if (!foundStaff) {
      const conn = mongoose.connection.readyState === 1
        ? mongoose.connection
        : (await connectDB(), mongoose.connection)
      const models = getModels(conn)
      const staff = await models.Staff.findOne({ email, active: true }).select('+password')
      if (staff) {
        const owner = await models.User.findById(staff.userId)
        if (owner) { foundStaff = staff; foundOwner = owner }
      }
    }

    if (!foundStaff) {
      return NextResponse.json({ error: 'Invalid credentials or account is inactive' }, { status: 401 })
    }

    const isPasswordValid = await foundStaff.comparePassword(password)
    if (!isPasswordValid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const token = await createToken({
      userId: foundStaff._id.toString(),
      email: foundStaff.email,
      role: foundStaff.role,
      type: 'staff',
      adminId: foundStaff.userId.toString(),
      mongoUri: foundMongoUri || undefined,
      tenantFeatures: foundMongoUri ? foundFeatures : undefined,
      permissions: foundStaff.permissions,
    })

    await setAuthCookie(token)
    return NextResponse.json({
      message: 'Login successful',
      staff: {
        id: foundStaff._id, name: foundStaff.name, email: foundStaff.email,
        role: foundStaff.role, permissions: foundStaff.permissions,
        shopName: foundOwner.shopName,
      },
    })
  } catch (error) {
    console.error('[staff-login] error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
