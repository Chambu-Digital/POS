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

    // Sales paid via 'deposit' (customer prepayment drawdown). These are NOT
    // cash — they're recorded here for the "Deposits Used Today" report section
    // and excluded from the per-method cash totals to avoid double-counting.
    const depositsUsed: any[] = []

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
          // 'credit' and 'deposit' are both non-cash for totals purposes:
          //  - credit  → debt created, no cash today (settled later as 'payment')
          //  - deposit → internal transfer drawing a customer prepayment; the
          //              cash was already counted on the day the deposit was
          //              taken (see the deposits-received block below). Counting
          //              it here would double-count the same money.
          if ((payment.method || '').toLowerCase() === 'credit') continue
          if ((payment.method || '').toLowerCase() === 'deposit') {
            // Collect for the "Deposits Used Today" view — no cash, just records
            // which sale drew down which deposit.
            depositsUsed.push({
              _id: sale._id,
              orderNumber: sale.orderNumber,
              customerName: sale.customerName || 'Walk-in',
              amount: parseFloat(payment.amount) || 0,
              depositId: payment.depositId || null,
              cashierId: saleStaffId,
              cashierName: '', // resolved below from staffMap
              timestamp: sale.createdAt,
            })
            continue
          }

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
    // 3b. FETCH CUSTOMER DEPOSITS — received & refunded today
    // ─────────────────────────────────────────────────────────────────────────
    // A deposit received is REAL CASH by method (already in the customer's
    // hand), so it must flow INTO totalsByMethod exactly like a credit payment
    // does — otherwise the Equity/cash total for the day would be wrong. The
    // matching "deposits used" sale-payment (method 'deposit') is skipped in
    // section 2 to avoid double-counting the same money.
    //
    // A deposit refunded is a REAL CASH OUTFLOW by method, tracked in
    // depositRefundsByMethod and subtracted in netByMethod below.
    const depositLedgerCustomers = await models.Customer.find({
      userId: ownerId,
      'ledger.date': { $gte: startOfDay, $lte: endOfDay },
      'ledger.type': { $in: ['deposit', 'deposit_refund'] },
    }).lean()

    const depositsReceived: any[] = []
    const depositRefundsByMethod = new Map<string, number>()

    // helper: resolve a ledger entry's method display name (mirrors the credit
    // payment logic above so totals stay consistent).
    const resolveLedgerMethodName = (entry: any): string => {
      if (entry.paymentMethod === 'cash') return 'Cash'
      if (entry.paymentMethod === 'mobile_money') return 'M-Pesa'
      if (entry.paymentMethod === 'bank' && entry.bankProviderName) return entry.bankProviderName
      if (entry.paymentMethod === 'custom' && entry.customMethodName) return entry.customMethodName
      if (entry.paymentMethod) return entry.paymentMethod
      return 'Cash'
    }

    for (const customer of depositLedgerCustomers) {
      for (const entry of customer.ledger) {
        const entryDate = new Date(entry.date)
        if (entryDate < startOfDay || entryDate > endOfDay) continue

        if (entry.type === 'deposit' && entry.amount > 0) {
          // Scope to this staff member's collections if not full-report view
          if (staffScopeId && entry.collectedBy?.toString() !== staffScopeId) continue

          const methodName = resolveLedgerMethodName(entry)
          const collectorId = entry.collectedBy?.toString() || 'owner'
          staffIds.add(collectorId)
          if (!paymentsByEmployee.has(collectorId)) {
            paymentsByEmployee.set(collectorId, new Map())
          }
          allPaymentMethods.add(methodName)
          const empMap = paymentsByEmployee.get(collectorId)!
          empMap.set(methodName, (empMap.get(methodName) || 0) + entry.amount)

          depositsReceived.push({
            customerId: customer._id,
            customerName: customer.name,
            depositId: entry.depositId || null,
            amount: entry.amount,
            paymentMethod: methodName,
            mpesaCode: entry.mpesaCode || '',
            remainingDepositBalance: entry.balance,
            timestamp: entry.date,
            note: entry.note,
            collectedBy: collectorId,
          })
        } else if (entry.type === 'deposit_refund' && entry.amount < 0) {
          // Refunds are outflows; do NOT add to totalsByMethod. Track separately
          // and subtract in netByMethod.
          if (staffScopeId && entry.collectedBy?.toString() !== staffScopeId) continue

          const methodName = resolveLedgerMethodName(entry)
          const refundAmount = Math.abs(entry.amount)
          depositRefundsByMethod.set(methodName, (depositRefundsByMethod.get(methodName) || 0) + refundAmount)
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

    // Resolve cashier display names for the deposits-used section (the sales
    // loop in section 2 runs before staffMap exists, so names are filled here).
    for (const d of depositsUsed) {
      d.cashierName = staffMap.get(d.cashierId) || ownerName
    }

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

    // Build per-method expense totals so the payment summary can show deductions
    const expensesByMethod = new Map<string, number>()
    for (const exp of expensesFormatted) {
      const method = exp.paymentMethod || 'N/A'
      expensesByMethod.set(method, (expensesByMethod.get(method) || 0) + exp.amount)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. STOCK RECEIPTS — purchases paid, payables settled, advances made today
    // ─────────────────────────────────────────────────────────────────────────
    const stockReceiptsToday = await (models as any).StockReceipt.find({
      userId: ownerId,
      ...(branchContext ? { branchId: branchContext } : {}),
      $or: [
        // Goods received and paid today (pay on receipt)
        { paymentStatus: 'paid', date: { $gte: startOfDay, $lte: endOfDay }, 'items.0': { $exists: true } },
        // Payables settled today (paidAt is today)
        { paymentStatus: 'paid', paidAt: { $gte: startOfDay, $lte: endOfDay }, 'items.0': { $exists: true } },
        // Advances paid today
        { paymentStatus: 'prepaid', paidAt: { $gte: startOfDay, $lte: endOfDay } },
      ]
    }).lean()

    // Bucket into three categories
    const stockPurchasesPayNow = stockReceiptsToday.filter((r: any) =>
      r.paymentStatus === 'paid' &&
      r.items?.length > 0 &&
      r.paidAt && new Date(r.paidAt) >= startOfDay && new Date(r.paidAt) <= endOfDay &&
      r.date && new Date(r.date) >= startOfDay && new Date(r.date) <= endOfDay
    )

    const supplierPaymentsSettled = stockReceiptsToday.filter((r: any) =>
      r.paymentStatus === 'paid' &&
      r.items?.length > 0 &&
      r.paidAt && new Date(r.paidAt) >= startOfDay && new Date(r.paidAt) <= endOfDay &&
      r.date && !(new Date(r.date) >= startOfDay && new Date(r.date) <= endOfDay)
    )

    const advancesPayments = stockReceiptsToday.filter((r: any) =>
      r.paymentStatus === 'prepaid'
    )

    const resolveReceiptMethodName = (r: any): string => {
      if (r.paymentMethod === 'cash') return 'Cash'
      if (r.paymentMethod === 'mobile_money') return 'M-Pesa'
      if (r.paymentMethod === 'bank' && r.bankProviderName) return r.bankProviderName
      if (r.paymentMethod === 'custom' && r.customMethodName) return r.customMethodName
      return r.paymentMethod || 'Cash'
    }

    const formatReceiptRow = (r: any) => ({
      _id: r._id.toString(),
      receiptNumber: r.receiptNumber,
      supplierName: r.supplierName,
      itemCount: r.items?.length || 0,
      totalCost: r.totalCost,
      paymentMethod: resolveReceiptMethodName(r),
      paymentReference: r.paymentReference || '',
      date: r.date,
      paidAt: r.paidAt,
    })

    const totalStockPurchasesPaid = stockPurchasesPayNow.reduce((sum: number, r: any) => sum + r.totalCost, 0)
    const totalSupplierPayments = supplierPaymentsSettled.reduce((sum: number, r: any) => sum + r.totalCost, 0)
    const totalAdvances = advancesPayments.reduce((sum: number, r: any) => sum + r.totalCost, 0)

    // Outstanding payables and advances (scoped to branch if active)
    const allUnpaid = await (models as any).StockReceipt.find({
      userId: ownerId,
      ...(branchContext ? { branchId: branchContext } : {}),
      paymentStatus: 'unpaid',
    }).select('totalCost').lean()

    const allPrepaid = await (models as any).StockReceipt.find({
      userId: ownerId,
      ...(branchContext ? { branchId: branchContext } : {}),
      paymentStatus: 'prepaid',
    }).select('totalCost').lean()

    const totalOutstandingPayables = allUnpaid.reduce((sum: number, r: any) => sum + r.totalCost, 0)
    const totalOutstandingAdvances = allPrepaid.reduce((sum: number, r: any) => sum + r.totalCost, 0)

    // Total cash out for stock today (all three categories)
    const totalStockCashOut = totalStockPurchasesPaid + totalSupplierPayments + totalAdvances

    // Build per-method stock-out totals (all three buckets combined)
    const stockOutByMethod = new Map<string, number>()
    for (const r of stockReceiptsToday) {
      const method = resolveReceiptMethodName(r)
      stockOutByMethod.set(method, (stockOutByMethod.get(method) || 0) + (r.totalCost || 0))
    }

    // Build per-method net totals: collected - expenses - stockOut - depositRefunds
    // Deposit refunds are a real cash OUTFLOW (money returned to the customer)
    // so they reduce each method's net, exactly like stock-out and expenses.
    const allOutflowMethods = new Set([
      ...Array.from(totalsByMethod.keys()),
      ...Array.from(expensesByMethod.keys()),
      ...Array.from(stockOutByMethod.keys()),
      ...Array.from(depositRefundsByMethod.keys()),
    ])
    const netByMethod: Record<string, number> = {}
    for (const method of allOutflowMethods) {
      const collected = totalsByMethod.get(method) || 0
      const expOut = expensesByMethod.get(method) || 0
      const stockOut = stockOutByMethod.get(method) || 0
      const depRefund = depositRefundsByMethod.get(method) || 0
      netByMethod[method] = collected - expOut - stockOut - depRefund
    }

    // ── Outstanding deposits: money we're holding for customers (a liability) ──
    // Sum of all active/partial Deposit balances for this branch. This is NOT
    // the business's money — it's prepayment we owe customers — so it's surfaced
    // as a liability alongside "You Owe Suppliers".
    const outstandingDepositsAgg = await models.Deposit.aggregate([
      { $match: {
        userId: new Types.ObjectId(ownerId),
        ...(branchContext ? { branchId: new Types.ObjectId(branchContext) } : {}),
        status: { $in: ['active', 'partial'] },
      }},
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ])
    const totalOutstandingDeposits = outstandingDepositsAgg[0]?.total || 0
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
        pendingExpensesTotal,
        // Stock cash out
        totalStockCashOut,
        totalStockPurchasesPaid,
        totalSupplierPayments,
        totalAdvances,
        // Net cash (in - expenses - stock out)
        netCash: totalCollected - totalExpenses - totalStockCashOut,
        // Outstanding balances
        totalOutstandingPayables,
        totalOutstandingAdvances,
        // Customer prepayments we owe (a liability — not our money)
        totalOutstandingDeposits,
      },
      paymentMethods: {
        methods: paymentMethodsArray,
        employeeBreakdown,
        totalsByMethod: Object.fromEntries(totalsByMethod),
        grandTotal,
        expensesByMethod: Object.fromEntries(expensesByMethod),
        stockOutByMethod: Object.fromEntries(stockOutByMethod),
        netByMethod,
        // Real cash OUTFLOW today from returning customer prepayments, by method.
        // Reduces netByMethod so the per-method cash position stays honest.
        depositRefundsByMethod: Object.fromEntries(depositRefundsByMethod),
      },
      creditSales: creditSalesFormatted,
      creditPayments: creditPaymentsReceived,
      // ── Customer deposits ───────────────────────────────────────────────────
      // Received = real cash by method (already in totalsByMethod). Shown
      // separately so the day's Equity/cash total can be reconciled against the
      // deposit slips.
      depositsReceived,
      // Used = sales that drew down deposits. No cash; listed for audit so each
      // pickup can be traced back to the deposit it consumed.
      depositsUsed,
      expenses: expensesFormatted,
      pendingExpenses: pendingExpenses.map(exp => ({
        _id: exp._id,
        title: exp.title,
        category: exp.category || 'Uncategorized',
        amount: exp.amount,
        date: exp.date,
        staffId: exp.staffId,
        staffName: exp.staffId ? staffMap.get(exp.staffId.toString()) : 'Owner'
      })),
      // Stock purchasing section
      stockPurchases: stockPurchasesPayNow.map(formatReceiptRow),
      supplierPayments: supplierPaymentsSettled.map(formatReceiptRow),
      advancePayments: advancesPayments.map(formatReceiptRow),
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[end-of-day] GET error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
