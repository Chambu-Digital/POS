// ─── Migration: Move Product.stock to ProductInventory per-branch ─────────────
// This script migrates existing retail product stock to branch-specific inventory
// Run with: npx tsx scripts/migrate-product-inventory.ts

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

interface Product {
  _id: any
  userId: any
  productName: string
  stock: number
}

interface Branch {
  _id: any
  userId: any
  name: string
  code: string
  isDefault?: boolean
  status: string
}

async function migrateProductInventory() {
  console.log('🔄 Starting Product Inventory Migration...\n')

  try {
    const adminUri = process.env.MONGODB_URI
    if (!adminUri) throw new Error('MONGODB_URI not set in .env')

    // Connect to admin DB
    const adminConn = await mongoose.createConnection(adminUri).asPromise()
    const Tenants = adminConn.collection('tenants')

    // Get all active tenants
    const tenants = await Tenants.find({ isActive: true }).toArray()
    console.log(`📊 Found ${tenants.length} active tenants\n`)

    let totalProcessed = 0
    let totalInventoryCreated = 0

    for (const tenant of tenants) {
      console.log(`\n📦 Processing tenant: ${tenant.name} (${tenant.subdomain})`)
      
      try {
        // Connect to tenant DB
        const tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
        
        const Products = tenantConn.collection('products')
        const Branches = tenantConn.collection('branches')
        const ProductInventory = tenantConn.collection('product_inventory')

        // Get all products with stock
        const products = await Products.find({ stock: { $gt: 0 } }).toArray() as Product[]
        console.log(`  Found ${products.length} products with stock`)

        if (products.length === 0) {
          console.log('  ✓ No products to migrate')
          await tenantConn.close()
          continue
        }

        // Get userId from first product
        const userId = products[0].userId

        // Get all branches for this tenant
        let branches = await Branches.find({ userId, status: 'active' }).toArray() as Branch[]
        console.log(`  Found ${branches.length} active branches`)

        if (branches.length === 0) {
          // No branches - create a default one
          console.log('  ⚠️  No branches found. Creating default branch...')
          
          const defaultBranch = {
            userId,
            name: 'Main Branch',
            code: 'MAIN',
            status: 'active',
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const result = await Branches.insertOne(defaultBranch)
          branches = [{ ...defaultBranch, _id: result.insertedId }]
          console.log('  ✓ Created default branch')
        }

        // Use the default branch or first branch
        const targetBranch = branches.find(b => b.isDefault) || branches[0]
        console.log(`  Using branch: ${targetBranch.name} (${targetBranch.code})`)

        // Migrate each product's stock to ProductInventory
        for (const product of products) {
          // Check if inventory already exists
          const existingInventory = await ProductInventory.findOne({
            userId: product.userId,
            branchId: targetBranch._id,
            productId: product._id,
          })

          if (existingInventory) {
            console.log(`    ⏭️  Inventory already exists for ${product.productName}`)
            continue
          }

          // Create ProductInventory record
          await ProductInventory.insertOne({
            userId: product.userId,
            branchId: targetBranch._id,
            productId: product._id,
            stock: product.stock,
            reserved: 0,
            lastUpdated: new Date(),
            createdAt: new Date(),
          })
          totalInventoryCreated++
        }

        totalProcessed += products.length
        console.log(`  ✓ Migrated ${products.length} products to branch inventory`)
        
        await tenantConn.close()

      } catch (error) {
        console.error(`  ✗ Error processing tenant ${tenant.name}:`, error)
      }
    }

    await adminConn.close()

    console.log(`\n✅ Migration Complete!`)
    console.log(`   Total products processed: ${totalProcessed}`)
    console.log(`   Total inventory records created: ${totalInventoryCreated}`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Run migration
migrateProductInventory()
  .then(() => {
    console.log('\n✅ Migration script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error)
    process.exit(1)
  })

