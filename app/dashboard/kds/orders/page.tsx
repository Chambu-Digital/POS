'use client'

import { useState, useEffect } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { OrderType, OrderPriority } from '@/types/kds'

interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  available: boolean
  prepTime?: number
  station?: string
  description?: string
  productId?: any
}

interface CartItem {
  menuItem: MenuItem
  quantity: number
  notes: string
}

export default function KDSOrdersPage() {
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  
  // Order details
  const [tableNumber, setTableNumber] = useState('')
  const [tableSection, setTableSection] = useState('')
  const [coverCount, setCoverCount] = useState('2')
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [priority, setPriority] = useState<OrderPriority>('normal')
  const [specialNotes, setSpecialNotes] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWaiter, setSelectedWaiter] = useState('')

  // Load menu items and orders from database
  useEffect(() => {
    loadMenu()
    loadStaff()
    loadOrders()
    const interval = setInterval(loadOrders, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const loadMenu = async () => {
    try {
      const res = await fetch('/api/kds/menu?available=true')
      if (!res.ok) return
      const data = await res.json()
      setMenu(data.menuItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        available: item.available,
        prepTime: item.prepTime,
        station: item.station,
        description: item.description,
        productId: item.productId,
      })))
    } catch (error) {
      console.error('Failed to load menu:', error)
      toast.error('Failed to load menu items')
    }
  }

  const loadStaff = async () => {
    try {
      const res = await fetch('/api/staff')
      if (!res.ok) return
      const data = await res.json()
      setStaff(data.staff.filter((s: any) => s.active))
    } catch (error) {
      console.error('Failed to load staff:', error)
    }
  }

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/kds?view=waiter')
      if (!res.ok) return
      const data = await res.json()
      setOrders(data.orders)
    } catch (error) {
      console.error('Failed to load orders:', error)
    }
  }

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id)
      if (existing) {
        return prev.map(c => 
          c.menuItem.id === item.id 
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId)
      if (!existing) return prev
      if (existing.quantity <= 1) {
        return prev.filter(c => c.menuItem.id !== itemId)
      }
      return prev.map(c =>
        c.menuItem.id === itemId
          ? { ...c, quantity: c.quantity - 1 }
          : c
      )
    })
  }

  const updateNotes = (itemId: string, notes: string) => {
    setCart(prev => prev.map(c =>
      c.menuItem.id === itemId ? { ...c, notes } : c
    ))
  }

  const handleCreateOrder = async () => {
    if (!tableNumber.trim()) {
      toast.error('Please enter a table number')
      return
    }
    if (cart.length === 0) {
      toast.error('Please add items to the order')
      return
    }
    if (!selectedWaiter) {
      toast.error('Please select a waiter')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/kds/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          tableSection: tableSection || undefined,
          coverCount: parseInt(coverCount) || 1,
          orderType,
          priority,
          notes: specialNotes || undefined,
          waiterId: selectedWaiter,
          items: cart.map((item, idx) => ({
            id: `item_${idx}`,
            menuItemId: item.menuItem.id,
            name: item.menuItem.name,
            quantity: item.quantity,
            category: item.menuItem.category,
            station: item.menuItem.station,
            notes: item.notes || undefined,
            prepTime: item.menuItem.prepTime || 15,
          })),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.details || error.error || 'Failed to create order')
      }

      const data = await res.json()
      toast.success(`Order ${data.order.orderNumber} sent to kitchen!`)
      
      // Reset form
      setCart([])
      setTableNumber('')
      setTableSection('')
      setCoverCount('2')
      setOrderType('dine-in')
      setPriority('normal')
      setSpecialNotes('')
      setSelectedWaiter('')
      setShowOrderDialog(false)
      
      // Reload orders
      loadOrders()
    } catch (error) {
      console.error('Create order error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const filteredMenu = menu.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const cartTotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const statusColors: Record<string, string> = {
    pending: 'bg-blue-100 text-blue-700',
    preparing: 'bg-orange-100 text-orange-700',
    ready: 'bg-green-100 text-green-700',
    served: 'bg-gray-100 text-gray-700',
  }

  const statusLabels: Record<string, string> = {
    pending: '⏳ Pending',
    preparing: '👨‍🍳 Preparing',
    ready: '✓ Ready',
    served: '✓ Served',
  }

  return (
    <PermissionGuard requiredPermission="kds.orders">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Create Kitchen Order</h1>
            <p className="text-gray-600 mt-1">Take orders and send to kitchen</p>
          </div>
          <Button 
            onClick={() => setShowOrderDialog(true)}
            className="bg-green-600 hover:bg-green-700"
            size="lg"
          >
             New Order
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{menu.length}</div>
              <div className="text-sm text-gray-600">Available Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-sm text-gray-600">Active Orders</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{cartCount}</div>
              <div className="text-sm text-gray-600">Items in Cart</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">KES {cartTotal.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Cart Total</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        {orders.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Order #</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Table</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Waiter</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold">Items</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold">Status</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 10).map((order: any) => (
                      <tr key={order.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold">{order.orderNumber}</td>
                        <td className="px-4 py-3">
                          <div>Table {order.tableNumber}</div>
                          {order.tableSection && (
                            <div className="text-xs text-gray-500">{order.tableSection}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{order.waiterName}</td>
                        <td className="px-4 py-3 text-sm">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-blue-800">
              <strong></strong> No oders made yet 
            
            </p>
          </CardContent>
        </Card>

        {/* Order Dialog */}
        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-6">
              {/* Left: Order Details */}
              <div className="col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Table Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Table Number *</Label>
                        <Input
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="e.g. 5"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Section</Label>
                        <Input
                          value={tableSection}
                          onChange={(e) => setTableSection(e.target.value)}
                          placeholder="e.g. Main Hall"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Assign Waiter *</Label>
                      <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select waiter..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map(s => (
                            <SelectItem key={s._id} value={s._id}>
                              {s.name} - {s.jobDescription || s.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Guests</Label>
                        <Input
                          type="number"
                          min="1"
                          value={coverCount}
                          onChange={(e) => setCoverCount(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Order Type</Label>
                        <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dine-in"> Dine-in</SelectItem>
                            <SelectItem value="takeaway"> Takeaway</SelectItem>
                            <SelectItem value="delivery"> Delivery</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as OrderPriority)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="rush"> Rush</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Special Instructions</Label>
                      <Textarea
                        value={specialNotes}
                        onChange={(e) => setSpecialNotes(e.target.value)}
                        placeholder="Allergies, dietary requirements..."
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Menu Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Menu Items</CardTitle>
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search menu..."
                      className="mt-2"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {filteredMenu.map(item => (
                        <Button
                          key={item.id}
                          variant="outline"
                          onClick={() => addToCart(item)}
                          className="justify-start h-auto py-2"
                        >
                          <div className="text-left flex-1">
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              KES {item.price.toFixed(2)}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Cart */}
              <div>
                <Card className="sticky top-0">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Order Cart ({cartCount})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {cart.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                          No items yet
                        </p>
                      ) : (
                        cart.map(item => (
                          <div key={item.menuItem.id} className="border p-2 space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-semibold text-sm">
                                  {item.menuItem.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  KES {item.menuItem.price.toFixed(2)} × {item.quantity}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFromCart(item.menuItem.id)}
                                >
                                  −
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addToCart(item.menuItem)}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                            <Input
                              placeholder="Special notes..."
                              value={item.notes}
                              onChange={(e) => updateNotes(item.menuItem.id, e.target.value)}
                              className="text-xs"
                            />
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between font-bold text-lg mb-4">
                        <span>Total:</span>
                        <span>KES {cartTotal.toFixed(2)}</span>
                      </div>
                      <Button
                        onClick={handleCreateOrder}
                        disabled={loading || cart.length === 0 || !tableNumber || !selectedWaiter}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {loading ? 'Sending...' : '🔔 Send to Kitchen'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
