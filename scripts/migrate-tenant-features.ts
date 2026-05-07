/**
 * One-time migration: converts old flat tenant feature keys to new dotted module keys.
 *
 * Run with:
 *   npx tsx scripts/migrate-tenant-features.ts
 *
 * Safe to run multiple times — skips tenants that already use dotted keys.
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

const LEGACY_KEY_MAP: Record<string, string> = {
  pos:            'pos.sales',
  kitchenDisplay: 'kds.display',
  bar:            'bar.tabs',
  rentals:        'rentals.bookings',
  orders:         'pos.orders',
  inventory:      'pos.inventory',
  reports:        'pos.reports',
  expenses:       'pos.expenses',
}

const DEFAULT_NEW_FEATURES: Record<string, boolean> = {
  'pos.sales':        true,
  'pos.orders':       true,
  'pos.inventory':    true,
  'pos.reports':      true,
  'pos.expenses':     true,
  'kds.display':      false,
  'bar.tabs':         false,
  'rentals.bookings': false,
  'rentals.manage':   false,
}

function migrateFeatures(old: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = { ...DEFAULT_NEW_FEATURES }
  for (const [k, v] of Object.entries(old)) {
    if (k in LEGACY_KEY_MAP) {
      out[LEGACY_KEY_MAP[k]] = v
    } else {
      out[k] = v
    }
  }
  return out
}

async function main() {
  const adminUri = process.env.MONGODB_URI
  if (!adminUri) throw new Error('MONGODB_URI not set in .env')

  const conn = await mongoose.createConnection(adminUri).asPromise()
  const Tenants = conn.collection('tenants')

  const cursor = Tenants.find({})
  let updated = 0
  let skipped = 0

  for await (const doc of cursor) {
    const features = doc.features || {}
    const keys = Object.keys(features)

    // Already migrated if any key contains a dot
    if (keys.some(k => k.includes('.'))) { skipped++; continue }

    const newFeatures = migrateFeatures(features)
    await Tenants.updateOne({ _id: doc._id }, { $set: { features: newFeatures } })
    updated++
    console.log(`  ✓ ${doc.subdomain}: migrated`)
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already migrated): ${skipped}`)
  await conn.close()
}

main().catch(err => { console.error(err); process.exit(1) })