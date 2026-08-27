/**
 * Test script to directly call TabManager.createSyntheticDirectSaleTab
 * to see the exact error that's preventing synthetic tabs from being created
 * 
 * Run: npx tsx scripts/test-synthetic-tab.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { TabManager } from '@/lib/bar/tab-manager'
import { getModels } from '@/lib/tenant/get-models'

dotenv.config()

async function testSyntheticTab() {
  try {
    // Connect to jaywines database
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) throw new Error('MONGODB_URI not set')
    
    const tenantUri = baseUri.replace(/\/\w+\?/, '/jaywines?')
    console.log('🔌 Connecting to jaywines...')
    const conn = await mongoose.createConnection(tenantUri).asPromise()
    console.log('✅ Connected!\n')

    // Get a real userId from the database
    const models = getModels(conn)
    const user = await models.User.findOne().lean()
    
    if (!user) {
      console.log('❌ No users found in database')
      await conn.close()
      return
    }

    console.log(`📝 Found user: ${user.email} (${user._id})\n`)
    console.log('🧪 Attempting to create synthetic tab...\n')

    // Try to create a synthetic tab
    const syntheticTab = await TabManager.createSyntheticDirectSaleTab(
      {
        userId:       String(user._id),
        staffId:      String(user._id),
        customerName: 'Test Customer',
        tableNumber:  'DIRECT',
        notes:        'Test synthetic tab',
      },
      conn
    )

    console.log('✅ SYNTHETIC TAB CREATED SUCCESSFULLY!')
    console.log(`   Tab ID: ${(syntheticTab as any)._id}`)
    console.log(`   Tab Number: ${(syntheticTab as any).tabNumber}`)
    console.log(`   Status: ${(syntheticTab as any).status}`)
    console.log(`   Is Synthetic: ${(syntheticTab as any).isSyntheticDirectSale}`)
    console.log('\n💡 The synthetic tab creation is working!')
    console.log('   The issue must be elsewhere in the flow\n')

    await conn.close()

  } catch (error: any) {
    console.log('\n❌ ERROR CREATING SYNTHETIC TAB:\n')
    console.log(`   Message: ${error.message}`)
    console.log(`   Stack: ${error.stack}\n`)
    
    if (error.message.includes('validation failed')) {
      console.log('💡 This is a SCHEMA VALIDATION ERROR')
      console.log('   Check if the BarTab schema accepts isSyntheticDirectSaleTab field\n')
    }
    
    if (error.message.includes('enum')) {
      console.log('💡 This is an ENUM ERROR')
      console.log('   Check if all audit log operations use valid enum values\n')
    }

    process.exit(1)
  }
}

testSyntheticTab()
