// Find thesheaglow@gmail.com user in platform and tenant databases
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

async function findUser() {
  try {
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) {
      console.error('❌ MONGODB_URI not set')
      process.exit(1)
    }

    console.log('\n========== SEARCHING FOR thesheaglow@gmail.com ==========\n')

    // 1. Check platform database (jayposmulti)
    console.log('1. Checking PLATFORM database (jayposmulti)...')
    await connectDB()
    const platformDb = mongoose.connection.db
    
    const platformUser = await platformDb.collection('users').findOne({ 
      email: 'thesheaglow@gmail.com' 
    })
    
    if (platformUser) {
      console.log('✅ Found in PLATFORM DB:', {
        _id: platformUser._id,
        email: platformUser.email,
        name: platformUser.name,
        role: platformUser.role,
        tenantId: platformUser.tenantId,
        createdAt: platformUser.createdAt,
      })

      // If user has tenantId, get tenant details
      if (platformUser.tenantId) {
        console.log('\n   Looking up tenant details...')
        const tenant = await platformDb.collection('tenants').findOne({
          _id: platformUser.tenantId
        })
        if (tenant) {
          console.log('   ✅ Tenant:', {
            _id: tenant._id,
            name: tenant.name,
            dbName: tenant.dbName,
            owner: tenant.owner,
          })
        }
      }
    } else {
      console.log('❌ NOT found in platform database')
    }

    // 2. Check jaywines tenant database
    console.log('\n2. Checking TENANT database (jaywines)...')
    const tenantUri = baseUri.replace('/jayposmulti', '/jaywines')
    const tenantConn = await connectTenantDB(tenantUri)
    const models = getModels(tenantConn)

    const tenantUser = await models.User.findOne({ 
      email: 'thesheaglow@gmail.com' 
    }).lean()
    
    if (tenantUser) {
      console.log('✅ Found in TENANT DB (jaywines):', {
        _id: tenantUser._id,
        email: (tenantUser as any).email,
        name: (tenantUser as any).name,
        role: (tenantUser as any).role,
        createdAt: (tenantUser as any).createdAt,
      })

      // Check if this user has any bar sales data
      console.log('\n   Checking user\'s bar data...')
      
      const tabLines = await models.BarTabLine.countDocuments({ 
        userId: tenantUser._id 
      })
      console.log(`   - BarTabLine records: ${tabLines}`)
      
      const tabs = await models.BarTab.countDocuments({ 
        userId: tenantUser._id 
      })
      console.log(`   - BarTab records: ${tabs}`)
      
      const sales = await models.Sale.countDocuments({ 
        userId: tenantUser._id 
      })
      console.log(`   - Sale records: ${sales}`)

      // Check recent tab lines for this user
      if (tabLines > 0) {
        console.log('\n   Recent BarTabLine records:')
        const recentLines = await models.BarTabLine.find({ 
          userId: tenantUser._id 
        })
        .sort({ addedAt: -1 })
        .limit(5)
        .lean()

        for (const line of recentLines) {
          console.log('     -', {
            _id: (line as any)._id,
            itemName: (line as any).itemName,
            lineTotal: (line as any).lineTotal,
            addedAt: (line as any).addedAt,
            voided: (line as any).voided,
          })
        }
      }
    } else {
      console.log('❌ NOT found in tenant database')
    }

    // 3. Search for userId from logs
    console.log('\n3. Searching for userId from logs: 6a5fe17b12981336f9ba2590...')
    const logUserId = new mongoose.Types.ObjectId('6a5fe17b12981336f9ba2590')
    
    // Check platform
    const platformUserById = await platformDb.collection('users').findOne({ 
      _id: logUserId 
    })
    if (platformUserById) {
      console.log('   ✅ Found in PLATFORM DB:', {
        _id: platformUserById._id,
        email: platformUserById.email,
        name: platformUserById.name,
      })
    } else {
      console.log('   ❌ NOT in platform DB')
    }

    // Check tenant
    const tenantUserById = await models.User.findById(logUserId).lean()
    if (tenantUserById) {
      console.log('   ✅ Found in TENANT DB:', {
        _id: tenantUserById._id,
        email: (tenantUserById as any).email,
        name: (tenantUserById as any).name,
      })
    } else {
      console.log('   ❌ NOT in tenant DB')
    }

    console.log('\n========== SEARCH COMPLETE ==========\n')

    await mongoose.connection.close()
    await tenantConn.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

findUser()
