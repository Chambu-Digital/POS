/**
 * FORCE Drop bottle unique index - Direct database operation
 * 
 * This script directly connects to the tenant database and drops the index.
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

async function forceDropIndex() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not found')
  }

  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)

  // Get the jaywines database directly
  const db = mongoose.connection.useDb('jaywines')
  const collection = db.collection('bar_bottles')

  console.log('\n=== Current Indexes ===')
  const indexes = await collection.indexes()
  indexes.forEach(idx => {
    console.log(`- ${idx.name}`, idx.unique ? '(UNIQUE)' : '')
  })

  // Drop ALL indexes except _id
  console.log('\n=== Dropping problematic indexes ===')
  for (const idx of indexes) {
    if (idx.name !== '_id_' && idx.name.includes('userId_1_branchId_1_inventoryItemId_1_state_1')) {
      try {
        console.log(`Dropping: ${idx.name}`)
        await collection.dropIndex(idx.name)
        console.log(`✅ Dropped: ${idx.name}`)
      } catch (error: any) {
        console.error(`❌ Failed to drop ${idx.name}:`, error.message)
      }
    }
  }

  // Create non-unique indexes
  console.log('\n=== Creating non-unique indexes ===')
  
  try {
    await collection.createIndex(
      { userId: 1, branchId: 1, inventoryItemId: 1, state: 1 },
      { name: 'userId_1_branchId_1_inventoryItemId_1_state_1', unique: false }
    )
    console.log('✅ Created: userId_1_branchId_1_inventoryItemId_1_state_1 (non-unique)')
  } catch (error: any) {
    console.error('❌ Failed:', error.message)
  }

  try {
    await collection.createIndex(
      { userId: 1, branchId: 1, inventoryItemId: 1, createdAt: -1 },
      { name: 'userId_1_branchId_1_inventoryItemId_1_createdAt_-1' }
    )
    console.log('✅ Created: userId_1_branchId_1_inventoryItemId_1_createdAt_-1')
  } catch (error: any) {
    if (!error.message.includes('already exists')) {
      console.error('❌ Failed:', error.message)
    }
  }

  try {
    await collection.createIndex(
      { userId: 1, branchId: 1, state: 1 },
      { name: 'userId_1_branchId_1_state_1' }
    )
    console.log('✅ Created: userId_1_branchId_1_state_1')
  } catch (error: any) {
    if (!error.message.includes('already exists')) {
      console.error('❌ Failed:', error.message)
    }
  }

  console.log('\n=== Final Index State ===')
  const finalIndexes = await collection.indexes()
  finalIndexes.forEach(idx => {
    console.log(`- ${idx.name}`, idx.unique ? '(UNIQUE ⚠️)' : '(non-unique ✅)')
  })

  console.log('\n✅ Done! Restart your Next.js dev server.')
  
  await mongoose.disconnect()
}

forceDropIndex().catch(error => {
  console.error('Failed:', error)
  process.exit(1)
})
