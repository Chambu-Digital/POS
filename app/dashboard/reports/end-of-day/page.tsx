 'use client'

import { useState, useEffect } from 'react'
import { Calendar, Download, Printer, AlertCircle, DollarSign, TrendingUp, CreditCard, Receipt, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface EndOfDayReport {
  branch: {
    _id: string
    name: string
  }
  date: string
  generatedAt: string
  generatedBy: {
    name: string
    type: string
  }
  summary: {
    totalSales: number
    totalSalesAmount: number
    totalCollected: number
    totalCreditIssued: number
    totalExpenses: number
    pendingExpensesCount: number
    pendingExpensesTotal: number
    totalStockCashOut: number
    totalStockPurchasesPaid: number
    totalSupplierPayments: number
    totalAdvances: number
    netCash: number
    totalOutstandingPayables: number
    totalOutstandingAdvances: number
    totalOutstandingDeposits: number
  }
  paymentMethods: {
    methods: string[]
    employeeBreakdown: {
      staffId: string
      employeeName: string
      methods: { [key: string]: number }
      total: number
    }[]
    totalsByMethod: { [key: string]: number }
    grandTotal: number
    expensesByMethod: { [key: string]: number }
    stockOutByMethod: { [key: string]: number }
    netByMethod: { [key: string]: number }
    depositRefundsByMethod: { [key: string]: number }
  }
  creditSales: {
    _id: string
    orderNumber: string
    customerName: string
    total: number
    amountPaid: number
    debt: number
    paymentStatus: string
    staffName: string
    createdAt: string
  }[]
  creditPayments: {
    customerId: string
    customerName: string
    amount: number
    paymentMethod: string
    mpesaCode: string
    remainingBalance: number
    timestamp: string
    note: string
  }[]
  depositsReceived: {
    customerId: string
    customerName: string
    depositId: string | null
    amount: number
    paymentMethod: string
    mpesaCode: string
    remainingDepositBalance: number
    timestamp: string
    note: string
  }[]
  depositsUsed: {
    _id: string
    orderNumber: string
    customerName: string
    amount: number
    depositId: string | null
    cashierName: string
    timestamp: string
  }[]
  expenses: {
    _id: string
    title: string
    category: string
    amount: number
    paymentMethod: string
    paidBy: string
    paymentDate: string
    receiptNumber: string
  }[]
  pendingExpenses: {
    _id: string
    title: string
    category: string
    amount: number
    date: string
    staffName: string
  }[]
  stockPurchases: {
    _id: string
    receiptNumber: string
    supplierName: string
    itemCount: number
    totalCost: number
    paymentMethod: string
    paymentReference: string
    date: string
    paidAt: string
  }[]
  supplierPayments: {
    _id: string
    receiptNumber: string
    supplierName: string
    itemCount: number
    totalCost: number
    paymentMethod: string
    paymentReference: string
    date: string
    paidAt: string
  }[]
  advancePayments: {
    _id: string
    receiptNumber: string
    supplierName: string
    itemCount: number
    totalCost: number
    paymentMethod: string
    paymentReference: string
    date: string
    paidAt: string
  }[]
}

export default function EndOfDayReportPage() {
  return (
    <PermissionGuard requiredPermission="pos.reports">
      <EndOfDayReportContent />
    </PermissionGuard>
  )
}

function EndOfDayReportContent() {
  const { toast } = useToast()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState<EndOfDayReport | null>(null)
  const [loading, setLoading] = useState(false)

  // Inject print styles
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #printable-report, #printable-report * {
          visibility: visible;
        }
        #printable-report {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .print-hide {
          display: none !important;
        }
        .print-page-break {
          page-break-after: always;
        }
        table {
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        @page {
          margin: 1cm;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/end-of-day?date=${date}`)
      const data = await res.json()
      
      if (res.ok) {
        setReport(data.report)
      } else {
        toast({ title: data.error || 'Failed to fetch report', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Failed to fetch report', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  if (loading && !report) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading report...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header - Hidden when printing */}
      <div className="flex items-center justify-between print-hide">
        <div>
          <h1 className="text-xl font-bold">End-of-Day Report</h1>
          <p className="text-xs text-muted-foreground">Complete daily financial summary</p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-36 h-9 text-sm"
          />
          <Button onClick={fetchReport} disabled={loading} className="bg-green-600 hover:bg-green-700 h-9 text-sm">
            {loading ? 'Loading...' : 'Generate'}
          </Button>
          <Button onClick={handlePrint} variant="outline" className="h-9 w-9 p-0">
            <Printer size={16} />
          </Button>
        </div>
      </div>

      {!report ? (
        <div className="text-center py-12 text-muted-foreground">
          Select a date and click Generate Report
        </div>
      ) : (
        <div id="printable-report" className="space-y-4">
          {/* Report Header */}
          <div className="bg-white rounded-lg border p-3">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-green-700">End-of-Day Report</h2>
              <p className="text-sm font-medium">{report.branch.name}</p>
            </div>
            <div className="flex justify-between text-xs border-t pt-2">
              <div>
                <p className="text-muted-foreground">Report Date</p>
                <p className="font-medium">{formatDate(report.date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Generated At</p>
                <p className="font-medium">{formatDate(report.generatedAt)} {formatTime(report.generatedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Generated By</p>
                <p className="font-medium">{report.generatedBy.name}</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-blue-600" />
                <p className="text-xs text-blue-700 font-medium">Total Sales</p>
              </div>
              <p className="text-xl font-bold text-blue-900">{report.summary.totalSales}</p>
              <p className="text-xs text-blue-600">{formatCurrency(report.summary.totalSalesAmount)}</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-green-600" />
                <p className="text-xs text-green-700 font-medium">Total Collected</p>
              </div>
              <p className="text-xl font-bold text-green-900">{formatCurrency(report.summary.totalCollected)}</p>
              <p className="text-xs text-green-600">Inc. credit payments</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={16} className="text-amber-600" />
                <p className="text-xs text-amber-700 font-medium">Credit Issued</p>
              </div>
              <p className="text-xl font-bold text-amber-900">{formatCurrency(report.summary.totalCreditIssued)}</p>
              <p className="text-xs text-amber-600">{report.creditSales.length} sales</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Receipt size={16} className="text-red-600" />
                <p className="text-xs text-red-700 font-medium">Expenses Paid</p>
              </div>
              <p className="text-xl font-bold text-red-900">{formatCurrency(report.summary.totalExpenses)}</p>
              <p className="text-xs text-red-600">{report.expenses.length} expenses</p>
            </div>
          </div>

          {/* Payment Methods Summary Cards */}
          <div className="bg-white rounded-lg border p-3">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Payment Methods Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* Collect all methods that appear in collected, expenses, or stock out */}
              {Array.from(new Set([
                ...report.paymentMethods.methods.filter(m => m.toLowerCase() !== 'credit'),
                ...Object.keys(report.paymentMethods.expensesByMethod || {}),
                ...Object.keys(report.paymentMethods.stockOutByMethod || {}),
              ])).sort().map((method) => {
                const collected  = report.paymentMethods.totalsByMethod[method] || 0
                const expenses   = (report.paymentMethods.expensesByMethod || {})[method] || 0
                const stockOut   = (report.paymentMethods.stockOutByMethod || {})[method] || 0
                const net        = (report.paymentMethods.netByMethod || {})[method] ?? (collected - expenses - stockOut)
                const hasOutflow = expenses > 0 || stockOut > 0

                const getMethodColor = (m: string) => {
                  if (m === 'Cash') return { card: 'bg-gray-50 border-gray-300', label: 'text-gray-700', net: net >= 0 ? 'text-gray-900' : 'text-red-700' }
                  if (m === 'M-Pesa') return { card: 'bg-green-50 border-green-300', label: 'text-green-700', net: net >= 0 ? 'text-green-900' : 'text-red-700' }
                  if (m.includes('Equity') || m.includes('Bank')) return { card: 'bg-blue-50 border-blue-300', label: 'text-blue-700', net: net >= 0 ? 'text-blue-900' : 'text-red-700' }
                  return { card: 'bg-purple-50 border-purple-300', label: 'text-purple-700', net: net >= 0 ? 'text-purple-900' : 'text-red-700' }
                }

                const colors = getMethodColor(method)

                return (
                  <div key={method} className={`${colors.card} border rounded p-2`}>
                    <p className={`text-xs font-semibold mb-1 ${colors.label}`}>{method}</p>
                    {/* Collected */}
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-muted-foreground">Collected</span>
                      <span className="font-medium">{formatCurrency(collected)}</span>
                    </div>
                    {/* Expenses deduction — only shown when non-zero */}
                    {expenses > 0 && (
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-red-600">Expenses</span>
                        <span className="text-red-600 font-medium">− {formatCurrency(expenses)}</span>
                      </div>
                    )}
                    {/* Stock out deduction — only shown when non-zero */}
                    {stockOut > 0 && (
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-red-600">Stock Out</span>
                        <span className="text-red-600 font-medium">− {formatCurrency(stockOut)}</span>
                      </div>
                    )}
                    {/* Net — always shown; separator only when there were deductions */}
                    {hasOutflow && <div className="border-t border-current opacity-20 my-1" />}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${colors.label}`}>{hasOutflow ? 'Net' : ''}</span>
                      <span className={`text-base font-bold ${colors.net}`}>{formatCurrency(net)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Payment Methods Breakdown by Employee */}
          <div className="bg-white rounded-lg border p-3">
            <h3 className="text-sm font-semibold mb-3 text-green-700">Payment Collection by Employee</h3>
            <div className="space-y-2">
              {report.paymentMethods.employeeBreakdown.map((emp) => {
                const totalExcludingCredit = report.paymentMethods.methods
                  .filter(method => method.toLowerCase() !== 'credit')
                  .reduce((sum, method) => sum + (emp.methods[method] || 0), 0)
                
                return (
                  <div key={emp.staffId} className="border rounded p-2 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-muted-foreground" />
                        <span className="font-medium text-sm">{emp.employeeName}</span>
                      </div>
                      <span className="font-bold text-sm text-green-700">
                        {formatCurrency(totalExcludingCredit)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {report.paymentMethods.methods
                        .filter(method => method.toLowerCase() !== 'credit')
                        .filter(method => emp.methods[method] && emp.methods[method] > 0)
                        .map(method => (
                          <span key={method} className="bg-muted px-2 py-0.5 rounded">
                            {method}: <strong>{formatCurrency(emp.methods[method])}</strong>
                          </span>
                        ))}
                    </div>
                  </div>
                )
              })}
              
              {/* Total Row */}
              <div className="border-2 border-green-200 bg-green-50 rounded p-2 mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">Grand Total Collected</span>
                  <span className="font-bold text-base text-green-700">
                    {formatCurrency(
                      report.paymentMethods.methods
                        .filter(method => method.toLowerCase() !== 'credit')
                        .reduce((sum, method) => sum + (report.paymentMethods.totalsByMethod[method] || 0), 0)
                    )}
                  </span>
                </div>
                {(report.summary.totalExpenses > 0 || report.summary.totalStockCashOut > 0) && (
                  <>
                    {report.summary.totalExpenses > 0 && (
                      <div className="flex items-center justify-between text-xs text-red-600 mb-0.5">
                        <span>Less: Expenses</span>
                        <span className="font-medium">− {formatCurrency(report.summary.totalExpenses)}</span>
                      </div>
                    )}
                    {report.summary.totalStockCashOut > 0 && (
                      <div className="flex items-center justify-between text-xs text-red-600 mb-0.5">
                        <span>Less: Stock Cash Out</span>
                        <span className="font-medium">− {formatCurrency(report.summary.totalStockCashOut)}</span>
                      </div>
                    )}
                    <div className="border-t border-green-300 mt-1 pt-1 flex items-center justify-between">
                      <span className="font-bold text-sm">Net Cash Position</span>
                      <span className={`font-bold text-base ${report.summary.netCash >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {formatCurrency(report.summary.netCash)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Credit Sales */}
          {report.creditSales.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-amber-700">Credit Sales (Outstanding)</h3>
              <div className="space-y-2">
                {report.creditSales.map((sale) => (
                  <div key={sale._id} className="border border-amber-200 rounded p-2 bg-amber-50/30">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{sale.customerName}</p>
                        <p className="text-xs text-muted-foreground">Order #{sale.orderNumber}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        sale.paymentStatus === 'unpaid' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {sale.paymentStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{formatCurrency(sale.total)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid</p>
                        <p className="font-semibold">{formatCurrency(sale.amountPaid)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Outstanding</p>
                        <p className="font-bold text-amber-700">{formatCurrency(sale.debt)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Sold by: {sale.staffName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credit Payments Received */}
          {report.creditPayments.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-green-700">Credit Payments Received Today</h3>
              <div className="space-y-2">
                {report.creditPayments.map((payment, idx) => (
                  <div key={idx} className="border border-green-200 rounded p-2 bg-green-50/30">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium text-sm">{payment.customerName}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(payment.timestamp)}</p>
                      </div>
                      <p className="font-bold text-sm text-green-700">{formatCurrency(payment.amount)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Wallet size={12} className="text-muted-foreground" />
                        <span>{payment.paymentMethod}</span>
                        {payment.mpesaCode && (
                          <span className="text-muted-foreground">({payment.mpesaCode})</span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        Balance: {formatCurrency(payment.remainingBalance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deposits Received Today — real cash by method (already in totals) */}
          {report.depositsReceived?.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-teal-700">Customer Deposits Received Today</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Prepayments received (already included in the per-method totals above). Customer holds this as store credit.
              </p>
              <div className="space-y-2">
                {report.depositsReceived.map((d, idx) => (
                  <div key={idx} className="border border-teal-200 rounded p-2 bg-teal-50/30">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium text-sm">{d.customerName}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(d.timestamp)}</p>
                      </div>
                      <p className="font-bold text-sm text-teal-700">{formatCurrency(d.amount)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Wallet size={12} className="text-muted-foreground" />
                        <span>{d.paymentMethod}</span>
                        {d.mpesaCode && <span className="text-muted-foreground">({d.mpesaCode})</span>}
                      </div>
                      <span className="text-muted-foreground">
                        Balance after deposit: {formatCurrency(d.remainingDepositBalance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deposits Used Today — sales that drew down prepayments (no cash) */}
          {report.depositsUsed?.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-cyan-700">Deposits Used Today</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Sales settled by drawing down customer prepayments. No cash collected — the money was received on the deposit day. Excluded from the per-method totals above to avoid double-counting.
              </p>
              <div className="space-y-2">
                {report.depositsUsed.map((d, idx) => (
                  <div key={idx} className="border border-cyan-200 rounded p-2 bg-cyan-50/30">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium text-sm">{d.customerName}</p>
                        <p className="text-xs text-muted-foreground">Order #{d.orderNumber} · {formatTime(d.timestamp)}</p>
                      </div>
                      <p className="font-bold text-sm text-cyan-700">{formatCurrency(d.amount)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Served by: {d.cashierName}</span>
                      <span>From store credit</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deposit Refunds Today — cash returned to customers (outflow) */}
          {report.paymentMethods.depositRefundsByMethod &&
            Object.values(report.paymentMethods.depositRefundsByMethod).some((v: number) => v > 0) && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-orange-700">Deposit Refunds Today</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Prepayments returned to customers. Real cash outflow — reduces each method's net position.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(report.paymentMethods.depositRefundsByMethod)
                  .filter(([, v]) => (v as number) > 0)
                  .map(([method, amount]) => (
                    <div key={method} className="border border-orange-200 rounded p-2 bg-orange-50/30">
                      <p className="text-xs text-muted-foreground">{method}</p>
                      <p className="font-bold text-sm text-orange-700">− {formatCurrency(amount as number)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Expenses */}
          {report.expenses.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-red-700">Expenses Paid Today</h3>
              <div className="space-y-2">
                {report.expenses.map((expense) => (
                  <div key={expense._id} className="border border-red-200 rounded p-2 bg-red-50/30">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">{expense.category}</p>
                      </div>
                      <p className="font-bold text-sm text-red-700">{formatCurrency(expense.amount)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{expense.paymentMethod} · {expense.paidBy}</span>
                      {expense.receiptNumber && <span>Receipt: {expense.receiptNumber}</span>}
                    </div>
                  </div>
                ))}
                <div className="border-t-2 border-red-200 bg-red-50 rounded p-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Total Expenses</span>
                    <span className="font-bold text-base text-red-700">
                      {formatCurrency(report.summary.totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pending Expenses Warning */}
          {report.summary.pendingExpensesCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-amber-600 flex-shrink-0" size={16} />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-900">
                  {report.summary.pendingExpensesCount} Expense{report.summary.pendingExpensesCount > 1 ? 's' : ''} Awaiting Approval
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Total: {formatCurrency(report.summary.pendingExpensesTotal)} (not included above)
                </p>
              </div>
            </div>
          )}

          {/* Stock Purchases — paid on receipt */}
          {report.stockPurchases?.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-red-700">Stock Purchases (Paid Today)</h3>
              <div className="space-y-2">
                {report.stockPurchases.map((r) => (
                  <div key={r._id} className="border border-red-200 rounded p-2 bg-red-50/30">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium text-sm">{r.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{r.receiptNumber} · {r.itemCount} items</p>
                      </div>
                      <p className="font-bold text-sm text-red-700">{formatCurrency(r.totalCost)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.paymentMethod}{r.paymentReference && ` · ${r.paymentReference}`}</p>
                  </div>
                ))}
                <div className="border-t-2 border-red-200 bg-red-50 rounded p-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Total Stock Paid</span>
                    <span className="font-bold text-base text-red-700">{formatCurrency(report.summary.totalStockPurchasesPaid)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Supplier Payments — settling old payables */}
          {report.supplierPayments?.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-orange-700">Supplier Payments (Settling Credit)</h3>
              <div className="space-y-2">
                {report.supplierPayments.map((r) => (
                  <div key={r._id} className="border border-orange-200 rounded p-2 bg-orange-50/30">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium text-sm">{r.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{r.receiptNumber}</p>
                      </div>
                      <p className="font-bold text-sm text-orange-700">{formatCurrency(r.totalCost)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.paymentMethod}{r.paymentReference && ` · ${r.paymentReference}`}</p>
                  </div>
                ))}
                <div className="border-t-2 border-orange-200 bg-orange-50 rounded p-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Total Settled</span>
                    <span className="font-bold text-base text-orange-700">{formatCurrency(report.summary.totalSupplierPayments)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advance Payments */}
          {report.advancePayments?.length > 0 && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-3 text-purple-700">Advance Payments (Goods Pending)</h3>
              <div className="space-y-2">
                {report.advancePayments.map((r) => (
                  <div key={r._id} className="border border-purple-200 rounded p-2 bg-purple-50/30">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-medium text-sm">{r.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{r.receiptNumber} · goods not yet received</p>
                      </div>
                      <p className="font-bold text-sm text-purple-700">{formatCurrency(r.totalCost)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.paymentMethod}{r.paymentReference && ` · ${r.paymentReference}`}</p>
                  </div>
                ))}
                <div className="border-t-2 border-purple-200 bg-purple-50 rounded p-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Total Advances</span>
                    <span className="font-bold text-base text-purple-700">{formatCurrency(report.summary.totalAdvances)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Outstanding Balances Awareness */}
          {(report.summary.totalOutstandingPayables > 0 || report.summary.totalOutstandingAdvances > 0 || report.summary.totalOutstandingDeposits > 0) && (
            <div className="bg-white rounded-lg border p-3">
              <h3 className="text-sm font-semibold mb-2 text-gray-700">Outstanding Balances (All Time)</h3>
              <div className="grid grid-cols-2 gap-3">
                {report.summary.totalOutstandingPayables > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700 font-medium mb-1">You Owe Suppliers</p>
                    <p className="text-xl font-bold text-amber-900">{formatCurrency(report.summary.totalOutstandingPayables)}</p>
                    <p className="text-xs text-amber-600">Unpaid stock receipts</p>
                  </div>
                )}
                {report.summary.totalOutstandingAdvances > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs text-purple-700 font-medium mb-1">Awaiting Delivery</p>
                    <p className="text-xl font-bold text-purple-900">{formatCurrency(report.summary.totalOutstandingAdvances)}</p>
                    <p className="text-xs text-purple-600">Advance payments out</p>
                  </div>
                )}
                {report.summary.totalOutstandingDeposits > 0 && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p className="text-xs text-teal-700 font-medium mb-1">Customer Deposits Held</p>
                    <p className="text-xl font-bold text-teal-900">{formatCurrency(report.summary.totalOutstandingDeposits)}</p>
                    <p className="text-xs text-teal-600">Prepayments owed to customers</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Net Summary */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-3">
            <h3 className="text-sm font-bold mb-2 text-green-800">Daily Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Total Money In</p>
                <p className="text-xl font-bold text-green-700">
                  {formatCurrency(report.summary.totalCollected)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Expenses Paid</p>
                <p className="text-xl font-bold text-red-700">
                  {formatCurrency(report.summary.totalExpenses)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Stock Cash Out</p>
                <p className="text-xl font-bold text-red-700">
                  {formatCurrency(report.summary.totalStockCashOut || 0)}
                </p>
                <p className="text-xs text-muted-foreground">purchases + payments + advances</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Net Cash Position</p>
                <p className={`text-xl font-bold ${(report.summary.netCash ?? (report.summary.totalCollected - report.summary.totalExpenses)) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {formatCurrency(report.summary.netCash ?? (report.summary.totalCollected - report.summary.totalExpenses))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
