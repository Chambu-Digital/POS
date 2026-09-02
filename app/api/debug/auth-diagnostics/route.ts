import { NextRequest, NextResponse } from 'next/server'
import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB, getTenantConnectionStats } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('\n========================================')
    console.log('[auth-diagnostics] 🔍 Running authentication diagnostics...')
    console.log('========================================\n')

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      connectionStats: {},
      tenantInfo: {},
      indexAnalysis: [],
    }

    // Get connection pool statistics
    diagnostics.connectionStats = getTenantConnectionStats()
    console.log('[auth-diagnostics] 📊 Connection pool stats:')
    console.log(JSON.stringify(diagnostics.connectionStats, null, 2))

    // Get tenant information
    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find({ isActive: true }).lean() as Array<{
      _id: any
      subdomain: string
      mongoUri: string
      shopName: string
      features: Record<string, boolean>
      createdAt: Date
    }>

    diagnostics.tenantInfo = {
      totalActive: tenants.length,
      tenants: tenants.map(t => ({
        subdomain: t.subdomain,
        shopName: t.shopName,
        mongoUri: t.mongoUri.substring(0, 60) + '...',
        createdAt: t.createdAt,
      }))
    }

    console.log(`\n[auth-diagnostics] 📊 Found ${tenants.length} active tenants\n`)

    // Check indexes for each tenant
    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i]
      console.log(`[auth-diagnostics] Checking tenant ${i+1}/${tenants.length}: ${tenant.shopName}`)
      
      try {
        const conn = await connectTenantDB(tenant.mongoUri)
        const db = conn.db

        // Check User collection indexes
        const userIndexes = await db.collection('users').indexes()
        const userEmailIndex = userIndexes.find(idx => 
          idx.key && idx.key.email
        )

        // Check Staff collection indexes
        const staffIndexes = await db.collection('staff').indexes()
        const staffEmailIndex = staffIndexes.find(idx => 
          idx.key && idx.key.email
        )

        // Check collection stats
        const userStats = await db.collection('users').countDocuments()
        const staffStats = await db.collection('staff').countDocuments()

        const tenantAnalysis = {
          tenant: tenant.shopName,
          subdomain: tenant.subdomain,
          users: {
            count: userStats,
            hasEmailIndex: !!userEmailIndex,
            emailIndexDetails: userEmailIndex || null,
            allIndexes: userIndexes.map(idx => ({
              name: idx.name,
              key: idx.key,
              unique: idx.unique || false
            }))
          },
          staff: {
            count: staffStats,
            hasEmailIndex: !!staffEmailIndex,
            emailIndexDetails: staffEmailIndex || null,
            allIndexes: staffIndexes.map(idx => ({
              name: idx.name,
              key: idx.key,
              unique: idx.unique || false
            }))
          }
        }

        diagnostics.indexAnalysis.push(tenantAnalysis)

        console.log(`[auth-diagnostics]   Users: ${userStats} records`)
        console.log(`[auth-diagnostics]   - Email index: ${userEmailIndex ? '✓ EXISTS' : '✗ MISSING'}`)
        console.log(`[auth-diagnostics]   Staff: ${staffStats} records`)
        console.log(`[auth-diagnostics]   - Email index: ${staffEmailIndex ? '✓ EXISTS' : '✗ MISSING'}\n`)

      } catch (err) {
        console.error(`[auth-diagnostics]   ✗ Error checking tenant:`, err)
        diagnostics.indexAnalysis.push({
          tenant: tenant.shopName,
          error: String(err)
        })
      }
    }

    // Check default DB
    console.log('[auth-diagnostics] Checking default DB...')
    try {
      await connectDB()
      const db = mongoose.connection.db

      const userIndexes = await db.collection('users').indexes()
      const staffIndexes = await db.collection('staff').indexes()
      const userStats = await db.collection('users').countDocuments()
      const staffStats = await db.collection('staff').countDocuments()

      const userEmailIndex = userIndexes.find(idx => idx.key && idx.key.email)
      const staffEmailIndex = staffIndexes.find(idx => idx.key && idx.key.email)

      diagnostics.defaultDb = {
        users: {
          count: userStats,
          hasEmailIndex: !!userEmailIndex,
          emailIndexDetails: userEmailIndex || null,
          allIndexes: userIndexes.map(idx => ({
            name: idx.name,
            key: idx.key,
            unique: idx.unique || false
          }))
        },
        staff: {
          count: staffStats,
          hasEmailIndex: !!staffEmailIndex,
          emailIndexDetails: staffEmailIndex || null,
          allIndexes: staffIndexes.map(idx => ({
            name: idx.name,
            key: idx.key,
            unique: idx.unique || false
          }))
        }
      }

      console.log(`[auth-diagnostics]   Users: ${userStats} records (email index: ${userEmailIndex ? '✓' : '✗'})`)
      console.log(`[auth-diagnostics]   Staff: ${staffStats} records (email index: ${staffEmailIndex ? '✓' : '✗'})\n`)

    } catch (err) {
      console.error('[auth-diagnostics] Error checking default DB:', err)
      diagnostics.defaultDb = { error: String(err) }
    }

    // Summary
    console.log('\n========================================')
    console.log('[auth-diagnostics] 📊 SUMMARY')
    console.log(`[auth-diagnostics] Active tenants: ${diagnostics.tenantInfo.totalActive}`)
    console.log(`[auth-diagnostics] Cached connections: ${diagnostics.connectionStats.currentCached}/${diagnostics.connectionStats.maxCachedTenants}`)
    
    const tenantsWithoutUserIndex = diagnostics.indexAnalysis.filter((t: any) => 
      t.users && !t.users.hasEmailIndex
    ).length
    const tenantsWithoutStaffIndex = diagnostics.indexAnalysis.filter((t: any) => 
      t.staff && !t.staff.hasEmailIndex
    ).length
    
    console.log(`[auth-diagnostics] Tenants missing User email index: ${tenantsWithoutUserIndex}`)
    console.log(`[auth-diagnostics] Tenants missing Staff email index: ${tenantsWithoutStaffIndex}`)
    console.log('========================================\n')

    return NextResponse.json(diagnostics, { status: 200 })

  } catch (error) {
    console.error('[auth-diagnostics] ✗ Error:', error)
    return NextResponse.json({ 
      error: 'Diagnostics failed', 
      details: String(error) 
    }, { status: 500 })
  }
}
