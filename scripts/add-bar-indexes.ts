/**
 * Add Database Indexes for Bar Module Performance
 * 
 * This script adds indexes to optimize bar inventory queries:
 * 1. BarBottle: (inventoryItemId, state) - for counting open bottles
 * 2. BarTabLine: (userId, addedAt, voided, servingId) - for reports
 * 3. BarServing: (inventoryItemId, isActive) - for serving counts
 * 
 * Usage:
 *   tsx scripts/add-bar-indexes.ts <tenantId>
 *   tsx scripts/add-bar-indexes.ts --all
 */

import { connectDB } from '@/lib/db'
import { getTenantModels } from '@/lib/tenant/get-models'
import { Schema } from 'mongoose'

interface IndexResult {
  tenantId: string
  tenantName: string
  indexes: {
    collection: string
    indexName: string
    fields: Record<string, number>
    created: boolean
    error?: string
  }[]
}

async function addIndexesForTenant(tenantId: string, tenantName: string): Promise<IndexResult> {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Adding Indexes for: ${tenantName} (${tenantId})`)
  console.log('='.repeat(80))
  
  const models = await getTenantModels(tenantId)
  const results: IndexResult['indexes'] = []
  
  // ==================== INDEX 1: BarBottle (inventoryItemId, state) ====================
  console.log('\n[1/5] Creating index on BarBottle (inventoryItemId, state)...')
  try {
    await models.BarBottle.collection.createIndex(
      { inventoryItemId: 1, state: 1 },
      { name: 'inventoryItemId_1_state_1' }
    )
    results.push({
      collection: 'BarBottle',
      indexName: 'inventoryItemId_1_state_1',
      fields: { inventoryItemId: 1, state: 1 },
      created: true
    })
    console.log('  ✅ Index created successfully')
  } catch (error: any) {
    if (error.code === 85 || error.message?.includes('already exists')) {
      results.push({
        collection: 'BarBottle',
        indexName: 'inventoryItemId_1_state_1',
        fields: { inventoryItemId: 1, state: 1 },
        created: false
      })
      console.log('  ℹ️  Index already exists')
    } else {
      results.push({
        collection: 'BarBottle',
        indexName: 'inventoryItemId_1_state_1',
        fields: { inventoryItemId: 1, state: 1 },
        created: false,
        error: error.message
      })
      console.log(`  ❌ Failed: ${error.message}`)
    }
  }
  
  // ==================== INDEX 2: BarTabLine (userId, addedAt, voided) ====================
  console.log('\n[2/5] Creating index on BarTabLine (userId, addedAt, voided)...')
  try {
    await models.BarTabLine.collection.createIndex(
      { userId: 1, addedAt: -1, voided: 1 },
      { name: 'userId_1_addedAt_-1_voided_1' }
    )
    results.push({
      collection: 'BarTabLine',
      indexName: 'userId_1_addedAt_-1_voided_1',
      fields: { userId: 1, addedAt: -1, voided: 1 },
      created: true
    })
    console.log('  ✅ Index created successfully')
  } catch (error: any) {
    if (error.code === 85 || error.message?.includes('already exists')) {
      results.push({
        collection: 'BarTabLine',
        indexName: 'userId_1_addedAt_-1_voided_1',
        fields: { userId: 1, addedAt: -1, voided: 1 },
        created: false
      })
      console.log('  ℹ️  Index already exists')
    } else {
      results.push({
        collection: 'BarTabLine',
        indexName: 'userId_1_addedAt_-1_voided_1',
        fields: { userId: 1, addedAt: -1, voided: 1 },
        created: false,
        error: error.message
      })
      console.log(`  ❌ Failed: ${error.message}`)
    }
  }
  
  // ==================== INDEX 3: BarTabLine (servingId, bottleId) ====================
  console.log('\n[3/5] Creating index on BarTabLine (servingId, bottleId)...')
  try {
    await models.BarTabLine.collection.createIndex(
      { servingId: 1, bottleId: 1 },
      { name: 'servingId_1_bottleId_1' }
    )
    results.push({
      collection: 'BarTabLine',
      indexName: 'servingId_1_bottleId_1',
      fields: { servingId: 1, bottleId: 1 },
      created: true
    })
    console.log('  ✅ Index created successfully')
  } catch (error: any) {
    if (error.code === 85 || error.message?.includes('already exists')) {
      results.push({
        collection: 'BarTabLine',
        indexName: 'servingId_1_bottleId_1',
        fields: { servingId: 1, bottleId: 1 },
        created: false
      })
      console.log('  ℹ️  Index already exists')
    } else {
      results.push({
        collection: 'BarTabLine',
        indexName: 'servingId_1_bottleId_1',
        fields: { servingId: 1, bottleId: 1 },
        created: false,
        error: error.message
      })
      console.log(`  ❌ Failed: ${error.message}`)
    }
  }
  
  // ==================== INDEX 4: BarServing (inventoryItemId, isActive) ====================
  console.log('\n[4/5] Creating index on BarServing (inventoryItemId, isActive)...')
  try {
    await models.BarServing.collection.createIndex(
      { inventoryItemId: 1, isActive: 1 },
      { name: 'inventoryItemId_1_isActive_1' }
    )
    results.push({
      collection: 'BarServing',
      indexName: 'inventoryItemId_1_isActive_1',
      fields: { inventoryItemId: 1, isActive: 1 },
      created: true
    })
    console.log('  ✅ Index created successfully')
  } catch (error: any) {
    if (error.code === 85 || error.message?.includes('already exists')) {
      results.push({
        collection: 'BarServing',
        indexName: 'inventoryItemId_1_isActive_1',
        fields: { inventoryItemId: 1, isActive: 1 },
        created: false
      })
      console.log('  ℹ️  Index already exists')
    } else {
      results.push({
        collection: 'BarServing',
        indexName: 'inventoryItemId_1_isActive_1',
        fields: { inventoryItemId: 1, isActive: 1 },
        created: false,
        error: error.message
      })
      console.log(`  ❌ Failed: ${error.message}`)
    }
  }
  
  // ==================== INDEX 5: BarInventoryItem (userId, isActive, stock) ====================
  console.log('\n[5/5] Creating index on BarInventoryItem (userId, isActive, stock)...')
  try {
    await models.BarInventoryItem.collection.createIndex(
      { userId: 1, isActive: 1, stock: 1 },
      { name: 'userId_1_isActive_1_stock_1' }
    )
    results.push({
      collection: 'BarInventoryItem',
      indexName: 'userId_1_isActive_1_stock_1',
      fields: { userId: 1, isActive: 1, stock: 1 },
      created: true
    })
    console.log('  ✅ Index created successfully')
  } catch (error: any) {
    if (error.code === 85 || error.message?.includes('already exists')) {
      results.push({
        collection: 'BarInventoryItem',
        indexName: 'userId_1_isActive_1_stock_1',
        fields: { userId: 1, isActive: 1, stock: 1 },
        created: false
      })
      console.log('  ℹ️  Index already exists')
    } else {
      results.push({
        collection: 'BarInventoryItem',
        indexName: 'userId_1_isActive_1_stock_1',
        fields: { userId: 1, isActive: 1, stock: 1 },
        created: false,
        error: error.message
      })
      console.log(`  ❌ Failed: ${error.message}`)
    }
  }
  
  return {
    tenantId,
    tenantName,
    indexes: results
  }
}

async function main() {
  const args = process.argv.slice(2)
  const addAll = args.includes('--all')
  const tenantIdArg = args.find(arg => !arg.startsWith('--'))
  
  if (!addAll && !tenantIdArg) {
    console.error('Usage: tsx scripts/add-bar-indexes.ts <tenantId> OR tsx scripts/add-bar-indexes.ts --all')
    process.exit(1)
  }
  
  await connectDB()
  
  // Import Tenant model
  const mongoose = await import('mongoose')
  const TenantSchema = new mongoose.Schema({
    name: String,
    subdomain: String,
    dbName: String,
  })
  const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema)
  
  let results: IndexResult[] = []
  
  if (addAll) {
    console.log('Adding indexes for all tenants...\n')
    const tenants = await Tenant.find({}).lean()
    
    for (const tenant of tenants as any[]) {
      try {
        const result = await addIndexesForTenant(String(tenant._id), tenant.name)
        results.push(result)
      } catch (error) {
        console.error(`Failed to add indexes for tenant ${tenant.name}:`, error)
      }
    }
  } else if (tenantIdArg) {
    const tenant = await Tenant.findById(tenantIdArg).lean() as any
    if (!tenant) {
      console.error(`Tenant with ID ${tenantIdArg} not found`)
      process.exit(1)
    }
    const result = await addIndexesForTenant(String(tenant._id), tenant.name)
    results.push(result)
  }
  
  // ==================== SUMMARY ====================
  console.log(`\n\n${'='.repeat(80)}`)
  console.log('SUMMARY')
  console.log('='.repeat(80))
  
  for (const result of results) {
    const created = result.indexes.filter(i => i.created).length
    const existing = result.indexes.filter(i => !i.created && !i.error).length
    const failed = result.indexes.filter(i => i.error).length
    
    console.log(`\n${result.tenantName} (${result.tenantId})`)
    console.log(`  ✅ Created: ${created}`)
    console.log(`  ℹ️  Already existed: ${existing}`)
    if (failed > 0) {
      console.log(`  ❌ Failed: ${failed}`)
      result.indexes.filter(i => i.error).forEach(i => {
        console.log(`     - ${i.collection}.${i.indexName}: ${i.error}`)
      })
    }
  }
  
  console.log('\n💡 These indexes will improve query performance for:')
  console.log('   - Counting open bottles per inventory item')
  console.log('   - Generating serving sales reports')
  console.log('   - Filtering low stock / out of stock items')
  console.log('   - Aggregating tab lines by date range')
  
  process.exit(0)
}

main().catch((error) => {
  console.error('Index creation script failed:', error)
  process.exit(1)
})
