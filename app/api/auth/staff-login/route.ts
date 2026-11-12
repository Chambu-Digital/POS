import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import { createToken, setAuthCookie } from '@/lib/jwt'
import { normaliseFeatures, normalisePermissions, DEFAULT_MODULE_FEATURES } from '@/lib/modules'
import { getAdminModels } from '@/lib/admin-models'
import { findUserByEmail } from '@/lib/email-index'
import { CASHIER_ALLOWED_ROUTES, getCashierPermissions } from '@/lib/cashier-routes'
import { connectDB } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'

// ── Tenant list cache — only used for the fallback scan path ──────────────
interface TenantCache {
  data: Array<{ _id: any; mongoUri: string; features: Record<string, boolean> }>
  timestamp: number
}

declare global {
  // eslint-disable-next-line no-var
  var _tenantListCache: TenantCache | undefined
}

const TENANT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getCachedTenantList() {
  const now = Date.now()
  if (global._tenantListCache && now - global._tenantListCache.timestamp < TENANT_CACHE_TTL) {
    const age = Math.round((now - global._tenantListCache.timestamp) / 1000)
    console.log(`[staff-login] 📦 Using cached tenant list (age: ${age}s)`)
    return global._tenantListCache.data
  }
  console.log('[staff-login] 🔄 Fetching fresh tenant list from admin DB...')
  const { Tenant } = await getAdminModels()
  const tenants = (await Tenant.find({ isActive: true }).lean()) as Array<{
    _id: any
    mongoUri: string
    features: Record<string, boolean>
  }>
  global._tenantListCache = { data: tenants, timestamp: now }
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

    // ── Fast path: email index lookup ────────────────────────────────────────
    const indexStart = Date.now()
    console.log('[staff-login] 🔍 Looking up email in index...')
    const emailEntries = await findUserByEmail(email)
    timings.indexLookup = Date.now() - indexStart

    // Filter to staff entries only
    const staffEntries = emailEntries.filter(e => e.userType === 'staff')
    console.log(
      `[staff-login] 📊 Index lookup: ${timings.indexLookup}ms — ` +
      `${emailEntries.length} total entries, ${staffEntries.length} staff entries\n`
    )

    let foundStaff: any = null
    let foundOwner: any = null
    let foundMongoUri = ''
    let foundFeatures: Record<string, boolean> = DEFAULT_MODULE_FEATURES

    // ── Indexed path: connect to exactly the tenant(s) the index points to ──
    if (staffEntries.length > 0) {
      console.log('[staff-login] 🎯 Searching indexed tenant(s)...\n')
      const indexedSearchStart = Date.now()
      const { Tenant } = await getAdminModels()

      for (let i = 0; i < staffEntries.length; i++) {
        const entry = staffEntries[i]
        try {
          const tenant = (await Tenant.findById(entry.tenantId).lean()) as any
          if (!tenant || !tenant.isActive) {
            console.log(`[staff-login]   Entry ${i + 1}: ✗ Tenant not found or inactive`)
            continue
          }

          console.log(`[staff-login]   Entry ${i + 1} (${tenant.shopName}): connecting...`)
          const connStart = Date.now()
          const conn = await connectTenantDB(tenant.mongoUri)
          const connTime = Date.now() - connStart

          const models = getModels(conn)
          const queryStart = Date.now()
          const staff = await models.Staff.findOne({ email, active: true }).select('+password')
          const queryTime = Date.now() - queryStart

          if (staff) {
            const owner = await models.User.findById(staff.userId)
            if (owner) {
              foundStaff = staff
              foundOwner = owner
              foundMongoUri = tenant.mongoUri
              foundFeatures = normaliseFeatures(tenant.features || {})
              console.log(
                `[staff-login]   ✓ Staff found (conn: ${connTime}ms, query: ${queryTime}ms)\n`
              )
              break
            }
          } else {
            console.log(
              `[staff-login]   ✗ Staff not found or inactive (index may be stale) ` +
              `(conn: ${connTime}ms, query: ${queryTime}ms)`
            )
          }
        } catch (err) {
          console.log(`[staff-login]   Entry ${i + 1}: ✗ ERROR -`, err)
          continue
        }
      }

      timings.indexedSearch = Date.now() - indexedSearchStart
      timings.fullScan = 0
      console.log(`[staff-login] 📊 Indexed search: ${timings.indexedSearch}ms\n`)
    }

    // ── Fallback path: full tenant scan (index miss / stale index) ───────────
    if (!foundStaff) {
      if (staffEntries.length > 0) {
        console.log('[staff-login] ⚠️  Index miss — falling back to full tenant scan...\n')
      } else {
        console.log('[staff-login] ℹ️  No index entries — running full tenant scan...\n')
      }

      const scanStart = Date.now()
      const tenants = await getCachedTenantList()
      let totalConnectionTime = 0
      let totalQueryTime = 0

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
            console.log(
              `[staff-login]   Tenant ${i + 1}/${tenants.length}: ✓ Staff found ` +
              `(conn: ${connTime}ms, query: ${queryTime}ms)`
            )
            const owner = await models.User.findById(staff.userId)
            if (owner) {
              foundStaff = staff
              foundOwner = owner
              foundMongoUri = tenant.mongoUri
              foundFeatures = normaliseFeatures(tenant.features || {})
              console.log(`[staff-login]   ✓ Owner found, stopping search at tenant ${i + 1}/${tenants.length}\n`)
              break
            }
          } else {
            console.log(
              `[staff-login]   Tenant ${i + 1}/${tenants.length}: - no staff ` +
              `(conn: ${connTime}ms, query: ${queryTime}ms)`
            )
          }
        } catch (err) {
          console.log(`[staff-login]   Tenant ${i + 1}/${tenants.length}: ✗ ERROR -`, err)
          continue
        }
      }

      timings.fullScan = Date.now() - scanStart
      timings.indexedSearch = timings.indexedSearch ?? 0
      console.log(
        `[staff-login] 📊 Full scan: ${timings.fullScan}ms ` +
        `(avg conn: ${tenants.length > 0 ? Math.round(totalConnectionTime / tenants.length) : 0}ms, ` +
        `avg query: ${tenants.length > 0 ? Math.round(totalQueryTime / tenants.length) : 0}ms)\n`
      )
    }

    // ── Default DB fallback (dev / single-tenant) ────────────────────────────
    if (!foundStaff) {
      console.log('[staff-login] 🔍 Checking default DB...')
      const defaultStart = Date.now()
      const conn =
        mongoose.connection.readyState === 1
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
      timings.defaultDbCheck = 0
    }

    if (!foundStaff) {
      console.log('[staff-login] ✗ No staff account found for:', email)
      console.log(`[staff-login] ⏱️  Total time: ${Date.now() - requestStartTime}ms\n`)
      return NextResponse.json(
        { error: 'Invalid credentials or account is inactive' },
        { status: 401 }
      )
    }

    // ── Password check ───────────────────────────────────────────────────────
    const pwCheckStart = Date.now()
    const isPasswordValid = await foundStaff.comparePassword(password)
    timings.passwordCheck = Date.now() - pwCheckStart

    if (!isPasswordValid) {
      console.log('[staff-login] ✗ Invalid password')
      console.log(`[staff-login] ⏱️  Total time: ${Date.now() - requestStartTime}ms\n`)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // ── Build token ──────────────────────────────────────────────────────────
    const tokenStart = Date.now()

    const isCashierMode = foundStaff.role === 'cashier'
    const allowedRoutes = isCashierMode ? [...CASHIER_ALLOWED_ROUTES] : undefined
    const staffPermissions = isCashierMode
      ? getCashierPermissions()
      : normalisePermissions(foundStaff.permissions || {})

    const isBranchManager =
      foundStaff.managerOfBranches && foundStaff.managerOfBranches.length > 0
    const managerOfBranches = isBranchManager
      ? foundStaff.managerOfBranches.map((id: any) => id.toString())
      : []

    const initialBranchId = foundStaff.branchId?.toString()

    const token = await createToken({
      userId: foundStaff._id.toString(),
      email: foundStaff.email,
      role: foundStaff.role,
      type: 'staff',
      adminId: foundStaff.userId.toString(),
      branchId: initialBranchId,
      isBranchManager,
      managerOfBranches,
      mongoUri: foundMongoUri || undefined,
      tenantFeatures: foundMongoUri ? foundFeatures : undefined,
      permissions: staffPermissions,
      isCashierMode,
      allowedRoutes,
    })
    timings.tokenCreation = Date.now() - tokenStart

    await setAuthCookie(token)

    timings.total = Date.now() - requestStartTime

    console.log('\n========================================')
    console.log('[staff-login] ✅ LOGIN SUCCESS')
    console.log(
      `[staff-login] Role: ${foundStaff.role}${isCashierMode ? ' (CASHIER MODE)' : ''}`
    )
    console.log(`[staff-login] Branch: ${initialBranchId || 'Not assigned'}`)
    if (isBranchManager) {
      console.log(`[staff-login] Branch Manager: manages ${managerOfBranches.length} branch(es)`)
    }
    console.log('[staff-login] 📊 PERFORMANCE SUMMARY:')
    console.log(`[staff-login]   Index lookup:        ${timings.indexLookup}ms`)
    console.log(`[staff-login]   Indexed search:      ${timings.indexedSearch ?? 0}ms`)
    console.log(`[staff-login]   Full scan:           ${timings.fullScan ?? 0}ms`)
    console.log(`[staff-login]   Default DB check:    ${timings.defaultDbCheck}ms`)
    console.log(`[staff-login]   Password check:      ${timings.passwordCheck}ms`)
    console.log(`[staff-login]   Token creation:      ${timings.tokenCreation}ms`)
    console.log(`[staff-login]   ⏱️  TOTAL:            ${timings.total}ms`)
    console.log('========================================\n')

    return NextResponse.json({
      message: 'Login successful',
      staff: {
        id: foundStaff._id,
        name: foundStaff.name,
        email: foundStaff.email,
        role: foundStaff.role,
        permissions: foundStaff.permissions,
        shopName: foundOwner.shopName,
      },
    })
  } catch (error) {
    console.error('[staff-login] ✗ ERROR:', error)
    console.log(`[staff-login] ⏱️  Failed after ${Date.now() - requestStartTime}ms\n`)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
