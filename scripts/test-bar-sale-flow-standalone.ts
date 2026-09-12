/**
 * Standalone Test Script: Bar Sale Flow Validation
 * 
 * This script validates the hypotheses about bar sales failures without NextJS context
 */

import mongoose from 'mongoose'
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
    // Connect to main database
    const MONGODB_URI = process.env.MONGODB_URI
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment')
    }

    await mongoose.connect(MONGODB_URI)
    console.log('✓ Connected to main database\n')

    // Get first tenant
    const mainDb = mongoose.connection
    const tenantData = await mainDb.collection('tenants').findOne({})
    
    if (!tenantData) {
      console.log('❌ No tenants found in database. Cannot run tests.')
      return
    }

    const tenantDbName = tenantData.dbName || `tenant_${tenantData._id}`
    console.log(`✓ Using tenant: ${tenantData.name || 'Unnamed'} (${tenantData._id})`)
    console.log(`✓ Tenant database: ${tenantDbName}\n`)

    // Connect to tenant database
    const tenantConn = mongoose.createConnection(`${MONGODB_URI.split('/').slice(0, -1).join('/')}/${tenantDbName}`)
    await tenantConn.asPromise()
    console.log('✓ Connected to tenant database\n')

    console.log('═══════════════════════════════════════════════════════════════')
    console.log('TEST 1: Check for Orphaned Synthetic Tabs')
    console.log('═══════════════════════════════════════════════════════════════')
    await testOrphanedSyntheticTabs(tenantConn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 2: Check for Tabs Without SaleId')
    console.log('═══════════════════════════════════════════════════════════════')
    await testTabsWithoutSaleId(tenantConn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 3: Check for Inconsistent Bottle States')
    console.log('═══════════════════════════════════════════════════════════════')
    await testInconsistentBottleStates(tenantConn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 4: Check for TabLines Without Bottle Deductions')
    console.log('═══════════════════════════════════════════════════════════════')
    await testTabLinesWithoutDeductions(tenantConn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 5: Check for Closed Bottles Still Referenced in Tabs')
    console.log('═══════════════════════════════════════════════════════════════')
    await testClosedBottlesInTabs(tenantConn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 6: Check Branch Filtering Issues')
    console.log('═══════════════════════════════════════════════════════════════')
    await testBranchFiltering(tenantConn)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('TEST 7: Check for Duplicate Sale Records')
    console.log('═══════════════════════════════════════════════════════════════')
    await testDuplicateSales(tenantConn)

    console.log('\n╔═══════════════════════════════════════════════════════════════╗')
    console.log('║                      TEST SUMMARY                              ║')
    console.log('╚═══════════════════════════════════════════════════════════════╝\n')

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    results.forEach(result => {
      const icon = result.passed ? '✓' : '✗'
      console.log(`${icon} ${result.test}`)
      if (!result.passed && result.error) {
        console.log(`  └─ ${result.error}`)
      }
      if (result.details && Object.keys(result.details).length > 0) {
        const detailsStr = JSON.stringify(result.details, null, 2)
          .split('\n')
          .map((line, i) => i === 0 ? line : '     ' + line)
          .join('\n')
        console.log(`  └─ ${detailsStr}`)
      }
    })

    console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

    if (failed > 0) {
      console.log('\n🔴 CRITICAL ISSUES FOUND - These explain the payment failures!')
    } else {
      console.log('\n✅ All tests passed - No obvious data inconsistencies found')
    }

    await tenantConn.close()

  } catch (error: any) {
    console.error('\n❌ Fatal error running tests:', error.message)
    console.error(error.stack)
  } finally {
    await mongoose.connection.close()
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Test Functions
// ══════════════════════════════════════════════════════════════════════════════

async function testOrphanedSyntheticTabs(conn: mongoose.Connection) {
  try {
    const BarTab = conn.collection('bartabs')
    const Sale = conn.collection('sales')

    const syntheticTabs = await BarTab.find({
      isSyntheticDirectSale: true,
      status: 'paid'
    }).toArray()

    console.log(`Found ${syntheticTabs.length} paid synthetic tabs`)

    if (syntheticTabs.length === 0) {
      results.push({
        test: 'Orphaned Synthetic Tabs',
        passed: true,
        details: { count: 0, note: 'No synthetic tabs found' }
      })
      console.log('✓ No synthetic tabs found (clean state or no bar sales yet)')
      return
    }

    let orphanedCount = 0
    const orphanedTabs = []

    for (const tab of syntheticTabs) {
      const sale = await Sale.findOne({
        source: 'bar',
        createdAt: { 
          $gte: new Date(tab.createdAt.getTime() - 10000),
          $lte: new Date(tab.createdAt.getTime() + 10000)
        },
        total: tab.total
      })

      if (!sale) {
        orphanedCount++
        orphanedTabs.push({
          tabId: tab._id.toString(),
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
        error: `Found ${orphanedCount}/${syntheticTabs.length} synthetic tabs without corresponding sales`,
        details: { 
          orphanedCount,
          totalSynthetic: syntheticTabs.length,
          samples: orphanedTabs.slice(0, 2)
        }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: ${orphanedCount} synthetic tabs have no matching sales`)
      console.log('  → This indicates sale creation failed AFTER tab was marked paid')
      console.log('  → Confirms lack of atomic transactions')
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
      error: `Test error: ${error.message}`
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testTabsWithoutSaleId(conn: mongoose.Connection) {
  try {
    const BarTab = conn.collection('bartabs')

    const tabsWithoutSaleId = await BarTab.find({
      status: 'paid',
      $or: [
        { saleId: { $exists: false } },
        { saleId: null }
      ]
    }).toArray()

    console.log(`Found ${tabsWithoutSaleId.length} paid tabs without saleId`)

    if (tabsWithoutSaleId.length > 0) {
      results.push({
        test: 'Tabs Without SaleId',
        passed: false,
        error: `Found ${tabsWithoutSaleId.length} paid tabs missing saleId field`,
        details: {
          count: tabsWithoutSaleId.length,
          samples: tabsWithoutSaleId.slice(0, 2).map(t => ({
            tabId: t._id.toString(),
            tabNumber: t.tabNumber,
            status: t.status,
            total: t.total,
            isSynthetic: t.isSyntheticDirectSale
          }))
        }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: Paid tabs exist without saleId`)
      console.log('  → This causes "saleId missing" errors in queries')
      console.log('  → Sale → Tab linking step failed')
    } else {
      results.push({
        test: 'Tabs Without SaleId',
        passed: true
      })
      console.log('✓ All paid tabs have saleId field')
    }

  } catch (error: any) {
    results.push({
      test: 'Tabs Without SaleId',
      passed: false,
      error: `Test error: ${error.message}`
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testInconsistentBottleStates(conn: mongoose.Connection) {
  try {
    const BarBottle = conn.collection('barbottles')

    const emptyOpenBottles = await BarBottle.find({
      state: 'open',
      remainingFraction: { $lte: 0 }
    }).toArray()

    console.log(`Found ${emptyOpenBottles.length} open bottles with 0% remaining`)

    if (emptyOpenBottles.length > 0) {
      results.push({
        test: 'Inconsistent Bottle States',
        passed: false,
        error: `Found ${emptyOpenBottles.length} bottles that should be closed`,
        details: {
          count: emptyOpenBottles.length,
          samples: emptyOpenBottles.slice(0, 2).map(b => ({
            bottleId: b._id.toString(),
            bottleNumber: b.bottleNumber,
            remainingFraction: b.remainingFraction,
            state: b.state
          }))
        }
      })
      console.log(`✗ ISSUE FOUND: Empty bottles still marked as open`)
      console.log('  → These should have been auto-closed or manually closed')
      console.log('  → Can cause "insufficient fraction" errors')
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
      error: `Test error: ${error.message}`
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testTabLinesWithoutDeductions(conn: mongoose.Connection) {
  try {
    const BarTabLine = conn.collection('bartablines')
    const BarAuditLog = conn.collection('barauditlogs')

    const servingLines = await BarTabLine.find({
      servingId: { $exists: true, $ne: null },
      bottleId: { $exists: true, $ne: null },
      voided: false
    }).limit(50).toArray()

    console.log(`Checking ${servingLines.length} serving tab lines for audit trail...`)

    if (servingLines.length === 0) {
      results.push({
        test: 'TabLines Without Deductions',
        passed: true,
        details: { note: 'No serving lines found to check' }
      })
      console.log('✓ No serving lines found')
      return
    }

    let missingAuditCount = 0

    for (const line of servingLines) {
      const auditLog = await BarAuditLog.findOne({
        operation: 'SERVING_SOLD',
        'details.bottleId': line.bottleId.toString(),
        timestamp: {
          $gte: new Date(line.addedAt.getTime() - 2000),
          $lte: new Date(line.addedAt.getTime() + 2000)
        }
      })

      if (!auditLog) {
        missingAuditCount++
      }
    }

    if (missingAuditCount > 0) {
      results.push({
        test: 'TabLines Without Deductions',
        passed: false,
        error: `Found ${missingAuditCount}/${servingLines.length} lines without audit logs`,
        details: { 
          missingAuditCount,
          totalChecked: servingLines.length
        }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: ${missingAuditCount} lines lack audit trail`)
      console.log('  → Bottle deduction step was skipped or failed')
      console.log('  → Inventory is incorrect')
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
      error: `Test error: ${error.message}`
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testClosedBottlesInTabs(conn: mongoose.Connection) {
  try {
    const BarTab = conn.collection('bartabs')
    const BarTabLine = conn.collection('bartablines')
    const BarBottle = conn.collection('barbottles')

    const openTabs = await BarTab.find({
      status: 'open'
    }).toArray()

    if (openTabs.length === 0) {
      results.push({
        test: 'Closed Bottles in Open Tabs',
        passed: true,
        details: { note: 'No open tabs exist' }
      })
      console.log('✓ No open tabs to check')
      return
    }

    const tabIds = openTabs.map(t => t._id)
    const tabLines = await BarTabLine.find({
      tabId: { $in: tabIds },
      bottleId: { $exists: true, $ne: null },
      voided: false
    }).toArray()

    console.log(`Checking ${tabLines.length} tab lines for closed bottle references...`)

    if (tabLines.length === 0) {
      results.push({
        test: 'Closed Bottles in Open Tabs',
        passed: true,
        details: { note: 'No tab lines with bottles in open tabs' }
      })
      console.log('✓ No tab lines with bottles to check')
      return
    }

    let closedBottleCount = 0

    for (const line of tabLines) {
      const bottle = await BarBottle.findOne({ _id: line.bottleId })
      
      if (!bottle) {
        closedBottleCount++
      } else if (bottle.state === 'closed') {
        closedBottleCount++
      }
    }

    if (closedBottleCount > 0) {
      results.push({
        test: 'Closed Bottles in Open Tabs',
        passed: false,
        error: `Found ${closedBottleCount}/${tabLines.length} lines referencing closed/missing bottles`,
        details: { closedCount: closedBottleCount, totalLines: tabLines.length }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: Open tabs reference closed/missing bottles`)
      console.log('  → This causes "BOTTLE_NOT_FOUND_OR_CLOSED" errors during payment')
      console.log('  → Bottle was closed after item was added to tab')
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
      error: `Test error: ${error.message}`
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testBranchFiltering(conn: mongoose.Connection) {
  try {
    const BarBottle = conn.collection('barbottles')

    const bottles = await BarBottle.find({
      state: 'open'
    }).toArray()

    console.log(`Checking ${bottles.length} open bottles for branch filtering...`)

    if (bottles.length === 0) {
      results.push({
        test: 'Branch Filtering',
        passed: true,
        details: { note: 'No open bottles exist' }
      })
      console.log('✓ No open bottles to check')
      return
    }

    const bottlesWithoutBranch = bottles.filter(b => !b.branchId)
    
    if (bottlesWithoutBranch.length > 0) {
      results.push({
        test: 'Branch Filtering',
        passed: false,
        error: `Found ${bottlesWithoutBranch.length}/${bottles.length} bottles without branchId`,
        details: { 
          withoutBranch: bottlesWithoutBranch.length,
          total: bottles.length
        }
      })
      console.log(`✗ ISSUE FOUND: Bottles missing branchId`)
      console.log('  → Causes cross-branch bottle visibility')
      console.log('  → Users see bottles from other branches')
    } else {
      results.push({
        test: 'Branch Filtering',
        passed: true,
        details: { bottlesChecked: bottles.length }
      })
      console.log('✓ All bottles have branchId field')
    }

  } catch (error: any) {
    results.push({
      test: 'Branch Filtering',
      passed: false,
      error: `Test error: ${error.message}`
    })
    console.error('✗ Test failed:', error.message)
  }
}

async function testDuplicateSales(conn: mongoose.Connection) {
  try {
    const Sale = conn.collection('sales')

    const sales = await Sale.find({
      source: 'bar',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 }).toArray()

    console.log(`Checking ${sales.length} bar sales for duplicates...`)

    if (sales.length === 0) {
      results.push({
        test: 'Duplicate Sales',
        passed: true,
        details: { note: 'No bar sales in last 7 days' }
      })
      console.log('✓ No bar sales to check')
      return
    }

    const duplicates = []
    const seen = new Map()

    for (const sale of sales) {
      // Group by total + timestamp (within 5 seconds) + item count
      const timeKey = Math.floor(sale.createdAt.getTime() / 5000)
      const key = `${sale.total}_${timeKey}_${sale.items.length}`
      
      if (seen.has(key)) {
        const prev = seen.get(key)
        duplicates.push({
          saleId1: prev.id,
          saleId2: sale._id.toString(),
          total: sale.total,
          itemCount: sale.items.length,
          timeDiff: Math.abs(sale.createdAt.getTime() - prev.time) / 1000
        })
      } else {
        seen.set(key, { id: sale._id.toString(), time: sale.createdAt.getTime() })
      }
    }

    if (duplicates.length > 0) {
      results.push({
        test: 'Duplicate Sales',
        passed: false,
        error: `Found ${duplicates.length} potential duplicate sales`,
        details: { 
          duplicateCount: duplicates.length,
          samples: duplicates.slice(0, 2)
        }
      })
      console.log(`✗ HYPOTHESIS CONFIRMED: Duplicate sales exist`)
      console.log('  → Indicates lack of idempotency protection')
      console.log('  → Double-clicks or retries created multiple sales')
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
      error: `Test error: ${error.message}`
    })
    console.error('✗ Test failed:', error.message)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Run Tests
// ══════════════════════════════════════════════════════════════════════════════

runTests()
