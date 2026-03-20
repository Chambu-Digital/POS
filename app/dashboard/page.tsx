'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { UtensilsCrossed, ChefHat, Clock, Table } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    fetchStats()
  }, [period])

  async function fetchStats() {
    try {
      setLoading(true)
      const response = await fetch(`/api/dashboard/stats?days=${period}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-muted-foreground">No data available</div>
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
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics - Compact Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">KES {stats.totalRevenue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">POS Sales</p>
              <p className="text-2xl font-bold">KES {(stats.revenueBySource?.pos ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Bar Revenue</p>
              <p className="text-2xl font-bold text-green-700">KES {(stats.revenueBySource?.bar ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">KDS Revenue</p>
              <p className="text-2xl font-bold text-blue-700">KES {(stats.revenueBySource?.kds ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{stats.totalSales}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Products</p>
              <p className="text-2xl font-bold">{stats.products.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Avg Sale</p>
              <p className="text-2xl font-bold">KES {(stats.averageSaleValue).toFixed(0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Staff</p>
              <p className="text-2xl font-bold">{stats.staffCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sales Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sales Trend</CardTitle>
            </CardHeader>
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

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.charts.topProducts.slice(0, 5).map((product: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.quantity} sold</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">KES {product.revenue.toLocaleString()}</p>
                  </div>
                ))}
                {stats.charts.topProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Recent */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Period Sales</span>
                <span className="font-semibold">{stats.recentPeriod.totalSales}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Period Revenue</span>
                <span className="font-semibold">KES {stats.recentPeriod.revenue.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Discounts</span>
                <span className="font-semibold text-orange-600">KES {stats.recentPeriod.discount.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Stock Value</span>
                <span className="font-semibold">KES {stats.products.stockValue.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Low Stock</span>
                <Badge variant={stats.products.lowStockItems > 0 ? "destructive" : "secondary"}>
                  {stats.products.lowStockItems}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentOrders.slice(0, 5).map((order: any) => (
                  <div key={order._id} className="flex justify-between items-start text-sm">
                    <div>
                      <p className="font-medium">#{order._id.slice(-6).toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="font-semibold">KES {order.total.toLocaleString()}</p>
                  </div>
                ))}
                {stats.recentOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No orders</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.charts.paymentMethods.map((method: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm capitalize">{method.method.replace('_', ' ')}</span>
                    </div>
                    <span className="text-sm font-semibold">{method.count}</span>
                  </div>
                ))}
                {stats.charts.paymentMethods.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KDS Section — only shown when KDS is enabled */}
      {stats.kdsEnabled && stats.kdsStats && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-bold">Kitchen Display — Today</h2>
          </div>

          {/* KDS stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Orders',   value: stats.kdsStats.todayTotal,     color: 'text-blue-600' },
              { label: 'Completed',      value: stats.kdsStats.todayCompleted, color: 'text-green-600' },
              { label: 'Active Now',     value: stats.kdsStats.todayActive,    color: 'text-amber-600' },
              { label: 'Tables Served',  value: stats.kdsStats.tablesServed,   color: 'text-purple-600' },
              { label: 'Avg Prep (min)', value: stats.kdsStats.avgPrepMins || '—', color: 'text-gray-700' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-5">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent kitchen orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-green-600" />
                Recent Kitchen Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.kdsStats.recentKitchenOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No kitchen orders yet today</p>
                )}
                {stats.kdsStats.recentKitchenOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-sm border rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-green-700">{o.orderNumber}</span>
                      <span className="text-muted-foreground">Table {o.tableNumber}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{o.waiterName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        o.status === 'collected' ? 'secondary' :
                        o.status === 'ready'     ? 'default'   :
                        o.status === 'preparing' ? 'outline'   : 'outline'
                      } className={
                        o.status === 'collected' ? 'bg-gray-100 text-gray-600' :
                        o.status === 'ready'     ? 'bg-green-100 text-green-700 border-green-200' :
                        o.status === 'preparing' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        'bg-blue-100 text-blue-700 border-blue-200'
                      }>
                        {o.status.toUpperCase()}
                      </Badge>
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
