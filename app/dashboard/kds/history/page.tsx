'use client'

import { useState, useEffect } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KDSOrder, OrderStatus } from '@/types/kds'
import { formatTime } from '@/lib/kds-utils'
import { toast } from 'sonner'

export default function KDSHistoryPage() {
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [dateFilter, setDateFilter] = useState('today')

  useEffect(() => {
    fetchOrders()
  }, [dateFilter])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kds')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setOrders(data.orders)
    } catch (error) {
      toast.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        o.orderNumber.toLowerCase().includes(search) ||
        o.tableNumber.toLowerCase().includes(search) ||
        o.waiterName.toLowerCase().includes(search)
      )
    }
    return true
  })

  const statusColors = {
    pending: 'bg-blue-100 text-blue-700',
    preparing: 'bg-orange-100 text-orange-700',
    ready: 'bg-green-100 text-green-700',
    served: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  const calculatePrepTime = (order: KDSOrder) => {
    if (!order.preparingAt || !order.readyAt) return '-'
    const start = new Date(order.preparingAt).getTime()
    const end = new Date(order.readyAt).getTime()
    const mins = Math.round((end - start) / 60000)
    return `${mins}m`
  }

  return (
    <PermissionGuard requiredPermission="kds.history">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Order History</h1>
          <p className="text-gray-600 mt-1">View all kitchen orders and track performance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-sm text-gray-600">Total Orders</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {orders.filter(o => o.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">
                {orders.filter(o => o.status === 'preparing').length}
              </div>
              <div className="text-sm text-gray-600">Preparing</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {orders.filter(o => o.status === 'ready').length}
              </div>
              <div className="text-sm text-gray-600">Ready</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-600">
                {orders.filter(o => o.status === 'served').length}
              </div>
              <div className="text-sm text-gray-600">Served</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search by order #, table, or waiter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="served">Served</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={fetchOrders} variant="outline">
            🔄 Refresh
          </Button>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📋</div>
            <div className="text-xl font-semibold text-gray-700">No Orders Found</div>
            <div className="text-gray-500 mt-2">Try adjusting your filters</div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Order #</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Table</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Waiter</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Items</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Prep Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold">{order.orderNumber}</span>
                          {order.priority !== 'normal' && (
                            <Badge className="ml-2 text-xs">
                              {order.priority === 'rush' ? '🔥' : '👑'} {order.priority}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{order.tableNumber}</div>
                          {order.tableSection && (
                            <div className="text-xs text-gray-500">{order.tableSection}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{order.waiterName}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {order.items.length} item(s)
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.coverCount} guests
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{order.orderType}</td>
                        <td className="px-4 py-3">
                          <Badge className={statusColors[order.status]}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">{formatTime(order.createdAt)}</td>
                        <td className="px-4 py-3 text-sm font-mono">
                          {calculatePrepTime(order)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGuard>
  )
}
