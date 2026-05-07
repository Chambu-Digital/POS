import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, getDemoUser } from '@/lib/demo'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    console.log('[login] Attempting login for:', email)

    // ── Demo shortcut ────────────────────────────────────────────────────────
    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const token = await createToken({
        userId: DEMO_USER_ID, email: DEMO_EMAIL, role: 'admin', type: 'user', isDemo: true,
      })
      await setAuthCookie(token)
      return NextResponse.json({ message: 'Login successful', user: { ...getDemoUser(), isDemo: true } })
    }

    // ── Find which tenant this email belongs to ──────────────────────────────
    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find({ isActive: true }).lean() as unknown as Array<{
      _id: any; mongoUri: string; features: Record<string, boolean>; shopName: string
    }>

    console.log('[login] Found', tenants.length, 'active tenants')

    let foundUser: any = null
    let foundUserType: 'user' | 'staff' = 'user'
    let foundMongoUri = ''
    let foundFeatures: Record<string, boolean> = DEFAULT_MODULE_FEATURES

    for (const tenant of tenants) {
      try {
        console.log('[login] Checking tenant:', tenant.mongoUri)
        const conn = await connectTenantDB(tenant.mongoUri)
        const models = getModels(conn)

        // Try owner first
        let user = await models.User.findOne({ email }).select('+password')
        if (user) {
          console.log('[login] Found user in tenant:', tenant.mongoUri)
          foundUser = user
          foundUserType = 'user'
          foundMongoUri = tenant.mongoUri
          foundFeatures = normaliseFeatures(tenant.features || {})
          break
        }

        // Try staff
        const staff = await models.Staff.findOne({ email, active: true }).select('+password')
        if (staff) {
          console.log('[login] Found staff in tenant:', tenant.mongoUri)
          foundUser = staff
          foundUserType = 'staff'
          foundMongoUri = tenant.mongoUri
          foundFeatures = normaliseFeatures(tenant.features || {})
          break
        }
      } catch (err) {
        console.error('[login] Error checking tenant:', tenant.mongoUri, err)
        // Skip unreachable tenant DBs
        continue
      }
    }

    // ── Fallback: default DB (localhost dev / single-tenant) ─────────────────
    if (!foundUser) {
      console.log('[login] Checking fallback default DB')
      const conn = mongoose.connection.readyState === 1
        ? mongoose.connection
        : (await connectDB(), mongoose.connection)
      const models = getModels(conn)

      let user = await models.User.findOne({ email }).select('+password')
      if (user) {
        console.log('[login] Found user in default DB')
        foundUser = user; foundUserType = 'user'
      } else {
        const staff = await models.Staff.findOne({ email, active: true }).select('+password')
        if (staff) { 
          console.log('[login] Found staff in default DB')
          foundUser = staff; foundUserType = 'staff' 
        }
      }
      // No mongoUri for default DB — getTenantDB will fall back automatically
    }

    if (!foundUser) {
      console.log('[login] User not found:', email)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const isPasswordValid = await foundUser.comparePassword(password)
    if (!isPasswordValid) {
      console.log('[login] Invalid password for:', email)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    console.log('[login] Login successful for:', email)

    if (foundUserType === 'user') {
      foundUser.lastLogin = new Date()
      await foundUser.save()
    }

    const token = await createToken({
      userId: foundUser._id.toString(),
      email: foundUser.email,
      role: foundUser.role,
      type: foundUserType,
      adminId: foundUserType === 'staff' ? foundUser.userId?.toString() : undefined,
      mongoUri: foundMongoUri || undefined,
      tenantFeatures: foundMongoUri ? foundFeatures : undefined,
      permissions: foundUserType === 'staff' ? foundUser.permissions : undefined,
    })

    await setAuthCookie(token)
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: foundUser._id,
        email: foundUser.email,
        name: foundUserType === 'staff' ? foundUser.name : foundUser.shopName,
        role: foundUser.role,
        type: foundUserType,
      },
    })
  } catch (error) {
    console.error('[login] error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
