import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''

    // Build date filter
    const dateFilter: any = {}
    if (from && to) {
      dateFilter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59.999Z')
      }
    }

    // Get all customers with credit activity
    const customers = await models.Customer.find({ 
      userId: ownerId,
      $or: [
        { creditBalance: { $gt: 0 } },
        { 'ledger.type': 'purchase' }
      ]
    }).lean()

    // Filter ledger entries by date range and calculate credit sales
    const creditTransactions: any[] = []
    let totalCreditSales = 0
    let totalCreditPayments = 0

    for (const customer of customers as any[]) {
      if (customer.ledger && customer.ledger.length > 0) {
        for (const entry of customer.ledger) {
          const entryDate = new Date(entry.date)
          const inRange = (!from || !to) || (
            entryDate >= new Date(from) && entryDate <= new Date(to + 'T23:59:59.999Z')
          )

          if (inRange) {
            if (entry.type === 'purchase') {
              totalCreditSales += entry.amount
              creditTransactions.push({
                customerName: customer.name,
                customerPhone: customer.phone,
                type: 'purchase',
                amount: entry.amount,
                balance: entry.balance,
                date: entry.date,
                note: entry.note
              })
            } else if (entry.type === 'payment') {
              totalCreditPayments += Math.abs(entry.amount)
              creditTransactions.push({
                customerName: customer.name,
                customerPhone: customer.phone,
                type: 'payment',
                amount: entry.amount,
                balance: entry.balance,
                date: entry.date,
                note: entry.note
              })
            }
          }
        }
      }
    }

    // Calculate outstanding credit
    const totalOutstanding = customers.reduce((sum: number, c: any) => sum + (c.creditBalance || 0), 0)

    // Group by customer for summary
    const customerSummary = customers.map((c: any) => ({
      _id: c._id,
      name: c.name,
      phone: c.phone,
      creditBalance: c.creditBalance || 0,
      creditLimit: c.creditLimit || 0,
      availableCredit: Math.max(0, (c.creditLimit || 0) - (c.creditBalance || 0))
    })).filter((c: any) => c.creditBalance > 0)

    return NextResponse.json({
      creditTransactions,
      customerSummary,
      totalCreditSales,
      totalCreditPayments,
      totalOutstanding,
      customerCount: customerSummary.length
    })
  } catch (error) {
    console.error('[bar/reports/credit] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch credit report' }, { status: 500 })
  }
}
