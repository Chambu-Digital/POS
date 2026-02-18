/**
 * Migration Script: Fix Data Ownership
 * 
 * This script migrates products and sales from staff members to their admin/owner accounts.
 * Run this once to fix existing data where products/sales were incorrectly tied to staff userIds.
 * 
 * Usage: node scripts/migrate-data-ownership.js
 */

const mongoose = require('mongoose')
require('dotenv').config()

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables')
  process.exit(1)
}

// Define schemas (simplified versions)
const staffSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  email: String,
  role: String,
}, { collection: 'staff' })

const productSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  productName: String,
  category: String,
}, { collection: 'products' })

const saleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  total: Number,
}, { collection: 'sales' })

const Staff = mongoose.models.Staff || mongoose.model('Staff', staffSchema)
const Product = mongoose.models.Product || mongoose.model('Product', productSchema)
const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema)

async function migrateData() {
  try {
    console.log('🔄 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI, {
      family: 4, // Force IPv4
    })
    console.log('✅ Connected to MongoDB\n')

    // Get all staff members
    const staffMembers = await Staff.find({})
    console.log(`📋 Found ${staffMembers.length} staff members\n`)

    if (staffMembers.length === 0) {
      console.log('ℹ️  No staff members found. Nothing to migrate.')
      return
    }

    let totalProductsMigrated = 0
    let totalSalesMigrated = 0

    // For each staff member, migrate their products and sales to their admin
    for (const staff of staffMembers) {
      const staffId = staff._id
      const adminId = staff.userId // This is the owner's userId

      console.log(`\n👤 Processing staff: ${staff.name} (${staff.email})`)
      console.log(`   Staff ID: ${staffId}`)
      console.log(`   Admin ID: ${adminId}`)

      // Migrate products
      const productsResult = await Product.updateMany(
        { userId: staffId },
        { $set: { userId: adminId } }
      )
      console.log(`   📦 Products migrated: ${productsResult.modifiedCount}`)
      totalProductsMigrated += productsResult.modifiedCount

      // Migrate sales (update userId to admin, set staffId to track who made the sale)
      const salesResult = await Sale.updateMany(
        { userId: staffId },
        { 
          $set: { 
            userId: adminId,
            staffId: staffId 
          } 
        }
      )
      console.log(`   💰 Sales migrated: ${salesResult.modifiedCount}`)
      totalSalesMigrated += salesResult.modifiedCount
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ Migration completed successfully!')
    console.log('='.repeat(50))
    console.log(`📦 Total products migrated: ${totalProductsMigrated}`)
    console.log(`💰 Total sales migrated: ${totalSalesMigrated}`)
    console.log('\n💡 All products and sales are now owned by their respective shop owners.')
    console.log('💡 Sales records now include staffId to track which staff member made each sale.')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

// Run the migration
console.log('🚀 Starting data ownership migration...\n')
migrateData()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
