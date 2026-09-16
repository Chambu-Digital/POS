import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { approveProduction, rejectProduction } from '@/lib/hospitality/production'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn, features } = await getTenantDB(request)
    if (!features['hospitality.production']) {
      return NextResponse.json({ error: 'Hospitality module not enabled' }, { status: 403 })
    }

    const tenantId = payload.mongoUri || payload.userId
    const approvedBy = payload.type === 'staff' ? payload.userId : payload.userId
    const { id } = await params
    const body = await request.json()

    const action = body.action // 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
    }

    const session = await conn.startSession()

    try {
      let result
      await session.withTransaction(async () => {
        if (action === 'approve') {
          result = await approveProduction(
            {
              productionLogId: id,
              approvedBy,
              notes: body.notes
            },
            models,
            tenantId,
            session
          )
        } else {
          result = await rejectProduction(
            {
              productionLogId: id,
              approvedBy,
              notes: body.notes
            },
            models,
            tenantId,
            session
          )
        }
      })

      await session.endSession()

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true,
        productionLog: result.productionLog
      })
    } catch (error: any) {
      await session.endSession()
      throw error
    }
  } catch (error) {
    console.error('[hospitality/production/[id]/approve POST]', error)
    return NextResponse.json({ error: 'Failed to update production log' }, { status: 500 })
  }
}
