/**
 * Script to enable all bar module features for ALL existing tenants
 * Run with: npx tsx scripts/enable-bar-features.ts
 */

import mongoose from 'mongoose'
import { getAdminModels } from '../lib/admin-models'

async function main() {
  try {
    // Connect to admin database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chambu-pos-admin'
    await mongoose.connect(mongoUri)
    console.log('Connected to database')

    const { Tenant } = await getAdminModels()
    const tenants = await Tenant.find({})

    console.log(`Found ${tenants.length} tenants`)

    for (const tenant of tenants) {
      // Enable all bar features
      const updatedFeatures = {
        ...(tenant.features || {}),
        'bar.tabs': true,
        'bar.inventory': true,
        'bar.reports': true,
        'bar.admin': true,
      }

      await Tenant.findByIdAndUpdate(tenant._id, { $set: { features: updatedFeatures } })

      console.log(`✅ Bar features enabled for tenant: ${tenant.subdomain || tenant.shopName}`)
    }

    console.log('\n✅ All tenants updated successfully')
    console.log('Enabled features for all tenants:')
    console.log('  - bar.tabs (Bar Tabs)')
    console.log('  - bar.inventory (Bar Inventory)')
    console.log('  - bar.reports (Bar Reports)')
    console.log('  - bar.admin (Bar Administration)')
    console.log('\nRefresh your dashboard to see the Bar dropdown in the sidebar')

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

main()
