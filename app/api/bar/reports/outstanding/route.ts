import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const openTabs = await models.BarTab.find({
      userId: ownerId,
      status: { $in: ['open', 'hold', 'billing'] },
    }).lean() as any[]

    let totalOutstanding = 0
    for (const tab of openTabs) {
      const tabTotal   = tab.total    ?? 0
      const tabPaid    = tab.amountPaid ?? 0
      totalOutstanding += Math.max(0, tabTotal - tabPaid)
    }

    return NextResponse.json({
      outstanding: totalOutstanding,   // plain number — consistent with how the page reads it
      count:       openTabs.length,
    })
  } catch (error) {
    console.error('[bar/reports/outstanding] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch outstanding' }, { status: 500 })
  }
}
