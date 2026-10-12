/**
 * Check Nyamakima product data quality
 */

import mongoose from 'mongoose'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })

const ADMIN_DB_URI = process.env.MONGODB_URI

async function checkProductData() {
  console.log('🔍 Checking Nyamakima product data...\n')
  
  try {
    const adminConn = await mongoose.createConnection(ADMIN_DB_URI!).asPromise()
    const Tenant = adminConn.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants')
    
    const tenant = await Tenant.findOne({ subdomain: 'newnyamakimaelectricals' }).lean() as any
    const tenantConn = await mongoose.createConnection(tenant.mongoUri).asPromise()
    
    const productsCollection = tenantConn.collection('products')
    const products = await productsCollection.find({}).limit(20).toArray()
    
    console.log('📦 Checking first 20 products:\n')
    
    let issuesFound = 0
    
    products.forEach((p: any, i: number) => {
      const issues: string[] = []
      
      if (!p.productName) issues.push('Missing productName')
      if (p.brand === undefined) issues.push('brand field missing')
      if (p.variant === undefined) issues.push('variant field missing')
      if (p.model === undefined) issues.push('model field MISSING')
      if (p.category === undefined) issues.push('category field missing')
      
      if (issues.length > 0) {
        issuesFound++
        console.log(`${i + 1}. ❌ ${p.productName || 'UNNAMED'}`)
        issues.forEach(issue => console.log(`   - ${issue}`))
      } else {
        console.log(`${i + 1}. ✅ ${p.productName}`)
      }
    })
    
    console.log(`\n📊 Issues found in sample: ${issuesFound}/20`)
    
    // Check if model field exists at all
    const withoutModel = await productsCollection.countDocuments({
      model: { $exists: false }
    })
    
    const withNullModel = await productsCollection.countDocuments({
      model: null
    })
    
    const total = await productsCollection.countDocuments({})
    
    console.log(`\n🔍 Model field analysis:`)
    console.log(`   Total products: ${total}`)
    console.log(`   Without model field: ${withoutModel}`)
    console.log(`   With null model: ${withNullModel}`)
    console.log(`   Combined issue: ${withoutModel + withNullModel}/${total}`)
    
    if (withoutModel > 0) {
      console.log(`\n⚠️  ${withoutModel} products are missing the 'model' field entirely!`)
      console.log('   This will crash formatProductName() when it tries to access product.model')
    }
    
    await tenantConn.close()
    await adminConn.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkProductData()
