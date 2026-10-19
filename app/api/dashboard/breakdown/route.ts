import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/dashboard/breakdown
 *
 * Returns all of today's transactions that make up the dashboard Today's Summary.
 * Supports optional filtering via query params:
 *   ?filter=cash|mobile_money|card|bank_transfer|credit_issued|credit_collected|source_pos|source_kds|source_rental|source_hospitality
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
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const branchFilter = branchContext ? { branchId: branchContext } : {}
    const staffFilter = isStaff ? { staffId: payload.userId } : {}
    const tenantId = payload.mongoUri || payload.userId

    // ── Fetch all today's retail sales ─────────────────────────────────────────
    const allSales = await models.Sale.find({
      userId: ownerId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      ...staffFilter,
      ...branchFilter,
    })
      .populate('staffId', 'name firstName lastName')
      .lean()

    // ── Fetch all today's hospitality orders ──────────────────────────────────
    const allHospitality = models.HospitalityOrder
      ? await models.HospitalityOrder.find({
          tenantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: 'completed',
          ...(isStaff ? { servedBy: payload.userId } : {}),
        }).lean()
      : []

    // ── Fetch today's credit payments (from customer ledger) ──────────────────
    const customersWithPayments = await models.Customer.find({
      userId: ownerId,
      'ledger.date': { $gte: todayStart, $lte: todayEnd },
      'ledger.type': 'payment',
    }).lean()

    const creditPayments: Array<{
      _id: string
      customerName: string
      amount: number
      note: string
      date: Date
    }> = []

    customersWithPayments.forEach((customer: any) => {
      customer.ledger.forEach((entry: any) => {
        const entryDate = new Date(entry.date)
        if (
          entryDate >= todayStart &&
          entryDate <= todayEnd &&
          entry.type === 'payment' &&
          entry.amount < 0
        ) {
          // Staff only see credit they personally collected
          if (isStaff && entry.collectedBy?.toString() !== payload.userId) return
          creditPayments.push({
            _id: entry._id?.toString() || `${customer._id}-${entry.date}`,
            customerName: customer.name,
            amount: Math.abs(entry.amount),
            note: entry.note || '',
            date: entry.date,
          })
        }
      })
    })

    // ── Normalise retail sales into unified transaction shape ─────────────────
    const retailTransactions = allSales.map((sale: any) => {
      const payments: Array<{ method: string; displayName: string; amount: number }> = []

      if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
        sale.payments.forEach((p: any) => {
          const methodKey = p.customMethodName || p.method || 'cash'
          payments.push({
            method: methodKey,
            displayName: formatMethodName(methodKey),
            amount: p.amount || 0,
          })
        })
      } else {
        const m = sale.paymentMethod || 'cash'
        payments.push({
          method: m,
          displayName: formatMethodName(m),
          amount: sale.total,
        })
      }

      const staffName = sale.staffId
        ? sale.staffId.firstName && sale.staffId.lastName
          ? `${sale.staffId.firstName} ${sale.staffId.lastName}`.trim()
          : sale.staffId.name || 'Staff'
        : 'Owner'

      return {
        _id: sale._id.toString(),
        orderNumber: sale.orderNumber || sale._id.toString().slice(-6).toUpperCase(),
        source: (sale.source || 'pos') as string,
        total: sale.total,
        discount: sale.discount || 0,
        debt: sale.debt || 0,
        payments,
        customerName: sale.customerName || '',
        staffName,
        createdAt: sale.createdAt,
        items: (sale.items || []).map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
        })),
        type: 'sale' as const,
      }
    })

    // ── Normalise hospitality orders ──────────────────────────────────────────
    const hospitalityTransactions = allHospitality.map((order: any) => ({
      _id: order._id.toString(),
      orderNumber: order.orderNumber || order._id.toString().slice(-6).toUpperCase(),
      source: 'hospitality' as string,
      total: order.total,
      discount: order.discount || 0,
      debt: 0,
      payments: (() => {
        if (order.payments && Array.isArray(order.payments) && order.payments.length > 0) {
          return order.payments.map((p: any) => {
            const methodKey = p.customMethodName || p.method || 'cash'
            return { method: methodKey, displayName: formatMethodName(methodKey), amount: p.amount || 0 }
          })
        }
        const m = order.paymentMethod || 'cash'
        return [{ method: m, displayName: formatMethodName(m), amount: order.total }]
      })(),
      customerName: order.customerName || '',
      staffName: order.waiterName || order.servedByName || '',
      createdAt: order.createdAt,
      items: (order.items || []).map((item: any) => ({
        productName: item.name,
        quantity: item.quantity,
        price: item.unitPrice || item.totalPrice / (item.quantity || 1),
      })),
      type: 'sale' as const,
    }))

    let allTransactions = [...retailTransactions, ...hospitalityTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // ── Apply filter ──────────────────────────────────────────────────────────
    let filteredTransactions = allTransactions
    let filteredCreditPayments = creditPayments

    if (filter) {
      if (filter === 'credit_collected') {
        filteredTransactions = []
        // creditPayments stays as-is
      } else if (filter === 'credit_issued') {
        filteredTransactions = allTransactions.filter(t => t.debt > 0)
        filteredCreditPayments = []
      } else if (filter.startsWith('source_')) {
        const src = filter.replace('source_', '')
        filteredTransactions = allTransactions.filter(t => t.source === src)
        filteredCreditPayments = []
      } else {
        // Payment method filter (cash, mobile_money, card, bank_transfer, or custom name)
        filteredTransactions = allTransactions.filter(t =>
          t.payments.some(p => p.method.toLowerCase() === filter.toLowerCase())
        )
        filteredCreditPayments = []
      }
    }

    // ── Build summary totals ──────────────────────────────────────────────────
    const totalFromSales = allTransactions.reduce((s, t) => s + t.total, 0)
    const totalCreditCollected = creditPayments.reduce((s, c) => s + c.amount, 0)
    const totalRevenue = totalFromSales + totalCreditCollected

    const bySource: Record<string, number> = {}
    allTransactions.forEach(t => {
      bySource[t.source] = (bySource[t.source] || 0) + t.total
    })

    const byPayment: Record<string, number> = {}
    allTransactions.forEach(t => {
      t.payments.forEach(p => {
        if (p.method.toLowerCase() === 'credit') return
        // For each method, cap its contribution at (sale total minus what other methods covered).
        // This strips out change given back on cash payments.
        const otherMethodsTotal = t.payments
          .filter(op => op.method !== p.method && op.method.toLowerCase() !== 'credit')
          .reduce((s, op) => s + op.amount, 0)
        const maxForMethod = Math.max(0, t.total - otherMethodsTotal)
        byPayment[p.method] = (byPayment[p.method] || 0) + Math.min(p.amount, maxForMethod)
      })
    })

    return NextResponse.json({
      summary: {
        totalOrders: allTransactions.length,
        totalRevenue,
        bySource,
        byPayment,
        creditIssued: allTransactions.reduce((s, t) => s + t.debt, 0),
        creditCollected: totalCreditCollected,
      },
      transactions: filteredTransactions,
      creditPayments: filteredCreditPayments,
      filter,
    })
  } catch (error) {
    console.error('[Dashboard Breakdown] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch breakdown data' }, { status: 500 })
  }
}

function formatMethodName(method: string): string {
  if (method === 'mobile_money') return 'M-Pesa'
  if (method === 'cash') return 'Cash'
  if (method === 'card') return 'Card'
  if (method === 'bank_transfer' || method === 'bank') return 'Bank Transfer'
  if (method === 'credit') return 'Credit'
  return method.charAt(0).toUpperCase() + method.slice(1)
}
