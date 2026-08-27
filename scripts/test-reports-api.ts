// Test the products-sold API with the date fix
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

async function testReportsAPI() {
  try {
    const jayWinesUri = 'mongodb://jayjeremy2000:chambupos@ac-hyykgmq-shard-00-02.u8o9dcg.mongodb.net:27017/jaywines?ssl=true&replicaSet=atlas-xuf6tr-shard-0&authSource=admin&appName=chambupos'
    
    console.log('\n========== TESTING REPORTS API FIX ==========\n')
    
    await mongoose.connect(jayWinesUri)
    const conn = mongoose.connection
    const models = getModels(conn)

    const userId = '6a5fe17b12981336f9ba2590'
    
    // Test 1: OLD WAY (midnight to midnight - BROKEN)
    console.log('1. Testing OLD date logic (midnight to midnight):')
    const oldFrom = new Date('2026-08-27')
    const oldTo = new Date('2026-08-27')
    console.log('   From:', oldFrom.toISOString())
    console.log('   To:  ', oldTo.toISOString())
    
    const oldResults = await models.BarTabLine.find({
      userId,
      addedAt: { $gte: oldFrom, $lte: oldTo },
      voided: false,
    }).lean()
    
    console.log(`   Result: Found ${oldResults.length} record(s)`)
    if (oldResults.length > 0) {
      console.log('   ❌ UNEXPECTED: Should find 0 records (all sales after midnight)')
    } else {
      console.log('   ✅ Expected: 0 records (sales at 10:30 AM and 11:16 AM excluded)')
    }

    // Test 2: NEW WAY (start of day to end of day - FIXED)
    console.log('\n2. Testing NEW date logic (start to end of day):')
    const newFrom = new Date('2026-08-27')
    newFrom.setHours(0, 0, 0, 0)
    const newTo = new Date('2026-08-27')
    newTo.setHours(23, 59, 59, 999)
    console.log('   From:', newFrom.toISOString())
    console.log('   To:  ', newTo.toISOString())
    
    const newResults = await models.BarTabLine.find({
      userId,
      addedAt: { $gte: newFrom, $lte: newTo },
      voided: false,
    }).lean()
    
    console.log(`   Result: Found ${newResults.length} record(s)`)
    if (newResults.length > 0) {
      console.log('   ✅ FIXED! Now capturing sales throughout the day')
      
      let totalRevenue = 0
      console.log('\n   Sales details:')
      for (const line of newResults as any[]) {
        const time = new Date(line.addedAt).toLocaleTimeString()
        console.log(`     - ${line.itemName}: KES ${line.lineTotal} at ${time}`)
        totalRevenue += line.lineTotal
      }
      console.log(`\n   Total Revenue: KES ${totalRevenue}`)
    } else {
      console.log('   ❌ ERROR: Should find 4 records')
    }

    // Test 3: Verify the actual sales timestamps
    console.log('\n3. Checking actual sale timestamps:')
    const allSales = await models.BarTabLine.find({
      userId,
      voided: false,
    })
    .sort({ addedAt: 1 })
    .lean()

    for (const sale of allSales as any[]) {
      const date = new Date(sale.addedAt)
      console.log(`   - ${sale.itemName}: ${date.toLocaleString()} (KES ${sale.lineTotal})`)
    }

    console.log('\n========== TEST COMPLETE ==========\n')

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

testReportsAPI()
