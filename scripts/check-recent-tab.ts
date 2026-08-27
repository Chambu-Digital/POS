/**
 * Check the recent tab to see if it has bottle tracking
 * 
 * Run: npx tsx scripts/check-recent-tab.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { barTabSchema, barTabLineSchema, barAuditLogSchema } from '@/lib/models/schemas'

dotenv.config()

async function checkTab() {
  try {
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) throw new Error('MONGODB_URI not set')
    
    const tenantUri = baseUri.replace(/\/\w+\?/, '/jaywines?')
    console.log('🔌 Connecting to jaywines...')
    await mongoose.connect(tenantUri)
    console.log('✅ Connected!\n')

    const BarTab = mongoose.models.BarTab || mongoose.model('BarTab', barTabSchema)
    const BarTabLine = mongoose.models.BarTabLine || mongoose.model('BarTabLine', barTabLineSchema)
    const BarAuditLog = mongoose.models.BarAuditLog || mongoose.model('BarAuditLog', barAuditLogSchema)

    // Find the most recent tab
    const recentTab = await BarTab.findOne()
      .sort({ createdAt: -1 })
      .lean()

    if (!recentTab) {
      console.log('❌ No tabs found')
      await mongoose.disconnect()
      return
    }

    console.log('📋 MOST RECENT TAB:')
    console.log(`   Tab Number: ${recentTab.tabNumber}`)
    console.log(`   Customer: ${recentTab.customerName}`)
    console.log(`   Status: ${recentTab.status}`)
    console.log(`   Total: ${recentTab.total}`)
    console.log(`   Synthetic: ${recentTab.isSyntheticDirectSale ? '✅ YES' : '❌ NO'}`)
    console.log(`   Created: ${recentTab.createdAt?.toISOString()}`)
    console.log(`   Closed: ${recentTab.closedAt?.toISOString() || 'N/A'}`)
    console.log()

    // Find all lines for this tab
    const lines = await BarTabLine.find({ tabId: recentTab._id })
      .sort({ addedAt: 1 })
      .lean()

    console.log(`📝 TAB LINES (${lines.length}):\n`)
    lines.forEach((line: any, i: number) => {
      console.log(`   [${i + 1}] ${line.itemName}${line.servingName ? ` - ${line.servingName}` : ''}`)
      console.log(`       Quantity: ${line.quantity}`)
      console.log(`       Price: ${line.unitPrice}`)
      console.log(`       Total: ${line.lineTotal}`)
      console.log(`       Serving ID: ${line.servingId || '❌ NULL (bottle sale)'}`)
      console.log(`       Bottle ID: ${line.bottleId || '❌ NULL (no tracking)'}`)
      
      if (line.servingId && !line.bottleId) {
        console.log(`       ⚠️  WARNING: This is a serving but has NO bottle tracking!`)
      } else if (line.servingId && line.bottleId) {
        console.log(`       ✅ BOTTLE TRACKED`)
      }
      console.log()
    })

    // Check for SERVING_SOLD audit logs for this tab
    const servingSoldLogs = await BarAuditLog.find({ 
      operation: 'SERVING_SOLD',
      'details.tabId': String(recentTab._id)
    }).lean()

    console.log(`📊 SERVING_SOLD AUDIT LOGS: ${servingSoldLogs.length}`)
    if (servingSoldLogs.length > 0) {
      console.log('   ✅ Bottle tracking IS working!\n')
    } else {
      console.log('   ❌ No SERVING_SOLD logs - bottle tracking NOT working\n')
    }

    await mongoose.disconnect()
    console.log('✅ Disconnected')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

checkTab()
