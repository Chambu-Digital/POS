import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { saleSchema } from '@/lib/models/schemas'

dotenv.config()

async function findSale() {
  const baseUri = process.env.MONGODB_URI!
  const tenantUri = baseUri.replace('/?', '/jaywines?')
  
  await mongoose.connect(tenantUri)
  console.log('✅ Connected to:', mongoose.connection.name, '\n')

  const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema)

  // The sale ID from the logs
  const saleId = '6a8ff2fdcadad8599ba24ccb'
  
  const sale = await Sale.findById(saleId).lean()
  
  if (sale) {
    console.log('✅ SALE FOUND!')
    console.log(JSON.stringify(sale, null, 2))
  } else {
    console.log('❌ Sale not found with ID:', saleId)
    
    // Check if there are ANY sales with orderNumber BAR-00014
    const barSale = await Sale.findOne({ orderNumber: 'BAR-00014' }).lean()
    if (barSale) {
      console.log('\n✅ Found by order number!')
      console.log(JSON.stringify(barSale, null, 2))
    } else {
      console.log('❌ No sale with orderNumber BAR-00014 either')
    }
  }

  await mongoose.disconnect()
}

findSale().catch(console.error)
