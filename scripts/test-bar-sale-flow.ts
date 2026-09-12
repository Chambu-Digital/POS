/**
 * Test Script: Bar Sale Flow Validation
 * 
 * This script validates the hypotheses about bar sales failures:
 * 1. Bottle not found errors (timing/sequencing)
 * 2. SaleId missing errors (atomicity/transaction issues)
 * 3. State consistency problems
 * 4. Idempotency issues
 */

import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'
import { getTenantDB } from '@/lib/tenant/get-db'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

interface TestResult {
  test: string
  passed: boolean
  error?: string
  details?: any
}

const results: TestResult[] = []

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║   Bar Sale Flow Validation - Hypothesis Testing               ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝\n')

  try {
    // Connect to DB (we'll need to pass a mock request to getTenantDB)
    await connectDB()
    
    // For testing, we'll need a tenant. Let's look for one in the database
    const db = mongoose.connection
    const tenants = await db.collection('tenants').find({}).limit(1).toArray()
    
    if (tenants.length === 0) {
      console.log('❌ No tenants found in database. Cannot run tests.')
      return
    }

    const testTenant = tenants[0]
    console.log(`✓ Using tenant: ${testTenant.name} (${testTenant._id})`)
    console.log(`✓ Database: ${testTenant.dbName}\n`)

    // Create a mock request object for getTenantDB
    const mockRequest = {
      headers: new Headers({
        'x-tenant-id': testTenant._id.toString()
      })
    } as any

    const { models, conn } = await getTenantDB(mockRequest)
    
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('TEST 1: Check for Orphaned Synthetic Tabs')
    console.log('═══════════════════════════════════════════════════════════════')
    await testOrphanedSyntheticTabs(models, conn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 2: Check for Tabs Without SaleId')
    console.log('═══════════════════════════════════════════════════════════════')
    await testTabsWithoutSaleId(models, conn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 3: Check for Inconsistent Bottle States')
    console.log('═══════════════════════════════════════════════════════════════')
    await testInconsistentBottleStates(models, conn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 4: Check for TabLines Without Bottle Deductions')
    console.log('═══════════════════════════════════════════════════════════════')
    await testTabLinesWithoutDeductions(models, conn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 5: Check for Closed Bottles Still Referenced in Tabs')
    console.log('═══════════════════════════════════════════════════════════════')
    await testClosedBottlesInTabs(models, conn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 6: Check Branch Filtering Issues')
    console.log('═══════════════════════════════════════════════════════════════')
    await testBranchFiltering(models, conn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 7: Check for Duplicate Sale Records')
    console.log('═══════════════════════════════════════════════════════════════')
    await testDuplicateSales(models, conn)

    console.log('\n╔═══════════════════════════════════════════════════════════════╗')
    console.log('║                      TEST SUMMARY                              ║')
    console.log('╚═══════════════════════════════════════════════════════════════╝\n')

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    results.forEach(result => {
      const icon = result.passed ? '✓' : '✗'
      const color = result.passed ? '' : ''
      console.log(`${icon} ${result.test}`)
      if (!result.passed && result.error) {
        console.log(`  └─ ${result.error}`)
      }
      if (result.details) {
        console.log(`  └─ Details: ${JSON.stringify(result.details, null, 2)}`)
      }
    })

    console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

  } catch (error: any) {
    console.error('Fatal error running tests:', error.message)
    console.error(error.stack)
  } finally {
    await mongoose.connection.close()
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Test Functions
// ══════════════════════════════════════════════════════════════════════════════

async function testOrphanedSyntheticTabs(models: any, conn: mongoose.Connection) {
  try {
    // Find synthetic tabs that are marked as paid but don't have corresponding sales
    const syntheticTabs = await models.BarTab.find({
      isSyntheticDirectSale: true,
      status: 'paid'
    }).lean()

    console.log(`Found ${syntheticTabs.length} paid synthetic tabs`)

    if (syntheticTabs.length === 0) {
      results.push({
        test: 'Orphaned Synthetic Tabs',
        passed: true,
        details: { count: 0 }
      })
      console.log('✓ No synthetic tabs found (clean state or no bar sales yet)')
      return
    }

    // Check if corresponding sales exist
    let orphanedCount = 0
    const orphanedTabs = []

    for (const tab of syntheticTabs) {
      const sale = await models.Sale.findOne({
        source: 'bar',
        createdAt: { 
          $gte: new Date(tab.createdAt.getTime() - 5000), // Within 5 seconds
          $lte: new Date(tab.createdAt.getTime() + 5000)
        },
        total: tab.total
      }).lean()

      if (!sale) {
        orphanedCount++
        orphanedTabs.push({
          tabId: tab._id,
          tabNumber: tab.tabNumber,
          total: tab.total,
          createdAt: tab.createdAt
        })
      }
    }

    if (orphanedCount > 0) {
      results.push({
        test: 'Orphaned Synthetic Tabs',
        passed: false,
        error: `Found ${orphanedCount} synthetic tabs without corresponding sales`,
        details: { orphanedTabs: orphanedTabs.slice(0, 3) } // Show first 3
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: ${orphanedCount} synthetic tabs have no matching sales`)
      console.log('  This indicates sale creation failed after tab was paid')
    } else {
      results.push({
        test: 'Orphaned Synthetic Tabs',
        passed: true,
        details: { syntheticTabsChecked: syntheticTabs.length }
      })
      console.log('✓ All synthetic tabs have corresponding sales')
    }

  } catch (error: any) {
    results.push({
      test: 'Orphaned Synthetic Tabs',
      passed: false,
      error: error.message
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testTabsWithoutSaleId(models: any, conn: mongoose.Connection) {
  try {
    // Find paid tabs that don't have saleId field
    const tabsWithoutSaleId = await models.BarTab.find({
      status: 'paid',
      saleId: { $exists: false }
    }).lean()

    console.log(`Found ${tabsWithoutSaleId.length} paid tabs without saleId`)

    if (tabsWithoutSaleId.length > 0) {
      results.push({
        test: 'Tabs Without SaleId',
        passed: false,
        error: `Found ${tabsWithoutSaleId.length} paid tabs missing saleId field`,
        details: {
          sampleTabs: tabsWithoutSaleId.slice(0, 3).map(t => ({
            tabId: t._id,
            tabNumber: t.tabNumber,
            status: t.status,
            total: t.total
          }))
        }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: Paid tabs exist without saleId`)
      console.log('  This indicates Sale → Tab linking failed')
    } else {
      results.push({
        test: 'Tabs Without SaleId',
        passed: true
      })
      console.log('✓ All paid tabs have saleId field (or no paid tabs exist)')
    }

  } catch (error: any) {
    results.push({
      test: 'Tabs Without SaleId',
      passed: false,
      error: error.message
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testInconsistentBottleStates(models: any, conn: mongoose.Connection) {
  try {
    // Find bottles that are marked as open but have remainingFraction = 0
    const emptyOpenBottles = await models.BarBottle.find({
      state: 'open',
      remainingFraction: 0
    }).lean()

    console.log(`Found ${emptyOpenBottles.length} open bottles with 0% remaining`)

    if (emptyOpenBottles.length > 0) {
      results.push({
        test: 'Inconsistent Bottle States',
        passed: false,
        error: `Found ${emptyOpenBottles.length} bottles that should be closed but are marked open`,
        details: {
          sampleBottles: emptyOpenBottles.slice(0, 3).map(b => ({
            bottleId: b._id,
            bottleNumber: b.bottleNumber,
            inventoryItemId: b.inventoryItemId,
            remainingFraction: b.remainingFraction
          }))
        }
      })
      console.log(`✗ ISSUE FOUND: Empty bottles still marked as open`)
      console.log('  These should have been auto-closed')
    } else {
      results.push({
        test: 'Inconsistent Bottle States',
        passed: true
      })
      console.log('✓ No inconsistent bottle states found')
    }

  } catch (error: any) {
    results.push({
      test: 'Inconsistent Bottle States',
      passed: false,
      error: error.message
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testTabLinesWithoutDeductions(models: any, conn: mongoose.Connection) {
  try {
    // Find tab lines for servings that have bottleId but audit log doesn't show deduction
    const servingLines = await models.BarTabLine.find({
      servingId: { $exists: true, $ne: null },
      bottleId: { $exists: true, $ne: null },
      voided: false
    }).limit(100).lean()

    console.log(`Checking ${servingLines.length} serving tab lines for audit trail...`)

    let missingAuditCount = 0
    const missingAudits = []

    for (const line of servingLines) {
      // Check if SERVING_SOLD audit log exists
      const auditLog = await models.BarAuditLog.findOne({
        operation: 'SERVING_SOLD',
        'details.bottleId': line.bottleId,
        timestamp: {
          $gte: new Date(line.addedAt.getTime() - 1000),
          $lte: new Date(line.addedAt.getTime() + 1000)
        }
      }).lean()

      if (!auditLog) {
        missingAuditCount++
        missingAudits.push({
          lineId: line._id,
          bottleId: line.bottleId,
          addedAt: line.addedAt
        })
      }
    }

    if (missingAuditCount > 0) {
      results.push({
        test: 'TabLines Without Deductions',
        passed: false,
        error: `Found ${missingAuditCount} tab lines without corresponding SERVING_SOLD audit`,
        details: { sampleLines: missingAudits.slice(0, 3) }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: ${missingAuditCount} lines lack audit trail`)
      console.log('  This indicates bottle deduction was skipped')
    } else {
      results.push({
        test: 'TabLines Without Deductions',
        passed: true,
        details: { linesChecked: servingLines.length }
      })
      console.log(`✓ All ${servingLines.length} lines have corresponding audit logs`)
    }

  } catch (error: any) {
    results.push({
      test: 'TabLines Without Deductions',
      passed: false,
      error: error.message
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testClosedBottlesInTabs(models: any, conn: mongoose.Connection) {
  try {
    // Find open tabs that reference closed bottles
    const openTabs = await models.BarTab.find({
      status: 'open'
    }).select('_id').lean()

    if (openTabs.length === 0) {
      results.push({
        test: 'Closed Bottles in Open Tabs',
        passed: true,
        details: { message: 'No open tabs to check' }
      })
      console.log('✓ No open tabs exist')
      return
    }

    const tabIds = openTabs.map(t => t._id)
    const tabLines = await models.BarTabLine.find({
      tabId: { $in: tabIds },
      bottleId: { $exists: true, $ne: null },
      voided: false
    }).lean()

    console.log(`Checking ${tabLines.length} tab lines for closed bottle references...`)

    let closedBottleCount = 0
    const closedBottleRefs = []

    for (const line of tabLines) {
      const bottle = await models.BarBottle.findById(line.bottleId).lean()
      
      if (!bottle) {
        closedBottleCount++
        closedBottleRefs.push({
          lineId: line._id,
          tabId: line.tabId,
          bottleId: line.bottleId,
          issue: 'bottle_not_found'
        })
      } else if (bottle.state === 'closed') {
        closedBottleCount++
        closedBottleRefs.push({
          lineId: line._id,
          tabId: line.tabId,
          bottleId: line.bottleId,
          issue: 'bottle_closed'
        })
      }
    }

    if (closedBottleCount > 0) {
      results.push({
        test: 'Closed Bottles in Open Tabs',
        passed: false,
        error: `Found ${closedBottleCount} tab lines referencing closed/missing bottles`,
        details: { sampleRefs: closedBottleRefs.slice(0, 3) }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: Open tabs reference closed/missing bottles`)
      console.log('  This can cause "bottle not found" errors during payment')
    } else {
      results.push({
        test: 'Closed Bottles in Open Tabs',
        passed: true,
        details: { linesChecked: tabLines.length }
      })
      console.log(`✓ All tab lines reference valid open bottles`)
    }

  } catch (error: any) {
    results.push({
      test: 'Closed Bottles in Open Tabs',
      passed: false,
      error: error.message
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testBranchFiltering(models: any, conn: mongoose.Connection) {
  try {
    // Check if bottles have branchId field and if there are any cross-branch references
    const bottles = await models.BarBottle.find({
      state: 'open'
    }).select('_id branchId inventoryItemId').lean()

    console.log(`Checking ${bottles.length} open bottles for branch filtering...`)

    const bottlesWithoutBranch = bottles.filter(b => !b.branchId)
    
    if (bottlesWithoutBranch.length > 0) {
      results.push({
        test: 'Branch Filtering',
        passed: false,
        error: `Found ${bottlesWithoutBranch.length} bottles without branchId`,
        details: { 
          total: bottles.length,
          withoutBranch: bottlesWithoutBranch.length,
          sampleBottles: bottlesWithoutBranch.slice(0, 3).map(b => ({
            bottleId: b._id,
            inventoryItemId: b.inventoryItemId
          }))
        }
      })
      console.log(`✗ ISSUE FOUND: Bottles missing branchId`)
      console.log('  This causes cross-branch bottle visibility')
    } else if (bottles.length > 0) {
      results.push({
        test: 'Branch Filtering',
        passed: true,
        details: { bottlesChecked: bottles.length }
      })
      console.log('✓ All bottles have branchId field')
    } else {
      results.push({
        test: 'Branch Filtering',
        passed: true,
        details: { message: 'No open bottles to check' }
      })
      console.log('✓ No open bottles exist')
    }

  } catch (error: any) {
    results.push({
      test: 'Branch Filtering',
      passed: false,
      error: error.message
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testDuplicateSales(models: any, conn: mongoose.Connection) {
  try {
    // Look for duplicate sales (same amount, same timestamp, same items)
    const sales = await models.Sale.find({
      source: 'bar',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }).sort({ createdAt: -1 }).lean()

    console.log(`Checking ${sales.length} bar sales for duplicates...`)

    const duplicates = []
    const seen = new Map()

    for (const sale of sales) {
      const key = `${sale.total}_${Math.floor(sale.createdAt.getTime() / 10000)}_${sale.items.length}`
      
      if (seen.has(key)) {
        duplicates.push({
          saleId1: seen.get(key),
          saleId2: sale._id,
          total: sale.total,
          itemCount: sale.items.length,
          timeDiff: Math.abs(sale.createdAt.getTime() - seen.get(key + '_time'))
        })
      } else {
        seen.set(key, sale._id)
        seen.set(key + '_time', sale.createdAt.getTime())
      }
    }

    if (duplicates.length > 0) {
      results.push({
        test: 'Duplicate Sales',
        passed: false,
        error: `Found ${duplicates.length} potential duplicate sales`,
        details: { sampleDuplicates: duplicates.slice(0, 3) }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: Duplicate sales exist`)
      console.log('  This indicates lack of idempotency protection')
    } else {
      results.push({
        test: 'Duplicate Sales',
        passed: true,
        details: { salesChecked: sales.length }
      })
      console.log('✓ No duplicate sales found')
    }

  } catch (error: any) {
    results.push({
      test: 'Duplicate Sales',
      passed: false,
      error: error.message
    })
    console.error('✗ Test failed:', error.message)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Run Tests
// ══════════════════════════════════════════════════════════════════════════════

runTests()
