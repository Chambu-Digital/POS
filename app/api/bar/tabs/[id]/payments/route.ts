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
    const staffId = payload.userId

    const body = await request.json()
    const { amount, method, amountGiven, mpesaCode, mpesaPhone } = body

    const tabDoc = await models.BarTab.findOne({ _id: id, userId: ownerId })
    if (!tabDoc) return NextResponse.json({ error: 'Tab not found' }, { status: 404 })

    const tab = await PaymentHandler.recordPayment(id, {
      amount,
      method,
      amountGiven,
      mpesaCode,
      mpesaPhone,
      staffId,
    }, conn)

    return NextResponse.json({ tab }, { status: 201 })
  } catch (error: any) {
    console.error('[bar/tabs/[id]/payments] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record payment' },
      { status: error.message === 'TAB_NOT_IN_BILLING' ? 400 : 500 }
    )
  }
}
