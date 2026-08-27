/**
 * Diagnostic script to check if bottle tracking is working
 * 
 * This script checks:
 * 1. If BarAuditLog has SERVING_SOLD entries
 * 2. If BarBottle remainingFraction is being updated
 * 3. If BarTabLine records have bottleId populated
 * 4. If synthetic tabs are being created
 * 
 * Run: npx tsx scripts/diagnose-bottle-tracking.ts
 */

import mongoose from 'mongoose'
import { barBottleSchema, barAuditLogSchema, barTabSchema, barTabLineSchema } from '@/lib/models/schemas'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function diagnose() {
  try {
    // Connect to jaywines database (your tenant DB)
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) {
      throw new Error('MONGODB_URI not found in environment')
    }
    const tenantUri = baseUri.replace(/\/\w+\?/, '/jaywines?')
    
    console.log('🔌 Connecting to jaywines database...')
    console.log(`   URI: ${tenantUri.replace(/:[^:@]+@/, ':****@')}`)
    await mongoose.connect(tenantUri)
    console.log('✅ Connected!\n')

    // Define models
    const BarBottle = mongoose.models.BarBottle || mongoose.model('BarBottle', barBottleSchema)
    const BarAuditLog = mongoose.models.BarAuditLog || mongoose.model('BarAuditLog', barAuditLogSchema)
    const BarTab = mongoose.models.BarTab || mongoose.model('BarTab', barTabSchema)
    const BarTabLine = mongoose.models.BarTabLine || mongoose.model('BarTabLine', barTabLineSchema)

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Check for SERVING_SOLD audit logs
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('1️⃣  CHECKING SERVING_SOLD AUDIT LOGS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const servingSoldLogs = await BarAuditLog.find({ operation: 'SERVING_SOLD' })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean()

    if (servingSoldLogs.length === 0) {
      console.log('❌ NO SERVING_SOLD AUDIT LOGS FOUND')
      console.log('   This means InventoryEngine.deductFraction() was NEVER called')
      console.log('   OR it was called but failed before creating the audit log\n')
    } else {
      console.log(`✅ Found ${servingSoldLogs.length} SERVING_SOLD entries (showing last 10):\n`)
      servingSoldLogs.forEach((log: any, i: number) => {
        console.log(`   [${i + 1}] ${log.timestamp.toISOString()}`)
        console.log(`       Bottle ID: ${log.details?.bottleId}`)
        console.log(`       Fraction Deducted: ${log.details?.fractionDeducted}`)
        console.log(`       Remaining Fraction: ${log.details?.remainingFraction}`)
        console.log(`       Bottle Number: ${log.details?.bottleNumber}\n`)
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Check open bottles and their remainingFraction
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('2️⃣  CHECKING OPEN BOTTLES')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const openBottles = await BarBottle.find({ state: 'open' })
      .populate('inventoryItemId', 'name size')
      .sort({ createdAt: -1 })
      .lean()

    if (openBottles.length === 0) {
      console.log('⚠️  NO OPEN BOTTLES FOUND\n')
    } else {
      console.log(`Found ${openBottles.length} open bottle(s):\n`)
      openBottles.forEach((bottle: any) => {
        const productName = bottle.inventoryItemId?.name || 'Unknown'
        const productSize = bottle.inventoryItemId?.size || ''
        const remaining = bottle.remainingFraction ?? 1.0
        const pct = (remaining * 100).toFixed(1)
        
        console.log(`   Bottle #${bottle.bottleNumber} - ${productName} ${productSize}`)
        console.log(`   ID: ${bottle._id}`)
        console.log(`   Remaining: ${remaining} (${pct}%)`)
        console.log(`   Opened: ${bottle.openedAt?.toISOString()}`)
        
        if (remaining < 1.0) {
          console.log(`   ✅ THIS BOTTLE HAS BEEN USED (${(1 - remaining) * 100}% consumed)`)
        } else {
          console.log(`   ⚠️  THIS BOTTLE IS STILL FULL (no servings sold yet)`)
        }
        console.log()
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Check synthetic tabs
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('3️⃣  CHECKING SYNTHETIC TABS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const syntheticTabs = await BarTab.find({ isSyntheticDirectSale: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    if (syntheticTabs.length === 0) {
      console.log('❌ NO SYNTHETIC TABS FOUND')
      console.log('   This means TabManager.createSyntheticDirectSaleTab() is failing\n')
    } else {
      console.log(`✅ Found ${syntheticTabs.length} synthetic tab(s) (showing last 10):\n`)
      syntheticTabs.forEach((tab: any, i: number) => {
        console.log(`   [${i + 1}] ${tab.tabNumber} - ${tab.customerName}`)
        console.log(`       Status: ${tab.status}`)
        console.log(`       Total: ${tab.total}`)
        console.log(`       Created: ${tab.createdAt?.toISOString()}`)
        console.log(`       Closed: ${tab.closedAt ? tab.closedAt.toISOString() : 'N/A'}\n`)
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. Check tab lines with servings
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('4️⃣  CHECKING TAB LINES WITH SERVINGS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const servingLines = await BarTabLine.find({ 
      servingId: { $exists: true, $ne: null }
    })
      .sort({ addedAt: -1 })
      .limit(10)
      .lean()

    if (servingLines.length === 0) {
      console.log('❌ NO TAB LINES WITH SERVINGS FOUND')
      console.log('   This means TabManager.addLine() was NEVER called successfully\n')
    } else {
      console.log(`✅ Found ${servingLines.length} serving line(s) (showing last 10):\n`)
      servingLines.forEach((line: any, i: number) => {
        console.log(`   [${i + 1}] ${line.itemName} - ${line.servingName}`)
        console.log(`       Quantity: ${line.quantity}`)
        console.log(`       Bottle ID: ${line.bottleId || '❌ NULL'}`)
        console.log(`       Serving ID: ${line.servingId}`)
        console.log(`       Added: ${line.addedAt?.toISOString()}`)
        
        if (line.bottleId) {
          console.log(`       ✅ BOTTLE TRACKED`)
        } else {
          console.log(`       ❌ NO BOTTLE TRACKING (bottleId is null)`)
        }
        console.log()
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. Check TAB_LINE_ADDED audit logs
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('5️⃣  CHECKING TAB_LINE_ADDED AUDIT LOGS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const tabLineAddedLogs = await BarAuditLog.find({ 
      operation: 'TAB_LINE_ADDED',
      'details.servingId': { $exists: true, $ne: null }
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean()

    if (tabLineAddedLogs.length === 0) {
      console.log('❌ NO TAB_LINE_ADDED LOGS FOR SERVINGS')
      console.log('   TabManager.addLine() never completed successfully\n')
    } else {
      console.log(`✅ Found ${tabLineAddedLogs.length} serving line audit log(s):\n`)
      tabLineAddedLogs.forEach((log: any, i: number) => {
        console.log(`   [${i + 1}] ${log.details?.itemName} - ${log.details?.servingName}`)
        console.log(`       Bottle ID: ${log.details?.bottleId || '❌ NULL'}`)
        console.log(`       Timestamp: ${log.timestamp.toISOString()}\n`)
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DIAGNOSIS SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 DIAGNOSIS SUMMARY')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const hasSyntheticTabs = syntheticTabs.length > 0
    const hasServingLines = servingLines.length > 0
    const hasServingSoldLogs = servingSoldLogs.length > 0
    const hasReducedBottles = openBottles.some((b: any) => (b.remainingFraction ?? 1.0) < 1.0)

    if (hasSyntheticTabs && hasServingLines && hasServingSoldLogs && hasReducedBottles) {
      console.log('✅ SCENARIO A: BOTTLE TRACKING IS WORKING!')
      console.log('   - Synthetic tabs are being created')
      console.log('   - Tab lines have servings and bottleId')
      console.log('   - SERVING_SOLD audit logs exist')
      console.log('   - Bottle remainingFraction is being reduced')
      console.log('\n   🔧 THE PROBLEM: Reports query the Sale collection')
      console.log('      which has NO bottle tracking data!')
      console.log('\n   💡 SOLUTION: Fix reports to query BarAuditLog and BarTabLine')
    } else if (hasSyntheticTabs && !hasServingLines) {
      console.log('⚠️  SCENARIO B: SYNTHETIC TABS CREATED BUT NO LINES ADDED')
      console.log('   - Synthetic tabs exist')
      console.log('   - NO tab lines with servings')
      console.log('\n   🔧 THE PROBLEM: TabManager.addLine() is failing')
      console.log('      Errors are being caught silently by try/catch')
      console.log('\n   💡 SOLUTION: Check server console logs for:')
      console.log('      "[bar/pos-sale] Error adding serving line:"')
    } else if (!hasSyntheticTabs) {
      console.log('❌ SCENARIO C: SYNTHETIC TAB CREATION FAILING')
      console.log('   - NO synthetic tabs found')
      console.log('\n   🔧 THE PROBLEM: TabManager.createSyntheticDirectSaleTab() is failing')
      console.log('\n   💡 SOLUTION: Check for audit log enum errors or database issues')
    } else {
      console.log('⚠️  MIXED RESULTS - PARTIAL TRACKING')
      console.log('   Some components working, others not')
      console.log('\n   Check individual sections above for details')
    }

    console.log()
    await mongoose.disconnect()
    console.log('✅ Disconnected from database')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

diagnose()
