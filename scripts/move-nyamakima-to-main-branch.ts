/**
 * Move all Nyamakima inventory and data to Main branch
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })

const ADMIN_DB_URI = process.env.MONGODB_URI

async function moveToMainBranch() {
  console.log('🚀 Moving Nyamakima data to Main branch...\n')
  
  try {
    const adminConn = await mongoose.createConnection(ADMIN_DB_URI!).asPromise()
    const Tenant = adminConn.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants')
    
    // Find Nyamakima tenant
    const tenant = await Tenant.findOne({ subdomain: 'newnyamakimaelectricals' }).lean() as any
    if (!tenant) throw new Error('Nyamakima tenant not found')
    
    console.log(`✅ Found: ${tenant.shopName}`)
    
    const tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
    console.log(`✅ Connected to: ${tenantConn.name}\n`)
    
    const User = tenantConn.model('User', new mongoose.Schema({}, { strict: false }))
    const Branch = tenantConn.model('Branch', new mongoose.Schema({}, { strict: false }))
    
    const user = await User.findOne({}).lean() as any
    if (!user) throw new Error('User not found')
    
    const mainBranch = await Branch.findOne({ userId: user._id, code: 'MAIN' }).lean() as any
    if (!mainBranch) throw new Error('Main branch not found')
    
    console.log(`📍 Main Branch: ${mainBranch.name} (${mainBranch._id})\n`)
    
    const collections = [
      { name: 'product_inventory', field: 'branchId' },
      { name: 'stock_ledger', field: 'branchId' },
      { name: 'sales', field: 'branchId' },
      { name: 'staff', field: 'branchId' },
    ]
    
    let totalUpdated = 0
    
    for (const { name, field } of collections) {
      const collection = tenantConn.collection(name)
      
      // Count records without branchId
      const withoutBranch = await collection.countDocuments({
        userId: user._id,
        [field]: { $exists: false }
      })
      
      const withNull = await collection.countDocuments({
        userId: user._id,
        [field]: null
      })
      
      const needsUpdate = withoutBranch + withNull
      
      if (needsUpdate === 0) {
        console.log(`✅ ${name}: All records already have branchId`)
        continue
      }
      
      console.log(`🔧 ${name}: Updating ${needsUpdate} records...`)
      
      const result = await collection.updateMany(
        {
          userId: user._id,
          $or: [
            { [field]: { $exists: false } },
            { [field]: null }
          ]
        },
        {
          $set: { [field]: new mongoose.Types.ObjectId(mainBranch._id) }
        }
      )
      
      console.log(`   ✅ Updated ${result.modifiedCount} records`)
      totalUpdated += result.modifiedCount
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Migration completed!')
    console.log(`📊 Total records updated: ${totalUpdated}`)
    console.log('='.repeat(60))
    
    await tenantConn.close()
    await adminConn.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

moveToMainBranch()
