'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertCircle, Package, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface SaleItem {
  productId?: string
  productName: string
  quantity: number
  price: number
  discount?: number
}

interface Sale {
  _id: string
  orderNumber: string
  items: SaleItem[]
  total: number
  status: string
  createdAt: string
}

interface ReturnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
  onSuccess: () => void
}

export function ReturnModal({ open, onOpenChange, sale, onSuccess }: ReturnModalProps) {
  const [selectedItems, setSelectedItems] = useState<Record<string, { quantity: number; condition: 'resellable' | 'damaged' }>>({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleReset() {
    setSelectedItems({})
    setReason('')
    setNotes('')
  }

  function toggleItem(index: number) {
    if (!sale) return
    const item = sale.items[index]
    const key = `${index}`
    
    if (selectedItems[key]) {
      // Remove item
      const updated = { ...selectedItems }
      delete updated[key]
      setSelectedItems(updated)
    } else {
      // Add item with default values
      setSelectedItems({
        ...selectedItems,
        [key]: {
          quantity: item.quantity,
          condition: 'resellable',
        },
      })
    }
  }

  function updateItemQuantity(index: number, quantity: number) {
    if (!sale) return
    const item = sale.items[index]
    const key = `${index}`
    
    if (!selectedItems[key]) return
    
    setSelectedItems({
      ...selectedItems,
      [key]: {
        ...selectedItems[key],
        quantity: Math.min(Math.max(1, quantity), item.quantity),
      },
    })
  }

  function updateItemCondition(index: number, condition: 'resellable' | 'damaged') {
    const key = `${index}`
    if (!selectedItems[key]) return
    
    setSelectedItems({
      ...selectedItems,
      [key]: {
        ...selectedItems[key],
        condition,
      },
    })
  }

  async function handleSubmit() {
    if (!sale) return

    // Validation
    const returnItems = Object.entries(selectedItems)
    if (returnItems.length === 0) {
      toast.error('Please select at least one item to return')
      return
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the return')
      return
    }

    setSubmitting(true)
    try {
      const items = returnItems.map(([indexStr, data]) => {
        const index = parseInt(indexStr)
        const item = sale.items[index]
        return {
          productId: item.productId || '',
          productName: item.productName,
          quantity: data.quantity,
          price: item.price,
          condition: data.condition,
        }
      })

      const response = await fetch(`/api/sales/${sale._id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          reason: reason.trim(),
          notes: notes.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const restockedCount = data.items.filter((i: any) => i.restocked).length
        const damagedCount = data.items.filter((i: any) => !i.restocked).length
        
        let message = `Return processed for ${sale.orderNumber}`
        if (restockedCount > 0) message += ` • ${restockedCount} item(s) restocked`
        if (damagedCount > 0) message += ` • ${damagedCount} marked as damaged`
        
        toast.success(message)
        handleReset()
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to process return')
      }
    } catch (error) {
      toast.error('Error processing return')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!sale) return null

  const selectedItemCount = Object.keys(selectedItems).length
  const totalReturnValue = Object.entries(selectedItems).reduce((sum, [indexStr, data]) => {
    const index = parseInt(indexStr)
    const item = sale.items[index]
    return sum + (item.price * data.quantity)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleReset()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={20} />
            Process Return
          </DialogTitle>
          <DialogDescription>
            Sale #{sale.orderNumber} • {new Date(sale.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Items Selection */}
          <div>
            <Label className="text-base font-semibold">Items to Return</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Select items and specify their condition
            </p>

            <div className="space-y-3">
              {sale.items.map((item, index) => {
                const key = `${index}`
                const isSelected = !!selectedItems[key]
                const itemData = selectedItems[key]

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition-colors ${
                      isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(index)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />
                      <div className="flex-1 space-y-3">
                        {/* Item Info */}
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <div className="text-sm text-muted-foreground">
                            Qty: {item.quantity} • Price: KSh {item.price.toLocaleString()}
                            {item.discount ? ` • Discount: KSh ${item.discount}` : ''}
                          </div>
                        </div>

                        {/* Return Details (only if selected) */}
                        {isSelected && itemData && (
                          <div className="space-y-3 pl-4 border-l-2 border-blue-300">
                            {/* Quantity */}
                            <div>
                              <Label className="text-xs">Return Quantity</Label>
                              <Input
                                type="number"
                                min="1"
                                max={item.quantity}
                                value={itemData.quantity}
                                onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-24 h-8 text-sm"
                              />
                            </div>

                            {/* Condition */}
                            <div>
                              <Label className="text-xs mb-2 block">Item Condition</Label>
                              <RadioGroup
                                value={itemData.condition}
                                onValueChange={(value) => updateItemCondition(index, value as 'resellable' | 'damaged')}
                                className="space-y-2"
                              >
                                <div className="flex items-start space-x-2">
                                  <RadioGroupItem value="resellable" id={`${key}-resellable`} />
                                  <div>
                                    <Label htmlFor={`${key}-resellable`} className="flex items-center gap-2 font-normal cursor-pointer">
                                      <CheckCircle2 size={16} className="text-green-600" />
                                      <span className="font-medium">Resellable</span>
                                    </Label>
                                    <p className="text-xs text-muted-foreground ml-6">
                                      Return to inventory as sellable stock
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start space-x-2">
                                  <RadioGroupItem value="damaged" id={`${key}-damaged`} />
                                  <div>
                                    <Label htmlFor={`${key}-damaged`} className="flex items-center gap-2 font-normal cursor-pointer">
                                      <AlertCircle size={16} className="text-red-600" />
                                      <span className="font-medium">Damaged</span>
                                    </Label>
                                    <p className="text-xs text-muted-foreground ml-6">
                                      Do not return to sellable inventory
                                    </p>
                                  </div>
                                </div>
                              </RadioGroup>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          {selectedItemCount > 0 && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Return Summary</p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Items returning:</span>
                  <span className="font-semibold">{selectedItemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total value:</span>
                  <span className="font-semibold">KSh {totalReturnValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Return Reason *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer changed mind, Wrong item ordered, etc."
              maxLength={200}
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context about this return..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleReset()
                onOpenChange(false)
              }}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              className="flex-1"
              disabled={submitting || selectedItemCount === 0 || !reason.trim()}
            >
              {submitting ? 'Processing Return...' : `Process Return (${selectedItemCount} item${selectedItemCount !== 1 ? 's' : ''})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
