/**
 * Phase 0: Bar Inventory Data Audit Script
 * 
 * This script audits the bar inventory system to identify:
 * 1. Open bottles without remainingFraction
 * 2. Tab lines without bottle tracking (bottleId)
 * 3. Servings without servingsPerContainer configuration
 * 4. Orphaned records (references to deleted items)
 * 5. Data integrity issues
 * 
 * Usage:
 *   tsx scripts/audit-bar-data.ts [tenantId]
 *   tsx scripts/audit-bar-data.ts --all  (audit all tenants)
 */

import { connectDB } from '@/lib/db'
import { getTenantModels } from '@/lib/tenant/get-models'
import { Schema, Types } from 'mongoose'

interface AuditResult {
  tenantId: string
  tenantName: string
  timestamp: Date
  
  // Bottle Issues
  bottleIssues: {
    totalBottles: number
    openBottles: number
    closedBottles: number
    openWithoutRemaining: number
    openWithZeroRemaining: number
    openWithInvalidRemaining: number
    bottlesWithoutInventoryItem: number
    bottlesWithInvalidState: number
  }
  
  // Tab Line Issues
  tabLineIssues: {
    totalTabLines: number
    servingSales: number
    bottleSales: number
    servingSalesWithoutBottleId: number
    tabLinesWithoutInventoryItem: number
    tabLinesWithoutServing: number
    voidedLines: number
  }
  
  // Serving Configuration Issues
  servingIssues: {
    totalServings: number
    withoutServingsPerContainer: number
    withZeroServingsPerContainer: number
    withoutSellingPrice: number
    orphanedServings: number
  }
  
  // Inventory Item Issues
  inventoryIssues: {
    totalItems: number
    withoutBrand: number
    withoutBuyingPrice: number
    withoutBottleSellingPrice: number
    withNegativeStock: number
    inactiveItems: number
  }
  
  // Orphaned Records
  orphanedRecords: {
    tabLinesWithDeletedBottles: number
    tabLinesWithDeletedInventoryItems: number
    tabLinesWithDeletedServings: number
    bottlesWithDeletedInventoryItems: number
    servingsWithDeletedInventoryItems: number
  }
  
  // Data Quality Warnings
  warnings: string[]
  recommendations: string[]
}

async function auditTenant(tenantId: string, tenantName: string): Promise<AuditResult> {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Auditing Tenant: ${tenantName} (${tenantId})`)
  console.log('='.repeat(80))
  
  const models = await getTenantModels(tenantId)
  const warnings: string[] = []
  const recommendations: string[] = []
  
  // ==================== AUDIT BOTTLES ====================
  console.log('\n[1/5] Auditing Bottles...')
  
  const totalBottles = await models.BarBottle.countDocuments()
  const openBottles = await models.BarBottle.countDocuments({ state: 'open' })
  const closedBottles = await models.BarBottle.countDocuments({ state: 'closed' })
  
  const openWithoutRemaining = await models.BarBottle.countDocuments({
    state: 'open',
    $or: [
      { remainingFraction: null },
      { remainingFraction: { $exists: false } }
    ]
  })
  
  const openWithZeroRemaining = await models.BarBottle.countDocuments({
    state: 'open',
    remainingFraction: 0
  })
  
  const openWithInvalidRemaining = await models.BarBottle.countDocuments({
    state: 'open',
    $or: [
      { remainingFraction: { $lt: 0 } },
      { remainingFraction: { $gt: 1 } }
    ]
  })
  
  const bottlesWithoutInventoryItem = await models.BarBottle.countDocuments({
    $or: [
      { inventoryItemId: null },
      { inventoryItemId: { $exists: false } }
    ]
  })
  
  const bottlesWithInvalidState = await models.BarBottle.countDocuments({
    state: { $nin: ['open', 'closed', 'empty'] }
  })
  
  console.log(`  Total bottles: ${totalBottles}`)
  console.log(`  Open: ${openBottles}, Closed: ${closedBottles}`)
  if (openWithoutRemaining > 0) {
    console.log(`  ⚠️  Open bottles without remainingFraction: ${openWithoutRemaining}`)
    warnings.push(`${openWithoutRemaining} open bottles missing remainingFraction field`)
    recommendations.push('Run migration to set remainingFraction = 1.0 for newly opened bottles')
  }
  if (openWithZeroRemaining > 0) {
    console.log(`  ⚠️  Open bottles with 0% remaining: ${openWithZeroRemaining}`)
    warnings.push(`${openWithZeroRemaining} open bottles have remainingFraction = 0 (should be closed)`)
    recommendations.push('Close bottles with remainingFraction = 0')
  }
  if (openWithInvalidRemaining > 0) {
    console.log(`  ⚠️  Open bottles with invalid remainingFraction: ${openWithInvalidRemaining}`)
    warnings.push(`${openWithInvalidRemaining} bottles have invalid remainingFraction (<0 or >1)`)
  }
  
  // ==================== AUDIT TAB LINES ====================
  console.log('\n[2/5] Auditing Tab Lines...')
  
  const totalTabLines = await models.BarTabLine.countDocuments()
  const voidedLines = await models.BarTabLine.countDocuments({ voided: true })
  const activeLines = totalTabLines - voidedLines
  
  const servingSales = await models.BarTabLine.countDocuments({
    voided: false,
    servingId: { $ne: null }
  })
  
  const bottleSales = await models.BarTabLine.countDocuments({
    voided: false,
    servingId: null
  })
  
  const servingSalesWithoutBottleId = await models.BarTabLine.countDocuments({
    voided: false,
    servingId: { $ne: null },
    $or: [
      { bottleId: null },
      { bottleId: { $exists: false } }
    ]
  })
  
  const tabLinesWithoutInventoryItem = await models.BarTabLine.countDocuments({
    $or: [
      { inventoryItemId: null },
      { inventoryItemId: { $exists: false } }
    ]
  })
  
  const tabLinesWithoutServing = await models.BarTabLine.countDocuments({
    servingId: { $ne: null },
    $or: [
      { servingId: null },
      { servingId: { $exists: false } }
    ]
  })
  
  console.log(`  Total tab lines: ${totalTabLines} (${activeLines} active, ${voidedLines} voided)`)
  console.log(`  Serving sales: ${servingSales}, Bottle sales: ${bottleSales}`)
  
  if (servingSalesWithoutBottleId > 0) {
    console.log(`  ⚠️  Serving sales without bottle tracking: ${servingSalesWithoutBottleId}`)
    warnings.push(`${servingSalesWithoutBottleId} serving sales lack bottleId (${((servingSalesWithoutBottleId / servingSales) * 100).toFixed(1)}% of serving sales)`)
    recommendations.push('Ensure POS flow always assigns bottleId when selling servings')
  }
  
  // ==================== AUDIT SERVINGS ====================
  console.log('\n[3/5] Auditing Servings Configuration...')
  
  const totalServings = await models.BarServing.countDocuments()
  
  const withoutServingsPerContainer = await models.BarServing.countDocuments({
    $or: [
      { servingsPerContainer: null },
      { servingsPerContainer: { $exists: false } }
    ]
  })
  
  const withZeroServingsPerContainer = await models.BarServing.countDocuments({
    servingsPerContainer: 0
  })
  
  const withoutSellingPrice = await models.BarServing.countDocuments({
    $or: [
      { sellingPrice: null },
      { sellingPrice: { $exists: false } },
      { sellingPrice: 0 }
    ]
  })
  
  console.log(`  Total servings: ${totalServings}`)
  
  if (withoutServingsPerContainer > 0) {
    console.log(`  ⚠️  Servings without servingsPerContainer: ${withoutServingsPerContainer}`)
    warnings.push(`${withoutServingsPerContainer} servings missing servingsPerContainer configuration`)
    recommendations.push('Configure servingsPerContainer for all servings (e.g., Tot = 30, Quarter = 15)')
  }
  if (withZeroServingsPerContainer > 0) {
    console.log(`  ⚠️  Servings with servingsPerContainer = 0: ${withZeroServingsPerContainer}`)
    warnings.push(`${withZeroServingsPerContainer} servings have servingsPerContainer = 0`)
  }
  if (withoutSellingPrice > 0) {
    console.log(`  ℹ️  Servings without selling price: ${withoutSellingPrice}`)
  }
  
  // ==================== AUDIT INVENTORY ITEMS ====================
  console.log('\n[4/5] Auditing Inventory Items...')
  
  const totalItems = await models.BarInventoryItem.countDocuments()
  const inactiveItems = await models.BarInventoryItem.countDocuments({ isActive: false })
  
  const withoutBrand = await models.BarInventoryItem.countDocuments({
    $or: [
      { brandId: null },
      { brandId: { $exists: false } }
    ]
  })
  
  const withoutBuyingPrice = await models.BarInventoryItem.countDocuments({
    $or: [
      { buyingPrice: null },
      { buyingPrice: { $exists: false } },
      { buyingPrice: 0 }
    ]
  })
  
  const withoutBottleSellingPrice = await models.BarInventoryItem.countDocuments({
    $or: [
      { bottleSellingPrice: null },
      { bottleSellingPrice: { $exists: false } },
      { bottleSellingPrice: 0 }
    ]
  })
  
  const withNegativeStock = await models.BarInventoryItem.countDocuments({
    stock: { $lt: 0 }
  })
  
  console.log(`  Total inventory items: ${totalItems} (${totalItems - inactiveItems} active, ${inactiveItems} inactive)`)
  
  if (withNegativeStock > 0) {
    console.log(`  ⚠️  Items with negative stock: ${withNegativeStock}`)
    warnings.push(`${withNegativeStock} inventory items have negative stock`)
    recommendations.push('Investigate negative stock items - possible data corruption or incorrect sales recording')
  }
  
  // ==================== CHECK FOR ORPHANED RECORDS ====================
  console.log('\n[5/5] Checking for Orphaned Records...')
  
  // Get all unique IDs from tab lines
  const tabLineBottleIds = await models.BarTabLine.distinct('bottleId', { bottleId: { $ne: null } })
  const tabLineInventoryIds = await models.BarTabLine.distinct('inventoryItemId')
  const tabLineServingIds = await models.BarTabLine.distinct('servingId', { servingId: { $ne: null } })
  
  // Get all actual IDs from referenced collections
  const actualBottleIds = await models.BarBottle.distinct('_id')
  const actualInventoryIds = await models.BarInventoryItem.distinct('_id')
  const actualServingIds = await models.BarServing.distinct('_id')
  
  // Convert to strings for comparison
  const actualBottleIdStrs = new Set(actualBottleIds.map((id: Types.ObjectId) => id.toString()))
  const actualInventoryIdStrs = new Set(actualInventoryIds.map((id: Types.ObjectId) => id.toString()))
  const actualServingIdStrs = new Set(actualServingIds.map((id: Types.ObjectId) => id.toString()))
  
  let tabLinesWithDeletedBottles = 0
  let tabLinesWithDeletedInventoryItems = 0
  let tabLinesWithDeletedServings = 0
  
  for (const bottleId of tabLineBottleIds) {
    if (!actualBottleIdStrs.has(bottleId.toString())) {
      tabLinesWithDeletedBottles++
    }
  }
  
  for (const inventoryId of tabLineInventoryIds) {
    if (!actualInventoryIdStrs.has(inventoryId.toString())) {
      tabLinesWithDeletedInventoryItems++
    }
  }
  
  for (const servingId of tabLineServingIds) {
    if (!actualServingIdStrs.has(servingId.toString())) {
      tabLinesWithDeletedServings++
    }
  }
  
  // Check bottles referencing deleted inventory items
  const bottleInventoryIds = await models.BarBottle.distinct('inventoryItemId')
  let bottlesWithDeletedInventoryItems = 0
  for (const invId of bottleInventoryIds) {
    if (!actualInventoryIdStrs.has(invId.toString())) {
      bottlesWithDeletedInventoryItems++
    }
  }
  
  // Check servings referencing deleted inventory items
  const servingInventoryIds = await models.BarServing.distinct('inventoryItemId')
  let servingsWithDeletedInventoryItems = 0
  for (const invId of servingInventoryIds) {
    if (!actualInventoryIdStrs.has(invId.toString())) {
      servingsWithDeletedInventoryItems++
    }
  }
  
  if (tabLinesWithDeletedBottles > 0) {
    console.log(`  ⚠️  Tab lines referencing deleted bottles: ${tabLinesWithDeletedBottles}`)
    warnings.push(`${tabLinesWithDeletedBottles} tab lines reference deleted bottles`)
  }
  if (tabLinesWithDeletedInventoryItems > 0) {
    console.log(`  ⚠️  Tab lines referencing deleted inventory items: ${tabLinesWithDeletedInventoryItems}`)
    warnings.push(`${tabLinesWithDeletedInventoryItems} tab lines reference deleted inventory items`)
  }
  if (tabLinesWithDeletedServings > 0) {
    console.log(`  ⚠️  Tab lines referencing deleted servings: ${tabLinesWithDeletedServings}`)
    warnings.push(`${tabLinesWithDeletedServings} tab lines reference deleted servings`)
  }
  
  // ==================== CALCULATE SUMMARY METRICS ====================
  const bottleTrackingCoverage = servingSales > 0 
    ? ((servingSales - servingSalesWithoutBottleId) / servingSales * 100).toFixed(1)
    : '0'
  
  const servingConfigCoverage = totalServings > 0
    ? ((totalServings - withoutServingsPerContainer) / totalServings * 100).toFixed(1)
    : '0'
  
  console.log(`\n${'='.repeat(80)}`)
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Bottle Tracking Coverage: ${bottleTrackingCoverage}% of serving sales have bottle tracking`)
  console.log(`Serving Configuration Coverage: ${servingConfigCoverage}% of servings have servingsPerContainer configured`)
  console.log(`Total Warnings: ${warnings.length}`)
  console.log(`Total Recommendations: ${recommendations.length}`)
  
  return {
    tenantId,
    tenantName,
    timestamp: new Date(),
    bottleIssues: {
      totalBottles,
      openBottles,
      closedBottles,
      openWithoutRemaining,
      openWithZeroRemaining,
      openWithInvalidRemaining,
      bottlesWithoutInventoryItem,
      bottlesWithInvalidState,
    },
    tabLineIssues: {
      totalTabLines,
      servingSales,
      bottleSales,
      servingSalesWithoutBottleId,
      tabLinesWithoutInventoryItem,
      tabLinesWithoutServing,
      voidedLines,
    },
    servingIssues: {
      totalServings,
      withoutServingsPerContainer,
      withZeroServingsPerContainer,
      withoutSellingPrice,
      orphanedServings: servingsWithDeletedInventoryItems,
    },
    inventoryIssues: {
      totalItems,
      withoutBrand,
      withoutBuyingPrice,
      withoutBottleSellingPrice,
      withNegativeStock,
      inactiveItems,
    },
    orphanedRecords: {
      tabLinesWithDeletedBottles,
      tabLinesWithDeletedInventoryItems,
      tabLinesWithDeletedServings,
      bottlesWithDeletedInventoryItems,
      servingsWithDeletedInventoryItems,
    },
    warnings,
    recommendations,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const auditAll = args.includes('--all')
  const tenantIdArg = args.find(arg => !arg.startsWith('--'))
  
  await connectDB()
  
  // Import Tenant model
  const mongoose = await import('mongoose')
  const TenantSchema = new mongoose.Schema({
    name: String,
    subdomain: String,
    dbName: String,
  })
  const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema)
  
  let results: AuditResult[] = []
  
  if (auditAll) {
    console.log('Auditing all tenants...\n')
    const tenants = await Tenant.find({}).lean()
    
    for (const tenant of tenants as any[]) {
      try {
        const result = await auditTenant(String(tenant._id), tenant.name)
        results.push(result)
      } catch (error) {
        console.error(`Failed to audit tenant ${tenant.name}:`, error)
      }
    }
  } else if (tenantIdArg) {
    const tenant = await Tenant.findById(tenantIdArg).lean() as any
    if (!tenant) {
      console.error(`Tenant with ID ${tenantIdArg} not found`)
      process.exit(1)
    }
    const result = await auditTenant(String(tenant._id), tenant.name)
    results.push(result)
  } else {
    console.error('Usage: tsx scripts/audit-bar-data.ts [tenantId] OR tsx scripts/audit-bar-data.ts --all')
    process.exit(1)
  }
  
  // ==================== GENERATE REPORT ====================
  console.log('\n\n')
  console.log('█'.repeat(80))
  console.log('AUDIT REPORT COMPLETE')
  console.log('█'.repeat(80))
  
  for (const result of results) {
    console.log(`\n${result.tenantName} (${result.tenantId})`)
    console.log('-'.repeat(80))
    
    if (result.warnings.length === 0) {
      console.log('✅ No critical issues found')
    } else {
      console.log(`⚠️  ${result.warnings.length} warnings:`)
      result.warnings.forEach((w, i) => console.log(`   ${i + 1}. ${w}`))
    }
    
    if (result.recommendations.length > 0) {
      console.log(`\n💡 ${result.recommendations.length} recommendations:`)
      result.recommendations.forEach((r, i) => console.log(`   ${i + 1}. ${r}`))
    }
  }
  
  // Write JSON report
  const reportPath = `./audit-report-${Date.now()}.json`
  const fs = await import('fs/promises')
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2))
  console.log(`\n📄 Full report saved to: ${reportPath}`)
  
  process.exit(0)
}

main().catch((error) => {
  console.error('Audit script failed:', error)
  process.exit(1)
})
