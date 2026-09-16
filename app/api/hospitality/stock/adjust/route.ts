import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { adjustInventory } from '@/lib/hospitality/inventory'

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

    if (!body.menuItemId || !body.adjustmentType || body.value === undefined || !body.reason) {
      return NextResponse.json({ 
        error: 'menuItemId, adjustmentType, value, and reason are required' 
      }, { status: 400 })
    }

    const session = await conn.startSession()

    try {
      let result
      await session.withTransaction(async () => {
        result = await adjustInventory(
          {
            menuItemId: body.menuItemId,
            servingTypeId: body.servingTypeId,
            adjustmentType: body.adjustmentType,
            value: body.value,
            reason: body.reason,
            performedBy,
            requiresApproval: body.requiresApproval || false,
            approvedBy: body.approvedBy
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
    console.error('[hospitality/stock/adjust POST]', error)
    return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 })
  }
}
