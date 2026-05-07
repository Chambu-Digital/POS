/**
 * One-time migration: converts old flat staff permission keys to new dotted module keys.
 *
 * Run with:
 *   npx tsx scripts/migrate-permissions.ts
 *
 * Safe to run multiple times — skips records that already use dotted keys.
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

const LEGACY_PERM_MAP: Record<string, string> = {
  canMakeSales:        'pos.sales',
  canViewOrders:       'pos.orders',
  canViewInventory:    'pos.inventory',
  canEditInventory:    'pos.inventory',
  canAddProducts:      'pos.inventory',
  canDeleteProducts:   'pos.inventory',
  canViewSalesReports: 'pos.reports',
  canViewDashboard:    'pos.sales',
  canManageStaff:      'pos.sales',
  canEditSettings:     'pos.sales',
  canProcessRefunds:   'pos.sales',
  canApplyDiscounts:   'pos.sales',
  canDeleteOrders:     'pos.orders',
  canExportData:       'pos.reports',
}

const DEFAULT_NEW_PERMS: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.reports':      false,
  'pos.expenses':     false,
  'kds.display':      false,
  'bar.tabs':         false,
  'rentals.bookings': false,
  'rentals.manage':   false,
}

function migratePerms(old: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = { ...DEFAULT_NEW_PERMS }
  for (const [k, v] of Object.entries(old)) {
    if (k in LEGACY_PERM_MAP) {
      if (v) out[LEGACY_PERM_MAP[k]] = true
    } else {
      out[k] = v
    }
  }
  return out
}

async function migrateDB(uri: string, dbLabel: string) {
  const conn = await mongoose.createConnection(uri).asPromise()
  const Staff = conn.collection('staff')

  const cursor = Staff.find({})
  let updated = 0
  let skipped = 0

  for await (const doc of cursor) {
    const perms = doc.permissions || {}
    const keys = Object.keys(perms)

    // Already migrated if any key contains a dot
    if (keys.some(k => k.includes('.'))) { skipped++; continue }

    const newPerms = migratePerms(perms)
    await Staff.updateOne({ _id: doc._id }, { $set: { permissions: newPerms } })
    updated++
  }

  console.log(`[${dbLabel}] updated: ${updated}, skipped (already migrated): ${skipped}`)
  await conn.close()
}

async function main() {
  const adminUri = process.env.MONGODB_URI
  if (!adminUri) throw new Error('MONGODB_URI not set in .env')

  // Connect to admin DB to get all tenant URIs
  const adminConn = await mongoose.createConnection(adminUri).asPromise()
  const Tenant = adminConn.collection('tenants')
  const tenants = await Tenant.find({}).toArray()
  console.log(`Found ${tenants.length} tenant(s)`)

  for (const tenant of tenants) {
    if (!tenant.mongoUri) continue
    try {
      await migrateDB(tenant.mongoUri, tenant.subdomain || tenant._id.toString())
    } catch (err) {
      console.error(`Failed to migrate tenant ${tenant.subdomain}:`, err)
    }
  }

  // Also migrate the default DB (localhost / single-tenant dev)
  await migrateDB(adminUri, 'default-db')

  await adminConn.close()
  console.log('Migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
