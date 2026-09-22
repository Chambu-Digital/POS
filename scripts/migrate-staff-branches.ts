/**
 * Migration Script: Assign existing staff to default branch
 * 
 * This script:
 * 1. Finds all tenants
 * 2. For each tenant, finds the default branch
 * 3. Updates all staff members without a branchId to the default branch
 * 4. If no default branch exists, creates one
 * 
 * Run with: npx tsx scripts/migrate-staff-branches.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

interface Branch {
  _id: any
  userId: any
  name: string
  code: string
  isDefault?: boolean
  status: string
}

interface User {
  _id: any
  role: string
}

async function migrateStaffBranches() {
  console.log('🔄 Starting Staff-to-Branch Migration...\n')

  try {
    const adminUri = process.env.MONGODB_URI
    if (!adminUri) throw new Error('MONGODB_URI not set in .env')

    // Connect to admin DB
    const adminConn = await mongoose.createConnection(adminUri).asPromise()
    const Tenants = adminConn.collection('tenants')

    // Get all active tenants
    const tenants = await Tenants.find({ isActive: true }).toArray()
    console.log(`📊 Found ${tenants.length} active tenants\n`)

    let totalProcessed = 0
    let totalUpdated = 0
    let totalBranchesCreated = 0

    for (const tenant of tenants) {
      console.log(`\n📦 Processing tenant: ${tenant.name} (${tenant.subdomain})`)
      
      try {
        // Connect to tenant DB
        const tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
        
        const Staff = tenantConn.collection('staff')
        const Branches = tenantConn.collection('branches')
        const Users = tenantConn.collection('users')

        // Get all staff members
        const allStaff = await Staff.find({}).toArray()
        console.log(`  Found ${allStaff.length} staff members`)

        if (allStaff.length === 0) {
          console.log('  ✓ No staff to migrate')
          await tenantConn.close()
          continue
        }

        // Get userId from first staff member
        const userId = allStaff[0].userId || allStaff[0].adminId

        // Find or create default branch
        let branches = await Branches.find({ userId, status: 'active' }).toArray() as Branch[]
        console.log(`  Found ${branches.length} active branches`)

        let defaultBranch: Branch | null = branches.find(b => b.isDefault) || null

        if (!defaultBranch && branches.length === 0) {
          // No branches - create a default one
          console.log('  ⚠️  No branches found. Creating default branch...')
          
          // Get the business owner
          const owner = await Users.findOne({ role: 'owner' }) as User | null
          if (!owner) {
            console.log('  ❌ No owner found, skipping tenant')
            await tenantConn.close()
            continue
          }

          const newBranch = {
            userId: owner._id,
            name: 'Main Branch',
            code: 'MAIN',
            status: 'active',
            isDefault: true,
            address: '',
            phone: '',
            email: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const result = await Branches.insertOne(newBranch)
          defaultBranch = { ...newBranch, _id: result.insertedId }
          totalBranchesCreated++
          console.log(`  ✓ Created default branch: ${defaultBranch.name} (${defaultBranch.code})`)
        } else if (!defaultBranch && branches.length > 0) {
          // Has branches but no default - use first one
          defaultBranch = branches[0]
          console.log(`  ✓ Using first branch as default: ${defaultBranch.name} (${defaultBranch.code})`)
        } else {
          console.log(`  ✓ Found default branch: ${defaultBranch!.name} (${defaultBranch!.code})`)
        }

        // Count staff without branchId
        const staffWithoutBranch = await Staff.find({
          $or: [
            { branchId: { $exists: false } },
            { branchId: null }
          ]
        }).toArray()

        if (staffWithoutBranch.length === 0) {
          console.log('  ✓ All staff already have branches assigned')
        } else {
          // Update staff with default branch
          const result = await Staff.updateMany(
            {
              $or: [
                { branchId: { $exists: false } },
                { branchId: null }
              ]
            },
            {
              $set: { 
                branchId: defaultBranch!._id,
                updatedAt: new Date()
              }
            }
          )

          totalUpdated += result.modifiedCount
          totalProcessed += staffWithoutBranch.length
          console.log(`  ✓ Assigned ${result.modifiedCount} staff members to default branch`)
        }
        
        await tenantConn.close()

      } catch (error) {
        console.error(`  ✗ Error processing tenant ${tenant.name}:`, error)
      }
    }

    await adminConn.close()

    console.log(`\n✅ Migration Complete!`)
    console.log(`   Tenants processed: ${tenants.length}`)
    console.log(`   Staff processed: ${totalProcessed}`)
    console.log(`   Staff updated: ${totalUpdated}`)
    console.log(`   Default branches created: ${totalBranchesCreated}`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Run migration
migrateStaffBranches()
  .then(() => {
    console.log('\n✅ Migration script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error)
    process.exit(1)
  })
