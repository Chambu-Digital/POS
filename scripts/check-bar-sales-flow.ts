/**
 * Check Bar Sales Data Flow
 * 
 * This script checks:
 * 1. If serving sales were recorded
 * 2. If they created BarTab records
 * 3. If they created BarTabLine records
 * 4. If they created Sale records
 * 5. Which collections have data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

async function checkFlow() {
  let connection: typeof mongoose | null = null;
  
  try {
    console.log('🔍 CHECKING BAR SALES DATA FLOW\n');
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

    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Check for bar-related collections
    console.log('📊 BAR-RELATED COLLECTIONS\n');
    
    const barCollections = collectionNames.filter(name => 
      name.includes('bar_') || name === 'sales'
    );

    if (barCollections.length === 0) {
      console.log('❌ No bar collections found!');
      return;
    }

    for (const collName of barCollections) {
      const count = await db.collection(collName).countDocuments({});
      console.log(`${collName}: ${count} documents`);
    }

    // Check Sales collection
    console.log('\n📝 SALES RECORDS (source: bar)\n');
    
    if (collectionNames.includes('sales')) {
      const barSales = await db.collection('sales').countDocuments({ source: 'bar' });
      console.log(`Total bar sales: ${barSales}`);

      if (barSales > 0) {
        // Get recent bar sales
        const recent = await db.collection('sales')
          .find({ source: 'bar' })
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();

        console.log('\nRecent bar sales:');
        recent.forEach((sale: any, idx: number) => {
          console.log(`${idx + 1}. ${sale.orderNumber || 'No order #'}`);
          console.log(`   Total: KES ${sale.total?.toFixed(2) || 0}`);
          console.log(`   Date: ${sale.createdAt}`);
          console.log(`   Items: ${sale.items?.length || 0}`);
          if (sale.syntheticTabId) {
            console.log(`   Synthetic Tab: ${sale.syntheticTabId}`);
          }
          console.log('');
        });
      }
    }

    // Check BarTab collection
    console.log('🏷️  BAR TABS\n');
    
    if (collectionNames.includes('bar_tabs')) {
      const totalTabs = await db.collection('bar_tabs').countDocuments({});
      const syntheticTabs = await db.collection('bar_tabs').countDocuments({ 
        isSyntheticDirectSale: true 
      });

      console.log(`Total tabs: ${totalTabs}`);
      console.log(`Synthetic tabs (direct sales): ${syntheticTabs}`);

      if (totalTabs > 0) {
        const statusBreakdown = await db.collection('bar_tabs').aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]).toArray();

        console.log('\nTabs by status:');
        statusBreakdown.forEach((stat: any) => {
          console.log(`  ${stat._id}: ${stat.count}`);
        });

        // Check recent tabs
        const recentTabs = await db.collection('bar_tabs')
          .find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();

        console.log('\nRecent tabs:');
        recentTabs.forEach((tab: any, idx: number) => {
          console.log(`${idx + 1}. Tab #${tab.tabNumber || tab._id}`);
          console.log(`   Status: ${tab.status}`);
          console.log(`   Total: KES ${tab.total?.toFixed(2) || 0}`);
          console.log(`   Synthetic: ${tab.isSyntheticDirectSale ? 'YES' : 'NO'}`);
          console.log(`   Created: ${tab.createdAt}`);
          console.log('');
        });
      }
    }

    // The critical check: BarTabLine
    console.log('💎 BAR TAB LINES (THE MISSING PIECE)\n');
    
    if (collectionNames.includes('bar_tab_lines')) {
      const totalLines = await db.collection('bar_tab_lines').countDocuments({});
      const nonVoidedLines = await db.collection('bar_tab_lines').countDocuments({ voided: false });

      console.log(`Total lines: ${totalLines}`);
      console.log(`Non-voided: ${nonVoidedLines}`);

      if (totalLines === 0) {
        console.log('\n❌ PROBLEM IDENTIFIED: bar_tab_lines is empty!');
        console.log('\nPossible causes:');
        console.log('  1. TabManager.addLine() is not being called');
        console.log('  2. TabManager.addLine() is failing silently');
        console.log('  3. BarTabLine.create() is failing');
        console.log('  4. Data is being saved to a different database/tenant');
        console.log('\nNext step: Check application logs when making a sale');
      }
    } else {
      console.log('❌ bar_tab_lines collection does not exist!');
    }

    // Cross-reference: Do we have tabs but no lines?
    console.log('\n🔬 CROSS-REFERENCE CHECK\n');
    
    const hasTabs = collectionNames.includes('bar_tabs');
    const hasLines = collectionNames.includes('bar_tab_lines');
    const hasSales = collectionNames.includes('sales');

    if (hasTabs) {
      const tabCount = await db.collection('bar_tabs').countDocuments({});
      console.log(`✅ Have ${tabCount} tabs`);
    } else {
      console.log('❌ No tabs');
    }

    if (hasLines) {
      const lineCount = await db.collection('bar_tab_lines').countDocuments({});
      console.log(`${lineCount > 0 ? '✅' : '❌'} Have ${lineCount} tab lines`);
    } else {
      console.log('❌ No tab lines');
    }

    if (hasSales) {
      const barSaleCount = await db.collection('sales').countDocuments({ source: 'bar' });
      console.log(`✅ Have ${barSaleCount} bar sales`);
    } else {
      console.log('❌ No sales');
    }

    // Diagnosis
    console.log('\n💡 DIAGNOSIS\n');
    console.log('='.repeat(60));

    const tabCount = hasTabs ? await db.collection('bar_tabs').countDocuments({}) : 0;
    const lineCount = hasLines ? await db.collection('bar_tab_lines').countDocuments({}) : 0;
    const saleCount = hasSales ? await db.collection('sales').countDocuments({ source: 'bar' }) : 0;

    if (tabCount > 0 && lineCount === 0) {
      console.log('⚠️  TABS EXIST BUT NO TAB LINES!');
      console.log('\nThis means:');
      console.log('  - Tabs are being created ✅');
      console.log('  - TabManager.addLine() is NOT working ❌');
      console.log('\nCause: TabManager.addLine() is either:');
      console.log('  - Not being called');
      console.log('  - Failing with an error (check logs)');
      console.log('  - Writing to a different collection/database');
      console.log('\nAction: Make a test sale and watch the server console for errors');
    } else if (tabCount === 0 && lineCount === 0 && saleCount > 0) {
      console.log('⚠️  SALES EXIST BUT NO TABS/LINES!');
      console.log('\nThis means:');
      console.log('  - Sales are being recorded ✅');
      console.log('  - BUT synthetic tab creation is failing ❌');
      console.log('\nCause: TabManager.createSyntheticDirectSaleTab() is failing');
      console.log('Action: Check error logs in server console');
    } else if (tabCount === 0 && lineCount === 0 && saleCount === 0) {
      console.log('📋 NO DATA AT ALL');
      console.log('\nThis means:');
      console.log('  - No sales have been made through the POS');
      console.log('  - OR sales are going to a different database');
      console.log('\nAction:');
      console.log('  1. Make a test sale in the POS');
      console.log('  2. Watch for errors in the server console');
      console.log('  3. Run this script again');
    } else {
      console.log('✅ Data flow looks correct!');
      console.log(`   Tabs: ${tabCount}, Lines: ${lineCount}, Sales: ${saleCount}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Check complete!\n');

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

checkFlow()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
