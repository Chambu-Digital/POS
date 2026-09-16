'use client'

import { useState, useEffect } from 'react'
import { Calendar, Download, TrendingUp, DollarSign, ShoppingCart, Package, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SalesReport {
  summary: {
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    period: {
      startDate: string
      endDate: string
    }
  }
  paymentMethods: Record<string, number>
  orderTypes: Record<string, number>
  topItems: Array<{
    name: string
    quantity: number
    revenue: number
  }>
}

export default function HospitalityReportsPage() {
  return (
    <PermissionGuard requiredPermission="hospitality.reports">
      <ReportsContent />
    </PermissionGuard>
  )
}

function ReportsContent() {
  const [report, setReport] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadReport()
  }, [])

  async function loadReport() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate + 'T23:59:59').toISOString()
      })

      const res = await fetch(`/api/hospitality/reports/sales?${params}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      } else {
        toast.error('Failed to load report')
      }
    } catch (error) {
      toast.error('Failed to load report')
    }
    setLoading(false)
  }

  function exportToCSV() {
    if (!report) return

    const rows = [
      ['Hospitality Sales Report'],
      ['Period', `${startDate} to ${endDate}`],
      [],
      ['Summary'],
      ['Total Orders', report.summary.totalOrders],
      ['Total Revenue', `KES ${report.summary.totalRevenue.toLocaleString()}`],
      ['Average Order Value', `KES ${report.summary.averageOrderValue.toLocaleString()}`],
      [],
      ['Payment Methods'],
      ...Object.entries(report.paymentMethods).map(([method, amount]) => [
        method,
        `KES ${amount.toLocaleString()}`
      ]),
      [],
      ['Order Types'],
      ...Object.entries(report.orderTypes).map(([type, amount]) => [
        type,
        `KES ${amount.toLocaleString()}`
      ]),
      [],
      ['Top 10 Items'],
      ['Item', 'Quantity', 'Revenue'],
      ...report.topItems.map(item => [
        item.name,
        item.quantity,
        `KES ${item.revenue.toLocaleString()}`
      ])
    ]

    const csv = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hospitality-report-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">View sales performance and insights</p>
        </div>
        <Button
          onClick={exportToCSV}
          disabled={!report}
          variant="outline"
        >
          <Download size={16} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium block mb-2">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium block mb-2">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button onClick={loadReport} disabled={loading}>
              {loading ? 'Loading...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Generating report...</div>
      ) : !report ? (
        <div className="text-center py-12 text-gray-500">
          Select date range and click "Generate Report"
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart size={16} className="text-blue-600" />
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {report.summary.totalOrders.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {startDate} to {endDate}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign size={16} className="text-green-600" />
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  KES {report.summary.totalRevenue.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Gross sales for period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp size={16} className="text-purple-600" />
                  Average Order Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  KES {report.summary.averageOrderValue.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Per transaction
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign size={18} className="text-green-600" />
                Sales by Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(report.paymentMethods).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No payment data</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(report.paymentMethods)
                    .sort(([, a], [, b]) => b - a)
                    .map(([method, amount]) => {
                      const percentage = (amount / report.summary.totalRevenue) * 100
                      return (
                        <div key={method}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium capitalize">
                              {method.replace('_', ' ')}
                            </span>
                            <span className="text-sm font-bold">
                              KES {amount.toLocaleString()} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-blue-600" />
                Sales by Order Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(report.orderTypes).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No order type data</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(report.orderTypes)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, amount]) => {
                      const percentage = (amount / report.summary.totalRevenue) * 100
                      return (
                        <div key={type} className="p-4 border rounded-lg">
                          <p className="text-sm text-gray-500 mb-1 capitalize">
                            {type.replace('-', ' ')}
                          </p>
                          <p className="text-2xl font-bold text-gray-900">
                            KES {amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Selling Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package size={18} className="text-orange-600" />
                Top 10 Best Sellers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.topItems.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No sales data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left text-sm text-gray-500">
                        <th className="pb-2 font-medium">Rank</th>
                        <th className="pb-2 font-medium">Item</th>
                        <th className="pb-2 font-medium text-right">Quantity</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                        <th className="pb-2 font-medium text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.topItems.map((item, index) => {
                        const percentage = (item.revenue / report.summary.totalRevenue) * 100
                        return (
                          <tr key={index} className="text-sm">
                            <td className="py-3">
                              <Badge variant={index < 3 ? 'default' : 'secondary'}>
                                #{index + 1}
                              </Badge>
                            </td>
                            <td className="py-3 font-medium">{item.name}</td>
                            <td className="py-3 text-right">{item.quantity}</td>
                            <td className="py-3 text-right font-semibold">
                              KES {item.revenue.toLocaleString()}
                            </td>
                            <td className="py-3 text-right text-gray-500">
                              {percentage.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights Card */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <AlertTriangle size={18} />
                Quick Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-blue-900">
                {report.summary.totalOrders === 0 && (
                  <li>• No sales recorded in this period</li>
                )}
                {report.summary.totalOrders > 0 && report.topItems.length > 0 && (
                  <>
                    <li>
                      • Best selling item: <strong>{report.topItems[0].name}</strong> with {report.topItems[0].quantity} orders
                    </li>
                    {report.summary.averageOrderValue < 500 && (
                      <li>• Consider upselling to increase average order value</li>
                    )}
                    {Object.keys(report.paymentMethods).length === 1 && (
                      <li>• Only one payment method used - consider enabling more options</li>
                    )}
                  </>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
