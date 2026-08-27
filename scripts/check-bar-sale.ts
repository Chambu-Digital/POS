// Script to check if the bar sale from logs exists in database
// From logs: tabId = 6a901c90cadad8599ba253f8, userId = 6a5fe17b12981336f9ba2590

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env file
dotenv.config({ path: path.join(process.cwd(), '.env') })

import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'
import mongoose from 'mongoose'

async function checkBarSale() {
  try {
    // From your logs - the jaywines tenant
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) {
      console.error('❌ MONGODB_URI not set in environment')
      process.exit(1)
    }
    
    const tenantUri = baseUri.replace('/jayposmulti', '/jaywines')
    
    console.log('Connecting to:', tenantUri.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://***:***@'))
    
    const conn = await connectTenantDB(tenantUri)
    const models = getModels(conn)

    console.log('\n========== DATABASE CHECK ==========\n')

    // From your logs:
    const tabId = '6a901c90cadad8599ba253f8'
    const userId = '6a5fe17b12981336f9ba2590'
    const saleId = '6a901c93cadad8599ba25413'

    // 1. Check if the synthetic tab exists
    console.log('1. Checking synthetic tab...')
    const tab = await models.BarTab.findById(tabId).lean()
    if (tab) {
      console.log('✅ Tab found:', {
        _id: tab._id,
        userId: tab.userId,
        status: (tab as any).status,
        total: (tab as any).total,
        customerName: (tab as any).customerName,
        isSyntheticDirectSale: (tab as any).isSyntheticDirectSale,
        openedAt: (tab as any).openedAt,
        closedAt: (tab as any).closedAt,
      })
    } else {
      console.log('❌ Tab NOT found')
    }

    // 2. Check if BarTabLine records exist for this tab
    console.log('\n2. Checking BarTabLine records for this tab...')
    const tabLines = await models.BarTabLine.find({ tabId }).lean()
    console.log(`Found ${tabLines.length} tab line(s)`)
    
    if (tabLines.length > 0) {
      for (const line of tabLines) {
        console.log('  BarTabLine:', {
          _id: (line as any)._id,
          userId: (line as any).userId,
          itemName: (line as any).itemName,
          servingName: (line as any).servingName,
          quantity: (line as any).quantity,
          lineTotal: (line as any).lineTotal,
          addedAt: (line as any).addedAt,
          voided: (line as any).voided,
        })
      }
    } else {
      console.log('  ❌ No BarTabLine records found for this tab!')
    }

    // 3. Check if Sale record exists
    console.log('\n3. Checking Sale record...')
    const sale = await models.Sale.findById(saleId).lean()
    if (sale) {
      console.log('✅ Sale found:', {
        _id: sale._id,
        userId: (sale as any).userId,
        orderNumber: (sale as any).orderNumber,
        total: (sale as any).total,
        source: (sale as any).source,
        syntheticTabId: (sale as any).syntheticTabId,
        createdAt: (sale as any).createdAt,
      })
    } else {
      console.log('❌ Sale NOT found')
    }

    // 4. Check ALL BarTabLine records for this user (unfiltered)
    console.log('\n4. Checking ALL BarTabLine records for userId:', userId)
    const allUserLines = await models.BarTabLine.find({ userId }).lean()
    console.log(`Found ${allUserLines.length} total line(s) for this user`)

    if (allUserLines.length > 0) {
      console.log('\n  Sample of user\'s tab lines:')
      for (const line of allUserLines.slice(0, 5)) {
        console.log('    -', {
          _id: (line as any)._id,
          tabId: (line as any).tabId,
          itemName: (line as any).itemName,
          lineTotal: (line as any).lineTotal,
          addedAt: (line as any).addedAt,
          voided: (line as any).voided,
        })
      }
    }

    // 5. Check records with date filter (today)
    console.log('\n5. Checking with date filter (today)...')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    console.log('  Date range:', {
      from: today.toISOString(),
      to: tomorrow.toISOString()
    })

    const todayLines = await models.BarTabLine.find({
      userId,
      addedAt: { $gte: today, $lt: tomorrow },
      voided: false,
    }).lean()

    console.log(`  Found ${todayLines.length} line(s) for today`)

    // 6. Check userId type in database
    console.log('\n6. Checking userId type in database...')
    const sampleLine = await models.BarTabLine.findOne({}).lean()
    if (sampleLine) {
      console.log('  Sample line userId type:', {
        userId: (sampleLine as any).userId,
        type: typeof (sampleLine as any).userId,
        isObjectId: mongoose.Types.ObjectId.isValid((sampleLine as any).userId),
      })
    }

    // 7. Try querying with ObjectId conversion
    console.log('\n7. Trying query with ObjectId conversion...')
    const linesWithObjectId = await models.BarTabLine.find({
      userId: new mongoose.Types.ObjectId(userId),
      voided: false,
    }).lean()
    console.log(`  Found ${linesWithObjectId.length} line(s) using ObjectId`)

    // 8. Try querying with string
    console.log('\n8. Trying query with string...')
    const linesWithString = await models.BarTabLine.find({
      userId: userId,
      voided: false,
    }).lean()
    console.log(`  Found ${linesWithString.length} line(s) using string`)

    console.log('\n========== CHECK COMPLETE ==========\n')

    await conn.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkBarSale()
