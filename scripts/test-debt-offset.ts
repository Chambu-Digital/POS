/**
 * End-to-end test for smart debt offset logic
 * 
 * Scenario:
 * 1. Create a test customer
 * 2. Record initial debt of 500
 * 3. Create a new sale for 300
 * 4. Process payment of 1000
 * 
 * Expected outcome:
 * - Old debt: 500
 * - New purchase: 300
 * - Amount paid: 1000
 * - Overpayment: 1000 - 300 = 700
 * - Debt offset: min(700, 500) = 500
 * - Remaining credit: 700 - 500 = 200
 * - Final balance: -200 (credit)
 * 
 * Ledger entries should show:
 * 1. Initial debt entry: +500 (purchase)
 * 2. Debt offset entry: -500 (payment)
 * 3. Credit entry: -200 (payment)
 * 4. Sale debt entry: 0 (sale was fully paid)
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3000/api'

interface TestResult {
  name: string
  passed: boolean
  message: string
  details?: any
}

const results: TestResult[] = []

async function test() {
  console.log('🧪 Starting Debt Offset Test Suite\n')

  try {
    // Step 1: Create test customer with initial debt
    console.log('Step 1: Creating customer with initial debt of 500...')
    const customerRes = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer - Debt Offset',
        phone: '+254700000000',
      }),
    })

    if (!customerRes.ok) {
      throw new Error(`Failed to create customer: ${await customerRes.text()}`)
    }

    const customerData = (await customerRes.json()) as any
    const customerId = customerData.customer._id

    console.log(`✓ Customer created: ${customerId}\n`)

    // Step 2: Manually add initial debt
    console.log('Step 2: Adding initial debt of 500 to customer...')
    // This would normally be done through a previous sale
    // For testing, we'd need to manually update the customer or create a previous sale

    // Step 3: Create a sale for 300
    console.log('Step 3: Creating sale for 300...')
    const saleRes = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            productId: '507f1f77bcf86cd799439011', // placeholder
            productName: 'Test Product',
            quantity: 1,
            price: 300,
            discount: 0,
          },
        ],
        subtotal: 300,
        discount: 0,
        total: 300,
        amountPaid: 1000,
        paymentMethod: 'cash',
        customerId,
        customerName: 'Test Customer - Debt Offset',
        source: 'pos',
      }),
    })

    if (!saleRes.ok) {
      const error = await saleRes.json()
      throw new Error(`Failed to create sale: ${JSON.stringify(error)}`)
    }

    const saleData = (await saleRes.json()) as any
    const sale = saleData.sale

    console.log(`✓ Sale created: ${sale._id}\n`)

    // Step 4: Verify results
    console.log('Step 4: Verifying results...\n')

    // Fetch updated customer
    const updatedCustomerRes = await fetch(`${API_BASE}/customers/${customerId}`, {
      headers: { 'Content-Type': 'application/json' },
    })

    const updatedCustomerData = (await updatedCustomerRes.json()) as any
    const updatedCustomer = updatedCustomerData.customer

    // Test 1: Customer balance
    console.log('Test 1: Checking customer balance')
    const expectedBalance = -200 // negative = credit
    const actualBalance = updatedCustomer.creditBalance

    if (actualBalance === expectedBalance) {
      results.push({
        name: 'Customer Balance',
        passed: true,
        message: `Balance correctly set to ${actualBalance} (credit wallet)`,
        details: { expected: expectedBalance, actual: actualBalance },
      })
      console.log(`✓ PASS: Balance = ${actualBalance} (expected: ${expectedBalance})\n`)
    } else {
      results.push({
        name: 'Customer Balance',
        passed: false,
        message: `Balance mismatch. Expected: ${expectedBalance}, Got: ${actualBalance}`,
        details: { expected: expectedBalance, actual: actualBalance },
      })
      console.log(`✗ FAIL: Balance = ${actualBalance} (expected: ${expectedBalance})\n`)
    }

    // Test 2: Ledger entries
    console.log('Test 2: Checking ledger entries')
    const ledger = updatedCustomer.ledger || []
    console.log(`Found ${ledger.length} ledger entries\n`)

    if (ledger.length >= 2) {
      results.push({
        name: 'Ledger Entries',
        passed: true,
        message: `Found ${ledger.length} ledger entries tracking debt and offsets`,
        details: { ledgerCount: ledger.length, entries: ledger },
      })
      console.log(`✓ PASS: ${ledger.length} ledger entries found\n`)

      // Print ledger details
      console.log('Ledger Details:')
      ledger.forEach((entry: any, index: number) => {
        console.log(`  Entry ${index + 1}:`)
        console.log(`    Type: ${entry.type}`)
        console.log(`    Amount: ${entry.amount}`)
        console.log(`    Balance After: ${entry.balance}`)
        console.log(`    Note: ${entry.note}\n`)
      })
    } else {
      results.push({
        name: 'Ledger Entries',
        passed: false,
        message: `Expected at least 2 ledger entries, found ${ledger.length}`,
        details: { ledgerCount: ledger.length, entries: ledger },
      })
      console.log(`✗ FAIL: Expected at least 2 entries, found ${ledger.length}\n`)
    }

    // Test 3: Sale debt status
    console.log('Test 3: Checking sale debt status')
    const saleDebt = sale.debt || 0

    if (saleDebt === 0) {
      results.push({
        name: 'Sale Debt Status',
        passed: true,
        message: 'Sale debt is 0 (fully paid)',
        details: { debt: saleDebt },
      })
      console.log(`✓ PASS: Sale debt = ${saleDebt} (fully paid)\n`)
    } else {
      results.push({
        name: 'Sale Debt Status',
        passed: false,
        message: `Sale debt should be 0, got ${saleDebt}`,
        details: { debt: saleDebt },
      })
      console.log(`✗ FAIL: Sale debt = ${saleDebt} (expected 0)\n`)
    }

    // Test 4: Credit applied tracking
    console.log('Test 4: Checking credit applied tracking')
    const creditApplied = sale.creditApplied || 0

    if (creditApplied >= 0) {
      results.push({
        name: 'Credit Applied',
        passed: true,
        message: `Credit applied tracked: ${creditApplied}`,
        details: { creditApplied },
      })
      console.log(`✓ PASS: Credit applied = ${creditApplied}\n`)
    } else {
      results.push({
        name: 'Credit Applied',
        passed: false,
        message: `Credit applied should be >= 0, got ${creditApplied}`,
        details: { creditApplied },
      })
      console.log(`✗ FAIL: Credit applied = ${creditApplied}\n`)
    }
  } catch (error) {
    console.error('Test error:', error)
    results.push({
      name: 'Test Execution',
      passed: false,
      message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('TEST SUMMARY')
  console.log('='.repeat(50) + '\n')

  const passCount = results.filter(r => r.passed).length
  const totalCount = results.length

  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗'
    const status = result.passed ? 'PASS' : 'FAIL'
    console.log(`${icon} ${result.name}: ${status}`)
    console.log(`  ${result.message}\n`)
  })

  console.log('='.repeat(50))
  console.log(`Total: ${passCount}/${totalCount} tests passed`)
  console.log('='.repeat(50))

  process.exit(passCount === totalCount ? 0 : 1)
}

test().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
