/**
 * Migration: Add isSyntheticDirectSale field to BarTab schema
 * 
 * Purpose:
 *   Support V2 unified bottle tracking by marking direct sales that flow
 *   through the tab system for proper bottle tracking, audit logging, and
 *   timeline visibility.
 * 
 * Schema Change:
 *   - Add `isSyntheticDirectSale: boolean` field to BarTab (default: false)
 *   - This field marks tabs created by direct sale endpoints (/api/bar/sale, /api/bar/pos-sale)
 *   - Synthetic tabs can be filtered from tab reports using this field
 * 
 * Benefits:
 *   - ALL serving sales (tab or direct) now track bottles properly
 *   - BarTabLine records created for every serving (with bottleId)
 *   - Unified audit logging via BarAuditLog
 *   - Activity timeline shows all bottle usage
 *   - No schema migration needed for existing data (field defaults to false)
 * 
 * Usage:
 *   npx tsx scripts/add-synthetic-tab-field.ts
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

async function migrate() {
  const MAIN_DB_URI = process.env.DATABASE_URL
  if (!MAIN_DB_URI) {
    throw new Error('DATABASE_URL not found in environment')
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
      const barTabsCollection = tenantDb.collection('bar_tabs')

      // Check if any tabs exist
      const tabCount = await barTabsCollection.countDocuments()
      console.log(`  - Found ${tabCount} bar tabs`)

      if (tabCount > 0) {
        // Add isSyntheticDirectSale field to all existing tabs (default: false)
        const result = await barTabsCollection.updateMany(
          { isSyntheticDirectSale: { $exists: false } },
          { $set: { isSyntheticDirectSale: false } }
        )
        console.log(`  - Updated ${result.modifiedCount} tabs with isSyntheticDirectSale: false`)
      }
    } catch (error) {
      console.error(`  ❌ Error processing tenant ${tenant.name}:`, error)
    }
  }

  console.log('\n✅ Migration completed')
  await mongoose.disconnect()
}

migrate().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
