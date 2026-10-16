/**
 * Test script to verify that concurrent connection requests don't create duplicate connections
 * This simulates multiple API requests hitting the same tenant database simultaneously
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import { connectTenantDB, getTenantConnectionStats } from '@/lib/db-tenant'
import mongoose from 'mongoose'

async function testConcurrentConnections() {
  console.log('\n========== TESTING CONCURRENT CONNECTION RACE CONDITION ==========\n')

  const testUri = process.env.MONGODB_URI
  if (!testUri) {
    console.error('❌ MONGODB_URI not set')
    process.exit(1)
  }

  // Add a test database suffix
  const parts = testUri.split('?')
  const baseWithoutQuery = parts[0].replace(/\/$/, '')
  const query = parts[1] ? `?${parts[1]}` : ''
  const testTenantUri = `${baseWithoutQuery}/test-race-condition${query}`

  console.log('🧪 Test URI:', testTenantUri.replace(/:[^:@]+@/, ':****@'))
  console.log('🚀 Launching 10 concurrent connection requests...\n')

  const startTime = Date.now()

  // Fire off 10 concurrent requests
  const promises = Array.from({ length: 10 }, (_, i) => 
    connectTenantDB(testTenantUri).then(conn => {
      console.log(`   Request ${i + 1}: Connected (readyState: ${conn.readyState})`)
      return conn
    })
  )

  const connections = await Promise.all(promises)
  const endTime = Date.now()

  console.log(`\n✅ All 10 requests completed in ${endTime - startTime}ms\n`)

  // Verify all connections are the same instance
  const firstConn = connections[0]
  const allSame = connections.every(conn => conn === firstConn)

  if (allSame) {
    console.log('✅ SUCCESS: All requests returned the same connection instance')
    console.log('   This confirms the race condition is fixed!\n')
  } else {
    console.log('❌ FAILURE: Multiple connection instances were created')
    console.log('   This indicates the race condition still exists!\n')
  }

  // Show statistics
  const stats = getTenantConnectionStats()
  console.log('📊 Connection Statistics:')
  console.log(JSON.stringify(stats, null, 2))

  // Cleanup
  console.log('\n🧹 Cleaning up...')
  await firstConn.close()
  
  // Clear the global cache for this test
  if (global._tenantConnections) {
    global._tenantConnections.delete(testTenantUri)
  }
  if (global._tenantConnectionPromises) {
    global._tenantConnectionPromises.delete(testTenantUri)
  }

  await mongoose.disconnect()
  console.log('✅ Cleanup complete\n')

  process.exit(allSame ? 0 : 1)
}

testConcurrentConnections().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
