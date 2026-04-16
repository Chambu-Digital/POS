import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const dateParam = new URL(req.url).searchParams.get('date')

    const date = dateParam ? new Date(dateParam) : new Date()
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999)

    const orders = await models.KitchenOrder.find({ userId: ownerId, createdAt: { $gte: dayStart, $lte: dayEnd } }).lean()

    const tableMap: Record<string, any> = {}
    for (const o of orders as any[]) {
      const t = o.tableNumber
      if (!tableMap[t]) tableMap[t] = { tableNumber: t, totalOrders: 0, completedOrders: 0, activeOrders: 0, totalCovers: 0, totalRevenue: 0, prepTimeSamples: [], lastActivity: null, waiters: new Set() }
      const row = tableMap[t]
      row.totalOrders++
      row.totalCovers += o.coverCount ?? 1
      if (o.status === 'collected') {
        row.completedOrders++
        row.totalRevenue += o.totalAmount ?? 0
        if (o.preparingAt && o.readyAt) row.prepTimeSamples.push((new Date(o.readyAt).getTime() - new Date(o.preparingAt).getTime()) / 60000)
      } else { row.activeOrders++ }
      const activity = new Date(o.updatedAt ?? o.createdAt)
      if (!row.lastActivity || activity > row.lastActivity) row.lastActivity = activity
      if (o.waiterName) row.waiters.add(o.waiterName)
    }

    const tables = Object.values(tableMap).map((r: any) => ({
      ...r, waiters: Array.from(r.waiters),
      avgPrepMins: r.prepTimeSamples.length ? Math.round(r.prepTimeSamples.reduce((a: number, b: number) => a + b, 0) / r.prepTimeSamples.length) : 0,
      prepTimeSamples: undefined,
    })).sort((a: any, b: any) => Number(a.tableNumber) - Number(b.tableNumber))

    const staffMap: Record<string, any> = {}
    for (const o of orders as any[]) {
      const w = o.waiterName || 'Unknown'
      if (!staffMap[w]) staffMap[w] = { waiterName: w, ordersServed: 0, tablesServed: new Set(), coversServed: 0, revenue: 0 }
      staffMap[w].ordersServed++
      staffMap[w].tablesServed.add(o.tableNumber)
      staffMap[w].coversServed += o.coverCount ?? 1
      if (o.status === 'collected') staffMap[w].revenue += o.totalAmount ?? 0
    }
    const staff = Object.values(staffMap).map((s: any) => ({ ...s, tablesServed: Array.from(s.tablesServed), tablesCount: s.tablesServed.size })).sort((a: any, b: any) => b.ordersServed - a.ordersServed)

    const totals = {
      totalOrders: (orders as any[]).length,
      completedOrders: (orders as any[]).filter((o: any) => o.status === 'collected').length,
      activeOrders: (orders as any[]).filter((o: any) => o.status !== 'collected').length,
      totalRevenue: (orders as any[]).filter((o: any) => o.status === 'collected').reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0),
      totalCovers: (orders as any[]).reduce((s: number, o: any) => s + (o.coverCount ?? 1), 0),
      tablesUsed: Object.keys(tableMap).length,
    }

    return NextResponse.json({ tables, staff, totals, date: dayStart })
  } catch (err) {
    console.error('KDS tables GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch table stats' }, { status: 500 })
  }
}
