import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { PaymentHandler } from '@/lib/bar/payment-handler'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const tabDoc = await models.BarTab.findOne({ _id: id, userId: ownerId })
    if (!tabDoc) return NextResponse.json({ error: 'Tab not found' }, { status: 404 })

    const result = await PaymentHandler.closeTab(id, conn)

    if (!result.sale) {
      return NextResponse.json({ tab: result.tab, error: 'Sync failed' }, { status: 503 })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('[bar/tabs/[id]/close] POST error:', error)
    if (error.message === 'TAB_NOT_IN_BILLING' || error.message === 'BALANCE_OUTSTANDING') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to close tab' }, { status: 500 })
  }
}
