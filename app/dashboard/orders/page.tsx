'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, ChevronLeft, ChevronRight, ShoppingCart, BedDouble, Download } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { OrderDetailsDialog } from '@/components/orders/order-details-dialog'
import { apiGet } from '@/lib/api-client'
import { LoadingOrOffline } from '@/components/offline-indicator'
import { handleApiError } from '@/lib/api-client'

interface SaleItem {
  productId: {
    _id: string
    name: string
  }
  quantity: number
  price: number
  discount: number
}

interface Sale {
  _id: string
  items: SaleItem[]
  total: number
  subtotal?: number
  discount: number
  paymentMethod: string
  status?: 'completed' | 'pending' | 'held' | 'refunded'
  source?: 'pos' | 'rental'
  createdAt: string
  notes?: string
  staffId?: {
    name: string
  }
  rentalMeta?: {
    serviceName?: string
    serviceCategory?: string
    pricingLabel?: string
    startTime?: string
    endTime?: string
    guestCount?: number
    deposit?: number
    customerName?: string
    customerPhone?: string
  }
}

export default function OrdersPage() {
  return (
    <PermissionGuard requiredPermission="pos.orders">
      <OrdersPageContent />
    </PermissionGuard>
  )
}

function OrdersPageContent() {
  const [userType, setUserType]       = useState<'user' | 'staff' | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [features, setFeatures]       = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/tenant/config').then(r => r.ok ? r.json() : null),
    ]).then(([meData, configData]) => {
      if (meData?.user) {
        setUserType(meData.user.type)
        if (meData.user.type === 'staff') setPermissions(meData.user.permissions || {})
      }
      if (configData?.features) setFeatures(configData.features)
    })
  }, [])

  function can(key: string) {
    if (userType === 'user') return features[key] === true
    return features[key] === true && permissions[key] === true
  }

  const showRentals = can('rentals.bookings') || can('rentals.manage')

  return (
    <div className="space-y-4">
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            Sales Orders
          </TabsTrigger>
          {showRentals && (
            <TabsTrigger value="rental" className="flex items-center gap-2">
              Rental Orders
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="sales" className="mt-4"><SalesOrdersTab source="pos" /></TabsContent>
        {showRentals && <TabsContent value="rental"  className="mt-4"><SalesOrdersTab source="rental" /></TabsContent>}
      </Tabs>
    </div>
  )
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status?: 'completed' | 'pending' | 'held' | 'refunded' | 'partially_refunded' }) {
  const cfg = {
    completed:           { icon: '✓', border: 'border-green-500',  text: 'text-green-600',  bg: 'bg-white', label: 'Completed' },
    pending:             { icon: '…', border: 'border-amber-400',  text: 'text-amber-500',  bg: 'bg-white', label: 'Pending'   },
    held:                { icon: '⏸', border: 'border-blue-400',   text: 'text-blue-500',   bg: 'bg-white', label: 'On Hold'   },
    refunded:            { icon: '↩', border: 'border-red-400',    text: 'text-red-500',    bg: 'bg-white', label: 'Refunded'  },
    partially_refunded:  { icon: '⤴', border: 'border-orange-400', text: 'text-orange-500', bg: 'bg-white', label: 'Partial Refund' },
  }
  const c = cfg[status || 'completed']
  return (
    <span className="relative group flex items-center justify-center">
      <span className={`w-5 h-5 rounded-full border-2 ${c.border} ${c.bg} flex items-center justify-center`}>
        <span className={`text-[10px] font-black leading-none ${c.text}`}>{c.icon}</span>
      </span>
      <span className="absolute left-6 top-1/2 -translate-y-1/2 z-10 hidden group-hover:flex items-center whitespace-nowrap bg-gray-900 text-white text-[11px] font-semibold px-2 py-1 rounded shadow-lg pointer-events-none">
        {c.label}
      </span>
    </span>
  )
}

// ── Sales Orders Tab ──────────────────────────────────────────────────────────
function SalesOrdersTab({ source }: { source: 'pos' | 'rental' }) {
  const [sales, setSales]           = useState<Sale[]>([])
  const [filteredSales, setFiltered] = useState<Sale[]>([])
  const [loading, setLoading]       = useState(true)
  const [isOffline, setIsOffline]   = useState(false)
  const [search, setSearch]         = useState('')
  const [dateRange, setDateRange]   = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const PER_PAGE = 15

  useEffect(() => { fetchSales() }, [])
  useEffect(() => { applyFilters(); setCurrentPage(1) }, [search, dateRange, sales])

  // Default date range: first of current month → today
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    setDateRange({ start: `${y}-${m}-01`, end: `${y}-${m}-${d}` })
  }, [])

  async function fetchSales() {
    setLoading(true)
    setIsOffline(false)
    
    const result = await apiGet<{ sales: Sale[] }>('/api/sales')
    
    if (result.success && result.data) {
      setSales(result.data.sales || [])
    } else if (result.error) {
      setIsOffline(result.error.isOffline)
      toast.error(handleApiError(result.error, 'Failed to load orders'))
    }
    
    setLoading(false)
  }

  function applyFilters() {
    let f = [...sales]
    // Filter by source: pos = no source (legacy) or source === 'pos'; rental = source === 'rental'
    if (source === 'pos') {
      f = f.filter(s => !s.source || s.source === 'pos')
    } else {
      f = f.filter(s => s.source === source)
    }
    if (search) f = f.filter(s =>
      s._id.toLowerCase().includes(search.toLowerCase()) ||
      s.items.some(i => (i.productId?.name || (i as any).productName || '').toLowerCase().includes(search.toLowerCase())) ||
      (s.rentalMeta?.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.rentalMeta?.serviceName || '').toLowerCase().includes(search.toLowerCase())
    )
    if (dateRange.start) f = f.filter(s => new Date(s.createdAt) >= new Date(dateRange.start))
    if (dateRange.end)   f = f.filter(s => new Date(s.createdAt) <= new Date(dateRange.end + 'T23:59:59'))
    setFiltered(f)
  }

  function fmtOrderDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  function fmtOrderTime(d: string) {
    return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  function fmtDateLabel(start: string, end: string) {
    if (!start && !end) return 'All dates'
    const fmt = (s: string) => {
      const [y, m, d] = s.split('-')
      return `${d}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]}-${y}`
    }
    if (start && end) return `${fmt(start)} - ${fmt(end)}`
    if (start) return `From ${fmt(start)}`
    return `Until ${fmt(end)}`
  }
  function payLabel(method: string) {
    if (method === 'mobile_money') return 'M-Pesa'
    return method.charAt(0).toUpperCase() + method.slice(1)
  }

  function exportCSV() {
    const rows = filteredSales
    let csv = `Order ID,Date,Time,Amount (KES),Payment,Status,Customer,Notes\n`
    rows.forEach(s => {
      const customer = s.rentalMeta?.customerName || (s.staffId as any)?.name || ''
      csv += [
        `"${s._id}"`,
        fmtOrderDate(s.createdAt),
        fmtOrderTime(s.createdAt),
        s.total.toFixed(2),
        payLabel(s.paymentMethod),
        s.status || 'completed',
        `"${customer}"`,
        `"${(s.notes || '').replace(/"/g, '""')}"`,
      ].join(',') + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${source}-orders-${dateRange.start || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Summary totals for filtered view
  const summaryTotal   = filteredSales.reduce((s, x) => s + x.total, 0)
  const summaryByCash  = filteredSales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0)
  const summaryByMpesa = filteredSales.filter(s => s.paymentMethod === 'mobile_money').reduce((s, x) => s + x.total, 0)
  const summaryByCard  = filteredSales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0)

  const paginated  = filteredSales.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)
  const totalPages = Math.ceil(filteredSales.length / PER_PAGE)

  return (
    <div className="space-y-2">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        {/* Search with button */}
        <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden flex-1 max-w-xs">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search Items"
            className="flex-1 px-3 py-2 text-sm text-gray-900 focus:outline-none placeholder:text-gray-400"
          />
          <button className="px-3 py-2 border-l border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
            <Search className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Date range display */}
        <div className="flex-1 border border-gray-300 rounded bg-white px-3 py-2 text-sm text-gray-700 tabular-nums">
          {fmtDateLabel(dateRange.start, dateRange.end)}
        </div>

        {/* Hidden date pickers — triggered via the display field */}
        <input type="date" value={dateRange.start}
          onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
          className="px-2 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />
        <input type="date" value={dateRange.end}
          onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
          className="px-2 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />

        <button onClick={exportCSV}
          className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors text-gray-700">
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {/* ── Summary bar ── */}
      {!loading && filteredSales.length > 0 && (
        <div className="flex flex-wrap gap-4 bg-green-50 border border-green-200 rounded px-4 py-2 text-sm">
          <span className="text-gray-700">Orders: <strong>{filteredSales.length}</strong></span>
          <span className="text-gray-900">Total: <strong>KES {summaryTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
          {summaryByCash  > 0 && <span className="text-gray-600">Cash: <strong>KES {summaryByCash.toLocaleString()}</strong></span>}
          {summaryByMpesa > 0 && <span className="text-blue-700">M-Pesa: <strong>KES {summaryByMpesa.toLocaleString()}</strong></span>}
          {summaryByCard  > 0 && <span className="text-purple-700">Card: <strong>KES {summaryByCard.toLocaleString()}</strong></span>}
        </div>
      )}

      {/* ── Table — flat, no card wrapper ── */}
      <LoadingOrOffline
        isLoading={loading}
        isOffline={isOffline}
        onRetry={fetchSales}
        loadingText="Loading orders..."
        offlineMessage="Unable to load orders. Please check your connection."
      >
        <div className="bg-white">
          {/* Column headers */}
          <div className="grid grid-cols-[36px_1fr_150px_130px_80px] border-b border-gray-200 px-3 py-2">
            <span className="text-xs font-semibold text-gray-500">#</span>
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">↕ Order</span>
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">↕ Time</span>
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">↕ Amount</span>
            <span className="text-xs font-semibold text-gray-500">Mode</span>
          </div>

          {filteredSales.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">No orders found</div>
          ) : (
          paginated.map((sale) => {
            const orderNum  = (sale as any).orderNumber || `ORD-${sale._id.slice(-5).toUpperCase()}`
            const staffName = (sale.staffId as any)?.firstName
              ? `${(sale.staffId as any).firstName} ${(sale.staffId as any).lastName ?? ''}`.trim()
              : (sale.staffId as any)?.name || null
            return (
              <div key={sale._id}
                onClick={() => { setSelectedOrder(sale); setDialogOpen(true) }}
                className="grid grid-cols-[36px_1fr_150px_130px_80px] px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-0 items-center">
                {/* # */}
                <div className="flex items-center">
                  <StatusDot status={sale.status ?? 'completed'} />
                </div>
                {/* Order — number + staff on one line */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-900 truncate">{orderNum}</span>
                  {staffName && (
                    <span className="text-xs text-gray-400 shrink-0">{staffName}</span>
                  )}
                  {sale.rentalMeta?.customerName && (
                    <span className="text-xs text-blue-500 shrink-0">{sale.rentalMeta.customerName}</span>
                  )}
                </div>
                {/* Time */}
                <div className="text-sm text-gray-600 tabular-nums">
                  {fmtOrderTime(sale.createdAt)} · {fmtOrderDate(sale.createdAt)}
                </div>
                {/* Amount */}
                <div className="text-sm text-gray-900 tabular-nums">
                  KES {sale.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                {/* Mode */}
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                    sale.paymentMethod === 'cash'         ? 'bg-gray-100 text-gray-700 border-gray-300' :
                    sale.paymentMethod === 'mobile_money' ? 'bg-blue-50 text-blue-700 border-blue-200'  :
                                                            'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {payLabel(sale.paymentMethod)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        </div>
      </LoadingOrOffline>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-end gap-1 pt-1">
        {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => setCurrentPage(p)}
            className={`w-7 h-7 rounded text-sm font-semibold transition-colors ${
              p === currentPage
                ? 'bg-white border border-gray-400 text-gray-900'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
            }`}>
            {p}
          </button>
        ))}
        {currentPage < totalPages && (
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="px-2 h-7 rounded text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-gray-400 flex items-center gap-0.5">
            Next <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-1.5" />
          </button>
        )}
      </div>

      <OrderDetailsDialog open={dialogOpen} onOpenChange={setDialogOpen} order={selectedOrder} />
    </div>
  )
}
