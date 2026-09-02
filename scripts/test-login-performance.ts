/**
 * Login Performance Test Script
 * 
 * Usage: npx tsx scripts/test-login-performance.ts
 * 
 * This script tests login performance by making actual API calls
 * and collecting timing data from the instrumented endpoints.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface TestResult {
  email: string
  success: boolean
  statusCode: number
  totalTime: number
  error?: string
}

async function testLogin(email: string, password: string): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const totalTime = Date.now() - startTime
    const data = await response.json()

    return {
      email,
      success: response.ok,
      statusCode: response.status,
      totalTime,
      error: data.error,
    }
  } catch (error) {
    return {
      email,
      success: false,
      statusCode: 0,
      totalTime: Date.now() - startTime,
      error: String(error),
    }
  }
}

async function testStaffLogin(email: string, password: string): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const totalTime = Date.now() - startTime
    const data = await response.json()

    return {
      email,
      success: response.ok,
      statusCode: response.status,
      totalTime,
      error: data.error,
    }
  } catch (error) {
    return {
      email,
      success: false,
      statusCode: 0,
      totalTime: Date.now() - startTime,
      error: String(error),
    }
  }
}

async function getDiagnostics() {
  try {
    const response = await fetch(`${BASE_URL}/api/debug/auth-diagnostics`)
    return await response.json()
  } catch (error) {
    console.error('Failed to get diagnostics:', error)
    return null
  }
}

async function main() {
  console.log('\n========================================')
  console.log('🧪 Login Performance Test Suite')
  console.log('========================================\n')

  console.log(`Testing against: ${BASE_URL}\n`)

  // Get initial diagnostics
  console.log('📊 Fetching system diagnostics...\n')
  const diagnostics = await getDiagnostics()
  
  if (diagnostics) {
    console.log(`Active tenants: ${diagnostics.tenantInfo?.totalActive || 'unknown'}`)
    console.log(`Cached connections: ${diagnostics.connectionStats?.currentCached || 0}/${diagnostics.connectionStats?.maxCachedTenants || 10}`)
    console.log('')
  }

  // Test cases
  const testCases = [
    {
      type: 'demo',
      email: 'demo@example.com',
      password: 'demo123',
      description: 'Demo user (should be fast - early exit)'
    },
    {
      type: 'user',
      email: 'wonders@gmail.com',
      password: '123456',
      description: 'Real owner login (Wonder shops)'
    },
    {
      type: 'invalid',
      email: 'nonexistent@example.com',
      password: 'wrong',
      description: 'Invalid login (full tenant scan expected)'
    },
  ]

  console.log('========================================')
  console.log('Running Test Cases')
  console.log('========================================\n')

  const results: TestResult[] = []

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`Test ${i + 1}/${testCases.length}: ${testCase.description}`)
    console.log(`  Email: ${testCase.email}`)
    
    const result = testCase.type === 'staff' 
      ? await testStaffLogin(testCase.email, testCase.password)
      : await testLogin(testCase.email, testCase.password)
    
    results.push(result)
    
    console.log(`  Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`)
    console.log(`  Time: ${result.totalTime}ms`)
    if (result.error) {
      console.log(`  Error: ${result.error}`)
    }
    console.log('')

    // Wait a bit between tests to see cache behavior
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Test cache warmup by repeating first successful test
  const successfulTest = testCases.find(t => results.find(r => r.email === t.email)?.success)
  if (successfulTest) {
    console.log('========================================')
    console.log('Cache Warmup Test (Repeat Login)')
    console.log('========================================\n')
    
    console.log(`Repeating: ${successfulTest.description}`)
    const repeatResult = successfulTest.type === 'staff'
      ? await testStaffLogin(successfulTest.email, successfulTest.password)
      : await testLogin(successfulTest.email, successfulTest.password)
    
    const originalResult = results.find(r => r.email === successfulTest.email)
    
    console.log(`  First attempt:  ${originalResult?.totalTime}ms`)
    console.log(`  Second attempt: ${repeatResult.totalTime}ms`)
    console.log(`  Improvement:    ${originalResult ? originalResult.totalTime - repeatResult.totalTime : 0}ms`)
    console.log('')
  }

  // Summary
  console.log('========================================')
  console.log('📊 Test Summary')
  console.log('========================================\n')

  const successfulResults = results.filter(r => r.success)
  const failedResults = results.filter(r => !r.success)

  console.log(`Total tests: ${results.length}`)
  console.log(`Successful: ${successfulResults.length}`)
  console.log(`Failed: ${failedResults.length}`)
  console.log('')

  if (successfulResults.length > 0) {
    const avgTime = successfulResults.reduce((sum, r) => sum + r.totalTime, 0) / successfulResults.length
    const minTime = Math.min(...successfulResults.map(r => r.totalTime))
    const maxTime = Math.max(...successfulResults.map(r => r.totalTime))

    console.log('Successful Login Performance:')
    console.log(`  Average: ${avgTime.toFixed(0)}ms`)
    console.log(`  Min: ${minTime}ms`)
    console.log(`  Max: ${maxTime}ms`)
    console.log('')
  }

  console.log('💡 Check server logs for detailed timing breakdowns')
  console.log('========================================\n')
}

main().catch(console.error)
