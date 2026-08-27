/**
 * Migration Script: Bar Module → Fractional Servings System
 * 
 * Migrates from unit-based tracking to fraction-based tracking.
 * 
 * Changes:
 * 1. BarServing: unitsProduced → servingsPerContainer
 * 2. BarBottle: remainingUnits → remainingFraction
 * 3. BarBottle: Remove unique constraint on open bottles
 * 
 * Run: npx ts-node scripts/migrate-bar-to-fractional.ts
 * 
 * IMPORTANT: Backup database before running!
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env') })

const MONGODB_URI = process.env.MONGODB_URI || ''

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment')
  process.exit(1)
}

interface ServingDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId
  unitsProduced?: number
  servingsPerContainer?: number
  save: () => Promise<void>
}

interface BottleDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId
  state: string
  expectedUnits?: number
  remainingUnits?: number
  remainingFraction?: number
  expectedFraction?: number
  actualFraction?: number
  varianceFraction?: number
  actualUnitsSold?: number
  save: () => Promise<void>
}

async function migrateBarToFractional() {
  console.log('🚀 Starting Bar Fractional Migration...\n')

  try {
    // Connect to database
    console.log('📡 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected\n')

    const db = mongoose.connection.db
    if (!db) throw new Error('Database connection failed')

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 1: Migrate BarServing: unitsProduced → servingsPerContainer
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('📋 Step 1: Migrating BarServing (unitsProduced → servingsPerContainer)...')
    
    const servingsCollection = db.collection('bar_servings')
    const servings = await servingsCollection.find({}).toArray()
    
    let servingsMigrated = 0
    for (const serving of servings) {
      const updates: any = {}
      
      // Copy unitsProduced to servingsPerContainer if not already set
      if (serving.unitsProduced && !serving.servingsPerContainer) {
        updates.servingsPerContainer = serving.unitsProduced
      }
      
      // Ensure servingsPerContainer exists (default to 1 if missing)
      if (!updates.servingsPerContainer && !serving.servingsPerContainer) {
        updates.servingsPerContainer = 1
        console.log(`  ⚠️  Serving "${serving.name}" has no unitsProduced, defaulting to 1`)
      }
      
      if (Object.keys(updates).length > 0) {
        await servingsCollection.updateOne(
          { _id: serving._id },
          { $set: updates }
        )
        servingsMigrated++
      }
    }
    
    console.log(`✅ Migrated ${servingsMigrated} servings\n`)

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 2: Migrate BarBottle: remainingUnits → remainingFraction
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('📋 Step 2: Migrating BarBottle (units → fractions)...')
    
    const bottlesCollection = db.collection('bar_bottles')
    const bottles = await bottlesCollection.find({}).toArray()
    
    let openBottlesMigrated = 0
    let closedBottlesMigrated = 0
    
    for (const bottle of bottles) {
      const updates: any = {}
      
      if (bottle.state === 'open') {
        // Migrate open bottles
        if (bottle.expectedUnits && bottle.expectedUnits > 0) {
          // Calculate remaining fraction from units
          const fraction = (bottle.remainingUnits || 0) / bottle.expectedUnits
          updates.remainingFraction = Math.max(0, Math.min(1, fraction))
          updates.expectedFraction = 1.0
        } else {
          // No unit data, assume full bottle
          updates.remainingFraction = 1.0
          updates.expectedFraction = 1.0
          console.log(`  ⚠️  Open bottle #${bottle.bottleNumber} has no expectedUnits, defaulting to full`)
        }
        openBottlesMigrated++
      } else if (bottle.state === 'closed') {
        // Migrate closed bottles for historical reporting
        if (bottle.expectedUnits && bottle.expectedUnits > 0) {
          updates.expectedFraction = 1.0
          
          // Calculate actual remaining at close
          const remainingAtClose = (bottle.remainingUnits || 0) / bottle.expectedUnits
          updates.actualFraction = Math.max(0, Math.min(1, remainingAtClose))
          
          // Variance = what remained when closed (waste/loss)
          updates.varianceFraction = updates.actualFraction
        } else {
          updates.expectedFraction = 1.0
          updates.actualFraction = 0.0
          updates.varianceFraction = 0.0
        }
        closedBottlesMigrated++
      }
      
      if (Object.keys(updates).length > 0) {
        await bottlesCollection.updateOne(
          { _id: bottle._id },
          { $set: updates }
        )
      }
    }
    
    console.log(`✅ Migrated ${openBottlesMigrated} open bottles`)
    console.log(`✅ Migrated ${closedBottlesMigrated} closed bottles\n`)

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 3: Drop old unique index and create new non-unique index
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('📋 Step 3: Updating BarBottle indexes...')
    
    try {
      // Try to drop the old unique index
      const oldIndexName = 'userId_1_branchId_1_inventoryItemId_1_state_1'
      const indexes = await bottlesCollection.indexes()
      const hasOldIndex = indexes.some(idx => idx.name === oldIndexName && idx.unique === true)
      
      if (hasOldIndex) {
        await bottlesCollection.dropIndex(oldIndexName)
        console.log('  ✅ Dropped old unique index')
      } else {
        console.log('  ℹ️  Old unique index not found (may already be migrated)')
      }
    } catch (error: any) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('  ℹ️  Old unique index not found (may already be migrated)')
      } else {
        console.log('  ⚠️  Error dropping old index:', error.message)
      }
    }
    
    try {
      // Create new non-unique compound index
      await bottlesCollection.createIndex(
        { userId: 1, branchId: 1, inventoryItemId: 1, state: 1 },
        { name: 'userId_1_branchId_1_inventoryItemId_1_state_1_new' }
      )
      console.log('  ✅ Created new compound index (non-unique)\n')
    } catch (error: any) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('  ℹ️  Index already exists\n')
      } else {
        throw error
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('═══════════════════════════════════════════════════════════')
    console.log('✅ Migration Complete!')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`📊 Summary:`)
    console.log(`   - Servings migrated: ${servingsMigrated}`)
    console.log(`   - Open bottles migrated: ${openBottlesMigrated}`)
    console.log(`   - Closed bottles migrated: ${closedBottlesMigrated}`)
    console.log(`   - Multi-bottle support: ENABLED`)
    console.log('')
    console.log('⚠️  Next Steps:')
    console.log('   1. Test on staging environment')
    console.log('   2. Verify bottle opening/closing works')
    console.log('   3. Check serving sales functionality')
    console.log('   4. Deploy updated code')
    console.log('═══════════════════════════════════════════════════════════\n')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await mongoose.disconnect()
    console.log('📡 Disconnected from MongoDB')
  }
}

// Run migration
if (require.main === module) {
  migrateBarToFractional()
    .then(() => {
      console.log('✅ Migration script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error)
      process.exit(1)
    })
}

export { migrateBarToFractional }
