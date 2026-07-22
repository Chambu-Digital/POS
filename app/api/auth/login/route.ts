import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, getDemoUser } from '@/lib/demo'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

// ── Candidate match found across tenant search ─────────────────────────────
interface Candidate {
  record: any
  type: 'user' | 'staff'
  mongoUri: string
  features: Record<string, boolean>
}

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

    // ── Search all active tenants ────────────────────────────────────────────
    // We collect ALL matches across every tenant before deciding which to use.
    //
    // Why: the same email can legitimately appear in multiple tenants:
    //   - as a staff member in Tenant A (employed there)
    //   - as an owner (User) in Tenant B (their own shop)
    //
    // Priority: an owner (User) match always wins over a staff match.
    // If multiple owner matches exist (shouldn't happen, but possible), the
    // one whose password matches the entered password wins.
    // If only staff matches exist, pick the one whose password matches.
    //
    // We never stop at the first match — we must check all tenants so that
    // a staff record in one tenant doesn't shadow an owner record in another.

    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find({ isActive: true }).lean() as unknown as Array<{
      _id: any; mongoUri: string; features: Record<string, boolean>; shopName: string
    }>

    console.log('[login] Found', tenants.length, 'active tenants')

    const ownerCandidates: Candidate[] = []
    const staffCandidates: Candidate[]  = []

    for (const tenant of tenants) {
      try {
        const conn   = await connectTenantDB(tenant.mongoUri)
        const models = getModels(conn)
        const features = normaliseFeatures(tenant.features || {})

        // Owner match
        const user = await models.User.findOne({ email }).select('+password')
        if (user) {
          console.log('[login] Owner candidate in tenant:', tenant.mongoUri)
          ownerCandidates.push({ record: user, type: 'user', mongoUri: tenant.mongoUri, features })
        }

        // Staff match (only active staff)
        const staff = await models.Staff.findOne({ email, active: true }).select('+password')
        if (staff) {
          console.log('[login] Staff candidate in tenant:', tenant.mongoUri)
          staffCandidates.push({ record: staff, type: 'staff', mongoUri: tenant.mongoUri, features })
        }
      } catch (err) {
        console.error('[login] Error checking tenant:', tenant.mongoUri, err)
        continue
      }
    }

    // ── Fallback: default DB (localhost dev / single-tenant) ─────────────────
    // Check the default connection last, after all registered tenants.
    const defaultConn = mongoose.connection.readyState === 1
      ? mongoose.connection
      : (await connectDB(), mongoose.connection)
    const defaultModels = getModels(defaultConn)

    const defaultUser = await defaultModels.User.findOne({ email }).select('+password')
    if (defaultUser) {
      console.log('[login] Owner candidate in default DB')
      ownerCandidates.push({ record: defaultUser, type: 'user', mongoUri: '', features: DEFAULT_MODULE_FEATURES })
    }
    const defaultStaff = await defaultModels.Staff.findOne({ email, active: true }).select('+password')
    if (defaultStaff) {
      console.log('[login] Staff candidate in default DB')
      staffCandidates.push({ record: defaultStaff, type: 'staff', mongoUri: '', features: DEFAULT_MODULE_FEATURES })
    }

    // ── Pick the winning candidate ───────────────────────────────────────────
    // 1. Try all owner candidates first — password match wins immediately.
    // 2. Fall back to staff candidates only if no owner password matched.
    // This means a person who is both staff somewhere and an owner elsewhere
    // will always be logged in as their own shop's owner.

    const allCandidates: Candidate[] = [...ownerCandidates, ...staffCandidates]

    if (allCandidates.length === 0) {
      console.log('[login] No account found for:', email)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    let winner: Candidate | null = null

    // Owner pass first
    for (const c of ownerCandidates) {
      const valid = await c.record.comparePassword(password)
      if (valid) { winner = c; break }
    }

    // Staff pass only if no owner matched
    if (!winner) {
      for (const c of staffCandidates) {
        const valid = await c.record.comparePassword(password)
        if (valid) { winner = c; break }
      }
    }

    if (!winner) {
      // At least one account was found but password didn't match any of them
      console.log('[login] Password did not match any candidate for:', email,
        `(${ownerCandidates.length} owner, ${staffCandidates.length} staff candidates)`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    console.log('[login] Login successful as', winner.type, 'for:', email)

    if (winner.type === 'user') {
      winner.record.lastLogin = new Date()
      await winner.record.save()
    }

    const token = await createToken({
      userId:         winner.record._id.toString(),
      email:          winner.record.email,
      role:           winner.record.role,
      type:           winner.type,
      adminId:        winner.type === 'staff' ? winner.record.userId?.toString() : undefined,
      mongoUri:       winner.mongoUri || undefined,
      tenantFeatures: winner.mongoUri ? winner.features : undefined,
      permissions:    winner.type === 'staff' ? winner.record.permissions : undefined,
    })

    await setAuthCookie(token)
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id:    winner.record._id,
        email: winner.record.email,
        name:  winner.type === 'staff' ? winner.record.name : winner.record.shopName,
        role:  winner.record.role,
        type:  winner.type,
      },
    })
  } catch (error) {
    console.error('[login] error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
