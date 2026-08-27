/**
 * Migration: Drop old unique index on bar_bottles
 * 
 * Problem:
 *   V1 had a unique index: userId_1_branchId_1_inventoryItemId_1_state_1
 *   This prevents multiple open bottles of the same item.
 * 
 * V2 Requirement:
 *   Multiple bottles of the same item can be open simultaneously (FIFO tracking).
 * 
 * Solution:
 *   Drop the unique index and replace with non-unique compound index.
 * 
 * Usage:
 *   npx tsx scripts/drop-bottle-unique-index.ts
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

async function migrate() {
  const MAIN_DB_URI = process.env.MONGODB_URI
  if (!MAIN_DB_URI) {
    throw new Error('MONGODB_URI not found in environment')
  }

  console.log('Connecting to main database...')
  await mongoose.connect(MAIN_DB_URI)

  const mainDb = mongoose.connection.db
  const tenantsCollection = mainDb.collection('tenants')

  console.log('Fetching tenants...')
  const tenants = await tenantsCollection.find({}).toArray()
  console.log(`Found ${tenants.length} tenants`)

  for (const tenant of tenants) {
    const tenantDbName = tenant.dbName
    console.log(`\nProcessing tenant: ${tenant.name} (${tenantDbName})`)

    try {
      const tenantDb = mongoose.connection.useDb(tenantDbName)
      const barBottlesCollection = tenantDb.collection('bar_bottles')

      // Get current indexes
      const indexes = await barBottlesCollection.indexes()
      console.log(`  - Current indexes:`, indexes.map(i => i.name))

      // Look for the problematic unique index
      const uniqueIndex = indexes.find(
        idx => idx.name === 'userId_1_branchId_1_inventoryItemId_1_state_1' && idx.unique === true
      )

      if (uniqueIndex) {
        console.log(`  - Found unique index: ${uniqueIndex.name}`)
        console.log(`  - Dropping unique index...`)
        await barBottlesCollection.dropIndex(uniqueIndex.name)
        console.log(`  - ✅ Dropped unique index`)
        
        // Recreate as non-unique compound index (should already exist from schema)
        console.log(`  - Ensuring non-unique compound index exists...`)
        await barBottlesCollection.createIndex(
          { userId: 1, branchId: 1, inventoryItemId: 1, state: 1 },
          { unique: false }
        )
        console.log(`  - ✅ Created non-unique compound index`)
      } else {
        console.log(`  - No problematic unique index found (already migrated or never existed)`)
      }

      // Verify final state
      const finalIndexes = await barBottlesCollection.indexes()
      const hasNonUnique = finalIndexes.some(
        idx => idx.name === 'userId_1_branchId_1_inventoryItemId_1_state_1' && !idx.unique
      )
      
      if (hasNonUnique) {
        console.log(`  - ✅ Verified: Non-unique compound index exists`)
      } else {
        console.log(`  - ⚠️ Warning: Expected compound index not found`)
      }

    } catch (error: any) {
      console.error(`  ❌ Error processing tenant ${tenant.name}:`, error.message)
    }
  }

  console.log('\n✅ Migration completed')
  console.log('\nNext steps:')
  console.log('1. Restart your Next.js dev server')
  console.log('2. Try opening bottles again')
  
  await mongoose.disconnect()
}

migrate().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
