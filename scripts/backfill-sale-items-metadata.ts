/**
 * Migration Script: Backfill Brand, Model, and Variant for Sale Items
 * 
 * This script updates existing sale records that are missing brand, model, 
 * and variant information in their items array. It looks up this data from 
 * the referenced products collection.
 * 
 * Usage:
 *   npx tsx scripts/backfill-sale-items-metadata.ts
 * 
 * Or for a specific tenant:
 *   TENANT_ID=your_tenant_id npx tsx scripts/backfill-sale-items-metadata.ts
 */

import mongoose from 'mongoose'
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function backfillSaleItemsMetadata() {
  const tenantId = process.env.TENANT_ID
  
  if (!tenantId) {
    console.error('❌ Error: TENANT_ID environment variable is required')
    console.log('Usage: TENANT_ID=your_tenant_id npx tsx scripts/backfill-sale-items-metadata.ts')
    process.exit(1)
  }

  const dbHost = process.env.DB_HOST || 'localhost'
  const dbPort = process.env.DB_PORT || '27017'
  const dbName = `tenant_${tenantId}`
  const connectionString = process.env.DATABASE_URL || `mongodb://${dbHost}:${dbPort}/${dbName}`

  console.log(`\n📊 Sale Items Metadata Backfill Script`)
  console.log(`=====================================`)
  console.log(`Tenant ID: ${tenantId}`)
  console.log(`Database: ${dbName}`)
  console.log(`Connection: ${connectionString.replace(/\/\/.*@/, '//***:***@')}\n`)

  try {
    // Connect to database
    console.log('🔌 Connecting to database...')
    await mongoose.connect(connectionString)
    console.log('✅ Connected successfully\n')

    const db = mongoose.connection.db
    const salesCollection = db.collection('sales')
    const productsCollection = db.collection('products')

    // Find sales with items missing brand/model/variant
    console.log('🔍 Analyzing sales records...')
    const salesToUpdate = await salesCollection.find({
      'items.0': { $exists: true }, // Has items
      $or: [
        { 'items.brand': { $exists: false } },
        { 'items.model': { $exists: false } },
        { 'items.variant': { $exists: false } },
      ]
    }).toArray()

    console.log(`📦 Found ${salesToUpdate.length} sales that need updating\n`)

    if (salesToUpdate.length === 0) {
      console.log('✨ All sales already have complete metadata. Nothing to do!')
      await mongoose.disconnect()
      rl.close()
      return
    }

    // Show sample of what will be updated
    console.log('Sample of sales to be updated:')
    salesToUpdate.slice(0, 5).forEach((sale: any, idx: number) => {
      const orderNum = sale.orderNumber || `SALE-${sale._id.toString().slice(-8).toUpperCase()}`
      const itemCount = sale.items?.length || 0
      const date = new Date(sale.createdAt).toLocaleDateString()
      console.log(`  ${idx + 1}. ${orderNum} - ${itemCount} items - ${date}`)
    })
    if (salesToUpdate.length > 5) {
      console.log(`  ... and ${salesToUpdate.length - 5} more`)
    }
    console.log()

    const answer = await question('Do you want to proceed with the migration? (yes/no): ')
    
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('\n❌ Migration cancelled by user')
      await mongoose.disconnect()
      rl.close()
      return
    }

    console.log('\n🚀 Starting migration...\n')

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const sale of salesToUpdate) {
      try {
        const orderNum = sale.orderNumber || `SALE-${sale._id.toString().slice(-8).toUpperCase()}`
        
        // Collect unique product IDs from items that need updating
        const productIdsToLookup = new Set<string>()
        sale.items?.forEach((item: any) => {
          if (item.productId && (!item.brand || !item.model || !item.variant)) {
            productIdsToLookup.add(item.productId.toString())
          }
        })

        if (productIdsToLookup.size === 0) {
          console.log(`⏭️  Skipping ${orderNum} - no items need updating`)
          skippedCount++
          continue
        }

        // Fetch product metadata
        const products = await productsCollection
          .find({ 
            _id: { 
              $in: Array.from(productIdsToLookup).map(id => new mongoose.Types.ObjectId(id)) 
            } 
          })
          .project({ _id: 1, brand: 1, model: 1, variant: 1 })
          .toArray()

        const productMap = new Map()
        products.forEach((p: any) => {
          productMap.set(p._id.toString(), {
            brand: p.brand || '',
            model: p.model || '',
            variant: p.variant || '',
          })
        })

        // Update items
        let itemsUpdated = 0
        const updatedItems = sale.items.map((item: any) => {
          if (item.productId && (!item.brand || !item.model || !item.variant)) {
            const productInfo = productMap.get(item.productId.toString())
            if (productInfo) {
              itemsUpdated++
              return {
                ...item,
                brand: item.brand || productInfo.brand,
                model: item.model || productInfo.model,
                variant: item.variant || productInfo.variant,
              }
            }
          }
          return item
        })

        // Update the sale record
        if (itemsUpdated > 0) {
          await salesCollection.updateOne(
            { _id: sale._id },
            { $set: { items: updatedItems } }
          )
          console.log(`✅ Updated ${orderNum} - ${itemsUpdated} items enriched`)
          updatedCount++
        } else {
          console.log(`⚠️  ${orderNum} - Products not found in database`)
          skippedCount++
        }

      } catch (error) {
        console.error(`❌ Error updating sale ${sale._id}:`, error)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 Migration Summary')
    console.log('='.repeat(50))
    console.log(`✅ Successfully updated: ${updatedCount}`)
    console.log(`⏭️  Skipped: ${skippedCount}`)
    console.log(`❌ Errors: ${errorCount}`)
    console.log(`📦 Total processed: ${salesToUpdate.length}`)
    console.log('='.repeat(50) + '\n')

    if (updatedCount > 0) {
      console.log('✨ Migration completed successfully!')
    } else {
      console.log('⚠️  No records were updated')
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await mongoose.disconnect()
    rl.close()
    console.log('\n🔌 Disconnected from database')
  }
}

// Run the migration
backfillSaleItemsMetadata()
  .then(() => {
    console.log('\n👋 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
