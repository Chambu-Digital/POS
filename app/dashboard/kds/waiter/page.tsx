'use client'

import { useState, useEffect, useRef } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { OrderCard } from '@/components/kds/OrderCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KDSOrder, OrderStatus } from '@/types/kds'
import { computeStats } from '@/lib/kds-utils'
import { toast } from 'sonner'

function playNotificationSound() {
  if (typeof window !== 'undefined') {
    const audio = new Audio('/notification.mp3')
    audio.volume = 0.5
    audio.play().catch(() => {})
  }
}

export default function WaiterViewPage() {
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const prevReadyCount = useRef(0)

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/kds?view=waiter')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      
      // Check for new ready orders
      const readyOrders = data.orders.filter((o: KDSOrder) => o.status === 'ready')
      
      if (readyOrders.length > prevReadyCount.current && prevReadyCount.current > 0) {
        playNotificationSound()
        toast.success(`${readyOrders.length - prevReadyCount.current} order(s) ready for pickup!`, {
          duration: 5000,
        })
        
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Orders Ready!', {
            body: `${readyOrders.length} order(s) ready for pickup`,
            icon: '/chambu-logo.svg'
          })
        }
      }
      
      prevReadyCount.current = readyOrders.length
      setOrders(data.orders)
    } catch (error) {
      toast.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    
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
        servedAt: status === 'served' ? now : o.servedAt,
      }
    }))

    const order = orders.find(o => o.id === id)
    if (order && status === 'served') {
      toast.success(`${order.orderNumber} served to Table ${order.tableNumber}`)
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
    return true
  })

  const stats = computeStats(orders)
  const readyCount = orders.filter(o => o.status === 'ready').length

  return (
    <PermissionGuard requiredPermission="kds.waiter">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Waiter View</h1>
          <p className="text-gray-600 mt-1">Monitor and collect ready orders</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-orange-600">{stats.preparing}</div>
              <div className="text-sm text-gray-600">Being Prepared</div>
            </CardContent>
          </Card>
          <Card className={readyCount > 0 ? 'ring-2 ring-green-500 animate-pulse' : ''}>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-green-600">{stats.ready}</div>
              <div className="text-sm text-gray-600">Ready for Pickup</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-600">{stats.served}</div>
              <div className="text-sm text-gray-600">Served Today</div>
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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="served">Served</SelectItem>
            </SelectContent>
          </Select>

          
        </div>

        {/* Instructions */}
        <div className="p-4 mb-6 border-l-4 bg-blue-50 border-blue-500 text-blue-800">
           <strong>Waiter:</strong> Monitor orders being prepared → Collect orders marked "Ready" → Click "Serve" when delivered to table
        </div>

        {/* Ready Orders Alert */}
        {readyCount > 0 && (
          <div className="p-4 mb-6 bg-green-100 border-2 border-green-500 text-green-800 font-semibold animate-pulse">
             {readyCount} order(s) ready for pickup!
          </div>
        )}

        {/* Orders Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4"></div>
            <div className="text-xl font-semibold text-gray-700">All Caught Up!</div>
            <div className="text-gray-500 mt-2">No orders to collect right now</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                viewMode="waiter"
                onUpdateStatus={handleUpdateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
