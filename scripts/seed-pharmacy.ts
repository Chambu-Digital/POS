/**
 * Seed pharmacy inventory with 20 sample drugs and batches
 *
 * Run with:
 *   npx tsx scripts/seed-pharmacy.ts
 *
 * This script will:
 * 1. Create a default branch if none exists
 * 2. Create 20 sample drugs across various categories
 * 3. Create batches for each drug with different expiry dates
 */

import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

const SAMPLE_DRUGS = [
  // Antibiotics
  { genericName: 'Amoxicillin', brandName: 'Amoxil', category: 'Antibiotics', dosageForm: 'Capsule', strength: '500mg', unit: 'Capsule', buyingPrice: 50, sellingPrice: 120, wholesalePrice: 80, requiresPrescription: true, isControlled: false },
  { genericName: 'Azithromycin', brandName: 'Zithromax', category: 'Antibiotics', dosageForm: 'Tablet', strength: '250mg', unit: 'Tablet', buyingPrice: 80, sellingPrice: 180, wholesalePrice: 120, requiresPrescription: true, isControlled: false },
  { genericName: 'Ciprofloxacin', brandName: 'Cipro', category: 'Antibiotics', dosageForm: 'Tablet', strength: '500mg', unit: 'Tablet', buyingPrice: 60, sellingPrice: 150, wholesalePrice: 100, requiresPrescription: true, isControlled: false },
  { genericName: 'Doxycycline', brandName: 'Vibramycin', category: 'Antibiotics', dosageForm: 'Capsule', strength: '100mg', unit: 'Capsule', buyingPrice: 45, sellingPrice: 110, wholesalePrice: 75, requiresPrescription: true, isControlled: false },
  { genericName: 'Metronidazole', brandName: 'Flagyl', category: 'Antibiotics', dosageForm: 'Tablet', strength: '400mg', unit: 'Tablet', buyingPrice: 30, sellingPrice: 80, wholesalePrice: 55, requiresPrescription: true, isControlled: false },
  
  // Analgesics
  { genericName: 'Ibuprofen', brandName: 'Brufen', category: 'Analgesics', dosageForm: 'Tablet', strength: '400mg', unit: 'Tablet', buyingPrice: 20, sellingPrice: 50, wholesalePrice: 35, requiresPrescription: false, isControlled: false },
  { genericName: 'Paracetamol', brandName: 'Panadol', category: 'Analgesics', dosageForm: 'Tablet', strength: '500mg', unit: 'Tablet', buyingPrice: 15, sellingPrice: 40, wholesalePrice: 25, requiresPrescription: false, isControlled: false },
  { genericName: 'Diclofenac', brandName: 'Voltaren', category: 'Analgesics', dosageForm: 'Tablet', strength: '50mg', unit: 'Tablet', buyingPrice: 35, sellingPrice: 90, wholesalePrice: 60, requiresPrescription: true, isControlled: false },
  { genericName: 'Tramadol', brandName: 'Tramal', category: 'Analgesics', dosageForm: 'Capsule', strength: '50mg', unit: 'Capsule', buyingPrice: 100, sellingPrice: 250, wholesalePrice: 180, requiresPrescription: true, isControlled: true },
  { genericName: 'Codeine', brandName: 'Codeine', category: 'Analgesics', dosageForm: 'Tablet', strength: '30mg', unit: 'Tablet', buyingPrice: 80, sellingPrice: 200, wholesalePrice: 150, requiresPrescription: true, isControlled: true },
  
  // Cardiovascular
  { genericName: 'Amlodipine', brandName: 'Norvasc', category: 'Cardiovascular', dosageForm: 'Tablet', strength: '5mg', unit: 'Tablet', buyingPrice: 40, sellingPrice: 100, wholesalePrice: 70, requiresPrescription: true, isControlled: false },
  { genericName: 'Lisinopril', brandName: 'Prinivil', category: 'Cardiovascular', dosageForm: 'Tablet', strength: '10mg', unit: 'Tablet', buyingPrice: 35, sellingPrice: 90, wholesalePrice: 65, requiresPrescription: true, isControlled: false },
  { genericName: 'Atorvastatin', brandName: 'Lipitor', category: 'Cardiovascular', dosageForm: 'Tablet', strength: '20mg', unit: 'Tablet', buyingPrice: 60, sellingPrice: 150, wholesalePrice: 110, requiresPrescription: true, isControlled: false },
  { genericName: 'Aspirin', brandName: 'Aspirin', category: 'Cardiovascular', dosageForm: 'Tablet', strength: '75mg', unit: 'Tablet', buyingPrice: 10, sellingPrice: 30, wholesalePrice: 20, requiresPrescription: false, isControlled: false },
  { genericName: 'Metoprolol', brandName: 'Lopressor', category: 'Cardiovascular', dosageForm: 'Tablet', strength: '50mg', unit: 'Tablet', buyingPrice: 45, sellingPrice: 120, wholesalePrice: 85, requiresPrescription: true, isControlled: false },
  
  // Respiratory
  { genericName: 'Salbutamol', brandName: 'Ventolin', category: 'Respiratory', dosageForm: 'Inhaler', strength: '100mcg', unit: 'piece', buyingPrice: 150, sellingPrice: 350, wholesalePrice: 250, requiresPrescription: true, isControlled: false },
  { genericName: 'Montelukast', brandName: 'Singulair', category: 'Respiratory', dosageForm: 'Tablet', strength: '10mg', unit: 'Tablet', buyingPrice: 70, sellingPrice: 180, wholesalePrice: 130, requiresPrescription: true, isControlled: false },
  { genericName: 'Fexofenadine', brandName: 'Allegra', category: 'Respiratory', dosageForm: 'Tablet', strength: '120mg', unit: 'Tablet', buyingPrice: 40, sellingPrice: 100, wholesalePrice: 70, requiresPrescription: false, isControlled: false },
  { genericName: 'Cetirizine', brandName: 'Zyrtec', category: 'Respiratory', dosageForm: 'Tablet', strength: '10mg', unit: 'Tablet', buyingPrice: 25, sellingPrice: 60, wholesalePrice: 45, requiresPrescription: false, isControlled: false },
  { genericName: 'Prednisone', brandName: 'Deltasone', category: 'Respiratory', dosageForm: 'Tablet', strength: '5mg', unit: 'Tablet', buyingPrice: 30, sellingPrice: 80, wholesalePrice: 55, requiresPrescription: true, isControlled: false },
]

function generateBatchNumber(drugName: string, index: number): string {
  const prefix = drugName.substring(0, 3).toUpperCase()
  const date = new Date().getFullYear().toString().slice(-2)
  return `${prefix}-${date}-${String(index + 1).padStart(3, '0')}`
}

function generateExpiryDate(monthsFromNow: number): Date {
  const date = new Date()
  date.setMonth(date.getMonth() + monthsFromNow)
  return date
}

async function main() {
  const adminUri = process.env.MONGODB_URI
  if (!adminUri) throw new Error('MONGODB_URI not set in .env')

  console.log('Connecting to admin database...')
  const adminConn = await mongoose.createConnection(adminUri).asPromise()
  const Tenants = adminConn.collection('tenants')

  // Get first tenant (or create one for testing)
  let tenant = await Tenants.findOne({})
  if (!tenant) {
    console.log('No tenant found. Creating test tenant...')
    const insertResult = await Tenants.insertOne({
      subdomain: 'test',
      mongoUri: adminUri,
      features: {
        'pharmacy.inventory': true,
        'pharmacy.sales': true,
      },
      createdAt: new Date(),
    })
    tenant = await Tenants.findOne({ _id: insertResult.insertedId })
    console.log('Test tenant created')
  }

  if (!tenant) {
    console.error('Failed to create or find a tenant.')
    await adminConn.close()
    process.exit(1)
  }

  const tenantUri = tenant.mongoUri
  const tenantDbName = `tenant_${tenant._id}`

  console.log(`Connecting to tenant database: ${tenantDbName}`)
  const tenantConn = await mongoose.createConnection(`${tenantUri}/${tenantDbName}`).asPromise()

  const Users = tenantConn.collection('users')
  const Branches = tenantConn.collection('branches')
  const Drugs = tenantConn.collection('drugs')
  const Batches = tenantConn.collection('drug_batches')

  // Get first user (owner)
  const user = await Users.findOne({})
  if (!user) {
    console.error('No user found. Please create a user first.')
    await tenantConn.close()
    await adminConn.close()
    process.exit(1)
  }

  const userId = user._id

  // Create default branch if none exists
  let branch = await Branches.findOne({ userId, isDefault: true })
  if (!branch) {
    console.log('Creating default branch...')
    const insertResult = await Branches.insertOne({
      userId,
      name: 'Main Branch',
      code: 'MAIN',
      address: '123 Main Street',
      phone: '+254700000000',
      status: 'active',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    branch = await Branches.findOne({ _id: insertResult.insertedId })
    console.log('Default branch created')
  }

  if (!branch) {
    console.error('Failed to create or find a branch.')
    await tenantConn.close()
    await adminConn.close()
    process.exit(1)
  }

  const branchId = branch._id

  // Clear existing drugs and batches
  console.log('Clearing existing pharmacy data...')
  await Batches.deleteMany({})
  await Drugs.deleteMany({})
  console.log('Existing data cleared')

  // Create drugs and batches
  console.log('Creating 20 sample drugs...')
  let createdDrugs = 0
  let createdBatches = 0

  for (const drugData of SAMPLE_DRUGS) {
    // Generate SKU
    const sku = `${drugData.category.substring(0, 3).toUpperCase()}-${drugData.genericName.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 1000)}`

    // Create drug
    const drug = await Drugs.insertOne({
      userId,
      branchId,
      ...drugData,
      sku,
      stock: 0, // Will be updated by batches
      reorderLevel: 10,
      status: 'active',
      description: `${drugData.genericName} ${drugData.strength} - ${drugData.dosageForm}`,
      sideEffects: 'Consult your doctor for possible side effects',
      manufacturer: 'Pharma Corp',
      barcode: `DRUG-${Math.floor(Math.random() * 1000000)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create 2-3 batches per drug with different expiry dates
    const batchCount = Math.floor(Math.random() * 2) + 2 // 2-3 batches
    let totalQuantity = 0

    for (let i = 0; i < batchCount; i++) {
      const quantity = Math.floor(Math.random() * 100) + 50 // 50-150 units
      totalQuantity += quantity

      const expiryMonths = Math.floor(Math.random() * 18) + 3 // 3-21 months from now
      const expiryDate = generateExpiryDate(expiryMonths)

      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
      const internalBatchId = `BAT-${dateStr}-${randomStr}`

      await Batches.insertOne({
        userId,
        branchId,
        drugId: drug.insertedId,
        internalBatchId,
        manufacturerLot: generateBatchNumber(drugData.genericName, i),
        invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
        poReference: `PO-${Math.floor(Math.random() * 10000)}`,
        reservedQuantity: 0,
        expiryDate,
        manufactureDate: new Date(),
        quantity,
        initialQuantity: quantity,
        buyingPrice: drugData.buyingPrice,
        sellingPrice: drugData.sellingPrice,
        supplier: 'MedSupply Ltd',
        receivedDate: new Date(),
        status: 'active',
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      createdBatches++
    }

    // Update drug stock
    await Drugs.updateOne({ _id: drug.insertedId }, { $set: { stock: totalQuantity } })

    createdDrugs++
    console.log(`  ✓ ${drugData.genericName} (${drugData.brandName}) - ${totalQuantity} units in ${batchCount} batches`)
  }

  console.log(`\nDone! Created ${createdDrugs} drugs and ${createdBatches} batches`)
  console.log(`Branch: ${branch.name} (${branch.code})`)
  console.log(`User: ${user.email}`)

  await tenantConn.close()
  await adminConn.close()
}

main().catch(err => { console.error(err); process.exit(1) })
