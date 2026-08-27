// Test the UTC fix
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import mongoose from 'mongoose'
import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

async function testUTCFix() {
  try {
    const jayWinesUri = 'mongodb://jayjeremy2000:chambupos@ac-hyykgmq-shard-00-02.u8o9dcg.mongodb.net:27017/jaywines?ssl=true&replicaSet=atlas-xuf6tr-shard-0&authSource=admin&appName=chambupos'
    
    console.log('\n========== TESTING UTC FIX ==========\n')
    
    await mongoose.connect(jayWinesUri)
    const conn = mongoose.connection
    const models = getModels(conn)

    const userId = '6a5fe17b12981336f9ba2590'
    
    // Simulate: from=2026-08-27&to=2026-08-27
    const fromParam = '2026-08-27'
    const toParam = '2026-08-27'
    
    console.log('Frontend sends:', { from: fromParam, to: toParam })
    
    // NEW FIX: Append time in UTC
    const to = new Date(toParam + 'T23:59:59.999Z')
    const from = new Date(fromParam + 'T00:00:00.000Z')
    
    console.log('\nParsed dates (UTC):')
    console.log('  From:', from.toISOString())
    console.log('  To:  ', to.toISOString())
    
    const results = await models.BarTabLine.find({
      userId,
      addedAt: { $gte: from, $lte: to },
      voided: false,
    }).lean()
    
    console.log(`\nQuery result: ${results.length} record(s)`)
    
    if (results.length > 0) {
      console.log('✅ SUCCESS! Now capturing all sales\n')
      
      let totalRevenue = 0
      console.log('Sales captured:')
      for (const line of results as any[]) {
        const addedAt = new Date(line.addedAt)
        console.log(`  - ${line.itemName}: KES ${line.lineTotal}`)
        console.log(`    Added at: ${addedAt.toISOString()}`)
        totalRevenue += line.lineTotal
      }
      console.log(`\n📊 Total Revenue: KES ${totalRevenue}`)
      console.log(`📊 Total Sales: ${results.length}`)
    } else {
      console.log('❌ Still not working\n')
      
      console.log('Debug: Sales in database:')
      const allSales = await models.BarTabLine.find({ userId, voided: false }).lean()
      for (const sale of allSales as any[]) {
        console.log(`  - ${(sale as any).addedAt}`)
      }
    }

    console.log('\n========== TEST COMPLETE ==========\n')

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

testUTCFix()
