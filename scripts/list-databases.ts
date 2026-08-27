// List all databases in MongoDB
import * as dotenv from 'dotenv'
import * as path from 'path'
import mongoose from 'mongoose'

dotenv.config({ path: path.join(process.cwd(), '.env') })

async function listDatabases() {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      console.error('❌ MONGODB_URI not set')
      process.exit(1)
    }

    console.log('Connecting to MongoDB...')
    await mongoose.connect(uri)

    // List all databases
    const admin = mongoose.connection.db.admin()
    const { databases } = await admin.listDatabases()

    console.log('\n========== DATABASES ==========\n')
    for (const db of databases) {
      console.log(`📁 ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`)
    }

    // Check jaywines specifically
    console.log('\n========== CHECKING JAYWINES ==========\n')
    const jayWinesDb = mongoose.connection.client.db('jaywines')
    const collections = await jayWinesDb.listCollections().toArray()
    
    console.log(`Found ${collections.length} collection(s) in jaywines:`)
    for (const coll of collections) {
      const count = await jayWinesDb.collection(coll.name).countDocuments()
      console.log(`  - ${coll.name}: ${count} document(s)`)
    }

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

listDatabases()
