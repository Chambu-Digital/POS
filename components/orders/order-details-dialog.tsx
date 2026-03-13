'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CheckCircle2, ChevronDown, Printer, Edit } from 'lucide-react'

interface OrderItem {
  productId: {
    _id: string
    name: string
  }
  quantity: number
  price: number
  discount: number
}

interface OrderDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: {
    _id: string
    items: OrderItem[]
    total: number
    subtotal?: number
    discount: number
    paymentMethod: string
    createdAt: string
    notes?: string
    staffId?: {
      name: string
    }
  } | null
}

export function OrderDetailsDialog({ open, onOpenChange, order }: OrderDetailsDialogProps) {
  const [showNoteInput, setShowNoteInput] = useState(false)

  if (!order) return null

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  function formatCurrency(amount: number) {
    return `KES ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const orderNumber = `SALE-${order._id.slice(-8).toUpperCase()}`
  const profits = (order.subtotal || order.total) - order.discount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Order Details</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 px-4 py-2 text-base">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completed
            </Badge>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Order No:</span>
              <span className="ml-2 font-semibold">{orderNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Time:</span>
              <span className="ml-2 font-semibold">{formatTime(order.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>
              <span className="ml-2 font-semibold">{formatDate(order.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Order by:</span>
              <span className="ml-2 font-semibold">
                {order.staffId?.name || 'Sales'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Payment:</span>
              <span className="ml-2 font-semibold">
                {order.paymentMethod === 'mobile_money' ? 'M-Pesa' : 
                 order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="flex-1">
                  More... <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>View Receipt</DropdownMenuItem>
                <DropdownMenuItem>Assign To Customer</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">Delete Order</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator />

          {/* Product Order List */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Product order list</h3>
            
            {/* Desktop Table */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">#</th>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-right p-3 font-medium">Quantity</th>
                    <th className="text-right p-3 font-medium">Price</th>
                    <th className="text-right p-3 font-medium">Discount</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3">
                        {typeof item.productId === 'object' && item.productId?.productName
                          ? item.productId.productName
                          : (item as any).productName || 'Unknown Item'}
                      </td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrency(item.discount)}
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrency(item.price * item.quantity - item.discount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {typeof item.productId === 'object' && item.productId?.productName
                          ? item.productId.productName
                          : (item as any).productName || 'Unknown Item'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Item #{index + 1}</p>
                    </div>
                    <p className="font-bold text-sm">
                      {formatCurrency(item.price * item.quantity - item.discount)}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Qty</p>
                      <p className="font-semibold">{item.quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p className="font-semibold">{formatCurrency(item.price)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Discount</p>
                      <p className="font-semibold text-orange-600">{formatCurrency(item.discount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">All Item/Services</span>
              <span className="font-semibold">{order.items.length}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">Profits</span>
              <span className="font-semibold text-green-600">
                {formatCurrency(profits)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">Discount</span>
              <span className="font-semibold">
                {formatCurrency(order.discount)}
              </span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center py-3">
              <span className="font-bold text-lg">Grand Total</span>
              <span className="font-bold text-lg text-orange-600">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>

          <Separator />

          {/* Notes Section */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Notes</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="text-orange-600 border-orange-600 hover:bg-orange-50"
                onClick={() => setShowNoteInput(!showNoteInput)}
              >
                <Edit className="h-3 w-3 mr-1" />
                Add a Note
              </Button>
            </div>
            {order.notes ? (
              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                {order.notes}
              </p>
            ) : showNoteInput ? (
              <textarea 
                className="w-full p-3 border rounded-lg text-sm"
                placeholder="Enter note..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground italic">No notes added</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
