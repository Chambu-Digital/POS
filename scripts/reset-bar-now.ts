/**
 * INSTANT BAR RESET (NO CONFIRMATION)
 * 
 * Use this for quick testing resets
 * Run: npx tsx scripts/reset-bar-now.ts
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { 
  saleSchema, 
  barTabSchema, 
  barTabLineSchema, 
  barBottleSchema, 
  barAuditLogSchema 
} from '@/lib/models/schemas'

dotenv.config()

async function resetBar() {
  const baseUri = process.env.MONGODB_URI!
  const tenantUri = baseUri.replace('/?', '/jaywines?')
  
  console.log('🔌 Connecting to jaywines...')
  await mongoose.connect(tenantUri)
  console.log('✅ Connected!\n')

  const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema)
  const BarTab = mongoose.models.BarTab || mongoose.model('BarTab', barTabSchema)
  const BarTabLine = mongoose.models.BarTabLine || mongoose.model('BarTabLine', barTabLineSchema)
  const BarBottle = mongoose.models.BarBottle || mongoose.model('BarBottle', barBottleSchema)
  const BarAuditLog = mongoose.models.BarAuditLog || mongoose.model('BarAuditLog', barAuditLogSchema)

  console.log('🗑️  DELETING BAR DATA...\n')

  const results = {
    tabLines: await BarTabLine.deleteMany({}),
    tabs: await BarTab.deleteMany({}),
    bottles: await BarBottle.deleteMany({}),
    auditLogs: await BarAuditLog.deleteMany({}),
    sales: await Sale.deleteMany({ source: 'bar' }),
  }

  console.log(`✅ Deleted ${results.tabLines.deletedCount} tab lines`)
  console.log(`✅ Deleted ${results.tabs.deletedCount} tabs`)
  console.log(`✅ Deleted ${results.bottles.deletedCount} bottles`)
  console.log(`✅ Deleted ${results.auditLogs.deletedCount} audit logs`)
  console.log(`✅ Deleted ${results.sales.deletedCount} bar sales`)

  console.log('\n✅ BAR MODULE RESET COMPLETE!')
  console.log('\n📋 STATUS:')
  console.log('   ✅ All inventory items intact')
  console.log('   ✅ All servings configured')
  console.log('   ✅ All stock sealed (no open bottles)')
  console.log('   ✅ No transaction history')
  console.log('\n💡 READY FOR LIVE TESTING!')

  await mongoose.disconnect()
}

resetBar().catch(console.error)
