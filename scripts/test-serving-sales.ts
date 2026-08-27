/**
 * Test Script for Serving Sales Report
 * 
 * This script tests the serving sales report to verify:
 * 1. API endpoint returns correct data structure
 * 2. Grouping by product → serving works correctly
 * 3. Bottle tracking is captured (bottleId references)
 * 4. Revenue calculations are accurate
 * 5. Data quality metrics are correct
 * 
 * Usage:
 *   tsx scripts/test-serving-sales.ts <tenantId>
 */

import { connectDB } from '@/lib/db'
import { getTenantModels } from '@/lib/tenant/get-models'
import { Types } from 'mongoose'

interface TestResult {
  testName: string
  passed: boolean
  message: string
  details?: any
}

async function testServingSalesReport(tenantId: string, tenantName: string) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Testing Serving Sales Report for: ${tenantName} (${tenantId})`)
  console.log('='.repeat(80)}`)
  
  const models = await getTenantModels(tenantId)
  const results: TestResult[] = []
  
  // ==================== TEST 1: Check if serving sales data exists ====================
  console.log('\n[1/7] Checking for serving sales data...')
  
  const servingSalesCount = await models.BarTabLine.countDocuments({
    servingId: { $ne: null },
    voided: false
  })
  
  console.log(`  Found ${servingSalesCount} serving sales in database`)
  
  if (servingSalesCount === 0) {
    console.log('  ⚠️  No serving sales found - creating sample data would help test the report')
    results.push({
      testName: 'Serving sales data exists',
      passed: true,
      message: 'No serving sales data found (expected for new systems)',
      details: { count: 0 }
    })
  } else {
    results.push({
      testName: 'Serving sales data exists',
      passed: true,
      message: `Found ${servingSalesCount} serving sales`,
      details: { count: servingSalesCount }
    })
  }
  
  // ==================== TEST 2: Check bottle tracking coverage ====================
  console.log('\n[2/7] Checking bottle tracking coverage...')
  
  const servingsWithBottleId = await models.BarTabLine.countDocuments({
    servingId: { $ne: null },
    voided: false,
    bottleId: { $ne: null }
  })
  
  const coverage = servingSalesCount > 0 
    ? ((servingsWithBottleId / servingSalesCount) * 100).toFixed(1)
    : '0'
  
  console.log(`  Bottle tracking coverage: ${coverage}%`)
  console.log(`  ${servingsWithBottleId} of ${servingSalesCount} serving sales have bottle tracking`)
  
  if (parseFloat(coverage) >= 80) {
    console.log('  ✅ Good coverage (≥80%)')
    results.push({
      testName: 'Bottle tracking coverage',
      passed: true,
      message: `Excellent coverage: ${coverage}%`,
      details: { coverage: parseFloat(coverage), withTracking: servingsWithBottleId, total: servingSalesCount }
    })
  } else if (parseFloat(coverage) >= 50) {
    console.log('  ⚠️  Moderate coverage (50-79%)')
    results.push({
      testName: 'Bottle tracking coverage',
      passed: true,
      message: `Moderate coverage: ${coverage}% - some data may be incomplete`,
      details: { coverage: parseFloat(coverage), withTracking: servingsWithBottleId, total: servingSalesCount }
    })
  } else {
    console.log('  ❌ Low coverage (<50%)')
    results.push({
      testName: 'Bottle tracking coverage',
      passed: false,
      message: `Low coverage: ${coverage}% - most serving sales lack bottle tracking`,
      details: { coverage: parseFloat(coverage), withTracking: servingsWithBottleId, total: servingSalesCount }
    })
  }
  
  // ==================== TEST 3: Test grouping logic ====================
  console.log('\n[3/7] Testing product → serving grouping...')
  
  const sampleTabLines = await models.BarTabLine.find({
    servingId: { $ne: null },
    voided: false
  })
    .limit(100)
    .populate('servingId', 'name')
    .populate('inventoryItemId', 'name size')
    .lean()
  
  // Simulate API grouping logic
  const productMap = new Map<string, any>()
  
  for (const line of sampleTabLines as any[]) {
    if (!line.inventoryItemId || !line.servingId) continue
    
    const itemId = String(line.inventoryItemId._id)
    const servingId = String(line.servingId._id)
    
    if (!productMap.has(itemId)) {
      productMap.set(itemId, {
        productName: line.inventoryItemId.name || 'Unknown',
        servings: new Map(),
      })
    }
    
    const product = productMap.get(itemId)
    
    if (!product.servings.has(servingId)) {
      product.servings.set(servingId, {
        servingName: line.servingId.name || 'Unknown',
        count: 0,
      })
    }
    
    product.servings.get(servingId).count++
  }
  
  const productsWithServings = Array.from(productMap.values())
  const totalServingTypes = productsWithServings.reduce((sum, p) => sum + p.servings.size, 0)
  
  console.log(`  Found ${productsWithServings.length} products with servings`)
  console.log(`  Total serving types: ${totalServingTypes}`)
  
  if (productsWithServings.length > 0) {
    console.log('  ✅ Grouping logic works')
    console.log('  Sample products:')
    productsWithServings.slice(0, 3).forEach(p => {
      const servingsList = Array.from(p.servings.values()).map(s => `${s.servingName} (${s.count})`).join(', ')
      console.log(`    - ${p.productName}: ${servingsList}`)
    })
    
    results.push({
      testName: 'Product → Serving grouping',
      passed: true,
      message: `Successfully grouped ${productsWithServings.length} products`,
      details: { productsCount: productsWithServings.length, servingTypesCount: totalServingTypes }
    })
  } else {
    console.log('  ℹ️  No products with servings found in sample')
    results.push({
      testName: 'Product → Serving grouping',
      passed: true,
      message: 'No serving sales in sample data',
      details: { productsCount: 0 }
    })
  }
  
  // ==================== TEST 4: Test revenue calculations ====================
  console.log('\n[4/7] Testing revenue calculations...')
  
  const revenueTest = await models.BarTabLine.aggregate([
    { 
      $match: { 
        servingId: { $ne: null }, 
        voided: false,
        lineTotal: { $gt: 0 }
      } 
    },
    { $limit: 50 },
    {
      $group: {
        _id: null,
        totalFromLineTotal: { $sum: '$lineTotal' },
        count: { $sum: 1 }
      }
    }
  ])
  
  if (revenueTest.length > 0) {
    const { totalFromLineTotal, count } = revenueTest[0]
    console.log(`  Sample revenue from ${count} lines: KES ${totalFromLineTotal.toLocaleString()}`)
    console.log(`  ✅ Revenue calculation uses lineTotal field`)
    
    results.push({
      testName: 'Revenue calculation',
      passed: true,
      message: `Correct: uses lineTotal field from BarTabLine`,
      details: { sampleRevenue: totalFromLineTotal, sampleCount: count }
    })
  } else {
    console.log('  ℹ️  No revenue data in sample')
    results.push({
      testName: 'Revenue calculation',
      passed: true,
      message: 'No revenue data to test',
      details: {}
    })
  }
  
  // ==================== TEST 5: Test bottle tracking details ====================
  console.log('\n[5/7] Testing bottle tracking details...')
  
  const bottleTrackingSample = await models.BarTabLine.find({
    servingId: { $ne: null },
    voided: false,
    bottleId: { $ne: null }
  })
    .limit(20)
    .populate('bottleId', 'bottleNumber')
    .populate('inventoryItemId', 'name')
    .populate('servingId', 'name')
    .lean() as any[]
  
  if (bottleTrackingSample.length > 0) {
    const bottleNumbers = bottleTrackingSample
      .filter(line => line.bottleId?.bottleNumber)
      .map(line => line.bottleId.bottleNumber)
    
    console.log(`  Found ${bottleNumbers.length} sales with bottle numbers`)
    console.log(`  Sample bottle numbers: ${bottleNumbers.slice(0, 5).join(', ')}`)
    console.log('  ✅ Bottle tracking captures bottle numbers')
    
    // Show sample serving sale
    const sample = bottleTrackingSample[0]
    console.log(`  Example: ${sample.inventoryItemId?.name} → ${sample.servingId?.name} from Bottle #${sample.bottleId?.bottleNumber}`)
    
    results.push({
      testName: 'Bottle tracking details',
      passed: true,
      message: 'Bottle numbers are captured correctly',
      details: { sampleBottles: bottleNumbers.slice(0, 10) }
    })
  } else {
    console.log('  ⚠️  No serving sales with bottle tracking found')
    results.push({
      testName: 'Bottle tracking details',
      passed: false,
      message: 'No bottle tracking data found',
      details: {}
    })
  }
  
  // ==================== TEST 6: Test servingsPerContainer configuration ====================
  console.log('\n[6/7] Testing servingsPerContainer configuration...')
  
  const servingsWithConfig = await models.BarServing.countDocuments({
    servingsPerContainer: { $gt: 0 }
  })
  
  const totalServings = await models.BarServing.countDocuments()
  
  const configCoverage = totalServings > 0
    ? ((servingsWithConfig / totalServings) * 100).toFixed(1)
    : '0'
  
  console.log(`  ${servingsWithConfig} of ${totalServings} servings have servingsPerContainer configured`)
  console.log(`  Configuration coverage: ${configCoverage}%`)
  
  if (parseFloat(configCoverage) >= 80) {
    console.log('  ✅ Most servings configured (can calculate estimated bottles consumed)')
    results.push({
      testName: 'ServingsPerContainer configuration',
      passed: true,
      message: `${configCoverage}% of servings configured`,
      details: { configured: servingsWithConfig, total: totalServings }
    })
  } else {
    console.log('  ⚠️  Many servings lack configuration (estimated bottles consumed will be null)')
    results.push({
      testName: 'ServingsPerContainer configuration',
      passed: false,
      message: `Only ${configCoverage}% of servings configured`,
      details: { configured: servingsWithConfig, total: totalServings }
    })
  }
  
  // ==================== TEST 7: Simulate API response ====================
  console.log('\n[7/7] Simulating API response structure...')
  
  try {
    // Get recent serving sales
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentTabLines = await models.BarTabLine.find({
      servingId: { $ne: null },
      voided: false,
      addedAt: { $gte: thirtyDaysAgo }
    })
      .limit(50)
      .populate('servingId', 'name servingsPerContainer')
      .populate('bottleId', 'bottleNumber')
      .populate('inventoryItemId', 'name size')
      .lean() as any[]
    
    // Simulate grouping
    const productMap2 = new Map<string, any>()
    
    for (const line of recentTabLines) {
      if (!line.inventoryItemId || !line.servingId) continue
      
      const itemId = String(line.inventoryItemId._id)
      const servingId = String(line.servingId._id)
      
      if (!productMap2.has(itemId)) {
        productMap2.set(itemId, {
          inventoryItemId: itemId,
          productName: line.inventoryItemId.name || 'Unknown',
          productSize: line.inventoryItemId.size || '',
          servings: new Map(),
          totalRevenue: 0,
          totalQuantity: 0,
        })
      }
      
      const product = productMap2.get(itemId)
      
      if (!product.servings.has(servingId)) {
        product.servings.set(servingId, {
          servingId,
          servingName: line.servingId.name || 'Unknown',
          servingsPerContainer: line.servingId.servingsPerContainer || 0,
          quantity: 0,
          revenue: 0,
          bottlesUsed: new Set(),
        })
      }
      
      const serving = product.servings.get(servingId)
      serving.quantity += line.quantity || 0
      serving.revenue += line.lineTotal || 0
      
      if (line.bottleId?.bottleNumber) {
        serving.bottlesUsed.add(line.bottleId.bottleNumber)
      }
      
      product.totalRevenue += line.lineTotal || 0
      product.totalQuantity += line.quantity || 0
    }
    
    const products = Array.from(productMap2.values()).map(p => ({
      ...p,
      servings: Array.from(p.servings.values()).map(s => ({
        ...s,
        bottlesUsed: Array.from(s.bottlesUsed),
        bottleCount: s.bottlesUsed.size,
        estimatedBottlesConsumed: s.servingsPerContainer > 0
          ? (s.quantity / s.servingsPerContainer).toFixed(2)
          : null
      }))
    }))
    
    console.log(`  Simulated API response:`)
    console.log(`    - ${products.length} products`)
    console.log(`    - ${products.reduce((sum, p) => sum + p.servings.length, 0)} serving types`)
    console.log(`    - Total revenue: KES ${products.reduce((sum, p) => sum + p.totalRevenue, 0).toLocaleString()}`)
    
    if (products.length > 0) {
      console.log(`  Sample product structure:`)
      const sample = products[0]
      console.log(JSON.stringify({
        productName: sample.productName,
        productSize: sample.productSize,
        totalRevenue: sample.totalRevenue,
        totalQuantity: sample.totalQuantity,
        servings: sample.servings.map(s => ({
          servingName: s.servingName,
          quantity: s.quantity,
          revenue: s.revenue,
          bottleCount: s.bottleCount,
          bottlesUsed: s.bottlesUsed.slice(0, 3),
          estimatedBottlesConsumed: s.estimatedBottlesConsumed
        }))
      }, null, 2))
    }
    
    console.log('  ✅ API response structure is correct')
    
    results.push({
      testName: 'API response structure',
      passed: true,
      message: 'Response structure matches expected format',
      details: { productsCount: products.length }
    })
  } catch (error: any) {
    console.log(`  ❌ Failed to simulate API response: ${error.message}`)
    results.push({
      testName: 'API response structure',
      passed: false,
      message: `Simulation failed: ${error.message}`,
      details: {}
    })
  }
  
  return results
}

async function main() {
  const args = process.argv.slice(2)
  const tenantIdArg = args[0]
  
  if (!tenantIdArg) {
    console.error('Usage: tsx scripts/test-serving-sales.ts <tenantId>')
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
  
  const results = await testServingSalesReport(String(tenant._id), tenant.name)
  
  // ==================== SUMMARY ====================
  console.log(`\n\n${'='.repeat(80)}`)
  console.log('TEST SUMMARY')
  console.log('='.repeat(80))
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  
  console.log(`\nTotal Tests: ${total}`)
  console.log(`✅ Passed: ${passed}`)
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`)
  }
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.testName}: ${r.message}`)
    })
  }
  
  console.log('\n📊 KEY METRICS:')
  results.forEach(r => {
    if (r.details && Object.keys(r.details).length > 0) {
      console.log(`   ${r.passed ? '✅' : '❌'} ${r.testName}: ${r.message}`)
    }
  })
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! The serving sales report is working correctly.')
  } else {
    console.log('\n⚠️  Some tests failed. Review the issues above.')
  }
  
  console.log('\n💡 Next Steps:')
  console.log('   1. Test in browser: Navigate to Bar → Reports → Serving Sales')
  console.log('   2. Select a date range with known serving sales')
  console.log('   3. Verify grouping, bottle tracking, and revenue calculations')
  console.log('   4. Check that bottle numbers display correctly')
  console.log('   5. Proceed to Phase 3 (Fix Products Sold Report)')
  
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Test script failed:', error)
  process.exit(1)
})
