import { connectDB } from '@/lib/db'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { getAdminModels } from '@/lib/admin-models'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'

// ── Tenant list cache (shared with login route) ────────────────────────────
interface TenantCache {
  data: Array<{
    _id: any
    mongoUri: string
    features: Record<string, boolean>
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
  
  if (global._tenantListCache && (now - global._tenantListCache.timestamp) < TENANT_CACHE_TTL) {
    const age = Math.round((now - global._tenantListCache.timestamp) / 1000)
    console.log(`[staff-login] 📦 Using cached tenant list (age: ${age}s)`)
    return global._tenantListCache.data
  }
  
  console.log('[staff-login] 🔄 Fetching fresh tenant list from admin DB...')
  const { Tenant } = await getAdminModels()
  const tenants = await Tenant.find({ isActive: true }).lean() as Array<{
    _id: any; mongoUri: string; features: Record<string, boolean>
  }>
  
  global._tenantListCache = {
    data: tenants,
    timestamp: now
  }
  
  return tenants
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
    console.log('[staff-login] 🔐 STAFF LOGIN ATTEMPT:', email)
    console.log('[staff-login] Timestamp:', new Date().toISOString())
    console.log('========================================\n')

    const tenantLoadStart = Date.now()
    const tenants = await getCachedTenantList()
    timings.tenantLoad = Date.now() - tenantLoadStart

    console.log(`[staff-login] 📊 Loaded ${tenants.length} active tenants in ${timings.tenantLoad}ms\n`)

    let foundStaff: any = null
    let foundOwner: any = null
    let foundMongoUri = ''
    let foundFeatures: Record<string, boolean> = DEFAULT_MODULE_FEATURES
    let totalConnectionTime = 0
    let totalQueryTime = 0
    
    const searchStart = Date.now()

    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i]
      try {
        const connStart = Date.now()
        const conn = await connectTenantDB(tenant.mongoUri)
        const connTime = Date.now() - connStart
        totalConnectionTime += connTime
        
        const models = getModels(conn)

        const queryStart = Date.now()
        const staff = await models.Staff.findOne({ email, active: true }).select('+password')
        const queryTime = Date.now() - queryStart
        totalQueryTime += queryTime
        
        if (staff) {
          console.log(`[staff-login]   Tenant ${i+1}/${tenants.length}: ✓ Staff found (conn: ${connTime}ms, query: ${queryTime}ms)`)
          
          const owner = await models.User.findById(staff.userId)
          if (owner) {
            foundStaff = staff
            foundOwner = owner
            foundMongoUri = tenant.mongoUri
            foundFeatures = normaliseFeatures(tenant.features || {})
            console.log(`[staff-login]   ✓ Owner found, stopping search at tenant ${i+1}/${tenants.length}\n`)
            break
          }
        } else {
          console.log(`[staff-login]   Tenant ${i+1}/${tenants.length}: - no staff (conn: ${connTime}ms, query: ${queryTime}ms)`)
        }
      } catch (err) {
        console.log(`[staff-login]   Tenant ${i+1}/${tenants.length}: ✗ ERROR -`, err)
        continue
      }
    }
    
    timings.tenantSearch = Date.now() - searchStart
    const tenantsSearched = foundStaff ? 'stopped early' : tenants.length
    console.log(`[staff-login] 📊 Search summary: ${tenantsSearched} tenants in ${timings.tenantSearch}ms`)
    console.log(`[staff-login]   Avg connection time: ${tenants.length > 0 ? Math.round(totalConnectionTime / tenants.length) : 0}ms`)
    console.log(`[staff-login]   Avg query time: ${tenants.length > 0 ? Math.round(totalQueryTime / tenants.length) : 0}ms\n`)

    // Fallback: default DB (only if no staff found in tenants)
    if (!foundStaff) {
      console.log('[staff-login] 🔍 No staff found in tenants, checking default DB...')
      const defaultStart = Date.now()
      
      const conn = mongoose.connection.readyState === 1
        ? mongoose.connection
        : (await connectDB(), mongoose.connection)
      const models = getModels(conn)
      const staff = await models.Staff.findOne({ email, active: true }).select('+password')
      if (staff) {
        const owner = await models.User.findById(staff.userId)
        if (owner) { 
          foundStaff = staff
          foundOwner = owner
          console.log(`[staff-login]   ✓ Staff found in default DB (${Date.now() - defaultStart}ms)\n`)
        }
      }
      timings.defaultDbCheck = Date.now() - defaultStart
    } else {
      console.log('[staff-login] ⏩ Skipping default DB check (staff found in tenant)\n')
      timings.defaultDbCheck = 0
    }

    if (!foundStaff) {
      console.log('[staff-login] ✗ No staff account found for:', email)
      console.log(`[staff-login] ⏱️  Total time: ${Date.now() - requestStartTime}ms\n`)
      return NextResponse.json({ error: 'Invalid credentials or account is inactive' }, { status: 401 })
    }

    const pwCheckStart = Date.now()
    const isPasswordValid = await foundStaff.comparePassword(password)
    timings.passwordCheck = Date.now() - pwCheckStart
    
    if (!isPasswordValid) {
      console.log('[staff-login] ✗ Invalid password')
      console.log(`[staff-login] ⏱️  Total time: ${Date.now() - requestStartTime}ms\n`)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const tokenStart = Date.now()
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
    timings.tokenCreation = Date.now() - tokenStart

    await setAuthCookie(token)
    
    timings.total = Date.now() - requestStartTime
    
    console.log('\n========================================')
    console.log('[staff-login] ✅ LOGIN SUCCESS')
    console.log('[staff-login] 📊 PERFORMANCE SUMMARY:')
    console.log(`[staff-login]   Tenant load:         ${timings.tenantLoad}ms`)
    console.log(`[staff-login]   Tenant search:       ${timings.tenantSearch}ms`)
    console.log(`[staff-login]   Default DB check:    ${timings.defaultDbCheck || 0}ms`)
    console.log(`[staff-login]   Password check:      ${timings.passwordCheck}ms`)
    console.log(`[staff-login]   Token creation:      ${timings.tokenCreation}ms`)
    console.log(`[staff-login]   ⏱️  TOTAL:            ${timings.total}ms`)
    console.log('========================================\n')
    
    return NextResponse.json({
      message: 'Login successful',
      staff: {
        id: foundStaff._id, name: foundStaff.name, email: foundStaff.email,
        role: foundStaff.role, permissions: foundStaff.permissions,
        shopName: foundOwner.shopName,
      },
    })
  } catch (error) {
    console.error('[staff-login] ✗ ERROR:', error)
    console.log(`[staff-login] ⏱️  Failed after ${Date.now() - requestStartTime}ms\n`)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
