import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const bottle = await models.BarBottle.findOne({ _id: params.id, userId: ownerId }).lean()
    if (!bottle) return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })

    return NextResponse.json({ bottle })
  } catch (error) {
    console.error('[bar/bottles/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bottle' }, { status: 500 })
  }
}
