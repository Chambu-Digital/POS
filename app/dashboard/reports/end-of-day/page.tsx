'use client'

import { useState, useEffect } from 'react'
import { Calendar, Download, Printer, AlertCircle, DollarSign, TrendingUp, CreditCard, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

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
}

export default function EndOfDayReportPage() {
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
    <div className="p-6 space-y-6">
      {/* Header - Hidden when printing */}
      <div className="flex items-center justify-between print-hide">
        <div>
          <h1 className="text-2xl font-bold">End-of-Day Report</h1>
          <p className="text-sm text-muted-foreground">Complete daily financial summary</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button onClick={fetchReport} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Loading...' : 'Generate Report'}
          </Button>
          <Button onClick={handlePrint} variant="outline">
            <Printer size={16} className="mr-2" /> Print
          </Button>
        </div>
      </div>

      {!report ? (
        <div className="text-center py-12 text-muted-foreground">
          Select a date and click Generate Report
        </div>
      ) : (
        <div id="printable-report" className="space-y-6">
          {/* Report Header */}
          <div className="bg-white rounded-lg border p-6 print:border-none print:rounded-none">
            <div className="text-center mb-4">
              <h2 className="text-3xl font-bold text-green-700 print:text-black">End-of-Day Report</h2>
              <p className="text-lg font-medium mt-1">{report.branch.name}</p>
            </div>
            <div className="flex justify-between text-sm border-t pt-4 print:border-gray-400">
              <div>
                <p className="text-muted-foreground print:text-gray-600">Report Date</p>
                <p className="font-medium">{formatDate(report.date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground print:text-gray-600">Generated At</p>
                <p className="font-medium">{formatDate(report.generatedAt)} {formatTime(report.generatedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground print:text-gray-600">Generated By</p>
                <p className="font-medium">{report.generatedBy.name}</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={20} className="text-blue-600" />
                <p className="text-sm text-blue-700 font-medium">Total Sales</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">{report.summary.totalSales}</p>
              <p className="text-sm text-blue-600 mt-1">{formatCurrency(report.summary.totalSalesAmount)}</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={20} className="text-green-600" />
                <p className="text-sm text-green-700 font-medium">Total Collected</p>
              </div>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(report.summary.totalCollected)}</p>
              <p className="text-xs text-green-600 mt-1">Including credit payments</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={20} className="text-amber-600" />
                <p className="text-sm text-amber-700 font-medium">Credit Issued</p>
              </div>
              <p className="text-2xl font-bold text-amber-900">{formatCurrency(report.summary.totalCreditIssued)}</p>
              <p className="text-xs text-amber-600 mt-1">{report.creditSales.length} credit sales</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={20} className="text-red-600" />
                <p className="text-sm text-red-700 font-medium">Expenses Paid</p>
              </div>
              <p className="text-2xl font-bold text-red-900">{formatCurrency(report.summary.totalExpenses)}</p>
              <p className="text-xs text-red-600 mt-1">{report.expenses.length} expenses</p>
            </div>
          </div>

          {/* Payment Methods Summary Cards */}
          <div className="bg-white rounded-lg border p-4 print:border-none print:rounded-none">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 print:text-black">Payment Methods Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-6 print:gap-2">
              {report.paymentMethods.methods
                .filter(method => method.toLowerCase() !== 'credit') // Exclude credit - it's not a payment method
                .map((method) => {
                const total = report.paymentMethods.totalsByMethod[method] || 0
                
                // Assign colors based on payment method
                const getMethodColor = (method: string) => {
                  if (method === 'Cash') return 'bg-gray-50 border-gray-300 text-gray-700'
                  if (method === 'M-Pesa') return 'bg-green-50 border-green-300 text-green-700'
                  if (method.includes('Equity') || method.includes('Bank')) return 'bg-blue-50 border-blue-300 text-blue-700'
                  return 'bg-purple-50 border-purple-300 text-purple-700'
                }

                return (
                  <div key={method} className={`${getMethodColor(method)} border rounded-lg p-3 print:bg-white print:border-gray-400`}>
                    <p className="text-xs font-medium mb-1 print:text-black">{method}</p>
                    <p className="text-lg font-bold print:text-base">{formatCurrency(total)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="bg-white rounded-lg border p-6 print:border-none print:rounded-none print-page-break">
            <h3 className="text-lg font-bold mb-4 text-green-700 print:text-black">Payment Collection by Employee</h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm print:border print:border-gray-400">
                <thead className="bg-gray-50 border-b-2 border-gray-200 print:border print:border-gray-400">
                  <tr>
                    <th className="text-left p-3 font-semibold print:border print:border-gray-400">Employee</th>
                    {report.paymentMethods.methods
                      .filter(method => method.toLowerCase() !== 'credit') // Exclude credit from table
                      .map(method => (
                      <th key={method} className="text-right p-3 font-semibold print:border print:border-gray-400">{method}</th>
                    ))}
                    <th className="text-right p-3 font-semibold bg-green-50 print:bg-gray-100 print:border print:border-gray-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentMethods.employeeBreakdown.map((emp, idx) => {
                    // Recalculate total excluding credit
                    const totalExcludingCredit = report.paymentMethods.methods
                      .filter(method => method.toLowerCase() !== 'credit')
                      .reduce((sum, method) => sum + (emp.methods[method] || 0), 0)
                    
                    return (
                      <tr key={emp.staffId} className={idx % 2 === 0 ? 'bg-gray-50 print:bg-white' : 'print:bg-white'}>
                        <td className="p-3 font-medium print:border print:border-gray-400">{emp.employeeName}</td>
                        {report.paymentMethods.methods
                          .filter(method => method.toLowerCase() !== 'credit')
                          .map(method => (
                          <td key={method} className="text-right p-3 print:border print:border-gray-400">
                            {emp.methods[method] ? formatCurrency(emp.methods[method]) : '-'}
                          </td>
                        ))}
                        <td className="text-right p-3 font-semibold bg-green-50 print:bg-gray-100 print:border print:border-gray-400">
                          {formatCurrency(totalExcludingCredit)}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-300 bg-green-100 print:bg-gray-200 print:border print:border-gray-400">
                    <td className="p-3 font-bold print:border print:border-gray-400">Total</td>
                    {report.paymentMethods.methods
                      .filter(method => method.toLowerCase() !== 'credit')
                      .map(method => (
                      <td key={method} className="text-right p-3 font-bold print:border print:border-gray-400">
                        {formatCurrency(report.paymentMethods.totalsByMethod[method] || 0)}
                      </td>
                    ))}
                    <td className="text-right p-3 font-bold text-lg print:border print:border-gray-400">
                      {formatCurrency(
                        report.paymentMethods.methods
                          .filter(method => method.toLowerCase() !== 'credit')
                          .reduce((sum, method) => sum + (report.paymentMethods.totalsByMethod[method] || 0), 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit Sales */}
          {report.creditSales.length > 0 && (
            <div className="bg-white rounded-lg border p-6 print:border-none print:rounded-none print-page-break">
              <h3 className="text-lg font-bold mb-4 text-amber-700 print:text-black">Credit Sales (Outstanding)</h3>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b">
                    <tr>
                      <th className="text-left p-3">Order #</th>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-right p-3">Total</th>
                      <th className="text-right p-3">Paid</th>
                      <th className="text-right p-3">Outstanding</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Sold By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.creditSales.map((sale, idx) => (
                      <tr key={sale._id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="p-3 font-medium">{sale.orderNumber}</td>
                        <td className="p-3">{sale.customerName}</td>
                        <td className="text-right p-3">{formatCurrency(sale.total)}</td>
                        <td className="text-right p-3">{formatCurrency(sale.amountPaid)}</td>
                        <td className="text-right p-3 font-semibold text-amber-700">
                          {formatCurrency(sale.debt)}
                        </td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            sale.paymentStatus === 'unpaid' 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {sale.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3 text-sm">{sale.staffName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Credit Payments Received */}
          {report.creditPayments.length > 0 && (
            <div className="bg-white rounded-lg border p-6 print:border-none print:rounded-none">
              <h3 className="text-lg font-bold mb-4 text-green-700 print:text-black">Credit Payments Received Today</h3>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm">
                  <thead className="bg-green-50 border-b">
                    <tr>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-right p-3">Amount Paid</th>
                      <th className="text-left p-3">Payment Method</th>
                      <th className="text-right p-3">Remaining Balance</th>
                      <th className="text-left p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.creditPayments.map((payment, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="p-3 font-medium">{payment.customerName}</td>
                        <td className="text-right p-3 text-green-700 font-semibold">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="p-3">
                          {payment.paymentMethod}
                          {payment.mpesaCode && (
                            <span className="text-xs text-muted-foreground ml-2">({payment.mpesaCode})</span>
                          )}
                        </td>
                        <td className="text-right p-3">
                          {formatCurrency(payment.remainingBalance)}
                        </td>
                        <td className="p-3 text-sm">{formatTime(payment.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expenses */}
          {report.expenses.length > 0 && (
            <div className="bg-white rounded-lg border p-6 print:border-none print:rounded-none print-page-break">
              <h3 className="text-lg font-bold mb-4 text-red-700 print:text-black">Expenses Paid Today</h3>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 border-b">
                    <tr>
                      <th className="text-left p-3">Title</th>
                      <th className="text-left p-3">Category</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-left p-3">Payment Method</th>
                      <th className="text-left p-3">Paid By</th>
                      <th className="text-left p-3">Receipt #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenses.map((expense, idx) => (
                      <tr key={expense._id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="p-3 font-medium">{expense.title}</td>
                        <td className="p-3">{expense.category}</td>
                        <td className="text-right p-3 text-red-700 font-semibold">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="p-3">{expense.paymentMethod}</td>
                        <td className="p-3">{expense.paidBy}</td>
                        <td className="p-3 text-sm">{expense.receiptNumber || '-'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-red-100">
                      <td colSpan={2} className="p-3 font-bold">Total Expenses</td>
                      <td className="text-right p-3 font-bold text-red-900">
                        {formatCurrency(report.summary.totalExpenses)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending Expenses Warning */}
          {report.summary.pendingExpensesCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3 print:border-amber-400 print:rounded-none">
              <AlertCircle className="text-amber-600 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {report.summary.pendingExpensesCount} Expense{report.summary.pendingExpensesCount > 1 ? 's' : ''} Awaiting Approval
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Total pending: {formatCurrency(report.summary.pendingExpensesTotal)}. 
                  These are not included in today&apos;s expense figures.
                </p>
                <a 
                  href="/dashboard/expenses" 
                  className="text-sm text-amber-800 underline hover:text-amber-900 mt-2 inline-block"
                >
                  Review Pending Expenses →
                </a>
              </div>
            </div>
          )}

          {/* Net Summary */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6 print:bg-gray-100 print:border-gray-400 print:rounded-none">
            <h3 className="text-lg font-bold mb-4 text-green-800 print:text-black">Daily Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Money In</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(report.summary.totalCollected)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Money Out</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(report.summary.totalExpenses)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Net Cash Position</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(report.summary.totalCollected - report.summary.totalExpenses)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
