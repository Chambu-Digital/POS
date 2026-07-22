// GET /api/bar/reports/products-sold
// Aggregates bar sales from Sale records (source:'bar') within a date range.
// Returns top items by quantity and by revenue.
// Query params:
//   from  — ISO date string, default: 30 days ago
//   to    — ISO date string, default: now

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const to   = searchParams.get('to')   ? new Date(searchParams.get('to')!)   : new Date()
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Aggregate bar sales within the date range
    const sales = await models.Sale.find({
      userId:    ownerId,
      source:    'bar',
      status:    'completed',
      createdAt: { $gte: from, $lte: to },
    }).lean() as any[]

    // Roll up by product name (productId may be bar inventory item id)
    const map = new Map<string, { itemName: string; quantity: number; revenue: number }>()

    for (const sale of sales) {
      for (const item of (sale.items || [])) {
        const key  = item.productName || 'Unknown'
        const prev = map.get(key) || { itemName: key, quantity: 0, revenue: 0 }
        map.set(key, {
          itemName: key,
          quantity: prev.quantity + (item.quantity || 0),
          revenue:  prev.revenue  + (item.total    || (item.price * item.quantity) || 0),
        })
      }
    }

    const products = Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)

    // Revenue by day for the trend chart
    const dayMap = new Map<string, number>()
    for (const sale of sales) {
      const day = new Date(sale.createdAt).toISOString().slice(0, 10)
      dayMap.set(day, (dayMap.get(day) ?? 0) + (sale.total ?? 0))
    }
    const dailyRevenue = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))

    const totalRevenue = sales.reduce((s, sale) => s + (sale.total ?? 0), 0)
    const totalSales   = sales.length

    return NextResponse.json({ products, dailyRevenue, totalRevenue, totalSales })
  } catch (error) {
    console.error('[bar/reports/products-sold] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch products sold' }, { status: 500 })
  }
}
