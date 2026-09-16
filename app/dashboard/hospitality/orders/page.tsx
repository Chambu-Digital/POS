'use client'

import { useState, useEffect } from 'react'
import { Search, Eye, Calendar, Filter, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  menuItemId: string
  name: string
  quantity: number
  servingTypeId?: string
  servingTypeName?: string
  servingsOrdered?: number
  pricePerUnit: number
  totalPrice: number
}

interface Order {
  _id: string
  orderNumber: string
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
  paymentStatus: 'pending' | 'paid' | 'refunded'
  customerId?: string
  servedBy: string
  tableNumber?: string
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: string
  completedAt?: string
}

export default function HospitalityOrdersPage() {
  return (
    <PermissionGuard requiredPermission="hospitality.orders">
      <OrdersContent />
    </PermissionGuard>
  )
}

function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => loadOrders(), 300)
    return () => clearTimeout(timer)
  }, [search])

  async function loadOrders() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', '50')

      const res = await fetch(`/api/hospitality/sales?${params}`)
      if (res.ok) {
        const data = await res.json()
        let filtered = data.orders || []
        
        // Client-side search
        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter((order: Order) =>
            order.orderNumber.toLowerCase().includes(q) ||
            order.tableNumber?.toLowerCase().includes(q) ||
            order.items.some(item => item.name.toLowerCase().includes(q))
          )
        }
        
        setOrders(filtered)
      } else {
        toast.error('Failed to load orders')
      }
    } catch (error) {
      toast.error('Failed to load orders')
    }
    setLoading(false)
  }

  function viewOrderDetails(order: Order) {
    setSelectedOrder(order)
    setShowDetails(true)
  }

  function exportToCSV() {
    const headers = ['Order #', 'Date', 'Time', 'Type', 'Table', 'Items', 'Total', 'Payment', 'Status']
    const rows = orders.map(order => [
      order.orderNumber,
      new Date(order.createdAt).toLocaleDateString(),
      new Date(order.createdAt).toLocaleTimeString(),
      order.orderType,
      order.tableNumber || '-',
      order.items.length,
      order.total,
      order.paymentMethod,
      order.status
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hospitality-orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  }

  const orderTypeColors = {
    'dine-in': 'bg-blue-100 text-blue-700',
    'takeaway': 'bg-purple-100 text-purple-700',
    'delivery': 'bg-orange-100 text-orange-700'
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage customer orders</p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={orders.length === 0}>
          <Download size={16} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search by order #, table, or items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order._id} className="hover:shadow-md transition cursor-pointer" onClick={() => viewOrderDetails(order)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-lg">{order.orderNumber}</span>
                      <Badge className={statusColors[order.status]}>
                        {order.status}
                      </Badge>
                      <Badge className={orderTypeColors[order.orderType]}>
                        {order.orderType.replace('-', ' ')}
                      </Badge>
                      {order.tableNumber && (
                        <Badge variant="outline">
                          Table {order.tableNumber}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Date & Time</p>
                        <p className="font-medium">
                          {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Items</p>
                        <p className="font-medium">{order.items.length} items</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Payment</p>
                        <p className="font-medium capitalize">{order.paymentMethod.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total</p>
                        <p className="font-bold text-green-600">KES {order.total.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {item.quantity}x {item.name}
                          {item.servingTypeName && ` (${item.servingsOrdered} ${item.servingTypeName})`}
                        </span>
                      ))}
                      {order.items.length > 3 && (
                        <span className="text-xs text-gray-400">+{order.items.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  <Button size="sm" variant="ghost">
                    <Eye size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Details Modal */}
      {showDetails && selectedOrder && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogTitle>Order Details - {selectedOrder.orderNumber}</DialogTitle>
            
            <div className="space-y-4 mt-2">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Date & Time</p>
                  <p className="font-medium">
                    {new Date(selectedOrder.createdAt).toLocaleDateString()} {new Date(selectedOrder.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Order Type</p>
                  <Badge className={orderTypeColors[selectedOrder.orderType]}>
                    {selectedOrder.orderType.replace('-', ' ')}
                  </Badge>
                </div>
                {selectedOrder.tableNumber && (
                  <div>
                    <p className="text-xs text-gray-500">Table Number</p>
                    <p className="font-medium">{selectedOrder.tableNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge className={statusColors[selectedOrder.status]}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="font-medium capitalize">{selectedOrder.paymentMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Status</p>
                  <Badge variant={selectedOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                    {selectedOrder.paymentStatus}
                  </Badge>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-semibold mb-3">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        {item.servingTypeName && (
                          <p className="text-sm text-blue-600">
                            {item.servingsOrdered} {item.servingTypeName}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {item.quantity} × KES {item.pricePerUnit.toLocaleString()}
                        </p>
                      </div>
                      <p className="font-semibold">
                        KES {item.totalPrice.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">KES {selectedOrder.subtotal.toLocaleString()}</span>
                </div>
                {selectedOrder.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">KES {selectedOrder.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="text-green-600">KES {selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowDetails(false)} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
