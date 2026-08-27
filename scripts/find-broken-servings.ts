/**
 * Find all servings with missing or invalid servingsPerContainer
 * Run: npx tsx scripts/find-broken-servings.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { barServingSchema, barInventoryItemSchema } from '@/lib/models/schemas'

dotenv.config()

async function findBrokenServings() {
  const baseUri = process.env.MONGODB_URI!
  const tenantUri = baseUri.replace('/?', '/jaywines?')
  
  await mongoose.connect(tenantUri)
  console.log('✅ Connected to jaywines\n')

  const BarServing = mongoose.model('BarServing', barServingSchema)
  const BarInventoryItem = mongoose.model('BarInventoryItem', barInventoryItemSchema)

  // Find servings with undefined, null, 0, or negative servingsPerContainer
  const brokenServings = await BarServing.find({
    $or: [
      { servingsPerContainer: { $exists: false } },
      { servingsPerContainer: null },
      { servingsPerContainer: { $lte: 0 } },
    ]
  }).lean()

  console.log(`🔍 FOUND ${brokenServings.length} BROKEN SERVINGS:\n`)

  if (brokenServings.length === 0) {
    console.log('✅ All servings have valid servingsPerContainer!')
    await mongoose.disconnect()
    return
  }

  for (const serving of brokenServings as any[]) {
    const product = await BarInventoryItem.findById(serving.inventoryItemId).lean() as any
    
    console.log(`❌ ${product?.name || 'Unknown'} - ${serving.name}`)
    console.log(`   ID: ${serving._id}`)
    console.log(`   ServingsPerContainer: ${serving.servingsPerContainer}`)
    console.log(`   SellingPrice: ${serving.sellingPrice}`)
    console.log(`   IsActive: ${serving.isActive}`)
    console.log()
  }

  console.log('\n💡 TO FIX: Run the fix script or manually update servings in the bar inventory UI')
  console.log('   Example: Tot = 20 servings per 750ml bottle')
  console.log('            Quarter = 4 servings per bottle')
  console.log('            Half = 2 servings per bottle')

  await mongoose.disconnect()
}

findBrokenServings().catch(console.error)
