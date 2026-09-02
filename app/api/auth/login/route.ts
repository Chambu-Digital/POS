import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, getDemoUser } from '@/lib/demo'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

// ── Tenant list cache ───────────────────────────────────────────────────────
// Cached for 5 minutes to avoid repeated admin DB queries on every login
interface TenantCache {
  data: Array<{
    _id: any
    mongoUri: string
    features: Record<string, boolean>
    shopName: string
  }>
  timestamp: number
}

declare global {
  // eslint-disable-next-line no-var
  var _tenantListCache: TenantCache | undefined
}

const TENANT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getCachedTenantList() {
  const now = Date.now()
  
  // Return cached data if still valid
  if (global._tenantListCache && (now - global._tenantListCache.timestamp) < TENANT_CACHE_TTL) {
    const age = Math.round((now - global._tenantListCache.timestamp) / 1000)
    console.log(`[login] 📦 Using cached tenant list (age: ${age}s, ${global._tenantListCache.data.length} tenants)`)
    return global._tenantListCache.data
  }
  
  // Fetch fresh data
  console.log('[login] 🔄 Fetching fresh tenant list from admin DB...')
  const { Tenant } = await getAdminModels()
  const tenants = await Tenant.find({ isActive: true }).lean() as unknown as Array<{
    _id: any; mongoUri: string; features: Record<string, boolean>; shopName: string
  }>
  
  // Update cache
  global._tenantListCache = {
    data: tenants,
    timestamp: now
  }
  
  return tenants
}

// ── Candidate match found across tenant search ─────────────────────────────
interface Candidate {
  record: any
  type: 'user' | 'staff'
  mongoUri: string
  features: Record<string, boolean>
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()
  const timings: Record<string, number> = {}
  
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    console.log('\n========================================')
    console.log('[login] 🔐 LOGIN ATTEMPT:', email)
    console.log('[login] Timestamp:', new Date().toISOString())
    console.log('========================================\n')

    // ── Demo shortcut ────────────────────────────────────────────────────────
    if (email.toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const demoCheckTime = Date.now() - requestStartTime
      console.log(`[login] ✓ Demo user detected (${demoCheckTime}ms)`)
      
      const token = await createToken({
        userId: DEMO_USER_ID, email: DEMO_EMAIL, role: 'admin', type: 'user', isDemo: true,
      })
      await setAuthCookie(token)
      
      console.log(`[login] ✓ Demo login completed in ${Date.now() - requestStartTime}ms\n`)
      return NextResponse.json({ message: 'Login successful', user: { ...getDemoUser(), isDemo: true } })
    }

    // ── Search all active tenants ────────────────────────────────────────────
    const tenantLoadStart = Date.now()
    const tenants = await getCachedTenantList()
    timings.tenantLoad = Date.now() - tenantLoadStart

    console.log(`[login] 📊 Loaded ${tenants.length} active tenants in ${timings.tenantLoad}ms`)
    console.log(`[login] Tenants: ${tenants.map(t => t.shopName || 'Unnamed').join(', ')}\n`)

    const ownerCandidates: Candidate[] = []
    const staffCandidates: Candidate[]  = []
    const tenantSearchStart = Date.now()
    let totalConnectionTime = 0
    let totalUserQueryTime = 0
    let totalStaffQueryTime = 0

    console.log('[login] 🔍 Searching across all tenants...\n')

    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i]
      const tenantStart = Date.now()
      
      try {
        const connStart = Date.now()
        const conn   = await connectTenantDB(tenant.mongoUri)
        const connTime = Date.now() - connStart
        totalConnectionTime += connTime
        
        const models = getModels(conn)
        const features = normaliseFeatures(tenant.features || {})

        // Owner match
        const userQueryStart = Date.now()
        const userRecord = await models.User.findOne({ email }).select('+password')
        const userQueryTime = Date.now() - userQueryStart
        totalUserQueryTime += userQueryTime
        
        if (userRecord) {
          console.log(`[login]   Tenant ${i+1}/${tenants.length} (${tenant.shopName}): ✓ OWNER found (conn: ${connTime}ms, query: ${userQueryTime}ms)`)
          ownerCandidates.push({ record: userRecord, type: 'user', mongoUri: tenant.mongoUri, features })
        } else {
          console.log(`[login]   Tenant ${i+1}/${tenants.length} (${tenant.shopName}): - no owner (conn: ${connTime}ms, query: ${userQueryTime}ms)`)
        }

        // Staff match (only active staff)
        const staffQueryStart = Date.now()
        const staff = await models.Staff.findOne({ email, active: true }).select('+password')
        const staffQueryTime = Date.now() - staffQueryStart
        totalStaffQueryTime += staffQueryTime
        
        if (staff) {
          console.log(`[login]   Tenant ${i+1}/${tenants.length} (${tenant.shopName}): ✓ STAFF found (staff query: ${staffQueryTime}ms)`)
          staffCandidates.push({ record: staff, type: 'staff', mongoUri: tenant.mongoUri, features })
        }

        const tenantTime = Date.now() - tenantStart
        console.log(`[login]   Tenant ${i+1}/${tenants.length} total time: ${tenantTime}ms\n`)
        
      } catch (err) {
        console.error(`[login]   Tenant ${i+1}/${tenants.length} (${tenant.shopName}): ✗ ERROR -`, err)
        continue
      }
    }
    
    timings.tenantSearch = Date.now() - tenantSearchStart
    timings.avgConnectionTime = tenants.length > 0 ? Math.round(totalConnectionTime / tenants.length) : 0
    timings.avgUserQueryTime = tenants.length > 0 ? Math.round(totalUserQueryTime / tenants.length) : 0
    timings.avgStaffQueryTime = tenants.length > 0 ? Math.round(totalStaffQueryTime / tenants.length) : 0
    
    console.log('[login] 📊 Tenant search summary:')
    console.log(`[login]   Total time: ${timings.tenantSearch}ms`)
    console.log(`[login]   Avg connection time: ${timings.avgConnectionTime}ms`)
    console.log(`[login]   Avg user query time: ${timings.avgUserQueryTime}ms`)
    console.log(`[login]   Avg staff query time: ${timings.avgStaffQueryTime}ms`)
    console.log(`[login]   Owner candidates: ${ownerCandidates.length}`)
    console.log(`[login]   Staff candidates: ${staffCandidates.length}\n`)

    // ── Fallback: default DB (localhost dev / single-tenant) ─────────────────
    // Only check default DB if no candidates found in any tenant
    // This avoids unnecessary queries in multi-tenant production environments
    const defaultDbStart = Date.now()
    
    if (ownerCandidates.length === 0 && staffCandidates.length === 0) {
      console.log('[login] 🔍 No tenant candidates found, checking default DB...')
      
      const defaultConn = mongoose.connection.readyState === 1
        ? mongoose.connection
        : (await connectDB(), mongoose.connection)
      const defaultModels = getModels(defaultConn)

      const defaultUser = await defaultModels.User.findOne({ email }).select('+password')
      if (defaultUser) {
        console.log('[login]   ✓ Owner candidate in default DB')
        ownerCandidates.push({ record: defaultUser, type: 'user', mongoUri: '', features: DEFAULT_MODULE_FEATURES })
      }
      const defaultStaff = await defaultModels.Staff.findOne({ email, active: true }).select('+password')
      if (defaultStaff) {
        console.log('[login]   ✓ Staff candidate in default DB')
        staffCandidates.push({ record: defaultStaff, type: 'staff', mongoUri: '', features: DEFAULT_MODULE_FEATURES })
      }
      
      timings.defaultDbCheck = Date.now() - defaultDbStart
      console.log(`[login] Default DB check completed in ${timings.defaultDbCheck}ms\n`)
    } else {
      console.log('[login] ⏩ Skipping default DB check (candidates found in tenants)\n')
      timings.defaultDbCheck = 0
    }

    // ── Pick the winning candidate ───────────────────────────────────────────
    const candidateSelectionStart = Date.now()
    console.log('[login] 🎯 Selecting winner from candidates...')
    
    const allCandidates: Candidate[] = [...ownerCandidates, ...staffCandidates]

    if (allCandidates.length === 0) {
      console.log('[login] ✗ No account found for:', email)
      console.log(`[login] ⏱️  Total login attempt time: ${Date.now() - requestStartTime}ms\n`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    let winner: Candidate | null = null
    let passwordCheckTime = 0

    // Owner pass first
    for (const c of ownerCandidates) {
      const pwCheckStart = Date.now()
      const valid = await c.record.comparePassword(password)
      passwordCheckTime += Date.now() - pwCheckStart
      
      if (valid) { 
        winner = c
        console.log('[login]   ✓ Winner: OWNER (password matched)')
        break 
      }
    }

    // Staff pass only if no owner matched
    if (!winner) {
      for (const c of staffCandidates) {
        const pwCheckStart = Date.now()
        const valid = await c.record.comparePassword(password)
        passwordCheckTime += Date.now() - pwCheckStart
        
        if (valid) { 
          winner = c
          console.log('[login]   ✓ Winner: STAFF (password matched)')
          break 
        }
      }
    }

    timings.candidateSelection = Date.now() - candidateSelectionStart
    timings.passwordCheckTime = passwordCheckTime
    console.log(`[login] Candidate selection took ${timings.candidateSelection}ms (password checks: ${passwordCheckTime}ms)\n`)

    if (!winner) {
      console.log('[login] ✗ Password did not match any candidate for:', email,
        `(${ownerCandidates.length} owner, ${staffCandidates.length} staff candidates)`)
      console.log(`[login] ⏱️  Total login attempt time: ${Date.now() - requestStartTime}ms\n`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    console.log('[login] ✓ Login successful as', winner.type, 'for:', email)

    if (winner.type === 'user') {
      winner.record.lastLogin = new Date()
      await winner.record.save()
    }

    const tokenStart = Date.now()
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
    timings.tokenCreation = Date.now() - tokenStart

    await setAuthCookie(token)
    
    timings.total = Date.now() - requestStartTime
    
    console.log('\n========================================')
    console.log('[login] ✅ LOGIN SUCCESS')
    console.log('[login] 📊 PERFORMANCE SUMMARY:')
    console.log(`[login]   Tenant load:           ${timings.tenantLoad}ms`)
    console.log(`[login]   Tenant search:         ${timings.tenantSearch}ms`)
    console.log(`[login]     - Avg connection:    ${timings.avgConnectionTime}ms`)
    console.log(`[login]     - Avg user query:    ${timings.avgUserQueryTime}ms`)
    console.log(`[login]     - Avg staff query:   ${timings.avgStaffQueryTime}ms`)
    console.log(`[login]   Default DB check:      ${timings.defaultDbCheck}ms`)
    console.log(`[login]   Candidate selection:   ${timings.candidateSelection}ms`)
    console.log(`[login]     - Password checks:   ${timings.passwordCheckTime}ms`)
    console.log(`[login]   Token creation:        ${timings.tokenCreation}ms`)
    console.log(`[login]   ⏱️  TOTAL:              ${timings.total}ms`)
    console.log('========================================\n')
    
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
    console.error('[login] ✗ ERROR:', error)
    console.log(`[login] ⏱️  Failed after ${Date.now() - requestStartTime}ms\n`)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
