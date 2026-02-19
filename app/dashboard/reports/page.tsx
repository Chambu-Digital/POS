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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Download,
  TrendingUp,
  Package,
  DollarSign,
  Calendar,
  BarChart3,
  PieChart,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
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
    // Set default dates (last 30 days)
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
    if (!report.data.details || report.data.details.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = Object.keys(report.data.details[0])
    const csv = [
      headers.join(','),
      ...report.data.details.map((row: any) =>
        headers.map((header) => JSON.stringify(row[header] || '')).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.reportType}-report-${new Date().toISOString()}.csv`
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
                  <SelectItem value="sales">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Sales Report
                    </div>
                  </SelectItem>
                  <SelectItem value="inventory">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Inventory Report
                    </div>
                  </SelectItem>
                  <SelectItem value="profit">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Profit Report
                    </div>
                  </SelectItem>
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
                  <BarChart3 className="mr-2 h-4 w-4" />
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

