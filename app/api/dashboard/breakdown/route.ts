import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { processLedgerEntries, mergeByPayment } from '@/lib/dashboard-ledger'

/**
 * GET /api/dashboard/breakdown
 *
 * Returns all of today's transactions that make up the dashboard Today's Summary.
 * Uses the shared processLedgerEntries helper (lib/dashboard-ledger.ts) so
 * byPayment totals are identical to what stats/route.ts produces — no more
 * disagreement between summary chips and drill-down numbers.
 *
 * ?filter=cash|mobile_money|card|<bankName>|credit_issued|credit_collected|
 *         deposit_receipts|source_pos|source_kds|source_rental|source_hospitality
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const isStaff = payload.type === 'staff'
    const ownerId = isStaff && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || ''

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const branchFilter = branchContext ? { branchId: branchContext } : {}
    const staffFilter  = isStaff ? { staffId: payload.userId } : {}
    const staffScopeId = isStaff ? payload.userId : null
    const tenantId     = payload.mongoUri || payload.userId

    // ── 1. Today's retail sales ───────────────────────────────────────────────
    const allSales = await models.Sale.find({
      userId:    ownerId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      ...staffFilter,
      ...branchFilter,
    })
      .populate('staffId', 'name firstName lastName')
      .lean()

    // ── 2. Today's hospitality orders ─────────────────────────────────────────
    const allHospitality = models.HospitalityOrder
      ? await models.HospitalityOrder.find({
          tenantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status:    'completed',
          ...(isStaff ? { servedBy: payload.userId } : {}),
        }).lean()
      : []

    // ── 3. Today's customer ledger (credit settlements + deposit receipts) ────
    // Single query for all cash-movement ledger types; processLedgerEntries
    // splits them into the right buckets.
    const customersWithEntries = await models.Customer.find({
      userId:      ownerId,
      'ledger.date': { $gte: todayStart, $lte: todayEnd },
      'ledger.type': { $in: ['payment', 'deposit', 'deposit_refund'] },
    }).lean()

    const {
      creditPayments,
      depositReceipts,
      byPaymentFromLedger,
    } = processLedgerEntries(customersWithEntries, todayStart, todayEnd, staffScopeId)

    // ── 4. Normalise retail sales → unified transaction shape ─────────────────
    const retailTransactions = allSales.map((sale: any) => {
      const payments: Array<{ method: string; displayName: string; amount: number }> = []

      if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
        sale.payments.forEach((p: any) => {
          // 'deposit' is an internal transfer (drawing a customer prepayment) — it
          // is NOT new cash today. Exclude it from the payment rows on the
          // transaction so it doesn't inflate cash totals here. The corresponding
          // cash inflow is already captured via the customer ledger (type:'deposit').
          if ((p.method || '').toLowerCase() === 'deposit') return
          const methodKey = p.customMethodName || p.method || 'cash'
          payments.push({
            method:      methodKey,
            displayName: formatMethodName(methodKey),
            amount:      p.amount || 0,
          })
        })
      } else {
        const m = sale.paymentMethod || 'cash'
        if (m.toLowerCase() !== 'deposit') {
          payments.push({ method: m, displayName: formatMethodName(m), amount: sale.total })
        }
      }

      const staffName = sale.staffId
        ? sale.staffId.firstName && sale.staffId.lastName
          ? `${sale.staffId.firstName} ${sale.staffId.lastName}`.trim()
          : sale.staffId.name || 'Staff'
        : 'Owner'

      return {
        _id:         sale._id.toString(),
        orderNumber: sale.orderNumber || sale._id.toString().slice(-6).toUpperCase(),
        source:      (sale.source || 'pos') as string,
        total:       sale.total,
        discount:    sale.discount || 0,
        debt:        sale.debt || 0,
        payments,
        customerName: sale.customerName || '',
        staffName,
        createdAt: sale.createdAt,
        items: (sale.items || []).map((item: any) => ({
          productName: item.productName,
          quantity:    item.quantity,
          price:       item.price,
        })),
        type: 'sale' as const,
      }
    })

    // ── 5. Normalise hospitality orders ───────────────────────────────────────
    const hospitalityTransactions = allHospitality.map((order: any) => ({
      _id:         order._id.toString(),
      orderNumber: order.orderNumber || order._id.toString().slice(-6).toUpperCase(),
      source:      'hospitality' as string,
      total:       order.total,
      discount:    order.discount || 0,
      debt:        0,
      payments: (() => {
        if (order.payments && Array.isArray(order.payments) && order.payments.length > 0) {
          return order.payments
            .filter((p: any) => (p.method || '').toLowerCase() !== 'deposit')
            .map((p: any) => {
              const methodKey = p.customMethodName || p.method || 'cash'
              return { method: methodKey, displayName: formatMethodName(methodKey), amount: p.amount || 0 }
            })
        }
        const m = order.paymentMethod || 'cash'
        return [{ method: m, displayName: formatMethodName(m), amount: order.total }]
      })(),
      customerName: order.customerName || '',
      staffName:    order.waiterName || order.servedByName || '',
      createdAt:    order.createdAt,
      items: (order.items || []).map((item: any) => ({
        productName: item.name,
        quantity:    item.quantity,
        price:       item.unitPrice || item.totalPrice / (item.quantity || 1),
      })),
      type: 'sale' as const,
    }))

    let allTransactions = [...retailTransactions, ...hospitalityTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // ── 6. Build byPayment from sales (skip 'deposit' and 'credit') ───────────
    const byPaymentFromSales: Record<string, number> = {}
    allTransactions.forEach(t => {
      t.payments.forEach(p => {
        if (p.method.toLowerCase() === 'credit')  return
        if (p.method.toLowerCase() === 'deposit') return  // already in ledger
        const otherMethodsTotal = t.payments
          .filter(op => op.method !== p.method && op.method.toLowerCase() !== 'credit')
          .reduce((s, op) => s + op.amount, 0)
        const maxForMethod = Math.max(0, t.total - otherMethodsTotal)
        byPaymentFromSales[p.method] = (byPaymentFromSales[p.method] || 0) + Math.min(p.amount, maxForMethod)
      })
    })

    // Merge sales + ledger (credit settlements + deposit receipts) additively
    const byPayment = mergeByPayment(byPaymentFromSales, byPaymentFromLedger)

    // ── 7. Apply filter ───────────────────────────────────────────────────────
    let filteredTransactions     = allTransactions
    let filteredCreditPayments   = creditPayments
    let filteredDepositReceipts  = depositReceipts

    if (filter) {
      if (filter === 'credit_collected') {
        filteredTransactions    = []
        filteredDepositReceipts = []
      } else if (filter === 'deposit_receipts') {
        filteredTransactions   = []
        filteredCreditPayments = []
        // depositReceipts stays unfiltered (show all deposit receipts)
      } else if (filter === 'credit_issued') {
        filteredTransactions    = allTransactions.filter(t => t.debt > 0)
        filteredCreditPayments  = []
        filteredDepositReceipts = []
      } else if (filter.startsWith('source_')) {
        const src = filter.replace('source_', '')
        filteredTransactions    = allTransactions.filter(t => t.source === src)
        filteredCreditPayments  = []
        filteredDepositReceipts = []
      } else {
        // Payment method filter (cash, mobile_money, card, bank name, custom name)
        // Transactions that have ANY payment entry with this method
        filteredTransactions = allTransactions.filter(t =>
          t.payments.some(p => p.method.toLowerCase() === filter.toLowerCase())
        )
        filteredCreditPayments = creditPayments.filter(cp => {
          // Credit payments don't carry a method on the creditPayments object, so
          // they don't appear in method-specific filter views (they have their own
          // filter: credit_collected).
          return false
        })
        // Deposit receipts whose method key matches the filter
        filteredDepositReceipts = depositReceipts.filter(
          dr => dr.methodKey.toLowerCase() === filter.toLowerCase()
        )
      }
    }

    // ── 8. Summary totals ─────────────────────────────────────────────────────
    const totalFromSales       = allTransactions.reduce((s, t) => s + t.total, 0)
    const totalCreditCollected = creditPayments.reduce((s, c) => s + c.amount, 0)
    const totalRevenue         = totalFromSales + totalCreditCollected

    const bySource: Record<string, number> = {}
    allTransactions.forEach(t => {
      bySource[t.source] = (bySource[t.source] || 0) + t.total
    })

    return NextResponse.json({
      summary: {
        totalOrders:      allTransactions.length,
        totalRevenue,
        bySource,
        byPayment,
        creditIssued:     allTransactions.reduce((s, t) => s + t.debt, 0),
        creditCollected:  totalCreditCollected,
        depositsReceived: depositReceipts.reduce((s, d) => s + d.amount, 0),
      },
      transactions:       filteredTransactions,
      creditPayments:     filteredCreditPayments,
      depositReceipts:    filteredDepositReceipts,
      filter,
    })
  } catch (error) {
    console.error('[Dashboard Breakdown] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch breakdown data' }, { status: 500 })
  }
}

function formatMethodName(method: string): string {
  if (method === 'mobile_money') return 'M-Pesa'
  if (method === 'cash')         return 'Cash'
  if (method === 'card')         return 'Card'
  if (method === 'bank_transfer' || method === 'bank') return 'Bank Transfer'
  if (method === 'credit')       return 'Credit'
  return method.charAt(0).toUpperCase() + method.slice(1)
}
