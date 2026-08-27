// Search jaywines database properly for sheaglow user
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import mongoose from 'mongoose'

async function findSheaglowUser() {
  try {
    // Connect directly to jaywines using the mongoUri from the login log
    const jayWinesUri = 'mongodb://jayjeremy2000:chambupos@ac-hyykgmq-shard-00-02.u8o9dcg.mongodb.net:27017/jaywines?ssl=true&replicaSet=atlas-xuf6tr-shard-0&authSource=admin&appName=chambupos'
    
    console.log('\n========== SEARCHING JAYWINES DATABASE ==========\n')
    console.log('Connecting to jaywines...')
    
    await mongoose.connect(jayWinesUri)
    const db = mongoose.connection.db

    // Search for sheaglow user
    console.log('\n1. Searching for thesheaglow@gmail.com user...')
    const user = await db.collection('users').findOne({ 
      email: 'thesheaglow@gmail.com' 
    })
    
    if (user) {
      console.log('✅ Found user:', {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        shopName: user.shopName,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      })

      const userId = user._id

      // Check bar data for this user
      console.log('\n2. Checking bar data for this user...')
      
      const tabLines = await db.collection('bar_tab_lines').find({ 
        userId 
      }).toArray()
      console.log(`   BarTabLine records: ${tabLines.length}`)
      
      if (tabLines.length > 0) {
        console.log('\n   Recent tab lines:')
        for (const line of tabLines.slice(0, 5)) {
          console.log('     -', {
            _id: line._id,
            tabId: line.tabId,
            itemName: line.itemName,
            lineTotal: line.lineTotal,
            addedAt: line.addedAt,
            voided: line.voided,
          })
        }
      }

      const tabs = await db.collection('bar_tabs').find({ 
        userId 
      }).toArray()
      console.log(`\n   BarTab records: ${tabs.length}`)
      
      if (tabs.length > 0) {
        console.log('\n   Tabs:')
        for (const tab of tabs) {
          console.log('     -', {
            _id: tab._id,
            tabNumber: tab.tabNumber,
            status: tab.status,
            total: tab.total,
            isSyntheticDirectSale: tab.isSyntheticDirectSale,
            openedAt: tab.openedAt,
            closedAt: tab.closedAt,
          })
        }
      }

      const sales = await db.collection('sales').find({ 
        userId 
      }).toArray()
      console.log(`\n   Sale records: ${sales.length}`)

      // Compare with expected userId from logs
      console.log('\n3. Comparing with logs...')
      console.log('   Expected userId from logs: 6a5fe17b12981336f9ba2590')
      console.log('   Actual userId in database:', userId.toString())
      console.log('   Match:', userId.toString() === '6a5fe17b12981336f9ba2590' ? '✅ YES' : '❌ NO')

    } else {
      console.log('❌ User NOT found with email thesheaglow@gmail.com')
      
      // List all users in jaywines
      console.log('\n   All users in jaywines:')
      const allUsers = await db.collection('users').find({}).toArray()
      for (const u of allUsers) {
        console.log('     -', {
          _id: u._id,
          email: u.email,
          name: u.name,
        })
      }
    }

    // Search for the userId from logs directly
    console.log('\n4. Searching for userId 6a5fe17b12981336f9ba2590 directly...')
    const logUserId = new mongoose.Types.ObjectId('6a5fe17b12981336f9ba2590')
    
    const userById = await db.collection('users').findOne({ _id: logUserId })
    if (userById) {
      console.log('   ✅ Found user by ID:', {
        _id: userById._id,
        email: userById.email,
        name: userById.name,
      })
    } else {
      console.log('   ❌ No user found with this ID')
    }

    const tabLinesById = await db.collection('bar_tab_lines').countDocuments({ 
      userId: logUserId 
    })
    console.log(`   BarTabLine records for this userId: ${tabLinesById}`)

    const tabsById = await db.collection('bar_tabs').countDocuments({ 
      userId: logUserId 
    })
    console.log(`   BarTab records for this userId: ${tabsById}`)

    console.log('\n========== COMPLETE ==========\n')

    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

findSheaglowUser()
