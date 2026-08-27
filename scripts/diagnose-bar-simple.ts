/**
 * Simple Bar Reports Diagnostic
 * Connects directly to MongoDB and queries bar_tab_lines
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function diagnose() {
  let connection: typeof mongoose | null = null;
  
  try {
    console.log('🔍 BAR REPORTS DIAGNOSTIC\n');
    console.log('='.repeat(60));

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not found in .env');
    }

    console.log('\n📡 Connecting to MongoDB...\n');
    
    connection = await mongoose.connect(uri, {
      family: 4,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to:', mongoose.connection.name || 'default database');
    console.log('');

    const db = mongoose.connection.db;

    // 1. Check if collection exists
    console.log('📊 1. CHECKING COLLECTIONS\n');
    const collections = await db.listCollections().toArray();
    const hasBarTabLines = collections.some(c => c.name === 'bar_tab_lines');
    console.log(`bar_tab_lines collection exists: ${hasBarTabLines ? '✅ YES' : '❌ NO'}`);
    
    if (!hasBarTabLines) {
      console.log('\n❌ PROBLEM FOUND: bar_tab_lines collection does not exist!');
      console.log('   This means no serving sales have been recorded.\n');
      return;
    }

    // 2. Count documents
    console.log('\n📊 2. DOCUMENT COUNTS\n');
    const totalCount = await db.collection('bar_tab_lines').countDocuments({});
    const nonVoidedCount = await db.collection('bar_tab_lines').countDocuments({ voided: false });
    const voidedCount = await db.collection('bar_tab_lines').countDocuments({ voided: true });

    console.log(`Total records: ${totalCount}`);
    console.log(`Non-voided: ${nonVoidedCount}`);
    console.log(`Voided: ${voidedCount}`);

    if (totalCount === 0) {
      console.log('\n❌ PROBLEM FOUND: No BarTabLine records exist!');
      console.log('   Serving sales are not creating records.\n');
      return;
    }

    // 3. Calculate total revenue
    console.log('\n💰 3. REVENUE ANALYSIS\n');
    const revenueResult = await db.collection('bar_tab_lines').aggregate([
      { $match: { voided: false } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$lineTotal' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$lineTotal' }
        }
      }
    ]).toArray();

    if (revenueResult.length > 0) {
      const stats = revenueResult[0];
      console.log(`Total Revenue: KES ${stats.totalRevenue?.toFixed(2) || 0}`);
      console.log(`Number of items: ${stats.count}`);
      console.log(`Average per item: KES ${stats.avgAmount?.toFixed(2) || 0}`);

      if (stats.totalRevenue > 0) {
        console.log('\n✅ Revenue exists in database!');
      }
    }

    // 4. Date range
    console.log('\n📅 4. DATE RANGE\n');
    const dateResult = await db.collection('bar_tab_lines').aggregate([
      { $match: { voided: false } },
      {
        $group: {
          _id: null,
          oldest: { $min: '$addedAt' },
          newest: { $max: '$addedAt' }
        }
      }
    ]).toArray();

    if (dateResult.length > 0) {
      const dates = dateResult[0];
      console.log(`Oldest record: ${dates.oldest}`);
      console.log(`Newest record: ${dates.newest}`);

      // Check today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayCount = await db.collection('bar_tab_lines').countDocuments({
        voided: false,
        addedAt: { $gte: todayStart, $lte: todayEnd }
      });

      console.log(`\nRecords from today: ${todayCount}`);

      if (todayCount === 0) {
        console.log('⚠️  WARNING: No records from today!');
        console.log('   Reports filtered to "Today" will show KES 0.');
      }

      // Last 7 days
      const last7 = new Date();
      last7.setDate(last7.getDate() - 7);
      const last7Count = await db.collection('bar_tab_lines').countDocuments({
        voided: false,
        addedAt: { $gte: last7 }
      });
      console.log(`Records from last 7 days: ${last7Count}`);

      // Last 30 days
      const last30 = new Date();
      last30.setDate(last30.getDate() - 30);
      const last30Count = await db.collection('bar_tab_lines').countDocuments({
        voided: false,
        addedAt: { $gte: last30 }
      });
      console.log(`Records from last 30 days: ${last30Count}`);
    }

    // 5. User IDs
    console.log('\n👥 5. USERS\n');
    const users = await db.collection('bar_tab_lines').distinct('userId', { voided: false });
    console.log(`Unique users: ${users.length}`);
    
    if (users.length > 0 && users.length <= 5) {
      users.forEach((userId: any, idx: number) => {
        console.log(`  ${idx + 1}. ${userId}`);
      });
    }

    // Revenue per user
    const userRevenue = await db.collection('bar_tab_lines').aggregate([
      { $match: { voided: false } },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          revenue: { $sum: '$lineTotal' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();

    console.log('\nTop users by sales:');
    userRevenue.forEach((user: any, idx: number) => {
      console.log(`  ${idx + 1}. User ${user._id}: ${user.count} items, KES ${user.revenue?.toFixed(2) || 0}`);
    });

    // 6. Sample records
    console.log('\n📝 6. RECENT RECORDS (Last 3)\n');
    const recent = await db.collection('bar_tab_lines')
      .find({ voided: false })
      .sort({ addedAt: -1 })
      .limit(3)
      .toArray();

    recent.forEach((record: any, idx: number) => {
      console.log(`${idx + 1}. ${record.productName || record.servingName || 'Unknown'}`);
      console.log(`   Amount: KES ${record.lineTotal?.toFixed(2) || 0}`);
      console.log(`   Date: ${record.addedAt}`);
      console.log(`   User: ${record.userId}`);
      console.log(`   Voided: ${record.voided}`);
      console.log('');
    });

    // 7. Tabs
    console.log('🏷️  7. BAR TABS\n');
    const tabsExist = collections.some(c => c.name === 'bar_tabs');
    
    if (tabsExist) {
      const tabStats = await db.collection('bar_tabs').aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      console.log('Tabs by status:');
      tabStats.forEach((stat: any) => {
        console.log(`  ${stat._id}: ${stat.count}`);
      });
    } else {
      console.log('bar_tabs collection not found');
    }

    // 8. Summary
    console.log('\n💡 DIAGNOSIS SUMMARY\n');
    console.log('='.repeat(60));

    if (nonVoidedCount === 0) {
      console.log('❌ No BarTabLine records found');
      console.log('   → Fix: Check serving sale flow');
    } else if (dateResult[0] && todayCount === 0) {
      console.log('⚠️  Records exist but not from today');
      console.log('   → Quick fix: Change period to "Last 30 days" in UI');
      console.log('   → Check: Are sales being saved with correct dates?');
    } else {
      console.log('✅ Data looks good in database');
      console.log('   → Check: Frontend/API communication');
      console.log('   → Check: User authentication (userId matching)');
      console.log('   → Inspect: Browser DevTools Network tab');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Diagnostic complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run diagnostic
diagnose()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
