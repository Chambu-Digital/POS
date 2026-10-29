import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// POST /api/deposits/[id]/refund — return prepayment money to the customer.
//
// This is a real cash OUTFLOW on the refund day, tracked by method in reports.
// Default behaviour: refund to the ORIGINAL deposit method (no approval needed).
// Override: refunding via a DIFFERENT method requires approvedBy + a reason,
// because it shifts which bank/cash total the outflow lands in and can mask
// theft. The frontend should gate the override behind a permission/confirmation.
//
// Body: {
//   amount,                 // <= remaining balance (defaults to remaining)
//   method?,                // override method; defaults to deposit.method
//   bankProviderId?, bankProviderName?,
//   customMethodId?, customMethodName?,
//   paymentReference?,      // mpesa code, cheque no, etc.
//   reason,                 // required
//   approvedBy?,            // required when method !== deposit.method
// }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json()
    const {
      amount,
      method,
      bankProviderId,
      bankProviderName,
      customMethodId,
      customMethodName,
      paymentReference,
      reason,
      approvedBy,
    } = body

    // ── Load deposit ───────────────────────────────────────────────────────
    const deposit = await models.Deposit.findOne({
      _id: new Types.ObjectId(id),
      userId: ownerId,
    })
    if (!deposit) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })
    if (!['active', 'partial'].includes(deposit.status)) {
      return NextResponse.json({
        error: `Cannot refund a deposit with status "${deposit.status}"`,
      }, { status: 400 })
    }

    // ── Determine refund amount (default = full remaining balance) ──────────
    const refundAmount = amount != null ? parseFloat(amount) : deposit.balance
    if (!refundAmount || refundAmount <= 0) {
      return NextResponse.json({ error: 'Refund amount must be greater than 0' }, { status: 400 })
    }
    if (refundAmount > deposit.balance) {
      return NextResponse.json({
        error: `Refund (KSh ${refundAmount}) exceeds remaining balance (KSh ${deposit.balance})`,
      }, { status: 400 })
    }

    // ── Determine method + override gating ──────────────────────────────────
    const refundMethod = method || deposit.method
    if (!['cash', 'card', 'mobile_money', 'bank', 'custom'].includes(refundMethod)) {
      return NextResponse.json({ error: 'Invalid refund method' }, { status: 400 })
    }
    if (refundMethod === 'bank' && !bankProviderId && refundMethod !== deposit.method) {
      return NextResponse.json({ error: 'Bank provider is required for bank refunds' }, { status: 400 })
    }
    if (refundMethod === 'custom' && !customMethodId && refundMethod !== deposit.method) {
      return NextResponse.json({ error: 'Custom payment method is required' }, { status: 400 })
    }

    const isOverride = refundMethod !== deposit.method
    let approvedById: Types.ObjectId | null = null
    let approvedByModel = 'User'
    let refundMethodOverride = ''
    if (isOverride) {
      if (!approvedBy) {
        return NextResponse.json({
          error: 'Refunding via a different method than the original deposit requires approval (approvedBy).',
        }, { status: 403 })
      }
      if (!reason) {
        return NextResponse.json({ error: 'A reason is required for method-override refunds' }, { status: 400 })
      }
      approvedById = new Types.ObjectId(approvedBy)
      refundMethodOverride = refundMethod // record the override on the ledger
    }

    // ── Resolve bank/custom method names if not supplied ──────────────────────
    let resolvedBankName = bankProviderName || ''
    let resolvedCustomName = customMethodName || ''
    if (refundMethod === 'bank' && bankProviderId && !resolvedBankName) {
      const bp = await models.BankProvider.findById(bankProviderId).lean()
      if (bp) resolvedBankName = bp.name
    } else if (refundMethod === 'bank' && refundMethod === deposit.method && !resolvedBankName) {
      resolvedBankName = deposit.bankProviderName || ''
    }
    if (refundMethod === 'custom' && customMethodId && !resolvedCustomName) {
      const cm = await models.PaymentMethod.findById(customMethodId).lean()
      if (cm) resolvedCustomName = cm.name
    } else if (refundMethod === 'custom' && refundMethod === deposit.method && !resolvedCustomName) {
      resolvedCustomName = deposit.customMethodName || ''
    }

    // ── Who processed the refund ───────────────────────────────────────────
    const refundedBy = new Types.ObjectId(payload.userId)
    const refundedByModel = payload.type === 'staff' ? 'Staff' : 'User'

    // ── Push the refund subdoc + decrement deposit balance ───────────────────
    deposit.refunds.push({
      amount: refundAmount,
      method: refundMethod,
      bankProviderId: refundMethod === 'bank' && bankProviderId ? new Types.ObjectId(bankProviderId) : (refundMethod === deposit.method ? deposit.bankProviderId : undefined),
      bankProviderName: resolvedBankName,
      customMethodId: refundMethod === 'custom' && customMethodId ? new Types.ObjectId(customMethodId) : (refundMethod === deposit.method ? deposit.customMethodId : undefined),
      customMethodName: resolvedCustomName,
      paymentReference: paymentReference || '',
      reason: reason || 'Refund of unused deposit',
      refundedBy,
      refundedByModel,
      approvedBy: approvedById || undefined,
      approvedByModel: approvedById ? (payload.type === 'staff' ? 'Staff' : 'User') : undefined,
      refundedAt: new Date(),
    })

    const remainingBeforeRefund = deposit.balance
    deposit.balance = Math.max(0, deposit.balance - refundAmount)
    // A deposit is 'refunded' when its balance hits 0 AND the last movement was a
    // refund (not a consumption). If consumptions exist and balance is 0, it was
    // already marked 'used' by a pickup; leave that status — refunds of an
    // already-used deposit just return any leftover.
    if (deposit.balance === 0 && (deposit.consumptions || []).length === 0) {
      deposit.status = 'refunded'
    } else if (deposit.balance === 0 && (deposit.consumptions || []).length > 0) {
      // Fully drawn down by pickup + any leftover refunded
      deposit.status = 'used'
    } else {
      deposit.status = 'partial'
    }
    await deposit.save()

    // ── Customer ledger: 'deposit_refund' entry (real cash OUT by method) ────
    const customer = await models.Customer.findById(deposit.customerId)
    if (customer) {
      let refundNote = `Refund of deposit ${deposit.receiptNo}`
      if (reason) refundNote += ` — ${reason}`
      if (refundMethod === 'mobile_money' && paymentReference) refundNote += ` (M-Pesa: ${paymentReference})`
      else if (refundMethod === 'bank' && resolvedBankName) refundNote += ` (${resolvedBankName})`
      else if (refundMethod === 'custom' && resolvedCustomName) refundNote += ` (${resolvedCustomName})`
      else if (refundMethod === 'cash') refundNote += ' (Cash)'
      else if (refundMethod === 'card') refundNote += ' (Card)'

      customer.depositBalance = Math.max(0, (customer.depositBalance || 0) - refundAmount)
      customer.ledger.push({
        date: new Date(),
        type: 'deposit_refund',
        amount: -refundAmount, // negative = prepayment returned to customer
        balance: customer.depositBalance,
        note: refundNote,
        paymentMethod: refundMethod,
        mpesaCode: refundMethod === 'mobile_money' ? (paymentReference || undefined) : undefined,
        bankProviderId: refundMethod === 'bank' && bankProviderId ? new Types.ObjectId(bankProviderId) : undefined,
        bankProviderName: resolvedBankName || undefined,
        customMethodId: refundMethod === 'custom' && customMethodId ? new Types.ObjectId(customMethodId) : undefined,
        customMethodName: resolvedCustomName || undefined,
        depositId: deposit._id,
        refundMethodOverride,
        approvedBy: approvedById || undefined,
        collectedBy: refundedBy, // who processed the outflow
        collectedByType: payload.type === 'staff' ? 'staff' : 'user',
      })
      await customer.save()
    }

    return NextResponse.json({
      deposit,
      customerBalance: customer?.depositBalance ?? 0,
      refund: {
        amount: refundAmount,
        method: refundMethod,
        previousBalance: remainingBeforeRefund,
        newBalance: deposit.balance,
        receiptNo: deposit.receiptNo,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[deposits/[id]/refund] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process refund' },
      { status: 500 }
    )
  }
}
