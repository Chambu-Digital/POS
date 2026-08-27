import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { barInventoryItemSchema, barServingSchema } from '@/lib/models/schemas'

dotenv.config()

async function checkProduct() {
  const baseUri = process.env.MONGODB_URI!
  const tenantUri = baseUri.replace('/?', '/jaywines?')
  
  await mongoose.connect(tenantUri)
  console.log('✅ Connected\n')

  const BarInventoryItem = mongoose.model('BarInventoryItem', barInventoryItemSchema)
  const BarServing = mongoose.model('BarServing', barServingSchema)

  // The product sold
  const productId = '6a64b6f27ea0db7659fe0b50'
  
  const product = await BarInventoryItem.findById(productId).lean()
  
  if (!product) {
    console.log('❌ Product not found')
    await mongoose.disconnect()
    return
  }

  console.log('📦 PRODUCT:', (product as any).name)
  console.log('   Size:', (product as any).size)
  console.log('   Price:', (product as any).sellingPrice)
  console.log()

  const servings = await BarServing.find({ 
    inventoryItemId: productId,
    isActive: true 
  }).lean()

  console.log(`🍺 SERVINGS: ${servings.length}`)
  
  if (servings.length === 0) {
    console.log('   ❌ NO SERVINGS CONFIGURED!')
    console.log('   This product can only be sold as sealed bottles.')
    console.log('\n💡 To test serving sales and bottle tracking:')
    console.log('   1. Find a product WITH servings (check your inventory)')
    console.log('   2. Open a bottle of that product')
    console.log('   3. Sell a serving (e.g., "Smirnoff - Tot")')
  } else {
    servings.forEach((s: any) => {
      console.log(`\n   - ${s.name}`)
      console.log(`     Price: ${s.sellingPrice}`)
      console.log(`     Servings per bottle: ${s.servingsPerContainer}`)
    })
  }

  await mongoose.disconnect()
}

checkProduct().catch(console.error)
