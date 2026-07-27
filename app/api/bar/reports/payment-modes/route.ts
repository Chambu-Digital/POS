// GET /api/bar/reports/payment-modes
// Returns payment method breakdown for closed BarTabs within a date range.
// Query params:
//   from  — ISO date string (required)
//   to    — ISO date string (required)

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const fromStr = searchParams.get('from')
    const toStr   = searchParams.get('to')

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const from = new Date(fromStr)
    const to   = new Date(toStr)
    // Include the full 'to' day
    to.setHours(23, 59, 59, 999)

    const tabs = await models.BarTab.find({
      userId:   ownerId,
      status:   'paid',
      closedAt: { $gte: from, $lte: to },
    })
      .lean() as any[]

    // Aggregate payments by method
    const paymentSummary: Record<string, { count: number; amount: number }> = {
      cash: { count: 0, amount: 0 },
      mobile_money: { count: 0, amount: 0 },
    }

    tabs.forEach(tab => {
      if (tab.payments && Array.isArray(tab.payments)) {
        tab.payments.forEach((payment: any) => {
          const method = payment.method
          if (paymentSummary[method]) {
            paymentSummary[method].count += 1
            paymentSummary[method].amount += payment.amount || 0
          }
        })
      }
    })

    // Convert to array for easier UI rendering
    const paymentModes = Object.entries(paymentSummary).map(([method, data]) => ({
      method,
      label: method === 'cash' ? 'Cash' : 'M-Pesa',
      count: data.count,
      amount: data.amount,
    }))

    const totalAmount = paymentModes.reduce((sum, m) => sum + m.amount, 0)
    const totalCount = paymentModes.reduce((sum, m) => sum + m.count, 0)

    return NextResponse.json({
      paymentModes,
      totalAmount,
      totalCount,
    })
  } catch (error) {
    console.error('[bar/reports/payment-modes] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch payment modes' }, { status: 500 })
  }
}
