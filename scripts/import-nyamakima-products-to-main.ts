/**
 * Import all Nyamakima products to Main Branch
 * Creates ProductInventory records for each product
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })

const ADMIN_DB_URI = process.env.MONGODB_URI

async function importProducts() {
  console.log('🚀 Importing Nyamakima products to Main Branch...\n')
  
  try {
    const adminConn = await mongoose.createConnection(ADMIN_DB_URI!).asPromise()
    const Tenant = adminConn.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants')
    
    const tenant = await Tenant.findOne({ subdomain: 'newnyamakimaelectricals' }).lean() as any
    if (!tenant) throw new Error('Tenant not found')
    
    const tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
    console.log(`✅ Connected to: ${tenantConn.name}`)
    
    const User = tenantConn.model('User', new mongoose.Schema({}, { strict: false }))
    const Branch = tenantConn.model('Branch', new mongoose.Schema({}, { strict: false }))
    const ProductInventory = tenantConn.model('ProductInventory', new mongoose.Schema({}, { strict: false }), 'product_inventory')
    
    const user = await User.findOne({}).lean() as any
    const mainBranch = await Branch.findOne({ userId: user._id, code: 'MAIN' }).lean() as any
    
    if (!mainBranch) throw new Error('Main Branch not found')
    
    console.log(`📍 Main Branch: ${mainBranch.name} (${mainBranch._id})`)
    
    // Get all products
    const productsCollection = tenantConn.collection('products')
    const products = await productsCollection.find({ userId: user._id }).toArray()
    
    console.log(`\n📦 Found ${products.length} products`)
    console.log('🔧 Creating ProductInventory records...\n')
    
    let created = 0
    let skipped = 0
    const batchSize = 100
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)
      const inventoryRecords = []
      
      for (const product of batch) {
        // Check if already exists
        const existing = await ProductInventory.findOne({
          userId: user._id,
          branchId: mainBranch._id,
          productId: product._id
        })
        
        if (existing) {
          skipped++
          continue
        }
        
        inventoryRecords.push({
          userId: new mongoose.Types.ObjectId(user._id),
          branchId: new mongoose.Types.ObjectId(mainBranch._id),
          productId: new mongoose.Types.ObjectId(product._id),
          stock: product.stock || 0,
          reserved: 0,
          reorderPoint: product.lowStockThreshold || 10,
          reorderQuantity: 50,
          lastUpdated: new Date(),
        })
      }
      
      if (inventoryRecords.length > 0) {
        await ProductInventory.insertMany(inventoryRecords)
        created += inventoryRecords.length
      }
      
      const progress = Math.min(i + batchSize, products.length)
      console.log(`   Progress: ${progress}/${products.length} (${Math.round(progress/products.length*100)}%)`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Import completed!')
    console.log(`📊 Created: ${created} ProductInventory records`)
    console.log(`⏭️  Skipped: ${skipped} (already existed)`)
    console.log('='.repeat(60))
    console.log('\n✨ All products are now available in Main Branch!')
    
    await tenantConn.close()
    await adminConn.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

importProducts()
