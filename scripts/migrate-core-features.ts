/**
 * Migration: Convert old pos.customers, pos.suppliers, pos.settings, bar.customers
 * to new core.* feature keys in tenant documents and staff permission documents.
 *
 * Run with:
 *   npx tsx scripts/migrate-core-features.ts
 *
 * Safe to run multiple times — only migrates keys that haven't been migrated yet.
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

const CORE_MIGRATION_MAP: Record<string, string> = {
  'pos.customers': 'core.customers',
  'pos.suppliers': 'core.suppliers',
  'pos.settings':  'core.settings',
  'bar.customers': 'core.customers',
}

interface MigrationStats {
  tenantsUpdated: number
  tenantsSkipped: number
  staffUpdated: number
  staffSkipped: number
}

/**
 * Migrates a features/permissions object by replacing old keys with new core.* keys
 */
function migrateCoreKeys(obj: Record<string, boolean>): { 
  updated: Record<string, boolean>
  changed: boolean 
} {
  const updated: Record<string, boolean> = {}
  let changed = false

  for (const [key, value] of Object.entries(obj)) {
    if (key in CORE_MIGRATION_MAP) {
      const newKey = CORE_MIGRATION_MAP[key]
      updated[newKey] = value
      changed = true
      console.log(`    Migrating: ${key} → ${newKey} (${value})`)
    } else {
      updated[key] = value
    }
  }

  return { updated, changed }
}

/**
 * Migrate tenant features in the admin database
 */
async function migrateTenantFeatures(adminConn: mongoose.Connection): Promise<{ updated: number, skipped: number }> {
  console.log('\n📦 Migrating tenant features in admin database...')
  const Tenants = adminConn.collection('tenants')
  
  let updated = 0
  let skipped = 0

  const cursor = Tenants.find({})
  
  for await (const tenant of cursor) {
    const features = tenant.features || {}
    const hasOldKeys = Object.keys(features).some(k => k in CORE_MIGRATION_MAP)
    
    if (!hasOldKeys) {
      skipped++
      continue
    }

    console.log(`\n  Tenant: ${tenant.subdomain} (${tenant.shopName})`)
    const { updated: newFeatures, changed } = migrateCoreKeys(features)
    
    if (changed) {
      await Tenants.updateOne(
        { _id: tenant._id },
        { $set: { features: newFeatures } }
      )
      updated++
      console.log(`  ✓ Updated tenant features`)
    }
  }

  return { updated, skipped }
}

/**
 * Migrate staff permissions in each tenant database
 */
async function migrateStaffPermissions(adminConn: mongoose.Connection): Promise<{ updated: number, skipped: number }> {
  console.log('\n👥 Migrating staff permissions in tenant databases...')
  const Tenants = adminConn.collection('tenants')
  
  let totalUpdated = 0
  let totalSkipped = 0

  const tenantDocs = await Tenants.find({}).toArray()
  
  for (const tenant of tenantDocs) {
    if (!tenant.mongoUri) {
      console.log(`  ⚠ Skipping ${tenant.subdomain}: no mongoUri`)
      continue
    }

    console.log(`\n  Tenant: ${tenant.subdomain}`)
    
    let tenantConn: mongoose.Connection | null = null
    try {
      tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
      const Staff = tenantConn.collection('staff')
      
      const staffDocs = await Staff.find({ permissions: { $exists: true } }).toArray()
      
      if (staffDocs.length === 0) {
        console.log(`    No staff with permissions found`)
        continue
      }

      for (const staff of staffDocs) {
        const permissions = staff.permissions || {}
        const hasOldKeys = Object.keys(permissions).some(k => k in CORE_MIGRATION_MAP)
        
        if (!hasOldKeys) {
          totalSkipped++
          continue
        }

        console.log(`    Staff: ${staff.name} (${staff.email})`)
        const { updated: newPermissions, changed } = migrateCoreKeys(permissions)
        
        if (changed) {
          await Staff.updateOne(
            { _id: staff._id },
            { $set: { permissions: newPermissions } }
          )
          totalUpdated++
          console.log(`    ✓ Updated staff permissions`)
        }
      }
    } catch (error) {
      console.error(`    ✗ Error processing ${tenant.subdomain}:`, error)
    } finally {
      if (tenantConn) {
        await tenantConn.close()
      }
    }
  }

  return { updated: totalUpdated, skipped: totalSkipped }
}

async function main() {
  const adminUri = process.env.MONGODB_URI
  if (!adminUri) {
    throw new Error('MONGODB_URI not set in .env')
  }

  console.log('🚀 Starting core features migration...\n')
  console.log('Migration map:')
  for (const [oldKey, newKey] of Object.entries(CORE_MIGRATION_MAP)) {
    console.log(`  ${oldKey} → ${newKey}`)
  }

  const adminConn = await mongoose.createConnection(adminUri).asPromise()
  
  try {
    // Migrate tenant features
    const tenantStats = await migrateTenantFeatures(adminConn)
    
    // Migrate staff permissions
    const staffStats = await migrateStaffPermissions(adminConn)
    
    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Migration Summary:')
    console.log('='.repeat(60))
    console.log(`Tenant features updated:  ${tenantStats.updated}`)
    console.log(`Tenant features skipped:  ${tenantStats.skipped}`)
    console.log(`Staff permissions updated: ${staffStats.updated}`)
    console.log(`Staff permissions skipped: ${staffStats.skipped}`)
    console.log('='.repeat(60))
    console.log('\n✅ Migration complete!')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await adminConn.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
