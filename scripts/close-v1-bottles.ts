/**
 * Migration: Close all V1 bottles and start fresh with V2
 * 
 * Problem:
 *   Bottles opened before V2 migration have V1 schema (remainingUnits)
 *   but V2 code expects V2 schema (remainingFraction).
 *   This causes availability calculation to fail (shows "0 servings available").
 * 
 * Solution:
 *   Close all existing open bottles by setting state to 'closed'.
 *   Users can then open fresh bottles using V2 schema.
 * 
 * What this does:
 *   1. Finds all bottles with state = 'open'
 *   2. Checks if they're V1 bottles (has remainingUnits but no remainingFraction)
 *   3. Closes them by setting:
 *      - state: 'closed'
 *      - closedAt: now
 *      - closedBy: null (system closure)
 *   4. Adds audit log entry for tracking
 * 
 * Safe to run:
 *   - Does not delete any data
 *   - Only updates state to 'closed'
 *   - Can be reversed manually if needed
 * 
 * Usage:
 *   npx tsx scripts/close-v1-bottles.ts
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

async function closeV1Bottles() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not found')
  }

  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)

  // Get the jaywines database directly (where the bottles are)
  const db = mongoose.connection.useDb('jaywines')
  const bottlesCollection = db.collection('bar_bottles')
  const auditLogCollection = db.collection('bar_audit_logs')

  console.log('\n=== Checking jaywines database ===')
  
  // Find all open bottles
  const openBottles = await bottlesCollection.find({ state: 'open' }).toArray()
  console.log(`Found ${openBottles.length} open bottles`)

  if (openBottles.length === 0) {
    console.log('No bottles to close\n')
    await mongoose.disconnect()
    return
  }

  // Identify V1 bottles (has remainingUnits but no remainingFraction)
  const v1Bottles = openBottles.filter(bottle => {
    const hasV1Field = bottle.remainingUnits !== undefined && bottle.remainingUnits !== null
    const hasV2Field = bottle.remainingFraction !== undefined && bottle.remainingFraction !== null
    return hasV1Field && !hasV2Field
  })

  // Also check for bottles with remainingFraction = 0 or null (broken V2 bottles)
  const brokenV2Bottles = openBottles.filter(bottle => {
    const hasV2Field = bottle.remainingFraction !== undefined && bottle.remainingFraction !== null
    return hasV2Field && bottle.remainingFraction === 0
  })

  const bottlesToClose = [...v1Bottles, ...brokenV2Bottles]

  console.log(`\nBottle Analysis:`)
  console.log(`- V1 bottles (remainingUnits only): ${v1Bottles.length}`)
  console.log(`- Broken V2 bottles (remainingFraction = 0): ${brokenV2Bottles.length}`)
  console.log(`- Total bottles to close: ${bottlesToClose.length}`)
  console.log(`- Valid V2 bottles: ${openBottles.length - bottlesToClose.length}\n`)

  if (bottlesToClose.length === 0) {
    console.log('All bottles are valid V2 format\n')
    await mongoose.disconnect()
    return
  }

  const now = new Date()
  let closed = 0

  // Close each bottle
  for (const bottle of bottlesToClose) {
    const bottleId = bottle._id
    
    console.log(`Closing Bottle #${bottle.bottleNumber}...`)
    
    // Update bottle to closed state
    await bottlesCollection.updateOne(
      { _id: bottleId },
      {
        $set: {
          state: 'closed',
          closedAt: now,
          closedBy: null, // System closure
          updatedAt: now,
        }
      }
    )

    // Create audit log entry
    await auditLogCollection.insertOne({
      userId: bottle.userId,
      branchId: bottle.branchId,
      staffId: bottle.openedBy || bottle.userId,
      operation: 'BOTTLE_CLOSED',
      referenceId: String(bottleId),
      referenceType: 'BarBottle',
      details: {
        bottleId: String(bottleId),
        bottleNumber: bottle.bottleNumber,
        inventoryItemId: String(bottle.inventoryItemId),
        reason: 'V1_TO_V2_MIGRATION',
        note: 'Closed during V1 to V2 migration - bottle used old schema',
        wasV1: bottle.remainingUnits !== undefined,
        wasEmpty: bottle.remainingFraction === 0,
      },
      timestamp: now,
    })

    closed++
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅ Migration completed`)
  console.log(`   Bottles closed: ${closed}`)
  console.log(`${'═'.repeat(60)}`)
  console.log('\nNext steps:')
  console.log('1. Refresh your Bar POS page')
  console.log('2. Open new bottles (they will use V2 schema)')
  console.log('3. Try selling servings - should work correctly now')
  console.log('\nNote: Old bottles are marked as "closed" but data is preserved.')
  
  await mongoose.disconnect()
}

closeV1Bottles().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
