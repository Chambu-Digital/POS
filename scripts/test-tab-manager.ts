/**
 * Test script to directly call TabManager.addLine and see what happens
 * Run with: npx tsx scripts/test-tab-manager.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { TabManager } from '../lib/bar/tab-manager';
import { getModels } from '../lib/tenant/get-models';

config();

async function test() {
  console.log('🧪 Testing TabManager.addLine directly\n');
  console.log('='.repeat(60));

  // Connect to MongoDB
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not found');
  }

  await mongoose.connect(uri);
  const conn = mongoose.connection;
  console.log(`✅ Connected to: ${conn.db?.databaseName}\n`);

  const models = getModels(conn);

  // Step 1: Create a test synthetic tab
  console.log('Step 1: Creating test synthetic tab...');
  const testUserId = '6a5fe17b12981336f9ba2590';  // Your user ID from logs
  
  const tab = await TabManager.createSyntheticDirectSaleTab(
    {
      userId: testUserId,
      branchId: undefined,
      staffId: testUserId,
      customerId: undefined,
      customerName: 'TEST CUSTOMER',
      tableNumber: 'TEST',
      notes: 'Test tab for debugging',
    },
    conn
  );

  const tabId = String((tab as any)._id);
  console.log(`✅ Tab created: ${tabId}\n`);

  // Step 2: Find a valid serving and inventory item
  console.log('Step 2: Finding a serving to add...');
  const serving = await models.BarServing.findOne({ 
    isActive: true,
    userId: testUserId
  }).lean();
  
  if (!serving) {
    console.log('❌ No servings found in database');
    await mongoose.disconnect();
    return;
  }

  console.log(`✅ Found serving: ${serving.name}`);
  console.log(`   inventoryItemId: ${serving.inventoryItemId}`);
  console.log(`   price: ${serving.sellingPrice}\n`);

  // Step 3: Call TabManager.addLine
  console.log('Step 3: Calling TabManager.addLine...');
  try {
    const result = await TabManager.addLine(
      tabId,
      {
        inventoryItemId: String(serving.inventoryItemId),
        servingId: String(serving._id),
        quantity: 1,
        staffId: testUserId,
        itemName: 'Test Item',
        servingName: serving.name,
        unitPrice: serving.sellingPrice,
      },
      conn
    );

    console.log('✅ TabManager.addLine returned successfully');
    console.log(`   TabLine ID: ${(result.tabLine as any)._id}\n`);

    // Step 4: Verify the BarTabLine was actually saved
    console.log('Step 4: Verifying BarTabLine in database...');
    const savedLine = await models.BarTabLine.findById((result.tabLine as any)._id);
    
    if (savedLine) {
      console.log('✅ BarTabLine EXISTS in database!');
      console.log(`   _id: ${savedLine._id}`);
      console.log(`   tabId: ${savedLine.tabId}`);
      console.log(`   lineTotal: ${savedLine.lineTotal}`);
      console.log(`   addedAt: ${savedLine.addedAt}`);
      console.log(`   voided: ${savedLine.voided}\n`);
    } else {
      console.log('❌ BarTabLine NOT FOUND in database!');
      console.log('   The record was returned but not saved!\n');
    }

    // Step 5: Count all BarTabLines
    console.log('Step 5: Counting all BarTabLines...');
    const count = await models.BarTabLine.countDocuments({});
    console.log(`Total BarTabLine records: ${count}\n`);

    // Step 6: Check which database we're actually in
    console.log('Step 6: Database verification...');
    console.log(`Connection database: ${conn.db?.databaseName}`);
    console.log(`Connection string: ${uri.substring(0, 50)}...`);
    
    // Check if BarTabLine collection exists
    const collections = await conn.db?.listCollections().toArray();
    const hasBarTabLines = collections?.some(c => c.name === 'bar_tab_lines');
    console.log(`bar_tab_lines collection exists: ${hasBarTabLines}\n`);

    // Clean up test data
    console.log('Cleaning up test data...');
    await models.BarTabLine.deleteMany({ tabId });
    await models.BarTab.deleteById(tabId);
    await models.BarAuditLog.deleteMany({ referenceId: tabId });
    console.log('✅ Cleanup complete\n');

  } catch (err: any) {
    console.log('❌ TabManager.addLine failed:');
    console.log(`   Error: ${err.message}`);
    console.log(`   Stack: ${err.stack}\n`);
  }

  await mongoose.disconnect();
  console.log('Done!');
}

test().catch(async (err) => {
  console.error('Test failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
