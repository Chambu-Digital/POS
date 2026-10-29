import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// GET /api/deposits/[id] — single deposit with consumptions + refunds history
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId =
      payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid deposit id' }, { status: 400 })
    }

    const deposit = await models.Deposit.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    }).lean()

    if (!deposit) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })

    return NextResponse.json({ deposit })
  } catch (error) {
    console.error('[deposits/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch deposit' }, { status: 500 })
  }
}

// PATCH /api/deposits/[id] — status/void update.
// Only 'void' is supported here: an admin can void an erroneously-recorded
// deposit IF it has no consumptions and no refunds yet. Voiding reverses the
// customer's depositBalance and pushes a compensating ledger entry.
// Refunds (returning money to the customer) are handled by the dedicated
// /api/deposits/[id]/refund route, not here.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId =
      payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params
    const body = await request.json()
    const { action, reason } = body

    if (action !== 'void') {
      return NextResponse.json({ error: 'Only "void" action is supported' }, { status: 400 })
    }

    const deposit = await models.Deposit.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    })
    if (!deposit) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })
    if (deposit.status === 'void') {
      return NextResponse.json({ error: 'Deposit already voided' }, { status: 400 })
    }
    // Cannot void a deposit that has already been used or refunded
    if ((deposit.consumptions && deposit.consumptions.length > 0) || (deposit.refunds && deposit.refunds.length > 0)) {
      return NextResponse.json(
        { error: 'Cannot void a deposit that has consumptions or refunds. Process a refund instead.' },
        { status: 400 }
      )
    }

    const remaining = deposit.balance
    deposit.status = 'void'
    deposit.balance = 0
    deposit.note = (deposit.note || '') + ` [VOIDED: ${reason || 'no reason given'}]`
    await deposit.save()

    // Reverse the customer balance + ledger entry
    const customer = await models.Customer.findById(deposit.customerId)
    if (customer) {
      customer.depositBalance = Math.max(0, (customer.depositBalance || 0) - remaining)
      customer.ledger.push({
        date: new Date(),
        type: 'adjustment',
        amount: -remaining, // reverse the prepayment
        balance: customer.depositBalance,
        note: `Voided deposit ${deposit.receiptNo}${reason ? ` — ${reason}` : ''}`,
        depositId: deposit._id,
        collectedBy: new Types.ObjectId(payload.userId),
        collectedByType: payload.type === 'staff' ? 'staff' : 'user',
      })
      await customer.save()
    }

    return NextResponse.json({ deposit, customerBalance: customer?.depositBalance ?? 0 })
  } catch (error) {
    console.error('[deposits/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update deposit' }, { status: 500 })
  }
}
