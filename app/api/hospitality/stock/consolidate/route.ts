import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { consolidatePartials } from '@/lib/hospitality/inventory'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn, features } = await getTenantDB(request)
    if (!features['hospitality.stock']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const performedBy = payload.type === 'staff' ? payload.userId : payload.userId
    const body = await request.json()

    if (!body.menuItemId || !body.partialIds || !Array.isArray(body.partialIds)) {
      return NextResponse.json({ 
        error: 'menuItemId and partialIds array are required' 
      }, { status: 400 })
    }

    const session = await conn.startSession()

    try {
      let result
      await session.withTransaction(async () => {
        result = await consolidatePartials(
          {
            menuItemId: body.menuItemId,
            partialIds: body.partialIds,
            performedBy
          },
          models,
          tenantId,
          session
        )
      })

      await session.endSession()

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true,
        inventory: result.newInventory
      })
    } catch (error: any) {
      await session.endSession()
      throw error
    }
  } catch (error) {
    console.error('[hospitality/stock/consolidate POST]', error)
    return NextResponse.json({ error: 'Failed to consolidate partials' }, { status: 500 })
  }
}
