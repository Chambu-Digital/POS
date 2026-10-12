import mongoose from 'mongoose'

/**
 * Query script for Wonder shops tenant
 * Run with: npx ts-node scripts/query-wonder-shops.ts
 */

const WONDER_SHOPS_URI = 'mongodb://jayjeremy2000:chambupos@ac-hyykgmq-shard-00-02.u8o9dcg.mongodb.net:27017/?ssl=true&replicaSet=atlas-xuf6tr-shard-0&authSource=admin&appName=chambupos'

const CONN_OPTIONS: mongoose.ConnectOptions = {
  family: 4,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 5,
  minPoolSize: 1,
}

async function queryWonderShops() {
  let conn: mongoose.Connection | null = null

  try {
    console.log('🔌 Connecting to Wonder shops tenant database...')
    conn = await mongoose.createConnection(WONDER_SHOPS_URI, CONN_OPTIONS).asPromise()
    console.log('✅ Connected successfully\n')

    // ─── Query User collection ──────────────────────────────────────────────
    console.log('📊 USERS COLLECTION')
    console.log('─'.repeat(60))

    const userCollection = conn.collection('users')
    const userCount = await userCollection.countDocuments()
    console.log(`Total Users: ${userCount}\n`)

    const users = await userCollection
      .find({}, { projection: { email: 1, _id: 1 } })
      .toArray()

    console.log('Users with email addresses:')
    users.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.email || '(no email)'} (ID: ${user._id})`)
    })

    // ─── Query Staff collection ─────────────────────────────────────────────
    console.log('\n📊 STAFF COLLECTION')
    console.log('─'.repeat(60))

    const staffCollection = conn.collection('staff')
    const staffDoc = await staffCollection.findOne({ email: 'jeremy@gmail.com' })

    if (staffDoc) {
      console.log('✅ Found staff record for jeremy@gmail.com:')
      console.log('\nFull Record:')
      console.log(JSON.stringify(staffDoc, null, 2))

      if (staffDoc.managerOfBranches) {
        console.log('\n📌 managerOfBranches:')
        console.log(JSON.stringify(staffDoc.managerOfBranches, null, 2))
      }
    } else {
      console.log('❌ No staff record found for jeremy@gmail.com')
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    if (conn) {
      await conn.close()
      console.log('\n🔌 Connection closed')
    }
  }
}

queryWonderShops()
