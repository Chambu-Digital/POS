/**
 * One-time migration: backfill branchId + collectedBy on existing customer
 * ledger entries that predate the Step 2 write-path changes.
 *
 * Strategy per entry type:
 *   purchase      — look up sale by saleId, copy sale.branchId + sale.staffId
 *   payment       — collectedBy already set on most; fill branchId from staff.branchId
 *   deposit       — collectedBy already set; fill branchId from staff.branchId
 *   deposit_use   — look up sale by saleId, copy sale.branchId + sale.staffId
 *   deposit_refund — collectedBy already set; fill branchId from staff.branchId
 *   adjustment    — no attribution possible; skip
 *   deposit_return — no attribution possible; skip
 *
 * Run with:
 *   npx tsx scripts/migrate-customer-ledger-branches.ts
 *
 * Safe to re-run — entries that already have branchId are skipped.
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

// ── Counters ──────────────────────────────────────────────────────────────────
interface Stats {
  customers: number
  entries: number
  updated: number
  skipped: number   // already had branchId
  unresolved: number // couldn't resolve — left untouched
}

// ── Per-DB migration ──────────────────────────────────────────────────────────
async function migrateDB(uri: string, label: string): Promise<Stats> {
  const conn = await mongoose.createConnection(uri).asPromise()

  const Customers = conn.collection('customers')
  const Sales     = conn.collection('sales')
  const Staff     = conn.collection('staff')

  // Build a branchId lookup map from staff: staffId → branchId
  const staffDocs = await Staff.find({}, { projection: { _id: 1, branchId: 1 } }).toArray()
  const staffBranchMap = new Map<string, mongoose.Types.ObjectId | null>()
  for (const s of staffDocs) {
    staffBranchMap.set(s._id.toString(), s.branchId || null)
  }

  const stats: Stats = { customers: 0, entries: 0, updated: 0, skipped: 0, unresolved: 0 }

  // Process customers in batches to avoid loading the entire collection
  const cursor = Customers.find({})

  for await (const customer of cursor) {
    if (!Array.isArray(customer.ledger) || customer.ledger.length === 0) continue
    stats.customers++

    let dirty = false

    for (let i = 0; i < customer.ledger.length; i++) {
      const entry = customer.ledger[i]
      stats.entries++

      // Skip if already migrated
      if (entry.branchId) { stats.skipped++; continue }

      const type: string = entry.type || ''

      if (type === 'purchase' || type === 'deposit_use') {
        // Resolve from the linked sale
        if (entry.saleId) {
          const sale = await Sales.findOne(
            { _id: entry.saleId },
            { projection: { branchId: 1, staffId: 1 } }
          )
          if (sale) {
            if (sale.branchId) {
              customer.ledger[i].branchId = sale.branchId
              dirty = true
              stats.updated++
            } else {
              stats.unresolved++
            }
            // Also backfill collectedBy on purchase entries that don't have it
            if (type === 'purchase' && !entry.collectedBy && sale.staffId) {
              customer.ledger[i].collectedBy     = sale.staffId
              customer.ledger[i].collectedByType = 'staff'
              dirty = true
            }
            continue
          }
        }
        stats.unresolved++

      } else if (
        type === 'payment' ||
        type === 'deposit' ||
        type === 'deposit_refund'
      ) {
        // Resolve branchId from the staff member who collected this entry
        const collectedById = entry.collectedBy?.toString()
        if (collectedById) {
          const staffBranch = staffBranchMap.get(collectedById)
          if (staffBranch) {
            customer.ledger[i].branchId = staffBranch
            dirty = true
            stats.updated++
          } else {
            // collectedBy may be the owner (no branchId) or staff without a branch
            stats.unresolved++
          }
        } else {
          stats.unresolved++
        }

      } else {
        // adjustment, deposit_return — no reliable attribution source
        stats.unresolved++
      }
    }

    if (dirty) {
      await Customers.updateOne(
        { _id: customer._id },
        { $set: { ledger: customer.ledger } }
      )
    }
  }

  await conn.close()
  return stats
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const adminUri = process.env.MONGODB_URI
  if (!adminUri) throw new Error('MONGODB_URI not set in .env')

  const adminConn = await mongoose.createConnection(adminUri).asPromise()
  const Tenant = adminConn.collection('tenants')
  const tenants = await Tenant.find({}).toArray()
  await adminConn.close()

  console.log(`\nFound ${tenants.length} tenant(s)\n`)

  let totalUpdated = 0
  let totalUnresolved = 0

  for (const tenant of tenants) {
    if (!tenant.mongoUri) continue
    const label = tenant.subdomain || tenant._id.toString()
    try {
      process.stdout.write(`Migrating ${label}... `)
      const stats = await migrateDB(tenant.mongoUri, label)
      totalUpdated   += stats.updated
      totalUnresolved += stats.unresolved
      console.log(
        `customers: ${stats.customers}, entries: ${stats.entries}, ` +
        `updated: ${stats.updated}, skipped: ${stats.skipped}, unresolved: ${stats.unresolved}`
      )
    } catch (err) {
      console.error(`\nFailed for ${label}:`, err)
    }
  }

  // Also migrate the default/dev DB
  try {
    process.stdout.write('Migrating default-db... ')
    const stats = await migrateDB(adminUri, 'default-db')
    totalUpdated   += stats.updated
    totalUnresolved += stats.unresolved
    console.log(
      `customers: ${stats.customers}, entries: ${stats.entries}, ` +
      `updated: ${stats.updated}, skipped: ${stats.skipped}, unresolved: ${stats.unresolved}`
    )
  } catch (err) {
    console.error('\nFailed for default-db:', err)
  }

  console.log(`\n✅ Migration complete. Updated: ${totalUpdated}, Unresolved: ${totalUnresolved}`)
  console.log('Unresolved entries have no branchId and will be treated as cross-branch in reports.')
}

main().catch(err => { console.error(err); process.exit(1) })
