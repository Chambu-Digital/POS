// Inspect actual userIds in database
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import { connectTenantDB } from '@/lib/db-tenant'
import { getModels } from '@/lib/tenant/get-models'

async function inspectUserIds() {
  try {
    const baseUri = process.env.MONGODB_URI
    if (!baseUri) {
      console.error('❌ MONGODB_URI not set')
      process.exit(1)
    }
    
    const tenantUri = baseUri.replace('/jayposmulti', '/jaywines')
    const conn = await connectTenantDB(tenantUri)
    const models = getModels(conn)

    console.log('\n========== USER IDS IN DATABASE ==========\n')

    // Check bar_tab_lines
    console.log('1. BarTabLine userIds:')
    const tabLines = await models.BarTabLine.find({}).lean()
    console.log(`   Found ${tabLines.length} tab line(s)`)
    for (const line of tabLines) {
      console.log('   -', {
        _id: (line as any)._id,
        userId: (line as any).userId,
        itemName: (line as any).itemName,
        lineTotal: (line as any).lineTotal,
        addedAt: (line as any).addedAt,
        voided: (line as any).voided,
      })
    }

    // Check bar_tabs
    console.log('\n2. BarTab userIds:')
    const tabs = await models.BarTab.find({}).lean()
    console.log(`   Found ${tabs.length} tab(s)`)
    for (const tab of tabs) {
      console.log('   -', {
        _id: (tab as any)._id,
        userId: (tab as any).userId,
        tabNumber: (tab as any).tabNumber,
        status: (tab as any).status,
        total: (tab as any).total,
        isSyntheticDirectSale: (tab as any).isSyntheticDirectSale,
      })
    }

    // Check sales
    console.log('\n3. Sale userIds:')
    const sales = await models.Sale.find({}).lean()
    console.log(`   Found ${sales.length} sale(s)`)
    for (const sale of sales) {
      console.log('   -', {
        _id: (sale as any)._id,
        userId: (sale as any).userId,
        orderNumber: (sale as any).orderNumber,
        total: (sale as any).total,
        source: (sale as any).source,
        syntheticTabId: (sale as any).syntheticTabId,
        createdAt: (sale as any).createdAt,
      })
    }

    // Check users
    console.log('\n4. Users in database:')
    const users = await models.User.find({}).lean()
    console.log(`   Found ${users.length} user(s)`)
    for (const user of users) {
      console.log('   -', {
        _id: (user as any)._id,
        email: (user as any).email,
        role: (user as any).role,
      })
    }

    console.log('\n========== COMPARISON ==========\n')
    console.log('Expected userId from logs: 6a5fe17b12981336f9ba2590')
    console.log('Actual userIds in database:', [...new Set(tabLines.map((l: any) => String(l.userId)))])

    await conn.close()
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

inspectUserIds()
