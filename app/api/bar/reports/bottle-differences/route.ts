// GET /api/bar/reports/bottle-differences
// Returns all closed BarBottle records that have a non-zero difference
// (expected units vs actual units sold — negative = loss, positive = surplus).
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

    const bottles = await models.BarBottle.find({
      userId:   ownerId,
      state:    'closed',
      closedAt: { $gte: from, $lte: to },
    })
      .populate('inventoryItemId', 'name size brandId')
      .populate('openedBy',        'name firstName lastName')
      .sort({ closedAt: -1 })
      .lean() as any[]

    const differences = bottles.map(b => {
      const diff         = (b.expectedUnits ?? 0) - (b.actualUnitsSold ?? 0)
      const invItem      = b.inventoryItemId as any
      const openedByUser = b.openedBy as any
      return {
        _id:             String(b._id),
        bottleNumber:    b.bottleNumber,
        inventoryItem: {
          name: invItem ? `${invItem.name || ''} ${invItem.size || ''}`.trim() : 'Unknown',
        },
        expectedUnits:   b.expectedUnits  ?? 0,
        actualUnitsSold: b.actualUnitsSold ?? 0,
        difference:      diff,
        openedBy: {
          name: openedByUser
            ? (openedByUser.name || `${openedByUser.firstName || ''} ${openedByUser.lastName || ''}`.trim() || 'Staff')
            : 'Unknown',
        },
        openedAt: b.openedAt,
        closedAt: b.closedAt,
      }
    })

    // Summary stats
    const totalLoss    = differences.filter(d => d.difference < 0).reduce((s, d) => s + Math.abs(d.difference), 0)
    const totalSurplus = differences.filter(d => d.difference > 0).reduce((s, d) => s + d.difference, 0)

    return NextResponse.json({ differences, totalLoss, totalSurplus })
  } catch (error) {
    console.error('[bar/reports/bottle-differences] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bottle differences' }, { status: 500 })
  }
}
