import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { TabManager } from '@/lib/bar/tab-manager'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const branchId = url.searchParams.get('branchId')

    const filter: any = { userId: ownerId }
    if (branchId) filter.branchId = branchId
    if (status) filter.status = status

    const tabs = await models.BarTab.find(filter).sort({ openedAt: -1 }).lean()
    
    const tabsWithBalance = await Promise.all(tabs.map(async (tab: any) => {
       const balance = await TabManager.getRunningBalance(tab._id.toString(), conn)
       return { ...tab, ...balance }
    }))

    return NextResponse.json({ tabs: tabsWithBalance })
  } catch (error) {
    console.error('[bar/tabs] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tabs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.userId

    const body = await request.json()
    const { customerName, customerId, tableNumber, notes, branchId } = body

    const tab = await TabManager.createTab({
      userId: ownerId,
      branchId,
      staffId,
      customerName,
      customerId,
      tableNumber,
      notes
    }, conn)

    return NextResponse.json({ tab }, { status: 201 })
  } catch (error) {
    console.error('[bar/tabs] POST error:', error)
    return NextResponse.json({ error: 'Failed to create tab' }, { status: 500 })
  }
}
