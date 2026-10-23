'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Calendar, TrendingUp, TrendingDown, Package, AlertCircle, Plus, Download, FileBarChart } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { RecordMovementModal } from '@/components/inventory/record-movement-modal'
import { cn } from '@/lib/utils'

interface StockMovement {
  _id: string
  type: string
  timestamp: string
  productId?: {
    _id: string
    productName: string
    brand?: string
    model?: string
    variant?: string
  }
  supplierId?: {
    _id: string
    name: string
  }
  staffId?: {
    _id: string
    name: string
  }
  quantity: number
  previousStock: number
  newStock: number
  unitCost?: number
  totalCost?: number
  reference?: string
  reason?: string
  notes?: string
  orderNumber?: string
  supplierName?: string
}

interface SummaryRow {
  productId: string
  type: string
  productName: string
  brand?: string
  model?: string
  variant?: string
  lotUnit?: string
  totalQty: number
  transactions: number
}

interface StaffMember {
  _id: string
  name: string
  firstName?: string
  lastName?: string
}

type MovementType = 'all' | 'STOCK_IN' | 'SALE' | 'RETURN' | 'DAMAGE' | 'WASTAGE' | 'EXPIRED' | 'LOSS' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'EXCHANGE_IN' | 'EXCHANGE_OUT'

const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'STOCK_IN', label: 'Stock In' },
  { value: 'TRANSFER_OUT', label: 'Stock Out (Transfer)' },
  { value: 'TRANSFER_IN', label: 'Transfer In' },
  { value: 'SALE', label: 'Sales' },
  { value: 'RETURN', label: 'Returns' },
  { value: 'EXCHANGE_IN', label: 'Exchange In' },
  { value: 'EXCHANGE_OUT', label: 'Exchange Out' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'WASTAGE', label: 'Wastage' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'LOSS', label: 'Loss' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
]

function formatProductName(product: StockMovement['productId']): string {
  if (!product) return 'Unknown'
  const parts = [
    product.brand,
    product.variant,
    product.productName,
  ].filter(Boolean)
  return parts.join(' › ')
}

export default function StockMovementsPage() {
  return (
    <PermissionGuard requiredPermission="pos.stock-movements">
      <StockMovementsPageContent />
    </PermissionGuard>
  )
}

function StockMovementsPageContent() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<MovementType>('all')
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isRecordMovementOpen, setIsRecordMovementOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // ── Report / summary state ─────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const [reportDate, setReportDate]       = useState(today)
  const [reportEndDate, setReportEndDate] = useState(today)
  const [selectedStaffId, setSelectedStaffId] = useState('all')
  const [staffList, setStaffList]         = useState<StaffMember[]>([])
  const [summaryRows, setSummaryRows]     = useState<SummaryRow[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryMeta, setSummaryMeta]     = useState<any>(null)
  const [showSummary, setShowSummary]     = useState(false)

  useEffect(() => {
    fetchMovements()
    fetchStaff()
  }, [activeType, search])

  async function fetchStaff() {
    try {
      const res = await fetch('/api/staff')
      if (res.ok) {
        const data = await res.json()
        setStaffList(data.staff || [])
      }
    } catch { /* silent */ }
  }

  async function fetchSummary() {
    setSummaryLoading(true)
    setShowSummary(true)
    try {
      const params = new URLSearchParams({
        startDate: reportDate,
        endDate:   reportEndDate,
      })
      if (selectedStaffId !== 'all') params.append('staffId', selectedStaffId)
      if (activeType !== 'all')      params.append('type', activeType)

      const res = await fetch(`/api/inventory/stock-ledger/summary?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSummaryRows(data.rows || [])
        setSummaryMeta(data.meta)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to load summary')
      }
    } catch {
      toast.error('Failed to load summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  function downloadSummaryCSV() {
    if (summaryRows.length === 0) { toast.error('No data to download'); return }

    const staffLabel = summaryMeta?.staffName || (selectedStaffId === 'all' ? 'All Users' : selectedStaffId)
    const header = ['Product', 'Brand', 'Model', 'Variant', 'Unit', 'Movement Type', 'Total Quantity', 'Transactions']
    const rows = summaryRows.map(r => [
      `"${(r.productName || '').replace(/"/g, '""')}"`,
      `"${(r.brand || '').replace(/"/g, '""')}"`,
      `"${(r.model || '').replace(/"/g, '""')}"`,
      `"${(r.variant || '').replace(/"/g, '""')}"`,
      `"${(r.lotUnit || 'units')}"`,
      `"${r.type}"`,
      r.totalQty,
      r.transactions,
    ])

    const csvContent = [
      `"Stock Movements Summary"`,
      `"Date: ${summaryMeta?.startDate}${summaryMeta?.startDate !== summaryMeta?.endDate ? ' to ' + summaryMeta?.endDate : ''}"`,
      `"User: ${staffLabel}"`,
      `"Type: ${activeType === 'all' ? 'All' : activeType}"`,
      '',
      header.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `stock_summary_${reportDate}_${staffLabel.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report downloaded')
  }

  function formatStaffName(s: StaffMember) {
    return s.firstName && s.lastName
      ? `${s.firstName} ${s.lastName}`.trim()
      : s.name
  }

  async function fetchMovements() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeType !== 'all') params.append('type', activeType)
      if (search) params.append('search', search)
      params.append('limit', '200')

      const response = await fetch(`/api/inventory/stock-ledger?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMovements(data.ledger || [])
      }
    } catch (error) {
      toast.error('Failed to load stock movements')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function getMovementIcon(type: string) {
    switch (type) {
      case 'STOCK_IN':
      case 'TRANSFER_IN':
        return <TrendingUp size={16} className="text-green-600" />
      case 'TRANSFER_OUT':
        return <TrendingDown size={16} className="text-orange-600" />
      case 'SALE':
        return <TrendingDown size={16} className="text-blue-600" />
      case 'RETURN':
        return <TrendingUp size={16} className="text-purple-600" />
      case 'EXCHANGE_IN':
        return <TrendingUp size={16} className="text-cyan-600" />
      case 'EXCHANGE_OUT':
        return <TrendingDown size={16} className="text-cyan-600" />
      case 'DAMAGE':
      case 'WASTAGE':
      case 'EXPIRED':
      case 'LOSS':
        return <AlertCircle size={16} className="text-red-600" />
      case 'ADJUSTMENT':
        return <Package size={16} className="text-orange-600" />
      default:
        return <Package size={16} className="text-gray-600" />
    }
  }

  function getMovementColor(type: string) {
    switch (type) {
      case 'STOCK_IN':
      case 'TRANSFER_IN':
        return 'bg-green-100 text-green-800'
      case 'TRANSFER_OUT':
        return 'bg-orange-100 text-orange-800'
      case 'SALE':
        return 'bg-blue-100 text-blue-800'
      case 'RETURN':
        return 'bg-purple-100 text-purple-800'
      case 'EXCHANGE_IN':
      case 'EXCHANGE_OUT':
        return 'bg-cyan-100 text-cyan-800'
      case 'DAMAGE':
      case 'WASTAGE':
      case 'EXPIRED':
      case 'LOSS':
        return 'bg-red-100 text-red-800'
      case 'ADJUSTMENT':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getMovementLabel(type: string) {
    return MOVEMENT_TYPES.find(t => t.value === type)?.label || type
  }

  function formatQuantity(quantity: number, type: string) {
    if (quantity > 0) {
      return <span className="text-green-600 font-semibold">+{quantity}</span>
    } else if (quantity < 0) {
      return <span className="text-red-600 font-semibold">{quantity}</span>
    }
    return <span className="text-gray-600">{quantity}</span>
  }

  function openDetailModal(movement: StockMovement) {
    setSelectedMovement(movement)
    setIsDetailOpen(true)
  }

  async function handleSyncToInventory() {
    if (selectedIds.length === 0) {
      toast.error('Please select movements to sync')
      return
    }

    try {
      setSyncing(true)
      const response = await fetch('/api/inventory/sync-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movementIds: selectedIds }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Movements synced to inventory')
        setSelectedIds([])
        fetchMovements()
      } else {
        toast.error(data.error || 'Failed to sync movements')
      }
    } catch (error) {
      toast.error('Failed to sync movements')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDeleteMovements() {
    if (selectedIds.length === 0) {
      toast.error('Please select movements to delete')
      return
    }

    if (!confirm(`Delete ${selectedIds.length} movement(s)? This cannot be undone.`)) {
      return
    }

    try {
      setSyncing(true)
      const response = await fetch(`/api/inventory/sync-movements?ids=${selectedIds.join(',')}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Movements deleted')
        setSelectedIds([])
        fetchMovements()
      } else {
        toast.error(data.error || 'Failed to delete movements')
      }
    } catch (error) {
      toast.error('Failed to delete movements')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncToInventory() {
    if (!confirm(`Sync ALL ${movements.length} adjustment movements to ProductInventory?\n\nThis will update your inventory based on these stock counts.`)) {
      return
    }

    try {
      setSyncing(true)
      const adjustmentIds = movements.map(m => m._id)
      
      const response = await fetch('/api/inventory/sync-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movementIds: adjustmentIds }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Movements synced to inventory')
        fetchMovements()
      } else {
        toast.error(data.error || 'Failed to sync movements')
      }
    } catch (error) {
      toast.error('Failed to sync movements')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDeleteMovements() {
    if (!confirm(`Delete ALL ${movements.length} adjustment movements?\n\nThis cannot be undone. Only use this if you need to redo the stock count.`)) {
      return
    }

    try {
      setSyncing(true)
      const adjustmentIds = movements.map(m => m._id)
      
      const response = await fetch(`/api/inventory/sync-movements?ids=${adjustmentIds.join(',')}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Movements deleted')
        fetchMovements()
      } else {
        toast.error(data.error || 'Failed to delete movements')
      }
    } catch (error) {
      toast.error('Failed to delete movements')
      console.error(error)
    } finally {
      setSyncing(false)
    }
  }

  // Calculate stats
  const stockInCount = movements.filter(m => ['STOCK_IN', 'TRANSFER_IN'].includes(m.type)).length
  const stockOutCount = movements.filter(m => ['TRANSFER_OUT'].includes(m.type)).length
  const saleCount = movements.filter(m => m.type === 'SALE').length
  const issueCount = movements.filter(m => ['DAMAGE', 'WASTAGE', 'EXPIRED', 'LOSS'].includes(m.type)).length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground mt-2">View complete stock movement history</p>
        </div>
        <div className="flex gap-2">
          {activeType === 'ADJUSTMENT' && movements.length > 0 && (
            <>
              <Button
                onClick={handleSyncToInventory}
                disabled={syncing}
                size="sm"
                variant="outline"
              >
                {syncing ? 'Syncing...' : 'Sync to Inventory'}
              </Button>
              <Button
                onClick={handleDeleteMovements}
                disabled={syncing}
                size="sm"
                variant="destructive"
              >
                {syncing ? 'Deleting...' : 'Delete Adjustments'}
              </Button>
            </>
          )}
          <Button
            onClick={() => setIsRecordMovementOpen(true)}
            size="lg"
          >
            <Plus size={20} className="mr-2" />
            Record Movement
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
            <p className="text-sm text-muted-foreground">Recent transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600" />
              Stock In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stockInCount}</div>
            <p className="text-xs text-muted-foreground">Received & Transfers In</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown size={16} className="text-orange-600" />
              Stock Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stockOutCount}</div>
            <p className="text-xs text-muted-foreground">Transfers Out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown size={16} className="text-blue-600" />
              Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{saleCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600" />
              Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{issueCount}</div>
            <p className="text-xs text-muted-foreground">Damage, Wastage, Expired, Loss</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Activity Report Filter Bar ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileBarChart size={16} />
            Activity Report
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Filter by date, user, and movement type then generate a summary or download CSV
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            {/* From date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                className="h-9 w-40 text-sm"
              />
            </div>
            {/* To date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={reportEndDate}
                onChange={e => setReportEndDate(e.target.value)}
                className="h-9 w-40 text-sm"
              />
            </div>
            {/* User / staff */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">User</label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="h-9 w-48 text-sm">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  {staffList.map(s => (
                    <SelectItem key={s._id} value={s._id}>
                      {formatStaffName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Generate */}
            <Button
              onClick={fetchSummary}
              disabled={summaryLoading}
              size="sm"
              className="h-9"
            >
              {summaryLoading ? 'Loading…' : 'Generate Report'}
            </Button>
            {/* Download — only shown once summary is loaded */}
            {showSummary && summaryRows.length > 0 && (
              <Button
                onClick={downloadSummaryCSV}
                variant="outline"
                size="sm"
                className="h-9"
              >
                <Download size={14} className="mr-1" />
                Download CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Table ─────────────────────────────────────────────────── */}
      {showSummary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {summaryMeta?.staffName
                ? `${summaryMeta.staffName}'s Activity`
                : 'Activity Summary'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {summaryMeta?.startDate === summaryMeta?.endDate
                ? summaryMeta?.startDate
                : `${summaryMeta?.startDate} → ${summaryMeta?.endDate}`}
              {activeType !== 'all' && ` · ${getMovementLabel(activeType)}`}
            </p>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Generating…</div>
            ) : summaryRows.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No movements found for the selected criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row, i) => (
                      <TableRow key={`${row.productId}-${row.type}-${i}`}>
                        <TableCell className="font-medium">
                          {[row.variant, row.brand, row.productName].filter(Boolean).join(' ')}
                          {row.model && <div className="text-xs text-muted-foreground">{row.model}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge className={getMovementColor(row.type)}>
                            <span className="flex items-center gap-1">
                              {getMovementIcon(row.type)}
                              {getMovementLabel(row.type)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {row.totalQty}
                          {row.lotUnit && row.lotUnit !== 'pieces' && (
                            <span className="text-xs font-normal ml-1 text-muted-foreground">{row.lotUnit}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.transactions}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movement Types Pills */}
      <div className="flex flex-wrap gap-2">
        {MOVEMENT_TYPES.map((type) => (
          <Button
            key={type.value}
            onClick={() => setActiveType(type.value)}
            variant={activeType === type.value ? 'default' : 'outline'}
            className={cn(
              'rounded-full whitespace-nowrap',
              activeType === type.value && 'shadow-sm'
            )}
            size="sm"
          >
            {type.label}
          </Button>
        ))}
      </div>

      {/* Movement History Card */}
      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>
            {activeType === 'all' 
              ? 'All stock movements'
              : `${getMovementLabel(activeType)} movements`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading movements...</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No movements found matching your search.' : 'No movements recorded yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Staff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow
                      key={movement._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetailModal(movement)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {new Date(movement.timestamp).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {new Date(movement.timestamp).toLocaleTimeString()}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatProductName(movement.productId)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getMovementColor(movement.type)}>
                          <span className="flex items-center gap-1">
                            {getMovementIcon(movement.type)}
                            {getMovementLabel(movement.type)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatQuantity(movement.quantity, movement.type)}
                      </TableCell>
                      <TableCell>{movement.previousStock}</TableCell>
                      <TableCell className="font-semibold">{movement.newStock}</TableCell>
                      <TableCell>
                        {movement.supplierId?.name || movement.supplierName || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.reference || movement.orderNumber || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.staffId?.name || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movement Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Movement Details</DialogTitle>
            <DialogDescription>
              Complete information about this stock movement
            </DialogDescription>
          </DialogHeader>

          {selectedMovement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                  <p className="text-base">
                    {new Date(selectedMovement.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Movement Type</p>
                  <Badge className={getMovementColor(selectedMovement.type)}>
                    <span className="flex items-center gap-1">
                      {getMovementIcon(selectedMovement.type)}
                      {getMovementLabel(selectedMovement.type)}
                    </span>
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Product</p>
                <p className="text-lg font-semibold">
                  {formatProductName(selectedMovement.productId)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Quantity</p>
                  <p className="text-2xl font-bold">
                    {formatQuantity(selectedMovement.quantity, selectedMovement.type)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Previous Stock</p>
                  <p className="text-2xl font-bold">{selectedMovement.previousStock}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New Stock</p>
                  <p className="text-2xl font-bold text-primary">{selectedMovement.newStock}</p>
                </div>
              </div>

              {(selectedMovement.unitCost || selectedMovement.totalCost) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedMovement.unitCost && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Unit Cost</p>
                      <p className="text-base font-semibold">
                        KSh {selectedMovement.unitCost.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedMovement.totalCost && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                      <p className="text-base font-semibold">
                        KSh {selectedMovement.totalCost.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(selectedMovement.supplierId || selectedMovement.supplierName) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Supplier</p>
                  <p className="text-base">
                    {selectedMovement.supplierId?.name || selectedMovement.supplierName}
                  </p>
                </div>
              )}

              {(selectedMovement.reference || selectedMovement.orderNumber) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reference</p>
                  <p className="text-base font-mono">
                    {selectedMovement.reference || selectedMovement.orderNumber}
                  </p>
                </div>
              )}

              {selectedMovement.staffId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Performed By</p>
                  <p className="text-base">{selectedMovement.staffId.name}</p>
                </div>
              )}

              {selectedMovement.reason && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reason</p>
                  <p className="text-base">{selectedMovement.reason}</p>
                </div>
              )}

              {selectedMovement.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-base whitespace-pre-wrap">{selectedMovement.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Movement Modal */}
      <RecordMovementModal
        open={isRecordMovementOpen}
        onOpenChange={setIsRecordMovementOpen}
        onSuccess={() => {
          setIsRecordMovementOpen(false)
          fetchMovements()
        }}
      />
    </div>
  )
}
