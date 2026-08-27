/**
 * Bar Inventory Data Fix Script
 * 
 * Fixes common data quality issues identified by the audit script:
 * 1. Sets remainingFraction = 1.0 for open bottles without it
 * 2. Closes bottles with remainingFraction = 0
 * 3. Warns about serving sales without bottle tracking (cannot auto-fix)
 * 
 * Usage:
 *   tsx scripts/fix-bar-data-issues.ts <tenantId> [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be fixed without making changes
 */

import { connectDB } from '@/lib/db'
import { getTenantModels } from '@/lib/tenant/get-models'
import { Schema } from 'mongoose'

interface FixReport {
  tenantId: string
  tenantName: string
  timestamp: Date
  dryRun: boolean
  fixes: {
    bottlesSetToFullRemaining: number
    bottlesClosed: number
    warnings: string[]
  }
}

async function fixTenantData(tenantId: string, tenantName: string, dryRun: boolean): Promise<FixReport> {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Fixing Data for: ${tenantName} (${tenantId})`)
  console.log('='.repeat(80))
  
  const models = await getTenantModels(tenantId)
  const warnings: string[] = []
  
  // ==================== FIX 1: Set remainingFraction for open bottles ====================
  console.log('\n[1/2] Fixing open bottles without remainingFraction...')
  
  const openBottlesWithoutRemaining = await models.BarBottle.find({
    state: 'open',
    $or: [
      { remainingFraction: null },
      { remainingFraction: { $exists: false } }
    ]
  }).lean()
  
  console.log(`  Found ${openBottlesWithoutRemaining.length} open bottles without remainingFraction`)
  
  if (openBottlesWithoutRemaining.length > 0) {
    if (!dryRun) {
      const result = await models.BarBottle.updateMany(
        {
          state: 'open',
          $or: [
            { remainingFraction: null },
            { remainingFraction: { $exists: false } }
          ]
        },
        {
          $set: { remainingFraction: 1.0 }
        }
      )
      console.log(`  ✅ Set remainingFraction = 1.0 for ${result.modifiedCount} bottles`)
    } else {
      console.log(`  [DRY RUN] Would set remainingFraction = 1.0 for ${openBottlesWithoutRemaining.length} bottles`)
    }
  } else {
    console.log('  ✅ No open bottles without remainingFraction')
  }
  
  // ==================== FIX 2: Close bottles with 0% remaining ====================
  console.log('\n[2/2] Closing bottles with 0% remaining...')
  
  const openBottlesWithZeroRemaining = await models.BarBottle.find({
    state: 'open',
    remainingFraction: 0
  }).lean()
  
  console.log(`  Found ${openBottlesWithZeroRemaining.length} open bottles with 0% remaining`)
  
  if (openBottlesWithZeroRemaining.length > 0) {
    if (!dryRun) {
      const result = await models.BarBottle.updateMany(
        {
          state: 'open',
          remainingFraction: 0
        },
        {
          $set: { 
            state: 'empty',
            closedAt: new Date()
          }
        }
      )
      console.log(`  ✅ Closed ${result.modifiedCount} bottles`)
    } else {
      console.log(`  [DRY RUN] Would close ${openBottlesWithZeroRemaining.length} bottles`)
    }
  } else {
    console.log('  ✅ No open bottles with 0% remaining')
  }
  
  // ==================== CHECK FOR ISSUES THAT CANNOT BE AUTO-FIXED ====================
  console.log('\n[INFO] Checking for issues that require manual attention...')
  
  const servingSalesWithoutBottleId = await models.BarTabLine.countDocuments({
    voided: false,
    servingId: { $ne: null },
    $or: [
      { bottleId: null },
      { bottleId: { $exists: false } }
    ]
  })
  
  if (servingSalesWithoutBottleId > 0) {
    const warning = `${servingSalesWithoutBottleId} serving sales lack bottle tracking - cannot be automatically fixed. Ensure POS flow assigns bottleId when selling servings.`
    warnings.push(warning)
    console.log(`  ⚠️  ${warning}`)
  }
  
  const servingsWithoutConfig = await models.BarServing.countDocuments({
    $or: [
      { servingsPerContainer: null },
      { servingsPerContainer: { $exists: false } },
      { servingsPerContainer: 0 }
    ]
  })
  
  if (servingsWithoutConfig > 0) {
    const servingsNeedingConfig = await models.BarServing.find({
      $or: [
        { servingsPerContainer: null },
        { servingsPerContainer: { $exists: false } },
        { servingsPerContainer: 0 }
      ]
    })
      .populate('inventoryItemId', 'name size')
      .lean() as any[]
    
    const warning = `${servingsWithoutConfig} servings need servingsPerContainer configured:`
    warnings.push(warning)
    console.log(`  ⚠️  ${warning}`)
    
    servingsNeedingConfig.forEach((serving) => {
      const productName = serving.inventoryItemId?.name || 'Unknown'
      console.log(`       - ${serving.name} (${productName}) - currently: ${serving.servingsPerContainer || 'not set'}`)
    })
    
    console.log(`\n  To fix manually:`)
    console.log(`  1. Go to Bar → Products → [Product] → Servings`)
    console.log(`  2. Set servingsPerContainer for each serving (e.g., Tot = 30, Quarter = 15)`)
  }
  
  const negativeStock = await models.BarInventoryItem.countDocuments({
    stock: { $lt: 0 }
  })
  
  if (negativeStock > 0) {
    const itemsWithNegativeStock = await models.BarInventoryItem.find({
      stock: { $lt: 0 }
    })
      .lean() as any[]
    
    const warning = `${negativeStock} inventory items have negative stock - requires investigation:`
    warnings.push(warning)
    console.log(`  ⚠️  ${warning}`)
    
    itemsWithNegativeStock.forEach((item) => {
      console.log(`       - ${item.name} ${item.size}: stock = ${item.stock}`)
    })
  }
  
  return {
    tenantId,
    tenantName,
    timestamp: new Date(),
    dryRun,
    fixes: {
      bottlesSetToFullRemaining: openBottlesWithoutRemaining.length,
      bottlesClosed: openBottlesWithZeroRemaining.length,
      warnings,
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const tenantIdArg = args.find(arg => !arg.startsWith('--'))
  
  if (!tenantIdArg) {
    console.error('Usage: tsx scripts/fix-bar-data-issues.ts <tenantId> [--dry-run]')
    console.error('\nOptions:')
    console.error('  --dry-run    Show what would be fixed without making changes')
    process.exit(1)
  }
  
  await connectDB()
  
  // Import Tenant model
  const mongoose = await import('mongoose')
  const TenantSchema = new mongoose.Schema({
    name: String,
    subdomain: String,
    dbName: String,
  })
  const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema)
  
  const tenant = await Tenant.findById(tenantIdArg).lean() as any
  if (!tenant) {
    console.error(`Tenant with ID ${tenantIdArg} not found`)
    process.exit(1)
  }
  
  const report = await fixTenantData(String(tenant._id), tenant.name, dryRun)
  
  // ==================== SUMMARY ====================
  console.log(`\n${'='.repeat(80)}`)
  console.log('SUMMARY')
  console.log('='.repeat(80))
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes were made\n')
  }
  
  const totalFixes = report.fixes.bottlesSetToFullRemaining + report.fixes.bottlesClosed
  
  if (totalFixes > 0) {
    console.log(`✅ ${totalFixes} issue${totalFixes !== 1 ? 's' : ''} ${dryRun ? 'would be' : ''} fixed:`)
    if (report.fixes.bottlesSetToFullRemaining > 0) {
      console.log(`   - ${report.fixes.bottlesSetToFullRemaining} open bottles set to full (remainingFraction = 1.0)`)
    }
    if (report.fixes.bottlesClosed > 0) {
      console.log(`   - ${report.fixes.bottlesClosed} empty bottles closed`)
    }
  } else {
    console.log('✅ No automatic fixes needed')
  }
  
  if (report.fixes.warnings.length > 0) {
    console.log(`\n⚠️  ${report.fixes.warnings.length} issue${report.fixes.warnings.length !== 1 ? 's' : ''} require manual attention`)
  }
  
  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply these fixes')
  } else {
    console.log('\n✅ Fixes applied successfully')
    console.log('💡 Run the audit script again to verify: npm run audit:bar ' + tenantIdArg)
  }
  
  process.exit(0)
}

main().catch((error) => {
  console.error('Fix script failed:', error)
  process.exit(1)
})
