'use client'

import { useState, useEffect, useRef } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { OrderCard } from '@/components/kds/OrderCard'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KDSOrder, OrderStatus, KitchenStation } from '@/types/kds'
import { computeStats } from '@/lib/kds-utils'
import { toast } from 'sonner'

function playNotificationSound() {
  if (typeof window !== 'undefined') {
    const audio = new Audio('/notification.mp3')
    audio.volume = 0.5
    audio.play().catch(() => {})
  }
}

export default function ChefViewPage() {
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [stationFilter, setStationFilter] = useState<KitchenStation | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const prevOrderIds = useRef<Set<string>>(new Set())

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/kds?view=chef')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      
      // Check for new pending orders
      const newPending = data.orders.filter(
        (o: KDSOrder) => o.status === 'pending' && !prevOrderIds.current.has(o.id)
      )
      
      if (newPending.length > 0 && prevOrderIds.current.size > 0) {
        playNotificationSound()
        toast.success(`${newPending.length} new order(s) received!`, {
          duration: 5000,
        })
      }
      
      prevOrderIds.current = new Set(data.orders.map((o: KDSOrder) => o.id))
      setOrders(data.orders)
    } catch (error) {
      toast.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleUpdateStatus = async (id: string, status: OrderStatus) => {
    // Optimistic update
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const now = new Date().toISOString()
      return {
        ...o,
        status,
        preparingAt: status === 'preparing' ? now : o.preparingAt,
        readyAt: status === 'ready' ? now : o.readyAt,
      }
    }))

    const order = orders.find(o => o.id === id)
    if (order) {
      if (status === 'ready') {
        playNotificationSound()
        toast.success(`${order.orderNumber} is ready for Table ${order.tableNumber}!`)
      } else if (status === 'preparing') {
        toast.info(`Started preparing ${order.orderNumber}`)
      }
    }

    try {
      await fetch('/api/kds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, status }),
      })
    } catch (error) {
      toast.error('Failed to update order')
      fetchOrders()
    }
  }

  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (stationFilter !== 'all') {
      const hasStation = o.items.some(item => item.station === stationFilter)
      if (!hasStation) return false
    }
    return true
  })

  const stats = computeStats(orders)

  return (
    <PermissionGuard requiredPermission="kds.chef">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Chef View</h1>
          <p className="text-gray-600 mt-1">Kitchen display for order preparation</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-orange-600">{stats.preparing}</div>
              <div className="text-sm text-gray-600">Preparing</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-green-600">{stats.ready}</div>
              <div className="text-sm text-gray-600">Ready</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-900">{stats.avgPrepTime}m</div>
              <div className="text-sm text-gray-600">Avg Prep Time</div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <Select value={stationFilter} onValueChange={(v) => setStationFilter(v as KitchenStation | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Stations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stations</SelectItem>
              <SelectItem value="grill">🔥 Grill</SelectItem>
              <SelectItem value="drinks">🥤 Drinks</SelectItem>
              <SelectItem value="dessert">🍰 Dessert</SelectItem>
              <SelectItem value="pizza">🍕 Pizza</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
            </SelectContent>
          </Select>

          
        </div>

        {/* Instructions */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl"></div>
              <div>
                <div className="font-semibold text-green-900">Chef Workflow</div>
                <div className="text-sm text-green-800">
                  1. Click " Start Preparing" on new orders → 2. Complete cooking → 3. Click " Order Ready" to notify waiters
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders by Status */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4"></div>
            <div className="text-xl font-semibold text-gray-700">All Clear!</div>
            <div className="text-gray-500 mt-2">No orders to prepare right now</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Orders */}
            {filteredOrders.filter(o => o.status === 'pending').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 bg-blue-600"></div>
                  <h2 className="text-xl font-bold text-blue-600">
                    New Orders ({filteredOrders.filter(o => o.status === 'pending').length})
                  </h2>
                  <div className="flex-1 h-px bg-blue-200"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders
                    .filter(o => o.status === 'pending')
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        viewMode="chef"
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Preparing Orders */}
            {filteredOrders.filter(o => o.status === 'preparing').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 bg-orange-600"></div>
                  <h2 className="text-xl font-bold text-orange-600">
                    Cooking Now ({filteredOrders.filter(o => o.status === 'preparing').length})
                  </h2>
                  <div className="flex-1 h-px bg-orange-200"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders
                    .filter(o => o.status === 'preparing')
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        viewMode="chef"
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Ready Orders */}
            {filteredOrders.filter(o => o.status === 'ready').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 bg-green-600"></div>
                  <h2 className="text-xl font-bold text-green-600">
                    Ready for Pickup ({filteredOrders.filter(o => o.status === 'ready').length})
                  </h2>
                  <div className="flex-1 h-px bg-green-200"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders
                    .filter(o => o.status === 'ready')
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        viewMode="chef"
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Served Orders (if showing all) */}
            {statusFilter === 'all' && filteredOrders.filter(o => o.status === 'served').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 bg-gray-600"></div>
                  <h2 className="text-xl font-bold text-gray-600">
                    Completed ({filteredOrders.filter(o => o.status === 'served').length})
                  </h2>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders
                    .filter(o => o.status === 'served')
                    .slice(0, 6)
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        viewMode="chef"
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
