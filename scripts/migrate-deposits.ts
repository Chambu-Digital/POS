/**
 * One-time migration: ensures every existing customer has a `depositBalance`
 * field (defaults to 0) so the customer-deposits feature works on historical data.
 *
 * The depositSchema + customerSchema.depositBalance default already handle NEW
 * documents, but this backfills any customer created before the feature shipped
 * so the end-of-day report's "outstanding deposits" aggregate and the customers
 * page don't read `undefined`.
 *
 * Run with:
 *   npx tsx scripts/migrate-deposits.ts
 *
 * Safe to run multiple times — only sets the field where it is missing or null.
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

async function migrateDB(uri: string, dbLabel: string) {
  const conn = await mongoose.createConnection(uri).asPromise()
  const Customer = conn.collection('customers')

  // Backfill depositBalance only where it is missing or null. Using $set with
  // a $or-style match via $exists:false OR null keeps the op idempotent.
  const result = await Customer.updateMany(
    { $or: [{ depositBalance: { $exists: false } }, { depositBalance: null }] },
    { $set: { depositBalance: 0 } }
  )

  // Also create the deposit indexes if the deposits collection doesn't exist yet.
  // Mongoose normally creates indexes on first model use, but we ensure the
  // unique receiptNo index exists here too so two cashiers can't race a duplicate.
  try {
    const deposits = conn.collection('deposits')
    await deposits.createIndex({ userId: 1, createdAt: -1 })
    await deposits.createIndex({ userId: 1, customerId: 1, status: 1, createdAt: -1 })
    await deposits.createIndex({ userId: 1, branchId: 1, status: 1, createdAt: -1 })
    await deposits.createIndex(
      { userId: 1, receiptNo: 1 },
      { unique: true }
    )
    // Customer deposit-balance lookup index
    await Customer.createIndex({ userId: 1, depositBalance: 1 })
  } catch (indexErr) {
    // Non-fatal — indexes may already exist
    console.warn(`[${dbLabel}] index creation skipped:`, (indexErr as Error).message)
  }

  console.log(`[${dbLabel}] customers backfilled: ${result.modifiedCount}`)
  await conn.close()
}

async function main() {
  const adminUri = process.env.MONGODB_URI
  if (!adminUri) throw new Error('MONGODB_URI not set in .env')

  // Connect to admin DB to enumerate tenant URIs
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
  console.log('Deposit migration complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
