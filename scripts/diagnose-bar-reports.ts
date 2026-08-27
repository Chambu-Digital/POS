/**
 * Diagnostic script to investigate why bar reports show KES 0
 * Run with: npx tsx scripts/diagnose-bar-reports.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

async function diagnose() {
  console.log('🔍 Bar Reports Diagnostic Tool\n');
  console.log('=' .repeat(60));

  // Connect to MongoDB
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not found in .env');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  
  console.log('\n✅ Connected to database: jaywines\n');

  // Test 1: Check the specific synthetic tab from logs
  console.log('TEST 1: Checking synthetic tab from your logs');
  console.log('-'.repeat(60));
  const syntheticTabId = '6a901c90cadad8599ba253f8';
  
  try {
    const tabLines = await db.collection('bar_tab_lines').find({
      tabId: new mongoose.Types.ObjectId(syntheticTabId)
    }).toArray();

    console.log(`Found ${tabLines.length} BarTabLine records for tab ${syntheticTabId}`);
    
    if (tabLines.length > 0) {
      tabLines.forEach((line, idx) => {
        console.log(`\nLine ${idx + 1}:`);
        console.log(`  _id: ${line._id}`);
        console.log(`  tabId: ${line.tabId}`);
        console.log(`  userId: ${line.userId}`);
        console.log(`  lineTotal: KES ${line.lineTotal}`);
        console.log(`  addedAt: ${line.addedAt}`);
        console.log(`  voided: ${line.voided}`);
        console.log(`  productName: ${line.productName || 'N/A'}`);
        console.log(`  servingName: ${line.servingName || 'N/A'}`);
      });
    } else {
      console.log('❌ NO RECORDS FOUND - This is the problem!');
    }
  } catch (err) {
    console.log('⚠️  Tab not found or ID invalid');
  }

  // Test 2: Check the tab itself
  console.log('\n\nTEST 2: Checking the synthetic tab record');
  console.log('-'.repeat(60));
  
  try {
    const tab = await db.collection('bar_tabs').findOne({
      _id: new mongoose.Types.ObjectId(syntheticTabId)
    });

    if (tab) {
      console.log('Tab found:');
      console.log(`  _id: ${tab._id}`);
      console.log(`  status: ${tab.status}`);
      console.log(`  type: ${tab.type || 'N/A'}`);
      console.log(`  isSynthetic: ${tab.isSynthetic || false}`);
      console.log(`  userId: ${tab.userId}`);
      console.log(`  createdAt: ${tab.createdAt}`);
      console.log(`  closedAt: ${tab.closedAt || 'N/A'}`);
      console.log(`  total: KES ${tab.total || 0}`);
    } else {
      console.log('❌ Tab not found');
    }
  } catch (err) {
    console.log('⚠️  Error fetching tab');
  }

  // Test 3: Count ALL BarTabLines (any status)
  console.log('\n\nTEST 3: Counting ALL BarTabLine records');
  console.log('-'.repeat(60));
  
  const totalLines = await db.collection('bar_tab_lines').countDocuments({});
  const nonVoidedLines = await db.collection('bar_tab_lines').countDocuments({ voided: false });
  const voidedLines = await db.collection('bar_tab_lines').countDocuments({ voided: true });
  
  console.log(`Total BarTabLine records: ${totalLines}`);
  console.log(`  Non-voided: ${nonVoidedLines}`);
  console.log(`  Voided: ${voidedLines}`);

  // Test 4: Check recent BarTabLines (last 7 days)
  console.log('\n\nTEST 4: Recent BarTabLine records (last 7 days)');
  console.log('-'.repeat(60));
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentLines = await db.collection('bar_tab_lines').find({
    addedAt: { $gte: sevenDaysAgo }
  }).sort({ addedAt: -1 }).limit(10).toArray();
  
  console.log(`Found ${recentLines.length} records in last 7 days`);
  
  if (recentLines.length > 0) {
    recentLines.forEach((line, idx) => {
      console.log(`\n${idx + 1}. ${line.productName || 'Unknown'} - ${line.servingName || 'N/A'}`);
      console.log(`   Total: KES ${line.lineTotal}, Added: ${line.addedAt}`);
      console.log(`   Voided: ${line.voided}, TabId: ${line.tabId}`);
    });
  } else {
    console.log('❌ NO RECENT RECORDS - This is the problem!');
  }

  // Test 5: Calculate total revenue (unfiltered)
  console.log('\n\nTEST 5: Total revenue calculation (ALL non-voided records)');
  console.log('-'.repeat(60));
  
  const revenueAgg = await db.collection('bar_tab_lines').aggregate([
    { $match: { voided: false } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$lineTotal' },
        totalSales: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    }
  ]).toArray();
  
  if (revenueAgg.length > 0) {
    const stats = revenueAgg[0];
    console.log(`Total Revenue (all time): KES ${stats.totalRevenue}`);
    console.log(`Total Sales Count: ${stats.totalSales}`);
    console.log(`Unique Users: ${stats.uniqueUsers.length}`);
  } else {
    console.log('❌ NO REVENUE DATA - No records exist at all');
  }

  // Test 6: Date range analysis
  console.log('\n\nTEST 6: Date range analysis');
  console.log('-'.repeat(60));
  
  const dateRangeAgg = await db.collection('bar_tab_lines').aggregate([
    { $match: { voided: false } },
    {
      $group: {
        _id: null,
        oldestSale: { $min: '$addedAt' },
        newestSale: { $max: '$addedAt' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  if (dateRangeAgg.length > 0) {
    const range = dateRangeAgg[0];
    console.log(`Date range of sales:`);
    console.log(`  Oldest: ${range.oldestSale}`);
    console.log(`  Newest: ${range.newestSale}`);
    console.log(`  Total records: ${range.count}`);
  } else {
    console.log('No date range data (no records)');
  }

  // Test 7: Check today's sales specifically
  console.log('\n\nTEST 7: Today\'s sales (2026-08-27)');
  console.log('-'.repeat(60));
  
  const todayStart = new Date('2026-08-27T00:00:00Z');
  const todayEnd = new Date('2026-08-28T00:00:00Z');
  
  const todayLines = await db.collection('bar_tab_lines').find({
    voided: false,
    addedAt: { $gte: todayStart, $lt: todayEnd }
  }).toArray();
  
  console.log(`Found ${todayLines.length} sales today (UTC)`);
  
  if (todayLines.length > 0) {
    let todayTotal = 0;
    todayLines.forEach((line, idx) => {
      todayTotal += line.lineTotal || 0;
      console.log(`${idx + 1}. KES ${line.lineTotal} at ${line.addedAt}`);
    });
    console.log(`\nToday's Total Revenue: KES ${todayTotal}`);
  } else {
    console.log('❌ NO SALES TODAY');
    console.log('\n💡 Possible reasons:');
    console.log('   - Sales are in a different date (timezone issue)');
    console.log('   - BarTabLine records not created');
    console.log('   - Records marked as voided');
  }

  // Test 8: Check user ID match
  console.log('\n\nTEST 8: User ID analysis');
  console.log('-'.repeat(60));
  
  const expectedUserId = '6a5fe17b12981336f9ba2590';
  
  const userLines = await db.collection('bar_tab_lines').countDocuments({
    userId: new mongoose.Types.ObjectId(expectedUserId),
    voided: false
  });
  
  console.log(`Records for user ${expectedUserId}: ${userLines}`);
  
  const allUserIds = await db.collection('bar_tab_lines').distinct('userId');
  console.log(`\nAll unique user IDs in bar_tab_lines: ${allUserIds.length}`);
  allUserIds.slice(0, 5).forEach(id => console.log(`  - ${id}`));

  // Test 9: Check for synthetic tab filtering
  console.log('\n\nTEST 9: Synthetic vs Regular tabs');
  console.log('-'.repeat(60));
  
  const allTabs = await db.collection('bar_tabs').countDocuments({});
  const syntheticTabs = await db.collection('bar_tabs').countDocuments({ isSynthetic: true });
  const regularTabs = await db.collection('bar_tabs').countDocuments({ 
    $or: [
      { isSynthetic: false },
      { isSynthetic: { $exists: false } }
    ]
  });
  
  console.log(`Total tabs: ${allTabs}`);
  console.log(`  Synthetic: ${syntheticTabs}`);
  console.log(`  Regular: ${regularTabs}`);

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  
  if (nonVoidedLines === 0) {
    console.log('\n🔴 CRITICAL: No BarTabLine records exist at all!');
    console.log('   Problem: TabManager.addLine() is not creating records');
    console.log('   OR: Records are being deleted after creation');
  } else if (todayLines.length === 0 && nonVoidedLines > 0) {
    console.log('\n🟡 WARNING: Records exist but not for today');
    console.log('   Problem: Date filtering or timezone issue');
    console.log('   Action: Check if sales have wrong timestamp');
  } else if (todayLines.length > 0) {
    console.log('\n🟢 SUCCESS: Today\'s sales data exists!');
    console.log('   Problem: Reports API is filtering them out');
    console.log('   Action: Check reports API query logic');
  }
  
  console.log('\n');
  await mongoose.disconnect();
  process.exit(0);
}

diagnose().catch(async (err) => {
  console.error('❌ Diagnostic failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
