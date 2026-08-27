/**
 * Check specific tab by ID
 * Run: npx tsx scripts/check-specific-tab.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { barTabSchema, barTabLineSchema, barAuditLogSchema, barBottleSchema } from '@/lib/models/schemas'

dotenv.config()

async function checkTab() {
  // MongoDB URI format: mongodb://user:pass@host:port/?params
  // Need to insert /jaywines before the ?
  const baseUri = process.env.MONGODB_URI!
  const tenantUri = baseUri.replace('/?', '/jaywines?')
    
  console.log('Connecting to jaywines database...')
  const conn = await mongoose.createConnection(tenantUri, { 
    serverSelectionTimeoutMS: 5000 
  }).asPromise()

  console.log('✅ Connected to:', conn.name, '\n')

  const BarTab = conn.model('BarTab', barTabSchema)
  const BarTabLine = conn.model('BarTabLine', barTabLineSchema)
  const BarAuditLog = conn.model('BarAuditLog', barAuditLogSchema)
  const BarBottle = conn.model('BarBottle', barBottleSchema)

  // The tab ID from your logs
  const tabId = '6a8ff065cadad8599ba24bbb'

  const tab = await BarTab.findById(tabId).lean()
  
  if (!tab) {
    console.log('❌ Tab not found')
    await conn.close()
    return
  }

  console.log('📋 TAB:', tab.tabNumber, '-', tab.customerName)
  console.log('   Total:', tab.total)
  console.log('   Status:', tab.status)
  console.log('   Synthetic:', tab.isSyntheticDirectSale || false)
  console.log()

  const lines = await BarTabLine.find({ tabId }).lean()
  console.log(`📝 LINES (${lines.length}):`)
  
  for (const line of lines as any[]) {
    console.log(`\n   ${line.itemName} ${line.servingName ? `(${line.servingName})` : ''}`)
    console.log(`   Qty: ${line.quantity}, Price: ${line.unitPrice}`)
    console.log(`   ServingID: ${line.servingId || 'NULL'}`)
    console.log(`   BottleID: ${line.bottleId || 'NULL'}`)
    
    if (line.servingId && !line.bottleId) {
      console.log(`   ⚠️  SERVING WITH NO BOTTLE TRACKING!`)
    }
  }

  // Check bottles
  const bottles = await BarBottle.find({ state: 'open' }).lean()
  console.log(`\n🍾 OPEN BOTTLES: ${bottles.length}`)
  
  for (const bottle of bottles as any[]) {
    console.log(`   Bottle #${bottle.bottleNumber}: ${(bottle.remainingFraction * 100).toFixed(1)}% remaining`)
  }

  // Check audit logs
  const servingSoldCount = await BarAuditLog.countDocuments({ operation: 'SERVING_SOLD' })
  console.log(`\n📊 SERVING_SOLD LOGS: ${servingSoldCount}`)

  await conn.close()
}

checkTab().catch(console.error)
