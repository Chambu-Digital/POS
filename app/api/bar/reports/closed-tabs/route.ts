// GET /api/bar/reports/closed-tabs
// Returns paid BarTab records within a date range with summary stats.
// Query params:
//   from  — ISO date string (required)
//   to    — ISO date string (required)

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
    const fromStr = searchParams.get('from')
    const toStr   = searchParams.get('to')

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const from = new Date(fromStr)
    const to   = new Date(toStr)
    // Include the full 'to' day
    to.setHours(23, 59, 59, 999)

    const tabs = await models.BarTab.find({
      userId:   ownerId,
      status:   'paid',
      closedAt: { $gte: from, $lte: to },
    })
      .sort({ closedAt: -1 })
      .lean() as any[]

    const totalRevenue  = tabs.reduce((s, t) => s + (t.total ?? 0), 0)
    const totalDiscount = tabs.reduce((s, t) => s + (t.discountAmount ?? 0), 0)

    return NextResponse.json({ tabs, totalRevenue, totalDiscount, count: tabs.length })
  } catch (error) {
    console.error('[bar/reports/closed-tabs] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch closed tabs' }, { status: 500 })
  }
}
