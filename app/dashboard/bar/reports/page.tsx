'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { Calendar, RefreshCw, TrendingUp, GlassWater, AlertTriangle, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OpenTab {
  _id: string
  tabNumber: string
  customerName: string
  tableNumber: string
  total: number
  amountPaid: number
  openedAt: string
}

interface ClosedTab {
  _id: string
  tabNumber: string
  customerName: string
  tableNumber: string
  total: number
  discountAmount: number
  closedAt: string
}

interface BottleDiff {
  _id: string
  bottleNumber: number
  inventoryItem: { name: string }
  expectedUnits: number
  actualUnitsSold: number
  difference: number
  openedBy: { name: string }
  openedAt: string
  closedAt: string
}

interface ProductSold {
  itemName: string
  quantity: number
  revenue: number
}

type Period = '7d' | '30d' | '90d' | 'custom'
type ReportTab = 'overview' | 'open' | 'closed' | 'bottles' | 'products'

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BarReportsPage() {
  return (
    <PermissionGuard requiredPermission="bar.reports">
      <ReportsContent />
    </PermissionGuard>
  )
}

function ReportsContent() {
  // ── Period state ────────────────────────────────────────────────────────────
  const [period,   setPeriod]   = useState<Period>('30d')
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')

  // ── Data state ──────────────────────────────────────────────────────────────
  const [outstanding,    setOutstanding]    = useState(0)
  const [openTabCount,   setOpenTabCount]   = useState(0)
  const [openTabs,       setOpenTabs]       = useState<OpenTab[]>([])
  const [closedTabs,     setClosedTabs]     = useState<ClosedTab[]>([])
  const [closedRevenue,  setClosedRevenue]  = useState(0)
  const [closedCount,    setClosedCount]    = useState(0)
  const [bottleDiffs,    setBottleDiffs]    = useState<BottleDiff[]>([])
  const [totalLoss,      setTotalLoss]      = useState(0)
  const [products,       setProducts]       = useState<ProductSold[]>([])
  const [dailyRevenue,   setDailyRevenue]   = useState<{ date: string; total: number }[]>([])
  const [totalRevenue,   setTotalRevenue]   = useState(0)
  const [totalSales,     setTotalSales]     = useState(0)

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ReportTab>('overview')

  // ── Date helpers ────────────────────────────────────────────────────────────

  function getDateRange(): { from: string; to: string } {
    const now = new Date()
    const to  = now.toISOString().slice(0, 10)
    if (period === 'custom') return { from: fromDate, to: toDate }
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { from, to }
  }

  // ── Load all data ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = getDateRange()
    if (!from || !to) { setLoading(false); return }

    try {
      const [outstandingRes, openRes, closedRes, diffRes, productsRes] = await Promise.all([
        fetch('/api/bar/reports/outstanding'),
        fetch('/api/bar/tabs?status=open'),
        fetch(`/api/bar/reports/closed-tabs?from=${from}&to=${to}`),
        fetch(`/api/bar/reports/bottle-differences?from=${from}&to=${to}`),
        fetch(`/api/bar/reports/products-sold?from=${from}&to=${to}`),
      ])

      if (outstandingRes.ok) {
        const d = await outstandingRes.json()
        setOutstanding(d.outstanding ?? 0)
      }
      if (openRes.ok) {
        const d = await openRes.json()
        setOpenTabs(d.tabs ?? [])
        setOpenTabCount((d.tabs ?? []).length)
      }
      if (closedRes.ok) {
        const d = await closedRes.json()
        setClosedTabs(d.tabs ?? [])
        setClosedRevenue(d.totalRevenue ?? 0)
        setClosedCount(d.count ?? 0)
      }
      if (diffRes.ok) {
        const d = await diffRes.json()
        setBottleDiffs(d.differences ?? [])
        setTotalLoss(d.totalLoss ?? 0)
      }
      if (productsRes.ok) {
        const d = await productsRes.json()
        setProducts(d.products ?? [])
        setDailyRevenue(d.dailyRevenue ?? [])
        setTotalRevenue(d.totalRevenue ?? 0)
        setTotalSales(d.totalSales ?? 0)
      }
    } catch {
      toast.error('Failed to load reports')
    }
    setLoading(false)
  }, [period, fromDate, toDate])

  useEffect(() => { load() }, [load])

  // ── UI helpers ──────────────────────────────────────────────────────────────

  const periodLabel: Record<Period, string> = {
    '7d':     'Last 7 days',
    '30d':    'Last 30 days',
    '90d':    'Last 90 days',
    'custom': 'Custom range',
  }

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'overview',  label: 'Overview'          },
    { key: 'open',      label: `Open Tabs (${openTabCount})` },
    { key: 'closed',    label: 'Closed Tabs'        },
    { key: 'bottles',   label: 'Bottle Differences' },
    { key: 'products',  label: 'Products Sold'      },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bar Reports</h1>
          <p className="text-sm text-muted-foreground">Sales, inventory, and performance analytics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['7d', '30d', '90d', 'custom'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                period === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              )}
            >
              {periodLabel[p]}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={cn('mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium mb-1">From</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">To</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
          </div>
          <Button size="sm" onClick={load} disabled={!fromDate || !toDate}>
            <Calendar size={14} className="mr-1.5" /> Load
          </Button>
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<DollarSign size={18} className="text-emerald-600" />}
          bg="bg-emerald-50"
          label="Period Revenue"
          value={`KES ${totalRevenue.toLocaleString()}`}
          sub={`${totalSales} bar sale${totalSales !== 1 ? 's' : ''}`}
        />
        <SummaryCard
          icon={<GlassWater size={18} className="text-orange-500" />}
          bg="bg-orange-50"
          label="Outstanding (Tabs)"
          value={`KES ${outstanding.toLocaleString()}`}
          sub={`${openTabCount} open tab${openTabCount !== 1 ? 's' : ''}`}
          highlight={outstanding > 0}
        />
        <SummaryCard
          icon={<TrendingUp size={18} className="text-blue-600" />}
          bg="bg-blue-50"
          label="Tabs Closed"
          value={closedCount.toLocaleString()}
          sub={`KES ${closedRevenue.toLocaleString()} revenue`}
        />
        <SummaryCard
          icon={<AlertTriangle size={18} className="text-red-500" />}
          bg="bg-red-50"
          label="Bottle Losses"
          value={bottleDiffs.filter(d => d.difference < 0).length.toLocaleString()}
          sub={`${totalLoss} units unaccounted`}
          highlight={totalLoss > 0}
        />
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Overview ───────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Revenue trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyRevenue.length === 0 ? (
                <EmptyState message="No sales in this period" />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }}
                        tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }}
                        tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, 'Revenue']} />
                      <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top products preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 Items</CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <EmptyState message="No sales in this period" />
              ) : (
                <div className="space-y-2">
                  {products.slice(0, 5).map((p, i) => (
                    <div key={p.itemName} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-muted text-[11px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.itemName}</p>
                        <p className="text-xs text-muted-foreground">{p.quantity} sold</p>
                      </div>
                      <p className="text-sm font-semibold shrink-0">KES {p.revenue.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Open tabs ──────────────────────────────────────────────────────── */}
      {activeTab === 'open' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Tabs</CardTitle>
          </CardHeader>
          <CardContent>
            {openTabs.length === 0 ? (
              <EmptyState message="No open tabs right now" />
            ) : (
              <div className="space-y-2">
                {openTabs.map(tab => {
                  const balance = tab.total - tab.amountPaid
                  return (
                    <div key={tab._id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">Tab #{tab.tabNumber}</p>
                          {balance > 0 && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]">
                              Unpaid
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tab.customerName || 'No customer'}
                          {tab.tableNumber && ` · Table ${tab.tableNumber}`}
                          {' · '}Opened {new Date(tab.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">KES {tab.total.toLocaleString()}</p>
                        {tab.amountPaid > 0 && (
                          <p className="text-xs text-muted-foreground">Paid: KES {tab.amountPaid.toLocaleString()}</p>
                        )}
                        {balance > 0 && (
                          <p className="text-xs text-orange-600 font-medium">Owes: KES {balance.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Total outstanding</span>
                  <span className="text-orange-600">KES {outstanding.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Closed tabs ────────────────────────────────────────────────────── */}
      {activeTab === 'closed' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Closed Tabs</CardTitle>
              {closedCount > 0 && (
                <span className="text-sm font-semibold text-emerald-600">
                  {closedCount} tabs · KES {closedRevenue.toLocaleString()}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {closedTabs.length === 0 ? (
              <EmptyState message="No closed tabs in this period" />
            ) : (
              <div className="space-y-2">
                {closedTabs.map(tab => (
                  <div key={tab._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">Tab #{tab.tabNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {tab.customerName || 'No customer'}
                        {tab.tableNumber && ` · Table ${tab.tableNumber}`}
                        {' · '}{new Date(tab.closedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">KES {tab.total.toLocaleString()}</p>
                      {tab.discountAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Disc: KES {tab.discountAmount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Bottle differences ─────────────────────────────────────────────── */}
      {activeTab === 'bottles' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Bottle Differences</CardTitle>
              {totalLoss > 0 && (
                <span className="text-sm font-semibold text-red-600">
                  {totalLoss} units unaccounted
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {bottleDiffs.length === 0 ? (
              <EmptyState message="No closed bottles in this period" />
            ) : (
              <div className="space-y-2">
                {bottleDiffs.map(diff => (
                  <div key={diff._id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{diff.inventoryItem.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Bottle #{diff.bottleNumber} · Opened by {diff.openedBy.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(diff.openedAt).toLocaleDateString()} – {new Date(diff.closedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-muted-foreground">
                        Expected {diff.expectedUnits} · Actual {diff.actualUnitsSold}
                      </p>
                      <p className={cn(
                        'text-sm font-bold',
                        diff.difference < 0 ? 'text-red-600' : diff.difference > 0 ? 'text-amber-600' : 'text-emerald-600'
                      )}>
                        {diff.difference > 0 ? '+' : ''}{diff.difference} units
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Products sold ──────────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {products.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Sales by Item</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={products.slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }}
                        tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="itemName" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`KES ${v.toLocaleString()}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Product Breakdown</CardTitle></CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <EmptyState message="No sales in this period" />
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 text-xs font-semibold text-muted-foreground px-3 pb-2 border-b">
                    <span>Item</span>
                    <span className="text-center">Qty Sold</span>
                    <span className="text-right">Revenue</span>
                  </div>
                  {products.map((p, i) => (
                    <div key={p.itemName} className="grid grid-cols-3 items-center px-3 py-2 rounded-lg hover:bg-muted/40 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                        <span className="truncate font-medium">{p.itemName}</span>
                      </div>
                      <span className="text-center text-muted-foreground">{p.quantity}</span>
                      <span className="text-right font-semibold">KES {p.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                  <Separator className="mt-2" />
                  <div className="grid grid-cols-3 px-3 py-2 text-sm font-bold">
                    <span>Total</span>
                    <span className="text-center">{products.reduce((s, p) => s + p.quantity, 0)}</span>
                    <span className="text-right">KES {totalRevenue.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ── Small reusable components ──────────────────────────────────────────────────

function SummaryCard({
  icon, bg, label, value, sub, highlight = false,
}: {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <Card className={cn(highlight && 'ring-1 ring-orange-300')}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', bg)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold leading-tight truncate">{value}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <GlassWater size={32} className="opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
