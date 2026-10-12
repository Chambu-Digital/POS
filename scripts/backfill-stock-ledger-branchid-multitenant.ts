/**
 * Migration Script: Backfill branchId on StockLedger records (Multi-Tenant)
 * 
 * Problem: All existing StockLedger records are missing branchId field,
 * causing Stock Movements page to show no data when branch filtering is applied.
 * 
 * Solution: For each tenant, set branchId to their primary/main branch for all existing records.
 * 
 * Usage:
 *   npx tsx scripts/backfill-stock-ledger-branchid-multitenant.ts
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env') })

const ADMIN_DB_URI = process.env.MONGODB_URI

if (!ADMIN_DB_URI) {
  console.error('❌ MONGODB_URI not found in .env')
  process.exit(1)
}

interface Tenant {
  _id: any
  subdomain: string
  mongoUri: string
  shopName: string
  isActive: boolean
}

async function backfillBranchId() {
  console.log('🚀 Starting Multi-Tenant StockLedger branchId backfill migration...\n')
  
  try {
    // Connect to admin database
    console.log('📡 Connecting to admin database...')
    const adminConn = await mongoose.createConnection(ADMIN_DB_URI).asPromise()
    console.log('✅ Connected to admin DB:', adminConn.name)

    // Get all active tenants
    const Tenant = adminConn.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants')
    const tenants = await Tenant.find({ isActive: true }).lean() as unknown as Tenant[]
    console.log(`\n📊 Found ${tenants.length} active tenants\n`)

    let totalUpdated = 0
    let tenantsProcessed = 0
    let tenantsSkipped = 0

    for (const tenant of tenants) {
      console.log(`\n${'='.repeat(70)}`)
      console.log(`🏢 Tenant: ${tenant.shopName || tenant.subdomain}`)
      console.log(`   Subdomain: ${tenant.subdomain}`)
      console.log(`   MongoDB: ${tenant.mongoUri.substring(0, 60)}...`)
      
      if (!tenant.mongoUri) {
        console.log('   ⚠️  No mongoUri - skipping')
        tenantsSkipped++
        continue
      }

      try {
        // Connect to tenant database
        const tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
        console.log(`   ✅ Connected to tenant DB: ${tenantConn.name}`)

        // Get users in this tenant
        const User = tenantConn.model('User', new mongoose.Schema({}, { strict: false }))
        const users = await User.find({}).select('_id email').lean()
        console.log(`   📊 Found ${users.length} users`)

        for (const user of users) {
          console.log(`\n   👤 User: ${user.email || user._id}`)
          
          // Get user's branches
          const Branch = tenantConn.model('Branch', new mongoose.Schema({}, { strict: false }))
          const branches = await Branch.find({ userId: user._id }).sort({ createdAt: 1 }).lean()
          
          if (branches.length === 0) {
            console.log('      ⚠️  User has no branches - skipping')
            continue
          }

          // Use first branch as default (usually the main branch)
          const defaultBranch: any = branches[0]
          console.log(`      📍 Default branch: ${defaultBranch.name} (${defaultBranch.code})`)

          // Get StockLedger model
          const StockLedger = tenantConn.model('StockLedger', new mongoose.Schema({}, { strict: false }), 'stock_ledger')
          
          // Count records that need updating
          const recordsNeedingUpdate = await StockLedger.countDocuments({
            userId: user._id,
            $or: [
              { branchId: { $exists: false } },
              { branchId: null },
              { branchId: { $type: 'string' } }, // String instead of ObjectId
            ]
          })

          if (recordsNeedingUpdate === 0) {
            console.log('      ✅ All records already have valid branchId')
            continue
          }

          console.log(`      🔧 Updating ${recordsNeedingUpdate} records...`)

          // Update records - convert to ObjectId
          const result = await StockLedger.updateMany(
            {
              userId: user._id,
              $or: [
                { branchId: { $exists: false } },
                { branchId: null },
                { branchId: { $type: 'string' } },
              ]
            },
            {
              $set: { branchId: new mongoose.Types.ObjectId(defaultBranch._id) }
            }
          )

          console.log(`      ✅ Updated ${result.modifiedCount} records`)
          totalUpdated += result.modifiedCount

          // Show sample of updated records
          const sampleRecords = await StockLedger.find({
            userId: user._id,
            branchId: new mongoose.Types.ObjectId(defaultBranch._id)
          })
            .sort({ timestamp: -1 })
            .limit(3)
            .lean()

          if (sampleRecords.length > 0) {
            console.log('      📝 Sample updated records:')
            sampleRecords.forEach((record: any) => {
              console.log(`         - ${record.type} | Qty: ${record.quantity} | ${new Date(record.timestamp).toLocaleDateString()}`)
            })
          }
        }

        await tenantConn.close()
        tenantsProcessed++

      } catch (error) {
        console.error(`   ❌ Error processing tenant ${tenant.subdomain}:`, error)
        tenantsSkipped++
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('✅ Migration completed successfully!')
    console.log(`📊 Tenants processed: ${tenantsProcessed}`)
    console.log(`⚠️  Tenants skipped: ${tenantsSkipped}`)
    console.log(`📝 Total records updated: ${totalUpdated}`)
    console.log('='.repeat(70) + '\n')

    await adminConn.close()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
backfillBranchId()
