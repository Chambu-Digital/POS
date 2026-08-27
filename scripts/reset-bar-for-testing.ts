/**
 * RESET BAR MODULE FOR CLEAN TESTING
 * 
 * This script:
 * 1. Deletes all bar sales (Sale records with source='bar')
 * 2. Deletes all bar tabs (BarTab, BarTabLine)
 * 3. Deletes all bottles (BarBottle)
 * 4. Deletes all audit logs (BarAuditLog)
 * 5. Keeps inventory items and servings intact
 * 6. Keeps products and their configurations
 * 
 * ⚠️  WARNING: This is DESTRUCTIVE and CANNOT be undone!
 * 
 * Run: npx tsx scripts/reset-bar-for-testing.ts
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
import * as readline from 'readline'

dotenv.config()

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes')
    })
  })
}

async function resetBar() {
  try {
    const baseUri = process.env.MONGODB_URI!
    const tenantUri = baseUri.replace('/?', '/jaywines?')
    
    console.log('🔌 Connecting to jaywines database...')
    await mongoose.connect(tenantUri)
    console.log('✅ Connected!\n')

    // Define models
    const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema)
    const BarTab = mongoose.models.BarTab || mongoose.model('BarTab', barTabSchema)
    const BarTabLine = mongoose.models.BarTabLine || mongoose.model('BarTabLine', barTabLineSchema)
    const BarBottle = mongoose.models.BarBottle || mongoose.model('BarBottle', barBottleSchema)
    const BarAuditLog = mongoose.models.BarAuditLog || mongoose.model('BarAuditLog', barAuditLogSchema)

    // Count what will be deleted
    const barSalesCount = await Sale.countDocuments({ source: 'bar' })
    const tabsCount = await BarTab.countDocuments({})
    const tabLinesCount = await BarTabLine.countDocuments({})
    const bottlesCount = await BarBottle.countDocuments({})
    const auditLogsCount = await BarAuditLog.countDocuments({})

    console.log('📊 ITEMS TO BE DELETED:')
    console.log(`   Bar Sales: ${barSalesCount}`)
    console.log(`   Bar Tabs: ${tabsCount}`)
    console.log(`   Tab Lines: ${tabLinesCount}`)
    console.log(`   Bottles: ${bottlesCount}`)
    console.log(`   Audit Logs: ${auditLogsCount}`)
    console.log()

    if (barSalesCount === 0 && tabsCount === 0 && bottlesCount === 0 && auditLogsCount === 0) {
      console.log('✅ Nothing to delete - bar module is already clean!')
      await mongoose.disconnect()
      return
    }

    console.log('⚠️  WARNING: This will DELETE all bar transaction data!')
    console.log('   - All sales records will be LOST')
    console.log('   - All tabs will be DELETED')
    console.log('   - All bottles (open and closed) will be REMOVED')
    console.log('   - All audit logs will be CLEARED')
    console.log()
    console.log('✅ WILL BE KEPT:')
    console.log('   - Bar inventory items (products)')
    console.log('   - Servings configurations')
    console.log('   - Stock levels will remain unchanged')
    console.log()

    const confirmed = await askConfirmation('Type "yes" to proceed with deletion: ')

    if (!confirmed) {
      console.log('\n❌ Operation cancelled by user')
      await mongoose.disconnect()
      return
    }

    console.log('\n🗑️  DELETING DATA...\n')

    // Delete in order (referential integrity)
    
    // 1. Delete tab lines first (reference tabs)
    if (tabLinesCount > 0) {
      const result = await BarTabLine.deleteMany({})
      console.log(`✅ Deleted ${result.deletedCount} tab lines`)
    }

    // 2. Delete tabs
    if (tabsCount > 0) {
      const result = await BarTab.deleteMany({})
      console.log(`✅ Deleted ${result.deletedCount} tabs`)
    }

    // 3. Delete bottles
    if (bottlesCount > 0) {
      const result = await BarBottle.deleteMany({})
      console.log(`✅ Deleted ${result.deletedCount} bottles`)
    }

    // 4. Delete audit logs
    if (auditLogsCount > 0) {
      const result = await BarAuditLog.deleteMany({})
      console.log(`✅ Deleted ${result.deletedCount} audit logs`)
    }

    // 5. Delete bar sales
    if (barSalesCount > 0) {
      const result = await Sale.deleteMany({ source: 'bar' })
      console.log(`✅ Deleted ${result.deletedCount} bar sales`)
    }

    console.log('\n✅ BAR MODULE RESET COMPLETE!')
    console.log('\n📋 READY FOR TESTING:')
    console.log('   1. All inventory items still exist with their stock')
    console.log('   2. All servings are configured and ready')
    console.log('   3. No open bottles - all stock is sealed')
    console.log('   4. No sales history')
    console.log('   5. No tabs or audit logs')
    console.log()
    console.log('💡 NEXT STEPS:')
    console.log('   1. Go to Bar POS')
    console.log('   2. Open a bottle of a product with servings')
    console.log('   3. Sell a serving')
    console.log('   4. Check bottle tracking is working!')

    await mongoose.disconnect()
    console.log('\n✅ Disconnected from database')

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message)
    process.exit(1)
  }
}

resetBar()
