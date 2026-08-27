// Test exactly what the API does with date parsing
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

async function testExactAPI() {
  try {
    const jayWinesUri = 'mongodb://jayjeremy2000:chambupos@ac-hyykgmq-shard-00-02.u8o9dcg.mongodb.net:27017/jaywines?ssl=true&replicaSet=atlas-xuf6tr-shard-0&authSource=admin&appName=chambupos'
    
    console.log('\n========== SIMULATING EXACT API BEHAVIOR ==========\n')
    
    await mongoose.connect(jayWinesUri)
    const conn = mongoose.connection
    const models = getModels(conn)

    const userId = '6a5fe17b12981336f9ba2590'
    
    // Simulate what happens when frontend sends: from=2026-08-27&to=2026-08-27
    
    console.log('Frontend sends: from=2026-08-27&to=2026-08-27')
    console.log('(These are date-only strings, no time component)')
    
    // OLD API CODE (before fix)
    console.log('\n1. OLD API CODE (before fix):')
    const oldToParam = '2026-08-27'
    const oldTo = new Date(oldToParam)  // Creates date at midnight
    console.log('   const to = new Date("2026-08-27")')
    console.log('   Result:', oldTo.toISOString())
    console.log('   ⚠️  This is MIDNIGHT, not end of day!')
    
    const oldResults = await models.BarTabLine.find({
      userId,
      addedAt: { $gte: new Date('2026-08-27'), $lte: oldTo },
      voided: false,
    }).lean()
    
    console.log(`   Query result: ${oldResults.length} records`)
    console.log('   ❌ BROKEN: Excludes all sales after midnight')

    // NEW API CODE (after fix)
    console.log('\n2. NEW API CODE (after fix):')
    const newToParam = '2026-08-27'
    const newTo = new Date(newToParam)
    newTo.setHours(23, 59, 59, 999)  // Set to end of day
    console.log('   const to = new Date("2026-08-27")')
    console.log('   to.setHours(23, 59, 59, 999)')
    console.log('   Result:', newTo.toISOString())
    console.log('   ✅ This is END OF DAY!')
    
    const newFromParam = '2026-08-27'
    const newFrom = new Date(newFromParam)
    newFrom.setHours(0, 0, 0, 0)  // Set to start of day
    console.log('\n   const from = new Date("2026-08-27")')
    console.log('   from.setHours(0, 0, 0, 0)')
    console.log('   Result:', newFrom.toISOString())
    
    const newResults = await models.BarTabLine.find({
      userId,
      addedAt: { $gte: newFrom, $lte: newTo },
      voided: false,
    }).lean()
    
    console.log(`\n   Query result: ${newResults.length} records`)
    
    if (newResults.length > 0) {
      console.log('   ✅ FIXED! Captures full day of sales\n')
      
      let totalRevenue = 0
      console.log('   Sales captured:')
      for (const line of newResults as any[]) {
        const addedAt = new Date(line.addedAt)
        console.log(`     - ${line.itemName}: KES ${line.lineTotal}`)
        console.log(`       Added at: ${addedAt.toISOString()} (${addedAt.toLocaleString()})`)
        totalRevenue += line.lineTotal
      }
      console.log(`\n   📊 Total Revenue: KES ${totalRevenue}`)
      console.log(`   📊 Total Sales: ${newResults.length}`)
    } else {
      console.log('   ❌ Still broken - checking why...')
      
      // Debug: check what's in the database
      console.log('\n   Debug: All sales for this user:')
      const allSales = await models.BarTabLine.find({ userId, voided: false }).lean()
      for (const sale of allSales as any[]) {
        console.log(`     - ${(sale as any).itemName}: ${new Date((sale as any).addedAt).toISOString()}`)
      }
      
      console.log('\n   Date range used:')
      console.log(`     From: ${newFrom.toISOString()}`)
      console.log(`     To:   ${newTo.toISOString()}`)
    }

    console.log('\n========== TEST COMPLETE ==========\n')

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

testExactAPI()
