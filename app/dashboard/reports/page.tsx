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
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to generate report')
      }

      const data = await response.json()
      toast.success('Report generated successfully')
      setSelectedReport(data.report)
      await fetchReports()
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  function downloadCSV(report: Report) {
    // Build CSV with summary section first
    let csv = ''
    
    // Add report header
    csv += `${report.title}\n`
    csv += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n`
    csv += `Date Range: ${new Date(report.dateRange.startDate).toLocaleDateString()} - ${new Date(report.dateRange.endDate).toLocaleDateString()}\n`
    csv += '\n'
    
    // Add summary statistics
    csv += 'SUMMARY STATISTICS\n'
    Object.entries(report.data.summary).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').trim()
      const formattedValue = typeof value === 'number'
        ? (key.toLowerCase().includes('revenue') ||
           key.toLowerCase().includes('profit') ||
           key.toLowerCase().includes('value') ||
           key.toLowerCase().includes('cost') ||
           key.toLowerCase().includes('discount'))
          ? `KES ${value.toLocaleString()}`
          : value.toLocaleString()
        : String(value)
      csv += `${label},${formattedValue}\n`
    })
    csv += '\n'
    
    // Add detailed data if available
    if (report.data.details && report.data.details.length > 0) {
      csv += 'DETAILED DATA\n'
      
      // Get headers from first item
      const firstItem = report.data.details[0]
      const headers = Object.keys(firstItem).filter(key => 
        !key.startsWith('_') && key !== '__v' && key !== 'userId' && key !== 'staffId'
      )
      
      csv += headers.join(',') + '\n'
      
      // Add data rows
      report.data.details.forEach((row: any) => {
        const values = headers.map(header => {
          let value = row[header]
          
          // Format dates
          if (header.toLowerCase().includes('date') || header === 'createdAt' || header === 'updatedAt') {
            value = value ? new Date(value).toLocaleString() : ''
          }
          // Format objects
          else if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value)
          }
          // Format numbers
          else if (typeof value === 'number') {
            value = value.toLocaleString()
          }
          
          return `"${String(value || '').replace(/"/g, '""')}"`
        })
        csv += values.join(',') + '\n'
      })
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.reportType}-report-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded with summary statistics')
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
                  <SelectItem value="rentals">Rentals Report</SelectItem>
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
                  {Object.entries(selectedReport.data.summary).map(([key, value]) => (
                    <Card key={key}>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {typeof value === 'number'
                            ? key.toLowerCase().includes('revenue') ||
                              key.toLowerCase().includes('profit') ||
                              key.toLowerCase().includes('value') ||
                              key.toLowerCase().includes('cost')
                              ? `KSh ${value.toLocaleString()}`
                              : value.toLocaleString()
                            : String(value)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCSV(selectedReport)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                  </Button>
                </div>

                {/* Details Table */}
                {selectedReport.data.details && selectedReport.data.details.length > 0 && (
                  <div className="overflow-x-auto">
                    <p className="text-sm font-medium mb-2">Transaction Details</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          {selectedReport.reportType === 'rentals' ? (
                            <>
                              <TableHead>Customer</TableHead>
                              <TableHead>Items</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Total (KSh)</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead>Items</TableHead>
                              <TableHead>Payment</TableHead>
                              <TableHead>Total (KSh)</TableHead>
                            </>
                          )}
                          <TableHead>Served By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedReport.data.details.slice(0, 50).map((row: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            {selectedReport.reportType === 'rentals' ? (
                              <>
                                <TableCell className="text-xs">{row.customer?.name}<br /><span className="text-muted-foreground">{row.customer?.phone}</span></TableCell>
                                <TableCell className="text-xs">{row.items?.length} item{row.items?.length !== 1 ? 's' : ''}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{row.status}</Badge></TableCell>
                                <TableCell className="text-xs font-medium">{row.totalAmount ? row.totalAmount.toLocaleString() : '—'}</TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-xs">{row.items?.length} item{row.items?.length !== 1 ? 's' : ''}</TableCell>
                                <TableCell className="text-xs capitalize">{row.paymentMethod?.replace('_', ' ')}</TableCell>
                                <TableCell className="text-xs font-medium">{row.total?.toLocaleString()}</TableCell>
                              </>
                            )}
                            <TableCell className="text-xs font-medium text-primary">{row.servedBy || 'Owner'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {selectedReport.data.details.length > 50 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">Showing 50 of {selectedReport.data.details.length} records. Download Excel for full data.</p>
                    )}
                  </div>
                )}
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
                          onClick={() => downloadCSV(report)}
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

