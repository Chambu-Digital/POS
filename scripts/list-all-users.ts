// List all users in both platform and tenant databases
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

async function listAllUsers() {
  try {
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) {
      console.error('❌ MONGODB_URI not set')
      process.exit(1)
    }

    console.log('\n========== ALL USERS IN SYSTEM ==========\n')

    // 1. Platform database (jayposmulti)
    console.log('1. PLATFORM DATABASE (jayposmulti) users:')
    await connectDB()
    const platformDb = mongoose.connection.db
    
    const platformUsers = await platformDb.collection('users').find({}).toArray()
    console.log(`   Found ${platformUsers.length} user(s)\n`)
    
    for (const user of platformUsers) {
      console.log('   -', {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      })
    }

    // 2. Tenant database (jaywines)
    console.log('\n2. TENANT DATABASE (jaywines) users:')
    const tenantUri = baseUri.replace('/jayposmulti', '/jaywines')
    const tenantConn = await connectTenantDB(tenantUri)
    const models = getModels(tenantConn)

    const tenantUsers = await models.User.find({}).lean()
    console.log(`   Found ${tenantUsers.length} user(s)\n`)
    
    for (const user of tenantUsers) {
      console.log('   -', {
        _id: (user as any)._id,
        email: (user as any).email,
        name: (user as any).name,
        role: (user as any).role,
      })

      // Check if this user has bar data
      const tabLineCount = await models.BarTabLine.countDocuments({ 
        userId: (user as any)._id 
      })
      const tabCount = await models.BarTab.countDocuments({ 
        userId: (user as any)._id 
      })
      
      if (tabLineCount > 0 || tabCount > 0) {
        console.log(`     → Has ${tabLineCount} tab lines, ${tabCount} tabs`)
      }
    }

    // 3. Check ALL tenants in platform
    console.log('\n3. ALL TENANTS in platform:')
    const tenants = await platformDb.collection('tenants').find({}).toArray()
    console.log(`   Found ${tenants.length} tenant(s)\n`)
    
    for (const tenant of tenants) {
      console.log('   -', {
        _id: tenant._id,
        name: tenant.name,
        dbName: tenant.dbName,
        owner: tenant.owner,
        status: tenant.status,
      })
    }

    // 4. Check if there's a different tenant database with sheaglow user
    console.log('\n4. Checking other tenant databases...')
    const admin = platformDb.admin()
    const { databases } = await admin.listDatabases()
    
    for (const dbInfo of databases) {
      if (dbInfo.name !== 'jayposmulti' && 
          dbInfo.name !== 'jaywines' && 
          !['admin', 'local', 'config'].includes(dbInfo.name)) {
        
        console.log(`\n   Checking ${dbInfo.name}...`)
        const otherDb = mongoose.connection.client.db(dbInfo.name)
        
        try {
          const collections = await otherDb.listCollections().toArray()
          const hasUsersCollection = collections.some(c => c.name === 'users')
          
          if (hasUsersCollection) {
            const users = await otherDb.collection('users').find({}).toArray()
            console.log(`     Found ${users.length} user(s)`)
            
            for (const user of users) {
              console.log('       -', {
                _id: user._id,
                email: user.email,
                name: user.name,
              })
              
              // Check if this is sheaglow
              if (user.email && user.email.includes('sheaglow')) {
                console.log('       🎯 FOUND SHEAGLOW USER!')
              }
              
              // Check if this matches the log userId
              if (user._id && user._id.toString() === '6a5fe17b12981336f9ba2590') {
                console.log('       🎯 FOUND LOG USER!')
              }
            }
          }
        } catch (err) {
          console.log(`     ⚠️  Could not read: ${err}`)
        }
      }
    }

    console.log('\n========== COMPLETE ==========\n')

    await mongoose.connection.close()
    await tenantConn.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

listAllUsers()
