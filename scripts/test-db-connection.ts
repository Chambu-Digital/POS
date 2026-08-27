import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

async function test() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('✅ Connected!');
    
    console.log('Connection name:', mongoose.connection.name);
    console.log('Connection state:', mongoose.connection.readyState);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\nFound ${collections.length} collections`);
    
    // List first 10
    collections.slice(0, 10).forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Test complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();
