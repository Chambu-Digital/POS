import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getAuthPayload } from '@/lib/jwt'
import KitchenOrder from '@/lib/models/KitchenOrder'

// ── GET — table management stats for a given date ────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')

    const date = dateParam ? new Date(dateParam) : new Date()
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999)

    const orders = await KitchenOrder.find({
      userId: ownerId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    }).lean()

    // ── Per-table summary ────────────────────────────────────────────────────
    const tableMap: Record<string, {
      tableNumber: string
      totalOrders: number
      completedOrders: number
      activeOrders: number
      totalCovers: number
      totalRevenue: number
      avgPrepMins: number
      prepTimeSamples: number[]
      lastActivity: Date | null
      waiters: Set<string>
    }> = {}

    for (const o of orders) {
      const t = o.tableNumber
      if (!tableMap[t]) {
        tableMap[t] = {
          tableNumber: t,
          totalOrders: 0, completedOrders: 0, activeOrders: 0,
          totalCovers: 0, totalRevenue: 0,
          avgPrepMins: 0, prepTimeSamples: [],
          lastActivity: null,
          waiters: new Set(),
        }
      }
      const row = tableMap[t]
      row.totalOrders++
      row.totalCovers += o.coverCount ?? 1
      if (o.status === 'collected') {
        row.completedOrders++
        row.totalRevenue += o.totalAmount ?? 0
        if (o.preparingAt && o.readyAt) {
          const mins = (new Date(o.readyAt).getTime() - new Date(o.preparingAt).getTime()) / 60000
          row.prepTimeSamples.push(mins)
        }
      } else {
        row.activeOrders++
      }
      const activity = new Date(o.updatedAt ?? o.createdAt)
      if (!row.lastActivity || activity > row.lastActivity) row.lastActivity = activity
      if (o.waiterName) row.waiters.add(o.waiterName)
    }

    const tables = Object.values(tableMap).map(r => ({
      ...r,
      waiters: Array.from(r.waiters),
      avgPrepMins: r.prepTimeSamples.length
        ? Math.round(r.prepTimeSamples.reduce((a, b) => a + b, 0) / r.prepTimeSamples.length)
        : 0,
      prepTimeSamples: undefined,
    })).sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber))

    // ── Per-employee summary ─────────────────────────────────────────────────
    const staffMap: Record<string, {
      waiterName: string
      ordersServed: number
      tablesServed: Set<string>
      coversServed: number
      revenue: number
    }> = {}

    for (const o of orders) {
      const w = o.waiterName || 'Unknown'
      if (!staffMap[w]) {
        staffMap[w] = { waiterName: w, ordersServed: 0, tablesServed: new Set(), coversServed: 0, revenue: 0 }
      }
      staffMap[w].ordersServed++
      staffMap[w].tablesServed.add(o.tableNumber)
      staffMap[w].coversServed += o.coverCount ?? 1
      if (o.status === 'collected') staffMap[w].revenue += o.totalAmount ?? 0
    }

    const staff = Object.values(staffMap).map(s => ({
      ...s,
      tablesServed: Array.from(s.tablesServed),
      tablesCount: s.tablesServed.size,
    })).sort((a, b) => b.ordersServed - a.ordersServed)

    // ── Day totals ───────────────────────────────────────────────────────────
    const totals = {
      totalOrders:    orders.length,
      completedOrders: orders.filter(o => o.status === 'collected').length,
      activeOrders:   orders.filter(o => o.status !== 'collected').length,
      totalRevenue:   orders.filter(o => o.status === 'collected').reduce((s, o) => s + (o.totalAmount ?? 0), 0),
      totalCovers:    orders.reduce((s, o) => s + (o.coverCount ?? 1), 0),
      tablesUsed:     Object.keys(tableMap).length,
    }

    return NextResponse.json({ tables, staff, totals, date: dayStart })
  } catch (err) {
    console.error('KDS tables GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch table stats' }, { status: 500 })
  }
}
