/**
 * Script to check all orders for the main branch and who made the sales
 * Run with: npx tsx scripts/check-main-branch-orders.ts
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables')
  process.exit(1)
}

async function checkMainBranchOrders() {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB\n')

    const db = mongoose.connection.db

    // First, find all tenants
    console.log('📋 Finding tenants...\n')
    const tenants = await db.collection('tenants').find({}).toArray()
    
    if (tenants.length === 0) {
      console.log('❌ No tenants found')
      await mongoose.disconnect()
      return
    }

    console.log(`Found ${tenants.length} tenant(s)\n`)

    // Show all tenants first
    console.log('📋 TENANT LIST')
    console.log('-'.repeat(80))
    tenants.forEach((tenant: any, idx: number) => {
      console.log(`${idx + 1}. ${tenant.shopName || 'Unknown Shop'}`)
      console.log(`   Subdomain: ${tenant.subdomain || 'NOT SET'}`)
      console.log(`   MongoDB URI: ${tenant.mongoUri ? '✅ Set' : '❌ NOT SET'}`)
      console.log(`   Status: ${tenant.mongoUri ? '✅ Ready' : '⚠️  No MongoDB URI'}`)
      console.log()
    })
    console.log('\n')

    // Process each tenant
    for (const tenant of tenants) {
      console.log('='.repeat(80))
      console.log(`TENANT: ${tenant.shopName || tenant.subdomain || 'Unknown'}`)
      console.log('='.repeat(80))
      console.log(`Tenant ID: ${tenant._id}`)
      console.log(`Subdomain: ${tenant.subdomain || 'NOT SET'}`)
      console.log(`Has MongoDB URI: ${tenant.mongoUri ? '✅ Yes' : '❌ No'}\n`)

      // Skip if no mongoUri
      if (!tenant.mongoUri) {
        console.log('⚠️  Skipping: No MongoDB URI configured for this tenant\n\n')
        continue
      }

      // Connect to tenant database
      let tenantConnection
      try {
        tenantConnection = await mongoose.createConnection(tenant.mongoUri).asPromise()
        console.log(`✅ Connected to tenant database: ${tenantConnection.name}\n`)
      } catch (connectionError: any) {
        console.error(`❌ Failed to connect to tenant database`)
        console.error(`   Error: ${connectionError.message}\n\n`)
        if (tenantConnection) {
          await tenantConnection.close()
        }
        continue
      }

      // Get branches
      const branches = await tenantConnection.db.collection('branches').find({}).toArray()
      console.log(`📍 Branches: ${branches.length}`)
      
      let mainBranchId = null
      let mainBranchName = 'Main Branch'

      if (branches.length > 0) {
        // Find main branch (first one or one named "Main")
        const mainBranch = branches.find((b: any) => 
          b.name?.toLowerCase().includes('main') || 
          b.isMain === true
        ) || branches[0]
        
        mainBranchId = mainBranch._id
        mainBranchName = mainBranch.name
        console.log(`   Main Branch: ${mainBranchName} (${mainBranchId})\n`)
      } else {
        console.log('   No branches configured (single branch setup)\n')
      }

      // Get all sales for main branch
      const salesQuery: any = {}
      if (mainBranchId) {
        salesQuery.branchId = mainBranchId
      }

      const sales = await tenantConnection.db.collection('sales')
        .find(salesQuery)
        .sort({ createdAt: -1 })
        .toArray()

      console.log(`📦 Total Orders in ${mainBranchName}: ${sales.length}\n`)

      if (sales.length === 0) {
        console.log('   No orders found\n')
        await tenantConnection.close()
        continue
      }

      // Get owner information from users collection
      const owner = await tenantConnection.db.collection('users').findOne({}) as any
      const ownerName = owner?.shopName || owner?.name || owner?.email || 'Owner'

      // Debug: Check sales with staffId
      const salesWithStaff = sales.filter((s: any) => s.staffId)
      console.log(`📊 Sales with staffId: ${salesWithStaff.length} out of ${sales.length}`)
      if (salesWithStaff.length > 0) {
        console.log(`   Sample staffId types:`, salesWithStaff.slice(0, 3).map((s: any) => ({
          id: s.staffId,
          type: typeof s.staffId,
          isObjectId: s.staffId?.constructor?.name
        })))
      }
      console.log()

      // Get all staff IDs to fetch their details
      const staffIds = [...new Set(sales.map((s: any) => s.staffId).filter(Boolean))]
      const staffMap = new Map()

      if (staffIds.length > 0) {
        console.log(`🔍 Looking up ${staffIds.length} unique staff member(s)...`)
        
        const staff = await tenantConnection.db.collection('staff')
          .find({ _id: { $in: staffIds } })
          .toArray()

        console.log(`   Found ${staff.length} staff record(s) in database`)
        
        if (staff.length > 0) {
          console.log(`   Staff members:`)
        }

        staff.forEach((s: any) => {
          const name = s.firstName && s.lastName 
            ? `${s.firstName} ${s.lastName}`.trim()
            : s.name || s.email || 'Unknown Staff'
          staffMap.set(s._id.toString(), name)
          console.log(`     - ${name} (${s._id})`)
        })
        
        // Check for mismatches
        const unmatchedIds = staffIds.filter(id => !staffMap.has(id.toString()))
        if (unmatchedIds.length > 0) {
          console.log(`   ⚠️  ${unmatchedIds.length} staff ID(s) in sales but not found in staff collection:`)
          unmatchedIds.forEach(id => console.log(`     - ${id}`))
        }
        console.log()
      }

      // Group sales by staff
      const salesByStaff = new Map<string, any[]>()
      const ownerSales: any[] = []

      sales.forEach((sale: any) => {
        if (sale.staffId) {
          const staffIdStr = sale.staffId.toString()
          const staffName = staffMap.get(staffIdStr) || 'Unknown Staff'
          
          if (!salesByStaff.has(staffName)) {
            salesByStaff.set(staffName, [])
          }
          salesByStaff.get(staffName)!.push(sale)
        } else {
          ownerSales.push(sale)
        }
      })

      // Print summary
      console.log('👥 SALES BY STAFF MEMBER')
      console.log('-'.repeat(80))

      // Owner sales
      if (ownerSales.length > 0) {
        const totalAmount = ownerSales.reduce((sum, s) => sum + (s.total || 0), 0)
        console.log(`\n🏢 ${ownerName}`)
        console.log(`   Orders: ${ownerSales.length}`)
        console.log(`   Total Value: KES ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      }

      // Staff sales
      for (const [staffName, staffSales] of salesByStaff.entries()) {
        const totalAmount = staffSales.reduce((sum, s) => sum + (s.total || 0), 0)
        console.log(`\n👤 ${staffName}`)
        console.log(`   Orders: ${staffSales.length}`)
        console.log(`   Total Value: KES ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      }

      // Print detailed order list
      console.log('\n\n📋 DETAILED ORDER LIST')
      console.log('-'.repeat(80))
      console.log(
        'Order No'.padEnd(18) + 
        'Date'.padEnd(12) + 
        'Time'.padEnd(10) + 
        'Staff'.padEnd(25) + 
        'Amount'.padStart(15)
      )
      console.log('-'.repeat(80))

      sales.forEach((sale: any) => {
        const orderNo = sale.orderNumber || `SALE-${sale._id.toString().slice(-8).toUpperCase()}`
        const date = new Date(sale.createdAt).toLocaleDateString('en-GB')
        const time = new Date(sale.createdAt).toLocaleTimeString('en-GB', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
        
        let staffName = ownerName
        if (sale.staffId) {
          const staffIdStr = sale.staffId.toString()
          staffName = staffMap.get(staffIdStr) || 'Unknown Staff'
        }

        const amount = `KES ${(sale.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

        console.log(
          orderNo.padEnd(18) + 
          date.padEnd(12) + 
          time.padEnd(10) + 
          staffName.padEnd(25) + 
          amount.padStart(15)
        )
      })

      // Summary stats
      const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0)
      console.log('-'.repeat(80))
      console.log(`TOTAL ORDERS: ${sales.length}`.padEnd(65) + `KES ${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`.padStart(15))
      console.log('='.repeat(80))
      console.log('\n\n')

      if (tenantConnection) {
        await tenantConnection.close()
      }
    }

    console.log('✅ Report completed successfully')
    await mongoose.disconnect()
    
  } catch (error) {
    console.error('❌ Error:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

checkMainBranchOrders()
