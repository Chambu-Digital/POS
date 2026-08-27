/**
 * Check recent bar sales to see if POS sales are being recorded at all
 * 
 * Run: npx tsx scripts/check-recent-sales.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { saleSchema } from '@/lib/models/schemas'

dotenv.config()

async function checkSales() {
  try {
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) throw new Error('MONGODB_URI not set')
    
    const tenantUri = baseUri.replace(/\/\w+\?/, '/jaywines?')
    console.log('🔌 Connecting to jaywines...')
    await mongoose.connect(tenantUri)
    console.log('✅ Connected!\n')

    const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema)

    // Check all sales
    const allSales = await Sale.countDocuments({})
    console.log(`📊 Total sales in database: ${allSales}`)

    // Check ALL recent sales (regardless of source)
    const recentSales = await Sale.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()

    console.log(`📊 Recent sales (any source): ${recentSales.length}\n`)

    if (recentSales.length > 0) {
      console.log('Recent sales:\n')
      recentSales.forEach((sale: any, i: number) => {
        console.log(`[${i + 1}] Order #${sale.orderNumber} - ${sale.customerName}`)
        console.log(`    Total: ${sale.total}`)
        console.log(`    Payment: ${sale.paymentMethod}`)
        console.log(`    Created: ${sale.createdAt?.toISOString()}`)
        console.log(`    Items:`)
        sale.items?.forEach((item: any) => {
          console.log(`      - ${item.productName} x${item.quantity} @ ${item.price}`)
        })
        console.log(`    Has syntheticTabId: ${sale.syntheticTabId ? `✅ ${sale.syntheticTabId}` : '❌ NO'}`)
        console.log()
      })
    } else {
      console.log('❌ No sales found in database at all\n')
    }

    await mongoose.disconnect()
    console.log('✅ Disconnected')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

checkSales()
