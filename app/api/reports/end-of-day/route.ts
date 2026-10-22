import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { normalisePermissions } from '@/lib/modules'

// ── helper: cap a payment amount at its actual revenue share (strips cash change) ──
// Mirrors the same helper in /api/dashboard/stats so numbers are consistent.
function cappedPaymentAmount(payment: any, allPayments: any[], saleTotal: number): number {
  const methodName = payment.customMethodName || payment.method || 'cash'
  const otherTotal = allPayments
    .filter((op: any) => {
      const opName = op.customMethodName || op.method || 'cash'
      return opName !== methodName && opName.toLowerCase() !== 'credit'
    })
    .reduce((s: number, op: any) => s + (op.amount || 0), 0)
  return Math.min(payment.amount || 0, Math.max(0, saleTotal - otherTotal))
}

// ── helper: resolve a payment method display name ────────────────────────────
function resolveMethodName(payment: any): string {
  if (payment.method === 'cash') return 'Cash'
  if (payment.method === 'mobile_money') return 'M-Pesa'
  if (payment.method === 'bank' && payment.bankProviderName) return payment.bankProviderName
  if (payment.method === 'custom' && payment.customMethodName) return payment.customMethodName
  return payment.method || 'Other'
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const isStaff = payload.type === 'staff'
    const ownerId = isStaff && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    // Staff without pos.reports permission only see their own records
    const perms = isStaff ? normalisePermissions(payload.permissions || {}) : null
    const canSeeFullReport = !isStaff || perms?.['pos.reports'] === true
    const staffScopeId = isStaff && !canSeeFullReport ? payload.userId : null

    if (!branchContext) {
      return NextResponse.json({ error: 'Branch context required' }, { status: 400 })
    }

    // Get date parameter (defaults to today)
    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    const reportDate = dateParam ? new Date(dateParam) : new Date()
    
    // Set to start and end of day
    const startOfDay = new Date(reportDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(reportDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Fetch branch details
    const branch = await models.Branch.findById(branchContext).lean()
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. FETCH SALES FOR THE DAY
    // ─────────────────────────────────────────────────────────────────────────
    const sales = await models.Sale.find({
      userId: ownerId,
      branchId: branchContext,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'held' },
      ...(staffScopeId ? { staffId: new Types.ObjectId(staffScopeId) } : {}),
    }).lean()

    // ─────────────────────────────────────────────────────────────────────────
    // 2. AGGREGATE PAYMENT METHODS BY EMPLOYEE
    // ─────────────────────────────────────────────────────────────────────────
    const paymentsByEmployee = new Map<string, Map<string, number>>()
    const allPaymentMethods = new Set<string>()
    const staffIds = new Set<string>()

    for (const sale of sales) {
      const saleStaffId = sale.staffId ? sale.staffId.toString() : 'owner'
      staffIds.add(saleStaffId)

      if (!paymentsByEmployee.has(saleStaffId)) {
        paymentsByEmployee.set(saleStaffId, new Map())
      }
      const employeePayments = paymentsByEmployee.get(saleStaffId)!

      // Process payments array (new format) — cap each payment to its revenue
      // share so we never count cash change as revenue (mirrors dashboard stats).
      if (sale.payments && Array.isArray(sale.payments)) {
        for (const payment of sale.payments) {
          if ((payment.method || '').toLowerCase() === 'credit') continue

          const methodName = resolveMethodName(payment)
          const capped = cappedPaymentAmount(payment, sale.payments, sale.total)

          allPaymentMethods.add(methodName)
          const currentAmount = employeePayments.get(methodName) || 0
          employeePayments.set(methodName, currentAmount + capped)
        }
      } else if (sale.paymentMethod) {
        // Legacy single payment format — use sale.total (revenue), not amountPaid
        if (sale.paymentMethod.toLowerCase() === 'credit') continue

        let methodName = ''
        if (sale.paymentMethod === 'cash') {
          methodName = 'Cash'
        } else if (sale.paymentMethod === 'mobile_money') {
          methodName = 'M-Pesa'
        } else {
          methodName = sale.paymentMethod
        }
        
        allPaymentMethods.add(methodName)
        const currentAmount = employeePayments.get(methodName) || 0
        employeePayments.set(methodName, currentAmount + (sale.total || 0))
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FETCH CREDIT PAYMENTS RECEIVED TODAY
    // ─────────────────────────────────────────────────────────────────────────
    const customers = await models.Customer.find({
      userId: ownerId,
      'ledger.date': { $gte: startOfDay, $lte: endOfDay },
      'ledger.type': 'payment'
    }).lean()

    const creditPaymentsReceived: any[] = []
    
    for (const customer of customers) {
      for (const entry of customer.ledger) {
        const entryDate = new Date(entry.date)
        if (
          entryDate >= startOfDay &&
          entryDate <= endOfDay &&
          entry.type === 'payment' &&
          entry.amount < 0
        ) {
          // Scope to this staff member's collections if not full-report view
          if (staffScopeId && entry.collectedBy?.toString() !== staffScopeId) continue

          const paymentAmount = Math.abs(entry.amount)

          // Attribute to whoever collected it (collectedBy), fallback to owner
          const collectorId = entry.collectedBy?.toString() || 'owner'
          staffIds.add(collectorId)
          if (!paymentsByEmployee.has(collectorId)) {
            paymentsByEmployee.set(collectorId, new Map())
          }

          let methodName = ''
          if (entry.paymentMethod === 'cash') {
            methodName = 'Cash'
          } else if (entry.paymentMethod === 'mobile_money') {
            methodName = 'M-Pesa'
          } else if (entry.paymentMethod === 'bank' && entry.bankProviderName) {
            methodName = entry.bankProviderName
          } else if (entry.paymentMethod === 'custom' && entry.customMethodName) {
            methodName = entry.customMethodName
          } else if (entry.paymentMethod) {
            methodName = entry.paymentMethod
          } else {
            methodName = 'Cash'
          }

          allPaymentMethods.add(methodName)
          const employeePayments = paymentsByEmployee.get(collectorId)!
          employeePayments.set(methodName, (employeePayments.get(methodName) || 0) + paymentAmount)

          creditPaymentsReceived.push({
            customerId: customer._id,
            customerName: customer.name,
            amount: paymentAmount,
            paymentMethod: methodName,
            mpesaCode: entry.mpesaCode || '',
            remainingBalance: entry.balance,
            timestamp: entry.date,
            note: entry.note,
            collectedBy: collectorId,
          })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. FETCH STAFF DETAILS
    // ─────────────────────────────────────────────────────────────────────────
    const staffIdsArray = Array.from(staffIds).filter(id => id !== 'owner')
    const staffMap = new Map<string, any>()
    
    if (staffIdsArray.length > 0) {
      const staff = await conn.db.collection('staff')
        .find({ _id: { $in: staffIdsArray.map(id => new Types.ObjectId(id)) } })
        .toArray()

      staff.forEach((s: any) => {
        const name = s.firstName && s.lastName 
          ? `${s.firstName} ${s.lastName}`.trim()
          : s.name || s.email || 'Staff'
        staffMap.set(s._id.toString(), name)
      })
    }

    // Get owner info
    const owner = await conn.db.collection('users').findOne({ _id: new Types.ObjectId(ownerId) }) as any
    const ownerName = owner?.firstName && owner?.lastName
      ? `${owner.firstName} ${owner.lastName}`.trim()
      : owner?.shopName || owner?.name || owner?.email || 'Owner'
    staffMap.set('owner', ownerName)

    // ─────────────────────────────────────────────────────────────────────────
    // 5. BUILD PAYMENT METHODS TABLE
    // ─────────────────────────────────────────────────────────────────────────
    const paymentMethodsArray = Array.from(allPaymentMethods).sort()
    const employeeBreakdown: any[] = []
    let totalsByMethod = new Map<string, number>()

    for (const [staffId, payments] of paymentsByEmployee.entries()) {
      const employeeName = staffMap.get(staffId) || 'Unknown'
      const row: any = {
        staffId,
        employeeName,
        methods: {},
        total: 0
      }

      for (const method of paymentMethodsArray) {
        const amount = payments.get(method) || 0
        row.methods[method] = amount
        row.total += amount
        
        const currentTotal = totalsByMethod.get(method) || 0
        totalsByMethod.set(method, currentTotal + amount)
      }

      employeeBreakdown.push(row)
    }

    // Sort by employee name
    employeeBreakdown.sort((a, b) => {
      if (a.employeeName === ownerName) return -1
      if (b.employeeName === ownerName) return 1
      return a.employeeName.localeCompare(b.employeeName)
    })

    // Calculate grand total
    const grandTotal = Array.from(totalsByMethod.values()).reduce((sum, val) => sum + val, 0)

    // ─────────────────────────────────────────────────────────────────────────
    // 6. CREDIT SALES (UNPAID/PARTIAL)
    // ─────────────────────────────────────────────────────────────────────────
    const creditSales = sales.filter(s => s.paymentStatus === 'unpaid' || s.paymentStatus === 'partial')
    const creditSalesFormatted = creditSales.map(sale => ({
      _id: sale._id,
      orderNumber: sale.orderNumber,
      customerName: sale.customerName || 'Walk-in',
      total: sale.total,
      amountPaid: sale.amountPaid || 0,
      debt: sale.debt || 0,
      paymentStatus: sale.paymentStatus,
      staffId: sale.staffId,
      staffName: sale.staffId ? staffMap.get(sale.staffId.toString()) : ownerName,
      createdAt: sale.createdAt
    }))

    // ─────────────────────────────────────────────────────────────────────────
    // 7. EXPENSES
    // ─────────────────────────────────────────────────────────────────────────
    const approvedExpenses = await models.Expense.find({
      userId: ownerId,
      branchId: branchContext,
      status: 'approved',
      paymentDate: { $gte: startOfDay, $lte: endOfDay },
      ...(staffScopeId ? { $or: [{ staffId: new Types.ObjectId(staffScopeId) }, { paidBy: new Types.ObjectId(staffScopeId) }] } : {}),
    }).lean()

    const pendingExpenses = await models.Expense.find({
      userId: ownerId,
      branchId: branchContext,
      status: 'pending',
      ...(staffScopeId ? { $or: [{ staffId: new Types.ObjectId(staffScopeId) }, { paidBy: new Types.ObjectId(staffScopeId) }] } : {}),
    }).lean()

    const expensesFormatted = approvedExpenses.map(exp => {
      let methodName = ''
      if (exp.paymentMethod === 'cash') {
        methodName = 'Cash'
      } else if (exp.paymentMethod === 'mobile_money') {
        methodName = 'M-Pesa'
      } else if (exp.paymentMethod === 'bank' && exp.bankProviderName) {
        methodName = exp.bankProviderName
      } else if (exp.paymentMethod === 'custom' && exp.customMethodName) {
        methodName = exp.customMethodName
      } else {
        methodName = exp.paymentMethod || 'N/A'
      }

      const paidByName = exp.paidBy 
        ? staffMap.get(exp.paidBy.toString()) || 'Staff'
        : ownerName

      return {
        _id: exp._id,
        title: exp.title,
        category: exp.category || 'Uncategorized',
        amount: exp.amount,
        paymentMethod: methodName,
        paidBy: paidByName,
        paymentDate: exp.paymentDate,
        receiptNumber: exp.receiptNumber || ''
      }
    })

    const totalExpenses = expensesFormatted.reduce((sum, exp) => sum + exp.amount, 0)
    const pendingExpensesTotal = pendingExpenses.reduce((sum, exp) => sum + exp.amount, 0)

    // ─────────────────────────────────────────────────────────────────────────
    // 8. BUILD SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    const totalSales = sales.length
    const totalSalesAmount = sales.reduce((sum, sale) => sum + sale.total, 0)
    const totalCreditIssued = sales
      .filter(s => s.paymentStatus !== 'paid')
      .reduce((sum, sale) => sum + (sale.debt || 0), 0)

    // grandTotal already includes capped sales payments + credit repayments received
    const totalCollected = grandTotal

    const report = {
      branch: {
        _id: branch._id,
        name: branch.name
      },
      date: reportDate,
      generatedAt: new Date(),
      isStaffView: !!staffScopeId,
      generatedBy: {
        name: staffScopeId ? (staffMap.get(staffScopeId) || 'Staff') : ownerName,
        type: payload.type
      },
      summary: {
        totalSales,
        totalSalesAmount,
        totalCollected,
        totalCreditIssued,
        totalExpenses,
        pendingExpensesCount: pendingExpenses.length,
        pendingExpensesTotal
      },
      paymentMethods: {
        methods: paymentMethodsArray,
        employeeBreakdown,
        totalsByMethod: Object.fromEntries(totalsByMethod),
        grandTotal
      },
      creditSales: creditSalesFormatted,
      creditPayments: creditPaymentsReceived,
      expenses: expensesFormatted,
      pendingExpenses: pendingExpenses.map(exp => ({
        _id: exp._id,
        title: exp.title,
        category: exp.category || 'Uncategorized',
        amount: exp.amount,
        date: exp.date,
        staffId: exp.staffId,
        staffName: exp.staffId ? staffMap.get(exp.staffId.toString()) : 'Owner'
      }))
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[end-of-day] GET error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
