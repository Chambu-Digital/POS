import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(req)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit  = parseInt(searchParams.get('limit') || '200')

    const query: Record<string, unknown> = { userId: ownerId }
    if (status && status !== 'all') query.status = status

    const orders = await models.KitchenOrder.find(query).sort({ createdAt: -1 }).limit(limit).lean()
    const normalized = orders.map((o: any) => ({ ...o, id: o._id.toString(), _id: o._id.toString() }))
    return NextResponse.json({ orders: normalized, total: normalized.length })
  } catch (err) {
    console.error('KDS all GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
