'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { UtensilsCrossed, Clock, BedDouble } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { normaliseFeatures, normalisePermissions } from '@/lib/modules'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const [stats, setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('30')

  // Access control
  const [userType, setUserType]         = useState<'user' | 'staff' | null>(null)
  const [permissions, setPermissions]   = useState<Record<string, boolean>>({})
  const [features, setFeatures]         = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Load user + tenant features in parallel
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/tenant/config').then(r => r.ok ? r.json() : null),
    ]).then(([meData, configData]) => {
      if (meData?.user) {
        setUserType(meData.user.type)
        if (meData.user.type === 'staff') {
          setPermissions(normalisePermissions(meData.user.permissions || {}))
        }
      }
      if (configData?.features) {
        setFeatures(normaliseFeatures(configData.features))
      }
    })
  }, [])

  useEffect(() => { fetchStats() }, [period])

  async function fetchStats() {
    try {
      setLoading(true)
      const res = await fetch(`/api/dashboard/stats?days=${period}`)
      if (res.ok) setStats((await res.json()).stats)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  // Can this user see a given feature key?
  function can(key: string): boolean {
    if (userType === 'user') return features[key] === true
    return features[key] === true && permissions[key] === true
  }

  const showBar     = can('bar.tabs')
  const showKds     = can('kds.display')
  const showRentals = can('rentals.bookings') || can('rentals.manage')

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">Loading dashboard...</div></div>
  if (!stats)  return <div className="flex items-center justify-center h-screen"><div className="text-lg text-muted-foreground">No data available</div></div>

  // ── Staff view — minimal, no sensitive business data ──────────────────────
  if (stats.isStaffView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your activity today</p>
        </div>

        {/* Today's summary — their own sales only */}
        {stats.todayStats && (
          <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Today's Summary</p>
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="text-gray-700">Orders: <strong>{stats.todayStats.totalOrders}</strong></span>
              <span className="text-gray-700">Revenue: <strong>KES {stats.todayStats.totalRevenue.toLocaleString()}</strong></span>
              {Object.entries(stats.todayStats.byPayment as Record<string, number>).map(([method, amt]) => (
                <span key={method} className="text-gray-500">
                  {method === 'mobile_money' ? 'M-Pesa' : method.charAt(0).toUpperCase() + method.slice(1)}: <strong>KES {(amt as number).toLocaleString()}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Low stock alert if they have inventory access */}
        {stats.products && stats.products.lowStockItems > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            ⚠ <strong>{stats.products.lowStockItems}</strong> product{stats.products.lowStockItems > 1 ? 's are' : ' is'} running low on stock.
          </div>
        )}

        {/* Recent orders — their own only */}
        <Card>
          <CardHeader><CardTitle className="text-lg">My Recent Sales</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats.recentOrders || []).slice(0, 10).map((order: any) => (
                <div key={order._id} className="flex justify-between items-start text-sm">
                  <div>
                    <p className="font-medium">#{order._id.slice(-6).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className="font-semibold">KES {order.total.toLocaleString()}</p>
                </div>
              ))}
              {(!stats.recentOrders || stats.recentOrders.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No sales yet today</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your business</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Today's Summary */}
      {stats.todayStats && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Today's Summary</p>
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="text-gray-700">Orders: <strong>{stats.todayStats.totalOrders}</strong></span>
            <span className="text-gray-700">Revenue: <strong>KES {stats.todayStats.totalRevenue.toLocaleString()}</strong></span>
            {stats.todayStats.bySource.pos > 0    && <span className="text-gray-600">POS: <strong>KES {stats.todayStats.bySource.pos.toLocaleString()}</strong></span>}
            {showBar     && stats.todayStats.bySource.bar > 0    && <span className="text-green-700">Bar: <strong>KES {stats.todayStats.bySource.bar.toLocaleString()}</strong></span>}
            {showKds     && stats.todayStats.bySource.kds > 0    && <span className="text-blue-700">Kitchen: <strong>KES {stats.todayStats.bySource.kds.toLocaleString()}</strong></span>}
            {showRentals && stats.todayStats.bySource.rental > 0 && <span className="text-purple-700">Rentals: <strong>KES {stats.todayStats.bySource.rental.toLocaleString()}</strong></span>}
            {Object.entries(stats.todayStats.byPayment as Record<string, number>).map(([method, amt]) => (
              <span key={method} className="text-gray-500">
                {method === 'mobile_money' ? 'M-Pesa' : method.charAt(0).toUpperCase() + method.slice(1)}: <strong>KES {amt.toLocaleString()}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className={`grid gap-4 ${[true, showBar, showKds, showRentals].filter(Boolean).length === 1 ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-5'}`}>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Revenue ({period}d)</p>
            <p className="text-2xl font-bold">KES {stats.recentPeriod.revenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">POS ({period}d)</p>
            <p className="text-2xl font-bold">KES {(stats.revenueBySource?.pos ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        {showBar && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Bar ({period}d)</p>
              <p className="text-2xl font-bold text-green-700">KES {(stats.revenueBySource?.bar ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        )}
        {showKds && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Kitchen ({period}d)</p>
              <p className="text-2xl font-bold text-blue-700">KES {(stats.revenueBySource?.kds ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        )}
        {showRentals && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Rentals ({period}d)</p>
              <p className="text-2xl font-bold text-purple-700">KES {(stats.revenueBySource?.rental ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Orders</p><p className="text-2xl font-bold">{stats.totalSales}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Products</p><p className="text-2xl font-bold">{stats.products.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Avg Sale</p><p className="text-2xl font-bold">KES {stats.averageSaleValue.toFixed(0)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Staff</p><p className="text-2xl font-bold">{stats.staffCount}</p></CardContent></Card>
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Sales Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.charts.salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Top Products</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.charts.topProducts.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">{i + 1}</Badge>
                      <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.quantity} sold</p></div>
                    </div>
                    <p className="text-sm font-semibold">KES {p.revenue.toLocaleString()}</p>
                  </div>
                ))}
                {stats.charts.topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Quick Stats</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Period Sales',    value: stats.recentPeriod.totalSales },
                { label: 'Period Revenue',  value: `KES ${stats.recentPeriod.revenue.toLocaleString()}` },
                { label: 'Discounts',       value: `KES ${stats.recentPeriod.discount.toLocaleString()}`, className: 'text-orange-600' },
                { label: 'Stock Value',     value: `KES ${stats.products.stockValue.toLocaleString()}` },
              ].map((row, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`font-semibold ${(row as any).className || ''}`}>{row.value}</span>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Low Stock</span>
                <Badge variant={stats.products.lowStockItems > 0 ? 'destructive' : 'secondary'}>{stats.products.lowStockItems}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Recent Orders</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentOrders.slice(0, 5).map((order: any) => (
                  <div key={order._id} className="flex justify-between items-start text-sm">
                    <div>
                      <p className="font-medium">#{order._id.slice(-6).toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <p className="font-semibold">KES {order.total.toLocaleString()}</p>
                  </div>
                ))}
                {stats.recentOrders.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No orders</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Payment Methods</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.charts.paymentMethods.map((method: any, i: number) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm capitalize">{method.method.replace('_', ' ')}</span>
                    </div>
                    <span className="text-sm font-semibold">{method.count}</span>
                  </div>
                ))}
                {stats.charts.paymentMethods.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rentals Section */}
      {showRentals && stats.rentalStats && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-bold">Rental Services</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Bookings</p><p className="text-2xl font-bold text-purple-700">{stats.rentalStats.totalBookings}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active Now</p><p className="text-2xl font-bold text-green-600">{stats.rentalStats.activeRentals}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold">{stats.rentalStats.completedRentals}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Rental Revenue</p><p className="text-2xl font-bold text-purple-700">KES {stats.rentalStats.rentalRevenue.toLocaleString()}</p></CardContent></Card>
          </div>
        </div>
      )}

      {/* KDS Section */}
      {showKds && stats.kdsStats && stats.kdsStats.todayTotal > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-bold">Kitchen Display — Today</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Orders',   value: stats.kdsStats.todayTotal,     color: 'text-blue-600' },
              { label: 'Completed',      value: stats.kdsStats.todayCompleted, color: 'text-green-600' },
              { label: 'Active Now',     value: stats.kdsStats.todayActive,    color: 'text-amber-600' },
              { label: 'Tables Served',  value: stats.kdsStats.tablesServed,   color: 'text-purple-600' },
              { label: 'Avg Prep (min)', value: stats.kdsStats.avgPrepMins || '—', color: 'text-gray-700' },
            ].map(s => (
              <Card key={s.label}><CardContent className="pt-5"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-sm text-muted-foreground mt-1">{s.label}</p></CardContent></Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2">👨‍🍳 Recent Kitchen Orders</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.kdsStats.recentKitchenOrders.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No kitchen orders yet today</p>}
                {stats.kdsStats.recentKitchenOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-sm border rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-green-700">{o.orderNumber}</span>
                      <span className="text-muted-foreground">Table {o.tableNumber}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{o.waiterName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={
                        o.status === 'collected' ? 'bg-gray-100 text-gray-600' :
                        o.status === 'ready'     ? 'bg-green-100 text-green-700 border-green-200' :
                        o.status === 'preparing' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        'bg-blue-100 text-blue-700 border-blue-200'
                      }>{o.status.toUpperCase()}</Badge>
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

