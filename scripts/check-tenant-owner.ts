// Check if the userId from logs matches any tenant owner
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

async function checkTenantOwner() {
  try {
    console.log('\n========== CHECKING TENANT OWNERSHIP ==========\n')

    await connectDB()
    const platformDb = mongoose.connection.db
    
    const userId = '6a5fe17b12981336f9ba2590'
    const userObjectId = new mongoose.Types.ObjectId(userId)

    console.log('Looking for userId:', userId)
    console.log('As ObjectId:', userObjectId)

    // Check if this is a tenant owner
    const tenant = await platformDb.collection('tenants').findOne({
      owner: userObjectId
    })

    if (tenant) {
      console.log('\n✅ Found tenant with this owner:', {
        _id: tenant._id,
        name: tenant.name,
        owner: tenant.owner,
        dbName: tenant.dbName,
        mongoUri: tenant.mongoUri ? '[REDACTED]' : undefined,
        status: tenant.status,
        createdAt: tenant.createdAt,
      })

      // Check if there's a user in the platform with this ID
      const user = await platformDb.collection('users').findOne({
        _id: userObjectId
      })

      if (user) {
        console.log('\n✅ Platform user found:', {
          _id: user._id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        })
      } else {
        console.log('\n❌ No platform user found with this ID')
        console.log('   This means the tenant owner user was deleted!')
      }

      // If tenant has a dbName, check that database
      if (tenant.dbName) {
        console.log(`\n   Checking ${tenant.dbName} database for this user...`)
        const tenantDb = mongoose.connection.client.db(tenant.dbName)
        
        try {
          const tenantUser = await tenantDb.collection('users').findOne({
            _id: userObjectId
          })

          if (tenantUser) {
            console.log('   ✅ Found in tenant DB:', {
              _id: tenantUser._id,
              email: tenantUser.email,
              role: tenantUser.role,
            })
          } else {
            console.log('   ❌ NOT in tenant DB')
          }
        } catch (err) {
          console.log('   ⚠️  Error checking tenant DB:', err)
        }
      }
    } else {
      console.log('\n❌ No tenant found with this owner ID')
    }

    // List all tenants for reference
    console.log('\n========== ALL TENANTS ==========\n')
    const allTenants = await platformDb.collection('tenants').find({}).toArray()
    
    for (const t of allTenants) {
      console.log({
        _id: t._id,
        name: t.name,
        owner: t.owner,
        dbName: t.dbName,
        status: t.status,
      })
    }

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkTenantOwner()
