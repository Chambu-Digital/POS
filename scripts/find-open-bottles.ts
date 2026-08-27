/**
 * Diagnostic: Find all open bottles across all databases
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'

config()

async function findBottles() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not found')
  }

  console.log('Connecting to MongoDB...')
  console.log('URI:', MONGODB_URI.replace(/:[^:]*@/, ':****@'))
  await mongoose.connect(MONGODB_URI)

  // List all databases
  const admin = mongoose.connection.db.admin()
  const { databases } = await admin.listDatabases()
  
  console.log('\n=== All Databases ===')
  databases.forEach(db => console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`))

  // Check each database for bar_bottles collection
  console.log('\n=== Checking for bar_bottles collections ===')
  
  for (const database of databases) {
    if (database.name === 'admin' || database.name === 'local' || database.name === 'config') {
      continue
    }

    const db = mongoose.connection.useDb(database.name)
    const collections = await db.db.listCollections().toArray()
    const hasBarBottles = collections.some(c => c.name === 'bar_bottles')

    if (hasBarBottles) {
      console.log(`\n📦 Database: ${database.name}`)
      const bottlesCollection = db.collection('bar_bottles')
      
      const total = await bottlesCollection.countDocuments()
      const open = await bottlesCollection.countDocuments({ state: 'open' })
      const closed = await bottlesCollection.countDocuments({ state: 'closed' })
      
      console.log(`   Total bottles: ${total}`)
      console.log(`   Open: ${open}`)
      console.log(`   Closed: ${closed}`)

      if (open > 0) {
        console.log(`\n   Open bottles:`)
        const openBottles = await bottlesCollection.find({ state: 'open' }).limit(10).toArray()
        
        for (const bottle of openBottles) {
          const hasV1 = bottle.remainingUnits !== undefined && bottle.remainingUnits !== null
          const hasV2 = bottle.remainingFraction !== undefined && bottle.remainingFraction !== null
          const format = hasV1 && !hasV2 ? 'V1 (broken)' : hasV2 ? `V2 (${bottle.remainingFraction})` : 'Unknown'
          
          console.log(`   - Bottle #${bottle.bottleNumber}: ${format}`)
          console.log(`     remainingUnits: ${bottle.remainingUnits}`)
          console.log(`     remainingFraction: ${bottle.remainingFraction}`)
        }
      }
    }
  }

  await mongoose.disconnect()
}

findBottles().catch(error => {
  console.error('Failed:', error)
  process.exit(1)
})
