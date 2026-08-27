// GET /api/bar/reports/products-sold
// Aggregates bar sales from BarTabLine records within a date range.
// Returns top items by quantity and by revenue.
// Shows both serving sales and bottle sales in "Product - Serving" format.
// Query params:
//   from  — ISO date string, default: 30 days ago
//   to    — ISO date string, default: now

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[products-sold] ========== QUERY STARTED ==========')
    
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[products-sold] Auth payload:', { 
      userId: payload.userId, 
      type: payload.type, 
      email: payload.email 
    })

    const { models, conn } = await getTenantDB(request)
    console.log('[products-sold] Connected to DB:', conn.name)
    
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    console.log('[products-sold] Owner ID:', ownerId, typeof ownerId)

    const { searchParams } = new URL(request.url)
    const toParam = searchParams.get('to')
    const fromParam = searchParams.get('from')
    
    // Parse dates and set to end of day for 'to' date (in UTC)
    const to = toParam ? new Date(toParam + 'T23:59:59.999Z') : new Date()
    const from = fromParam ? new Date(fromParam + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    console.log('[products-sold] Date range:', {
      from: from.toISOString(),
      to: to.toISOString(),
    })

    // Query BarTabLine for both serving sales and bottle sales
    const tabLines = await models.BarTabLine.find({
      userId: ownerId,
      addedAt: { $gte: from, $lte: to },
      voided: false,
    })
      .populate('servingId', 'name')
      .populate('inventoryItemId', 'name size')
      .lean()

    console.log('[products-sold] Found', tabLines.length, 'tab line(s)')
    if (tabLines.length > 0) {
      console.log('[products-sold] Sample line:', {
        _id: (tabLines[0] as any)._id,
        userId: (tabLines[0] as any).userId,
        itemName: (tabLines[0] as any).itemName,
        lineTotal: (tabLines[0] as any).lineTotal,
        addedAt: (tabLines[0] as any).addedAt,
      })
    }

    // Aggregate by product + serving (composite key)
    const map = new Map<string, { itemName: string; quantity: number; revenue: number }>()

    for (const line of tabLines as any[]) {
      // Get product name
      const productName = line.inventoryItemId?.name || line.itemName || 'Unknown'
      
      // Get serving name (if it's a serving sale)
      const servingName = line.servingId?.name || ''
      
      // Create composite key: "Product - Serving" or just "Product" for bottle sales
      const key = servingName ? `${productName} - ${servingName}` : productName
      
      const prev = map.get(key) || { itemName: key, quantity: 0, revenue: 0 }
      map.set(key, {
        itemName: key,
        quantity: prev.quantity + (line.quantity || 0),
        revenue: prev.revenue + (line.lineTotal || 0),
      })
    }

    const products = Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)

    // Revenue by day for the trend chart (use tabLines for consistency)
    const dayMap = new Map<string, number>()
    for (const line of tabLines as any[]) {
      const day = new Date(line.addedAt).toISOString().slice(0, 10)
      dayMap.set(day, (dayMap.get(day) ?? 0) + (line.lineTotal ?? 0))
    }
    const dailyRevenue = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))

    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)
    const totalSales   = tabLines.length

    return NextResponse.json({ products, dailyRevenue, totalRevenue, totalSales })
  } catch (error) {
    console.error('[bar/reports/products-sold] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch products sold' }, { status: 500 })
  }
}
