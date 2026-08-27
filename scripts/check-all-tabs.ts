/**
 * Check ALL tabs (synthetic and regular) in the database
 * 
 * Run: npx tsx scripts/check-all-tabs.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { barTabSchema } from '@/lib/models/schemas'

dotenv.config()

async function checkTabs() {
  try {
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) throw new Error('MONGODB_URI not set')
    
    const tenantUri = baseUri.replace(/\/\w+\?/, '/jaywines?')
    console.log('🔌 Connecting to jaywines...')
    await mongoose.connect(tenantUri)
    console.log('✅ Connected!\n')

    const BarTab = mongoose.models.BarTab || mongoose.model('BarTab', barTabSchema)

    const totalTabs = await BarTab.countDocuments({})
    console.log(`📊 Total tabs in database: ${totalTabs}\n`)

    if (totalTabs === 0) {
      console.log('❌ NO TABS FOUND IN DATABASE')
      console.log('\n💡 This means:')
      console.log('   1. You have NEVER used the tab system before')
      console.log('   2. OR all tabs were deleted')
      console.log('   3. OR the tab system has never been tested\n')
      await mongoose.disconnect()
      return
    }

    const tabs = await BarTab.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    console.log(`Found ${tabs.length} tab(s):\n`)

    tabs.forEach((tab: any, i: number) => {
      console.log(`[${i + 1}] ${tab.tabNumber} - ${tab.customerName || 'No name'}`)
      console.log(`    Status: ${tab.status}`)
      console.log(`    Total: ${tab.total || 0}`)
      console.log(`    Synthetic: ${tab.isSyntheticDirectSale ? '✅ YES' : '❌ NO'}`)
      console.log(`    Created: ${tab.createdAt?.toISOString()}`)
      if (tab.closedAt) {
        console.log(`    Closed: ${tab.closedAt.toISOString()}`)
      }
      console.log()
    })

    await mongoose.disconnect()
    console.log('✅ Disconnected')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

checkTabs()
