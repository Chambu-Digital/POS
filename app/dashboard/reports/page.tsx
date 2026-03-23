'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Download,
  BarChart3,
  PieChart,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Report {
  _id: string
  reportType: string
  title: string
  description?: string
  dateRange: {
    startDate: string
    endDate: string
  }
  data: {
    summary: any
    details: any[]
    charts?: any
  }
  generatedAt: string
  createdAt: string
}

export default function ReportsPage() {
  return (
    <PermissionGuard requiredPermission="canViewSalesReports">
      <ReportsPageContent />
    </PermissionGuard>
  )
}

function ReportsPageContent() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  // Form state
  const [reportType, setReportType] = useState('sales')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchReports()
    // Set default dates (last 30 days to today)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [])

  async function fetchReports() {
    try {
      const response = await fetch('/api/reports')
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  async function generateReport() {
    if (!startDate || !endDate) {
      toast.error('Please select date range')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          startDate,
          endDate,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const data = await response.json()
      toast.success('Report generated successfully')
      setSelectedReport(data.report)
      await fetchReports()
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  function downloadReport(report: Report) {
    const dataStr = JSON.stringify(report, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.reportType}-report-${new Date().toISOString()}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Report downloaded')
  }

  function downloadCSV(report: Report) {
    let csv = ''
    csv += `${report.title}\n`
    csv += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n`
    csv += `Date Range: ${new Date(report.dateRange.startDate).toLocaleDateString()} - ${new Date(report.dateRange.endDate).toLocaleDateString()}\n`
    csv += '\n'

    // Summary
    csv += 'SUMMARY\n'
    Object.entries(report.data.summary).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').trim()
      const isMonetary = ['revenue','profit','cost','value','discount'].some(k => key.toLowerCase().includes(k))
      const formatted = typeof value === 'number'
        ? isMonetary ? `KES ${(value as number).toLocaleString()}` : (value as number).toLocaleString()
        : String(value)
      csv += `${label},${formatted}\n`
    })

    // Source breakdown if present
    const sb = (report.data as any).sourceBreakdown
    if (sb) {
      csv += '\nSOURCE BREAKDOWN\n'
      csv += 'Source,Orders,Revenue\n'
      ;[['POS', sb.pos], ['Bar', sb.bar], ['KDS', sb.kds], ['Rentals', sb.rental]].forEach(([label, d]: any) => {
        if (!d) return
        csv += `${label},${d.count},KES ${d.revenue.toLocaleString()}\n`
      })
    }

    // Detailed rows
    if (report.data.details && report.data.details.length > 0) {
      csv += '\nDETAILED SALES\n'
      csv += 'Order ID,Date,Source,Payment,Total,Discount,Status,Notes\n'
      report.data.details.forEach((row: any) => {
        const source = row.source || 'pos'
        const payment = row.paymentMethod === 'mobile_money' ? 'M-Pesa' : (row.paymentMethod || '')
        csv += [
          `"${row._id}"`,
          `"${new Date(row.createdAt).toLocaleString()}"`,
          source.toUpperCase(),
          payment,
          `KES ${(row.total || 0).toLocaleString()}`,
          `KES ${(row.discount || 0).toLocaleString()}`,
          row.status || 'completed',
          `"${(row.notes || '').replace(/"/g, '""')}"`,
        ].join(',') + '\n'
      })
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.reportType}-report-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Loading Reports</h3>
                <p className="text-sm text-muted-foreground">Please wait...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Generate and view business reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generate Report Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Report
            </CardTitle>
            <CardDescription>Create a new report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Report</SelectItem>
                  <SelectItem value="inventory">Inventory Report</SelectItem>
                  <SelectItem value="profit">Profit Report</SelectItem>
                  <SelectItem value="kitchen">Kitchen Report</SelectItem>
                  <SelectItem value="bar">Bar Report</SelectItem>
                  <SelectItem value="rental">Rental Services Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <Button
              onClick={generateReport}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Report Display */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
            <CardDescription>
              {selectedReport
                ? selectedReport.title
                : 'Generate a report to view results'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedReport ? (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(selectedReport.data.summary).map(([key, value]) => {
                    const LABELS: Record<string, string> = {
                      totalSales: 'Total Orders', totalRevenue: 'Total Revenue', totalDiscount: 'Total Discounts',
                      averageSaleValue: 'Avg Order Value', posRevenue: 'POS Revenue', barRevenue: 'Bar Revenue',
                      kdsRevenue: 'Kitchen Revenue', rentalRevenue: 'Rental Revenue',
                      totalProducts: 'Total Products', totalStockValue: 'Stock Value',
                      lowStockItems: 'Low Stock Items', outOfStockItems: 'Out of Stock',
                      totalCost: 'Total Cost', totalProfit: 'Net Profit', profitMargin: 'Profit Margin (%)',
                      totalOrders: 'Total Orders', completedOrders: 'Completed', pendingOrders: 'Pending',
                      tablesServed: 'Tables Served', avgPrepMins: 'Avg Prep (min)',
                      averageOrderValue: 'Avg Order Value',
                      totalBookings: 'Total Bookings', completedBookings: 'Completed', activeBookings: 'Active',
                      cancelledBookings: 'Cancelled', totalDeposits: 'Total Deposits',
                    }
                    const label = LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()
                    const isMonetary = ['revenue','profit','cost','value','discount','deposit'].some(k => key.toLowerCase().includes(k))
                    const formatted = typeof value === 'number'
                      ? isMonetary ? `KES ${(value as number).toLocaleString()}` : (value as number).toLocaleString()
                      : String(value)
                    return (
                      <Card key={key}>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">{formatted}</div>
                          <p className="text-xs text-muted-foreground mt-1">{label}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {/* Source breakdown */}
                {(selectedReport.data as any).sourceBreakdown && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Revenue by Source</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'pos',    label: 'POS',     color: 'text-gray-800'   },
                        { key: 'bar',    label: 'Bar',     color: 'text-green-700'  },
                        { key: 'kds',    label: 'Kitchen', color: 'text-blue-700'   },
                        { key: 'rental', label: 'Rentals', color: 'text-purple-700' },
                      ].map(({ key, label, color }) => {
                        const d = (selectedReport.data as any).sourceBreakdown[key]
                        if (!d) return null
                        return (
                          <Card key={key}>
                            <CardContent className="pt-4 pb-4">
                              <p className={`text-lg font-bold ${color}`}>KES {d.revenue.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{label} · {d.count} orders</p>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadReport(selectedReport)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCSV(selectedReport)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <PieChart className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No report selected</p>
                <p className="text-sm">Generate a report to see the results here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report._id}>
                    <TableCell>
                      <Badge variant="outline">{report.reportType}</Badge>
                    </TableCell>
                    <TableCell>{report.title}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(report.dateRange.startDate).toLocaleDateString()} -{' '}
                      {new Date(report.dateRange.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(report.generatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReport(report)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadReport(report)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No reports generated yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

