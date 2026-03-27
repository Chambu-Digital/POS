'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface HeldOrder {
  id: string
  cart: any[]
  cartDiscount: number
  heldAt: string
}

interface Props {
  onRecall: (order: HeldOrder) => void
}

function loadHeld(): HeldOrder[] {
  try {
    return JSON.parse(localStorage.getItem('heldOrders') || '[]')
  } catch {
    return []
  }
}

export function HeldOrders({ onRecall }: Props) {
  const [orders, setOrders] = useState<HeldOrder[]>([])
  const [open, setOpen] = useState(false)

  // Load count immediately on mount + whenever storage changes (cross-tab)
  // Also refresh on window focus so returning from payment page updates instantly
  useEffect(() => {
    setOrders(loadHeld())

    function refresh() { setOrders(loadHeld()) }

    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  function recall(order: HeldOrder) {
    onRecall(order)
    const remaining = orders.filter((o) => o.id !== order.id)
    localStorage.setItem('heldOrders', JSON.stringify(remaining))
    setOrders(remaining)
    setOpen(false)
    toast.success('Order recalled')
  }

  function discard(id: string) {
    const remaining = orders.filter((o) => o.id !== id)
    localStorage.setItem('heldOrders', JSON.stringify(remaining))
    setOrders(remaining)
    toast.info('Held order discarded')
  }

  const count = orders.length
  const hasHeld = count > 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={hasHeld ? 'default' : 'outline'}
          size="sm"
          className={`relative transition-all ${
            hasHeld
              ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-200 animate-pulse-once'
              : ''
          }`}
        >
          <Clock className="h-4 w-4 mr-1.5" />
          {hasHeld ? `${count} Held Order${count !== 1 ? 's' : ''}` : 'Held Orders'}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Held Orders</SheetTitle>
          <SheetDescription>Recall a previously held order to continue.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No held orders</p>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      {order.cart.length} item{order.cart.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-sm font-bold">
                    KSh {order.cart
                      .reduce((s: number, i: any) => s + i.sellingPrice * i.quantity - i.discount, 0)
                      .toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => recall(order)}>
                    Recall
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => discard(order.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
