'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, ChevronLeft, ChevronRight, UtensilsCrossed, ShoppingCart, Beer } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { OrderDetailsDialog } from '@/components/orders/order-details-dialog'

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
  source?: 'pos' | 'bar' | 'kds'
  createdAt: string
  notes?: string
  staffId?: {
    name: string
  }
}

interface KitchenOrderItem {
  itemId: string
  name: string
  quantity: number
  notes?: string
  category: string
}

interface KitchenOrder {
  _id: string
  orderNumber: string
  tableNumber: string
  waiterName: string
  coverCount: number
  items: KitchenOrderItem[]
  status: 'pending' | 'acknowledged' | 'preparing' | 'ready' | 'collected'
  priority: string
  totalAmount: number
  createdAt: string
  collectedAt?: string
  specialInstructions?: string
}

export default function OrdersPage() {
  return (
    <PermissionGuard requiredPermission="canViewOrders">
      <OrdersPageContent />
    </PermissionGuard>
  )
}

function OrdersPageContent() {
  const [kdsEnabled, setKdsEnabled] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setKdsEnabled(d.settings?.features?.kdsEnabled === true))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Sales Orders
          </TabsTrigger>
          <TabsTrigger value="bar" className="flex items-center gap-2">
            <Beer className="h-4 w-4" /> Bar Orders
          </TabsTrigger>
          {kdsEnabled && (
            <TabsTrigger value="kitchen" className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" /> Kitchen Orders
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="sales" className="mt-4"><SalesOrdersTab source="pos" /></TabsContent>
        <TabsContent value="bar" className="mt-4"><SalesOrdersTab source="bar" /></TabsContent>
        {kdsEnabled && <TabsContent value="kitchen" className="mt-4"><KitchenOrdersTab /></TabsContent>}
      </Tabs>
    </div>
  )
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: 'completed' | 'pending' | 'held' | 'refunded' }) {
  const cfg = {
    completed: { icon: '✓', border: 'border-green-500', text: 'text-green-600', bg: 'bg-white',      label: 'Completed' },
    pending:   { icon: '…', border: 'border-amber-400', text: 'text-amber-500', bg: 'bg-white',      label: 'Pending'   },
    held:      { icon: '⏸', border: 'border-blue-400',  text: 'text-blue-500',  bg: 'bg-white',      label: 'On Hold'   },
    refunded:  { icon: '↩', border: 'border-red-400',   text: 'text-red-500',   bg: 'bg-white',      label: 'Refunded'  },
  }
  const c = cfg[status]
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
function SalesOrdersTab({ source }: { source: 'pos' | 'bar' }) {
  const [sales, setSales]           = useState<Sale[]>([])
  const [filteredSales, setFiltered] = useState<Sale[]>([])
  const [loading, setLoading]       = useState(true)
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
    try {
      setLoading(true)
      const res = await fetch('/api/sales')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSales(data.sales || [])
    } catch { toast.error('Failed to load orders') }
    finally { setLoading(false) }
  }

  function applyFilters() {
    let f = [...sales]
    // Filter by source: pos = no source (legacy) or source === 'pos'; bar = source === 'bar'
    if (source === 'pos') {
      f = f.filter(s => !s.source || s.source === 'pos')
    } else {
      f = f.filter(s => s.source === source)
    }
    if (search) f = f.filter(s =>
      s._id.toLowerCase().includes(search.toLowerCase()) ||
      s.items.some(i => (i.productId?.name || (i as any).productName || '').toLowerCase().includes(search.toLowerCase()))
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
      </div>

      {/* ── Table — flat, no card wrapper ── */}
      <div className="bg-white">
        {/* Column headers */}
        <div className="grid grid-cols-[36px_1fr_150px_130px_80px] border-b border-gray-200 px-3 py-2">
          <span className="text-xs font-semibold text-gray-500">#</span>
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">↕ Order</span>
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">↕ Time</span>
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">↕ Amount</span>
          <span className="text-xs font-semibold text-gray-500">Mode</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No orders found</div>
        ) : (
          paginated.map((sale) => {
            const orderNum  = `SALE-${sale._id.slice(-5).toUpperCase()}-${fmtOrderDate(sale.createdAt).replace(/ /g, '-')}`
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

// ── Kitchen Orders Tab ────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  pending:      'bg-blue-100 text-blue-700 border-blue-200',
  acknowledged: 'bg-purple-100 text-purple-700 border-purple-200',
  preparing:    'bg-orange-100 text-orange-700 border-orange-200',
  ready:        'bg-green-100 text-green-700 border-green-200',
  collected:    'bg-gray-100 text-gray-600 border-gray-200',
}

function KitchenOrdersTab() {
  const [orders, setOrders]     = useState<KitchenOrder[]>([])
  const [filtered, setFiltered] = useState<KitchenOrder[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const itemsPerPage = 10

  useEffect(() => { fetchOrders() }, [])
  useEffect(() => { applyFilters(); setCurrentPage(1) }, [search, statusFilter, dateRange, orders])

  async function fetchOrders() {
    try {
      setLoading(true)
      const res = await fetch('/api/kds?status=all')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      // Fetch all including collected — use a broader query
      const res2 = await fetch('/api/kds/all')
      const allData = res2.ok ? await res2.json() : data
      setOrders(allData.orders || data.orders || [])
    } catch { toast.error('Failed to load kitchen orders') }
    finally { setLoading(false) }
  }

  function applyFilters() {
    let f = [...orders]
    if (search) f = f.filter(o =>
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.tableNumber.includes(search) ||
      o.waiterName.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
    )
    if (statusFilter !== 'all') f = f.filter(o => o.status === statusFilter)
    if (dateRange.start) f = f.filter(o => new Date(o.createdAt) >= new Date(dateRange.start))
    if (dateRange.end)   f = f.filter(o => new Date(o.createdAt) <= new Date(dateRange.end))
    setFiltered(f)
  }

  const paginated  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filtered.length / itemsPerPage)

  // Summary counts
  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        {[
          { key: 'all',         label: 'All',         count: orders.length },
          { key: 'pending',     label: 'Pending',     count: counts.pending     || 0 },
          { key: 'preparing',   label: 'Preparing',   count: counts.preparing   || 0 },
          { key: 'ready',       label: 'Ready',       count: counts.ready       || 0 },
          { key: 'collected',   label: 'Completed',   count: counts.collected   || 0 },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              statusFilter === s.key
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
            }`}>
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by order #, table, waiter, or item..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">From Date</label>
              <Input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">To Date</label>
              <Input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-green-600" />
            Kitchen Orders ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8">Loading...</div>
          : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UtensilsCrossed className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No kitchen orders found
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginated.map(order => (
                  <div key={order._id} className="border rounded-lg overflow-hidden">
                    {/* Row */}
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExpanded(expanded === order._id ? null : order._id)}>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-green-700 text-base">{order.orderNumber}</span>
                        <div>
                          <p className="font-semibold text-sm">Table {order.tableNumber} · {order.coverCount} cover{order.coverCount !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.waiterName} · {new Date(order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {order.totalAmount > 0 && (
                          <span className="font-bold text-sm text-green-700">KES {order.totalAmount.toLocaleString()}</span>
                        )}
                        <Badge className={`border text-xs ${STATUS_STYLES[order.status]}`}>
                          {order.status.toUpperCase()}
                        </Badge>
                        <span className="text-muted-foreground text-xs">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    {/* Expanded items */}
                    {expanded === order._id && (
                      <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="font-medium">×{item.quantity} {item.name}</span>
                            {item.notes && <span className="text-amber-600 italic text-xs">{item.notes}</span>}
                          </div>
                        ))}
                        {order.specialInstructions && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2">
                            📝 {order.specialInstructions}
                          </p>
                        )}
                        {order.collectedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Completed: {new Date(order.collectedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6">
                  <Button variant="outline" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
