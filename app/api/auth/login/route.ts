import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, getDemoUser } from '@/lib/demo'
import { normaliseFeatures, normalisePermissions, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { findUserByEmail } from '@/lib/email-index'
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

    // ── Fast email lookup using index ───────────────────────────────────────
    const indexLookupStart = Date.now()
    console.log('[login] 🔍 Looking up email in index...')
    
    const emailEntries = await findUserByEmail(email)
    timings.indexLookup = Date.now() - indexLookupStart
    
    console.log(`[login] 📊 Index lookup completed in ${timings.indexLookup}ms`)
    console.log(`[login] Found ${emailEntries.length} entries for ${email}\n`)

    // ── Search specific tenants only ─────────────────────────────────────────
    const ownerCandidates: Candidate[] = []
    const staffCandidates: Candidate[]  = []
    
    if (emailEntries.length > 0) {
      console.log('[login] 🎯 Searching specific tenant(s) from index...\n')
      
      const tenantSearchStart = Date.now()
      const { Tenant } = await getAdminModels()
      let totalConnectionTime = 0
      let totalQueryTime = 0
      
      for (let i = 0; i < emailEntries.length; i++) {
        const entry = emailEntries[i]
        const entryStart = Date.now()
        
        try {
          // Get tenant info
          const tenant = await Tenant.findById(entry.tenantId).lean() as any
          if (!tenant || !tenant.isActive) {
            console.log(`[login]   Entry ${i+1}/${emailEntries.length}: ✗ Tenant not found or inactive`)
            continue
          }
          
          console.log(`[login]   Entry ${i+1}/${emailEntries.length} (${tenant.shopName}): Checking ${entry.userType}...`)
          
          // Connect to tenant DB
          const connStart = Date.now()
          const conn = await connectTenantDB(tenant.mongoUri)
          const connTime = Date.now() - connStart
          totalConnectionTime += connTime
          
          const models = getModels(conn)
          const features = normaliseFeatures(tenant.features || {})
          
          // Query only the specific user type
          const queryStart = Date.now()
          if (entry.userType === 'user') {
            const userRecord = await models.User.findOne({ email }).select('+password')
            const queryTime = Date.now() - queryStart
            totalQueryTime += queryTime
            
            if (userRecord) {
              console.log(`[login]   ✓ OWNER found (conn: ${connTime}ms, query: ${queryTime}ms)`)
              ownerCandidates.push({ 
                record: userRecord, 
                type: 'user', 
                mongoUri: tenant.mongoUri, 
                features 
              })
            } else {
              console.log(`[login]   ✗ Owner not found (index may be stale)`)
            }
          } else {
            const staffRecord = await models.Staff.findOne({ email, active: true }).select('+password')
            const queryTime = Date.now() - queryStart
            totalQueryTime += queryTime
            
            if (staffRecord) {
              console.log(`[login]   ✓ STAFF found (conn: ${connTime}ms, query: ${queryTime}ms)`)
              staffCandidates.push({ 
                record: staffRecord, 
                type: 'staff', 
                mongoUri: tenant.mongoUri, 
                features 
              })
            } else {
              console.log(`[login]   ✗ Staff not found or inactive (index may be stale)`)
            }
          }
          
          const entryTime = Date.now() - entryStart
          console.log(`[login]   Entry ${i+1}/${emailEntries.length} total time: ${entryTime}ms\n`)
          
        } catch (err) {
          console.error(`[login]   Entry ${i+1}/${emailEntries.length}: ✗ ERROR -`, err)
          continue
        }
      }
      
      timings.tenantSearch = Date.now() - tenantSearchStart
      timings.avgConnectionTime = emailEntries.length > 0 ? Math.round(totalConnectionTime / emailEntries.length) : 0
      timings.avgQueryTime = emailEntries.length > 0 ? Math.round(totalQueryTime / emailEntries.length) : 0
      
      console.log('[login] 📊 Tenant search summary:')
      console.log(`[login]   Total time: ${timings.tenantSearch}ms`)
      console.log(`[login]   Tenants checked: ${emailEntries.length}`)
      console.log(`[login]   Avg connection time: ${timings.avgConnectionTime}ms`)
      console.log(`[login]   Avg query time: ${timings.avgQueryTime}ms`)
      console.log(`[login]   Owner candidates: ${ownerCandidates.length}`)
      console.log(`[login]   Staff candidates: ${staffCandidates.length}\n`)
    } else {
      timings.tenantSearch = 0
      timings.avgConnectionTime = 0
      timings.avgQueryTime = 0
      console.log('[login] ℹ️  No index entries found\n')
    }

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
    
    // Build token payload based on user type
    const tokenPayload: any = {
      userId:         winner.record._id.toString(),
      email:          winner.record.email,
      role:           winner.record.role,
      type:           winner.type,
      adminId:        winner.type === 'staff' ? winner.record.userId?.toString() : undefined,
      mongoUri:       winner.mongoUri || undefined,
      tenantFeatures: winner.mongoUri ? winner.features : undefined,
      permissions:    winner.type === 'staff' ? normalisePermissions(winner.record.permissions || {}) : undefined,
    }
    
    // Add staff-specific fields
    if (winner.type === 'staff') {
      const staff = winner.record
      tokenPayload.branchId = staff.branchId?.toString()
      tokenPayload.isBranchManager = staff.managerOfBranches && staff.managerOfBranches.length > 0
      tokenPayload.managerOfBranches = staff.managerOfBranches 
        ? staff.managerOfBranches.map((id: any) => id.toString())
        : []
    }
    
    const token = await createToken(tokenPayload)
    timings.tokenCreation = Date.now() - tokenStart

    await setAuthCookie(token)
    
    timings.total = Date.now() - requestStartTime
    
    console.log('\n========================================')
    console.log('[login] ✅ LOGIN SUCCESS')
    if (winner.type === 'staff' && tokenPayload.branchId) {
      console.log(`[login] Staff Branch: ${tokenPayload.branchId}`)
      if (tokenPayload.isBranchManager) {
        console.log(`[login] Branch Manager: manages ${tokenPayload.managerOfBranches.length} branch(es)`)
      }
    }
    console.log('[login] 📊 PERFORMANCE SUMMARY:')
    console.log(`[login]   Index lookup:         ${timings.indexLookup}ms`)
    console.log(`[login]   Tenant search:        ${timings.tenantSearch}ms`)
    console.log(`[login]     - Tenants checked:  ${emailEntries.length}`)
    console.log(`[login]     - Avg connection:   ${timings.avgConnectionTime}ms`)
    console.log(`[login]     - Avg query:        ${timings.avgQueryTime}ms`)
    console.log(`[login]   Default DB check:     ${timings.defaultDbCheck}ms`)
    console.log(`[login]   Candidate selection:  ${timings.candidateSelection}ms`)
    console.log(`[login]     - Password checks:  ${timings.passwordCheckTime}ms`)
    console.log(`[login]   Token creation:       ${timings.tokenCreation}ms`)
    console.log(`[login]   ⏱️  TOTAL:             ${timings.total}ms`)
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
