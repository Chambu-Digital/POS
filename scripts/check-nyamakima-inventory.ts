/**
 * Check Nyamakima inventory status
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })

const ADMIN_DB_URI = process.env.MONGODB_URI

async function checkInventory() {
  console.log('🔍 Checking Nyamakima inventory...\n')
  
  try {
    const adminConn = await mongoose.createConnection(ADMIN_DB_URI!).asPromise()
    const Tenant = adminConn.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants')
    
    const tenant = await Tenant.findOne({ subdomain: 'newnyamakimaelectricals' }).lean() as any
    if (!tenant) throw new Error('Tenant not found')
    
    const tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
    const User = tenantConn.model('User', new mongoose.Schema({}, { strict: false }))
    const Branch = tenantConn.model('Branch', new mongoose.Schema({}, { strict: false }))
    
    const user = await User.findOne({}).lean() as any
    const branches = await Branch.find({ userId: user._id }).lean() as any[]
    
    console.log('📊 BRANCHES:')
    branches.forEach((b: any) => {
      console.log(`   - ${b.name} (${b.code}) - ID: ${b._id}`)
    })
    
    console.log('\n📦 PRODUCTS:')
    const productsCollection = tenantConn.collection('products')
    const products = await productsCollection.find({ userId: user._id }).limit(5).toArray()
    console.log(`   Total: ${await productsCollection.countDocuments({ userId: user._id })}`)
    products.forEach((p: any) => {
      console.log(`   - ${p.productName}: stock=${p.stock}`)
    })
    
    console.log('\n📦 PRODUCT_INVENTORY (branch-specific):')
    const inventoryCollection = tenantConn.collection('product_inventory')
    const totalInventory = await inventoryCollection.countDocuments({ userId: user._id })
    console.log(`   Total records: ${totalInventory}`)
    
    if (totalInventory === 0) {
      console.log('   ⚠️  NO ProductInventory records found!')
      console.log('   This means products have NOT been imported to any branch yet.')
    } else {
      const inventories = await inventoryCollection.find({ userId: user._id }).limit(10).toArray()
      const byBranch: any = {}
      
      for (const inv of inventories) {
        const branchId = inv.branchId?.toString() || 'null'
        byBranch[branchId] = (byBranch[branchId] || 0) + 1
      }
      
      console.log('   By Branch:')
      for (const [branchId, count] of Object.entries(byBranch)) {
        const branch = branches.find((b: any) => b._id.toString() === branchId)
        console.log(`      ${branch?.name || branchId}: ${count} products`)
      }
      
      console.log('\n   Sample records:')
      for (const inv of inventories.slice(0, 5)) {
        const product = await productsCollection.findOne({ _id: inv.productId })
        const branch = branches.find((b: any) => b._id.toString() === inv.branchId?.toString())
        console.log(`      - ${product?.productName}: ${inv.stock} units in ${branch?.name || 'Unknown'}`)
      }
    }
    
    console.log('\n📊 SALES:')
    const salesCollection = tenantConn.collection('sales')
    const salesCount = await salesCollection.countDocuments({ userId: user._id })
    console.log(`   Total: ${salesCount}`)
    
    const salesByBranch: any = {}
    const allSales = await salesCollection.find({ userId: user._id }).toArray()
    for (const sale of allSales) {
      const branchId = sale.branchId?.toString() || 'null'
      salesByBranch[branchId] = (salesByBranch[branchId] || 0) + 1
    }
    
    console.log('   By Branch:')
    for (const [branchId, count] of Object.entries(salesByBranch)) {
      const branch = branches.find((b: any) => b._id.toString() === branchId)
      console.log(`      ${branch?.name || branchId}: ${count} sales`)
    }
    
    console.log('\n📈 STOCK_LEDGER:')
    const ledgerCollection = tenantConn.collection('stock_ledger')
    const ledgerCount = await ledgerCollection.countDocuments({ userId: user._id })
    console.log(`   Total: ${ledgerCount}`)
    
    await tenantConn.close()
    await adminConn.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkInventory()
