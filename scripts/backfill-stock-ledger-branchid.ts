/**
 * Migration Script: Backfill branchId on StockLedger records
 * 
 * Problem: All existing StockLedger records are missing branchId field,
 * causing Stock Movements page to show no data when branch filtering is applied.
 * 
 * Solution: Set branchId to user's primary/main branch for all existing records.
 * 
 * Usage:
 *   npx tsx scripts/backfill-stock-ledger-branchid.ts
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env') })

const TENANT_DB_URI = process.env.MONGODB_URI_TENANT || process.env.MONGODB_URI

if (!TENANT_DB_URI) {
  console.error('❌ MONGODB_URI_TENANT or MONGODB_URI not found in .env')
  process.exit(1)
}

// Extract database name from URI or use default
let dbName = 'wondersshop' // Default to wondersshop
const dbMatch = TENANT_DB_URI.match(/\/([^/?]+)(\?|$)/)
if (dbMatch && dbMatch[1]) {
  dbName = dbMatch[1]
}

// Build connection string with explicit database
const connectionString = TENANT_DB_URI.includes('?') 
  ? TENANT_DB_URI.replace('?', `/${dbName}?`)
  : `${TENANT_DB_URI}/${dbName}`

console.log(`📊 Target database: ${dbName}`)

async function backfillBranchId() {
  console.log('🚀 Starting StockLedger branchId backfill migration...\n')
  
  try {
    // Connect to tenant database
    console.log('📡 Connecting to tenant database...')
    const conn = await mongoose.createConnection(connectionString).asPromise()
    console.log('✅ Connected to:', conn.name)

    // Get all users
    const User = conn.model('User', new mongoose.Schema({}, { strict: false }))
    const users = await User.find({}).select('_id email').lean()
    console.log(`\n📊 Found ${users.length} users\n`)

    let totalUpdated = 0

    for (const user of users) {
      console.log(`\n👤 Processing user: ${user.email || user._id}`)
      
      // Get user's branches
      const Branch = conn.model('Branch', new mongoose.Schema({}, { strict: false }))
      const branches = await Branch.find({ userId: user._id }).sort({ createdAt: 1 }).lean()
      
      if (branches.length === 0) {
        console.log('   ⚠️  User has no branches - skipping')
        continue
      }

      // Use first branch as default (usually the main branch)
      const defaultBranch = branches[0]
      console.log(`   📍 Using branch: ${defaultBranch.name} (${defaultBranch.code})`)

      // Get StockLedger records without valid branchId (including invalid ObjectIds)
      const StockLedger = conn.model('StockLedger', new mongoose.Schema({}, { strict: false }))
      
      // Find all records for this user
      const allRecords = await StockLedger.find({ userId: user._id }).lean()
      
      // Check which ones need updating
      const recordsNeedingUpdate = allRecords.filter((record: any) => {
        if (!record.branchId) return true // Missing or null
        
        // Check if it's a valid ObjectId by trying to match it with our branch
        const branchIdStr = String(record.branchId)
        const defaultBranchStr = String(defaultBranch._id)
        
        // If they don't match when converted to string, it's invalid
        try {
          const testId = new mongoose.Types.ObjectId(branchIdStr)
          // If this succeeds, check if it matches a real branch
          return false // It's a valid ObjectId format
        } catch {
          return true // Invalid ObjectId format
        }
      })

      console.log(`   📊 Total records: ${allRecords.length}`)
      console.log(`   🔧 Records needing update: ${recordsNeedingUpdate.length}`)
      
      // Check specifically how many match our query
      const recordsWithoutBranch = await StockLedger.countDocuments({
        userId: user._id,
        $or: [
          { branchId: { $exists: false } },
          { branchId: null },
          { branchId: { $type: 'string' } }, // String instead of ObjectId
        ]
      })

      console.log(`   🔍 Records matching update query: ${recordsWithoutBranch}`)

      if (recordsWithoutBranch === 0) {
        console.log('   ✅ All records already have valid branchId')
        continue
      }

      console.log(`   🔧 Updating ${recordsWithoutBranch} records...`)

      // Update records - set to ObjectId
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

      console.log(`   ✅ Updated ${result.modifiedCount} records`)
      totalUpdated += result.modifiedCount

      // Show sample of updated records
      const sampleRecords = await StockLedger.find({
        userId: user._id,
        branchId: defaultBranch._id
      })
        .sort({ timestamp: -1 })
        .limit(3)
        .lean()

      console.log('   📝 Sample updated records:')
      sampleRecords.forEach((record: any) => {
        console.log(`      - ${record.type} | Qty: ${record.quantity} | ${new Date(record.timestamp).toLocaleDateString()}`)
      })
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Migration completed successfully!')
    console.log(`📊 Total records updated: ${totalUpdated}`)
    console.log('='.repeat(60) + '\n')

    await conn.close()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
backfillBranchId()
