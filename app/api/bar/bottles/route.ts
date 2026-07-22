import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const url = new URL(request.url)
    const inventoryItemId = url.searchParams.get('inventoryItemId')
    const state = url.searchParams.get('state')
    const staffId = url.searchParams.get('staffId')

    const filter: any = { userId: ownerId }
    if (inventoryItemId) filter.inventoryItemId = inventoryItemId
    if (state) filter.state = state
    if (staffId) filter.openedBy = staffId

    const bottles = await models.BarBottle.find(filter).sort({ createdAt: -1 }).lean()
    return NextResponse.json({ bottles })
  } catch (error) {
    console.error('[bar/bottles] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bottles' }, { status: 500 })
  }
}
