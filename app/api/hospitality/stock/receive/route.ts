import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { addWholeUnits } from '@/lib/hospitality/inventory'

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

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 })
    }

    const session = await conn.startSession()
    const results = []
    const errors = []

    try {
      await session.withTransaction(async () => {
        for (const item of body.items) {
          if (!item.menuItemId || !item.quantity || item.quantity <= 0) {
            errors.push({
              menuItemId: item.menuItemId,
              error: 'menuItemId and positive quantity are required'
            })
            continue
          }

          const result = await addWholeUnits(
            {
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              reason: body.reason || 'Stock received',
              reference: body.reference || '',
              performedBy,
              batchId: item.batchId
            },
            models,
            tenantId,
            session
          )

          if (result.success) {
            results.push({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              newInventory: result.newInventory
            })
          } else {
            errors.push({
              menuItemId: item.menuItemId,
              error: result.error
            })
          }
        }
      })

      await session.endSession()

      return NextResponse.json({
        success: true,
        received: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      })
    } catch (error: any) {
      await session.endSession()
      throw error
    }
  } catch (error) {
    console.error('[hospitality/stock/receive POST]', error)
    return NextResponse.json({ error: 'Failed to receive stock' }, { status: 500 })
  }
}
