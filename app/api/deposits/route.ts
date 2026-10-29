import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── Customer Deposits — list & take ──────────────────────────────────────────
// A deposit is money the customer prepays (real cash by method, already counted
// in the day's per-method totals) that they later draw down against pickups.
// See lib/models/schemas.ts → depositSchema for the full lifecycle.

// Generate a per-tenant deposit receipt number: DEP-YYYY-NNNN
async function generateDepositNo(models: any, ownerId: string): Promise<string> {
  const year = new Date().getFullYear()
  // Count deposits this year for this tenant to build a monotonic sequence
  const count = await models.Deposit.countDocuments({
    userId: ownerId,
    receiptNo: { $regex: `^DEP-${year}-` },
  })
  return `DEP-${year}-${String(count + 1).padStart(4, '0')}`
}

// GET /api/deposits?customerId=...&status=active,partial&from=...&to=...
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId =
      payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const url = new URL(request.url)
    const customerId = url.searchParams.get('customerId')
    const statusParam = url.searchParams.get('status') // comma-separated
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const query: any = { userId: ownerId }
    if (branchContext) query.branchId = new Types.ObjectId(branchContext)
    if (customerId) query.customerId = new Types.ObjectId(customerId)
    if (statusParam) {
      query.status = { $in: statusParam.split(',').map((s) => s.trim()) }
    }
    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = new Date(from)
      if (to) query.createdAt.$lte = new Date(to + 'T23:59:59.999')
    }

    const deposits = await models.Deposit.find(query)
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ deposits })
  } catch (error) {
    console.error('[deposits] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch deposits' }, { status: 500 })
  }
}

// POST /api/deposits  — take a customer prepayment
// Body: { customerId, amount, method, bankProviderId?, customMethodId?, mpesaCode?,
//         mpesaPhone?, paymentReference?, note? }
// Creates the Deposit doc, pushes a 'deposit' ledger entry (real cash by method),
// and $inc's the customer's depositBalance. Returns the deposit + updated balance.
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId =
      payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const body = await request.json()
    const {
      customerId,
      amount,
      method,
      bankProviderId,
      bankProviderName,
      customMethodId,
      customMethodName,
      mpesaCode,
      mpesaPhone,
      paymentReference,
      note,
    } = body

    // ── Validation ──────────────────────────────────────────────────────────
    if (!customerId) return NextResponse.json({ error: 'Customer is required' }, { status: 400 })
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
    if (!method) return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    if (!['cash', 'card', 'mobile_money', 'bank', 'custom'].includes(method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }
    if (method === 'bank' && !bankProviderId) {
      return NextResponse.json({ error: 'Bank provider is required for bank payments' }, { status: 400 })
    }
    if (method === 'custom' && !customMethodId) {
      return NextResponse.json({ error: 'Custom payment method is required' }, { status: 400 })
    }

    // ── Load customer ───────────────────────────────────────────────────────
    const customer = await models.Customer.findById(customerId)
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    if (customer.userId.toString() !== ownerId.toString()) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // ── Resolve bank/custom method names if not supplied ──────────────────────
    let resolvedBankName = bankProviderName || ''
    let resolvedCustomName = customMethodName || ''
    if (method === 'bank' && bankProviderId && !resolvedBankName) {
      const bp = await models.BankProvider.findById(bankProviderId).lean()
      if (bp) resolvedBankName = bp.name
    }
    if (method === 'custom' && customMethodId && !resolvedCustomName) {
      const cm = await models.PaymentMethod.findById(customMethodId).lean()
      if (cm) resolvedCustomName = cm.name
    }

    // ── Generate receipt number ──────────────────────────────────────────────
    const receiptNo = await generateDepositNo(models, ownerId)

    // ── Determine who is creating the deposit (for audit) ───────────────────
    const createdBy = new Types.ObjectId(payload.userId)
    const createdByModel = payload.type === 'staff' ? 'Staff' : 'User'

    // ── Create the Deposit document ───────────────────────────────────────────
    const deposit = new models.Deposit({
      userId: ownerId,
      branchId: branchContext ? new Types.ObjectId(branchContext) : null,
      receiptNo,
      customerId: new Types.ObjectId(customerId),
      customerName: customer.name,
      customerPhone: customer.phone || '',
      amount: amt,
      balance: amt,
      status: 'active',
      method,
      bankProviderId: method === 'bank' && bankProviderId ? new Types.ObjectId(bankProviderId) : null,
      bankProviderName: resolvedBankName,
      customMethodId: method === 'custom' && customMethodId ? new Types.ObjectId(customMethodId) : null,
      customMethodName: resolvedCustomName,
      mpesaCode: method === 'mobile_money' ? (mpesaCode || '') : '',
      mpesaPhone: method === 'mobile_money' ? (mpesaPhone || '') : '',
      paymentReference: paymentReference || '',
      consumptions: [],
      refunds: [],
      note: note || '',
      createdBy,
      createdByModel,
    })
    await deposit.save()

    // ── Push customer ledger entry & increment depositBalance ────────────────
    // 'deposit' = real cash received by method. The end-of-day report reads
    // ledger entries of type 'deposit' to build the "Deposits Received Today"
    // section, attributing them to collectedBy.
    let ledgerNote = note || 'Customer prepayment'
    if (method === 'mobile_money' && mpesaCode) ledgerNote += ` (M-Pesa: ${mpesaCode})`
    else if (method === 'bank' && resolvedBankName) ledgerNote += ` (${resolvedBankName})`
    else if (method === 'custom' && resolvedCustomName) ledgerNote += ` (${resolvedCustomName})`
    else if (method === 'cash') ledgerNote += ' (Cash)'
    else if (method === 'card') ledgerNote += ' (Card)'

    customer.depositBalance = (customer.depositBalance || 0) + amt
    customer.ledger.push({
      date: new Date(),
      type: 'deposit',
      amount: amt, // positive = prepayment received (we owe them)
      balance: customer.depositBalance,
      note: ledgerNote,
      paymentMethod: method,
      mpesaCode: method === 'mobile_money' ? mpesaCode || undefined : undefined,
      mpesaPhone: method === 'mobile_money' ? mpesaPhone || undefined : undefined,
      bankProviderId: method === 'bank' && bankProviderId ? new Types.ObjectId(bankProviderId) : undefined,
      bankProviderName: resolvedBankName || undefined,
      customMethodId: method === 'custom' && customMethodId ? new Types.ObjectId(customMethodId) : undefined,
      customMethodName: resolvedCustomName || undefined,
      depositId: deposit._id,
      collectedBy: createdBy,
      collectedByType: payload.type === 'staff' ? 'staff' : 'user',
    })
    await customer.save()

    return NextResponse.json(
      {
        deposit,
        customerBalance: customer.depositBalance,
        creditBalance: customer.creditBalance,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[deposits] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create deposit' },
      { status: 500 }
    )
  }
}
