/**
 * List all users in the database
 * Usage: node scripts/list-users.js
 */

const mongoose = require('mongoose')
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables')
  process.exit(1)
}

const userSchema = new mongoose.Schema({
  email: String,
  shopName: String,
  role: String,
  createdAt: Date,
}, { collection: 'users' })

const User = mongoose.models.User || mongoose.model('User', userSchema)

async function listUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI, {
      family: 4,
    })
    console.log('✅ Connected to MongoDB\n')

    const users = await User.find({}).select('email shopName role createdAt')
    
    console.log(`📋 Found ${users.length} user(s):\n`)
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`)
      console.log(`   Shop: ${user.shopName}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Created: ${user.createdAt}`)
      console.log(`   ID: ${user._id}`)
      console.log('')
    })

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

listUsers()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
