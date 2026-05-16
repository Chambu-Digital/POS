'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface SendToKitchenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: Array<{
    productName: string
    quantity: number
    category?: string
  }>
  onSuccess?: () => void
}

export function SendToKitchenDialog({
  open,
  onOpenChange,
  items,
  onSuccess,
}: SendToKitchenDialogProps) {
  const [tableNumber, setTableNumber] = useState('')
  const [tableSection, setTableSection] = useState('')
  const [coverCount, setCoverCount] = useState('2')
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>('dine-in')
  const [priority, setPriority] = useState<'normal' | 'rush' | 'vip'>('normal')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!tableNumber.trim()) {
      toast.error('Please enter a table number')
      return
    }

    setSending(true)
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
          notes: notes || undefined,
          items: items.map((item, idx) => ({
            id: `item_${idx}`,
            menuItemId: `menu_${idx}`,
            name: item.productName,
            quantity: item.quantity,
            category: item.category || 'main',
            prepTime: 15,
          })),
        }),
      })

      if (!res.ok) throw new Error('Failed to send order')

      const data = await res.json()
      toast.success(`Order ${data.order.orderNumber} sent to kitchen!`)
      onOpenChange(false)
      onSuccess?.()
      
      // Reset form
      setTableNumber('')
      setTableSection('')
      setCoverCount('2')
      setOrderType('dine-in')
      setPriority('normal')
      setNotes('')
    } catch (error) {
      toast.error('Failed to send order to kitchen')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send to Kitchen</DialogTitle>
          <DialogDescription>
            Enter table details to send this order to the kitchen display
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Table Number */}
          <div>
            <Label htmlFor="tableNumber">Table Number *</Label>
            <Input
              id="tableNumber"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. 5"
              className="mt-1"
            />
          </div>

          {/* Table Section */}
          <div>
            <Label htmlFor="tableSection">Table Section (Optional)</Label>
            <Input
              id="tableSection"
              value={tableSection}
              onChange={(e) => setTableSection(e.target.value)}
              placeholder="e.g. Main Hall, Terrace"
              className="mt-1"
            />
          </div>

          {/* Cover Count */}
          <div>
            <Label htmlFor="coverCount">Number of Guests</Label>
            <Input
              id="coverCount"
              type="number"
              min="1"
              value={coverCount}
              onChange={(e) => setCoverCount(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Order Type */}
          <div>
            <Label htmlFor="orderType">Order Type</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as any)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dine-in">🍽️ Dine-in</SelectItem>
                <SelectItem value="takeaway">📦 Takeaway</SelectItem>
                <SelectItem value="delivery">🚗 Delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="rush">🔥 Rush</SelectItem>
                <SelectItem value="vip">👑 VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Special Instructions */}
          <div>
            <Label htmlFor="notes">Special Instructions</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, dietary requirements..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Items Preview */}
          <div className="bg-gray-50 p-3 border border-gray-200 max-h-32 overflow-y-auto">
            <div className="text-sm font-semibold mb-2">Order Items:</div>
            {items.map((item, idx) => (
              <div key={idx} className="text-sm text-gray-700">
                × {item.quantity} {item.productName}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={sending}
            >
              {sending ? 'Sending...' : '🔔 Send to Kitchen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
