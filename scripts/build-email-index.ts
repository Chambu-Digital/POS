/**
 * Migration script to build the email-to-tenant index
 * This populates the UserEmailIndex collection with all existing users and staff
 * 
 * Run with: npx tsx scripts/build-email-index.ts
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env from project root
config({ path: resolve(__dirname, '../.env') })

import { getAdminModels } from '@/lib/admin-models'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

async function buildEmailIndex() {
  console.log('🚀 Starting email index build...\n')
  
  const startTime = Date.now()
  const { Tenant, UserEmailIndex } = await getAdminModels()
  
  // Clear existing index
  console.log('🗑️  Clearing existing index...')
  await UserEmailIndex.deleteMany({})
  console.log('✓ Index cleared\n')
  
  // Get all active tenants
  const tenants = await Tenant.find({ isActive: true }).lean()
  console.log(`📊 Found ${tenants.length} active tenants\n`)
  
  let totalUsers = 0
  let totalStaff = 0
  let errors = 0
  
  for (let i = 0; i < tenants.length; i++) {
    const tenant = tenants[i] as any
    console.log(`\n[${i + 1}/${tenants.length}] Processing: ${tenant.shopName || tenant.subdomain}`)
    
    try {
      // Connect to tenant DB
      const conn = await connectTenantDB(tenant.mongoUri)
      const models = getModels(conn)
      
      // Index all owners
      const users = await models.User.find({}).lean()
      console.log(`  Found ${users.length} owners`)
      
      for (const user of users) {
        await UserEmailIndex.create({
          email: user.email.toLowerCase(),
          tenantId: tenant._id,
          userType: 'user',
          userId: user._id.toString(),
          isActive: true,
          lastSync: new Date()
        })
        totalUsers++
      }
      
      // Index all active staff
      const staff = await models.Staff.find({ active: true }).lean()
      console.log(`  Found ${staff.length} active staff`)
      
      for (const staffMember of staff) {
        await UserEmailIndex.create({
          email: staffMember.email.toLowerCase(),
          tenantId: tenant._id,
          userType: 'staff',
          userId: staffMember._id.toString(),
          isActive: true,
          lastSync: new Date()
        })
        totalStaff++
      }
      
      console.log(`  ✓ Indexed ${users.length} owners + ${staff.length} staff`)
      
    } catch (error) {
      console.error(`  ✗ Error processing tenant:`, error)
      errors++
    }
  }
  
  const totalTime = Date.now() - startTime
  
  console.log('\n========================================')
  console.log('✅ EMAIL INDEX BUILD COMPLETE')
  console.log('========================================')
  console.log(`Total owners indexed:  ${totalUsers}`)
  console.log(`Total staff indexed:   ${totalStaff}`)
  console.log(`Total entries:         ${totalUsers + totalStaff}`)
  console.log(`Errors:                ${errors}`)
  console.log(`Time taken:            ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`)
  console.log('========================================\n')
  
  process.exit(0)
}

buildEmailIndex().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
