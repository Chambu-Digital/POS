'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Transfer {
  _id: string
  transferNumber: string
  fromBranchId: { name: string }
  items: Array<{
    productId?: string
    drugId?: string
    itemName: string
    quantitySent: number
  }>
}

interface ReceiveTransferModalProps {
  isOpen: boolean
  transfer: Transfer
  onClose: () => void
  onSuccess: () => void
}

export function ReceiveTransferModal({ isOpen, transfer, onClose, onSuccess }: ReceiveTransferModalProps) {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>(
    transfer.items.reduce((acc, item) => {
      const itemId = item.productId || item.drugId || ''
      return { ...acc, [itemId]: item.quantitySent }
    }, {})
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [action, setAction] = useState<'receive' | 'reject' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  function getItemId(item: Transfer['items'][0]) {
    return item.productId || item.drugId || ''
  }

  function updateQuantity(itemId: string, quantity: number) {
    setReceivedQuantities(prev => ({ ...prev, [itemId]: quantity }))
  }

  async function handleReceive() {
    // Validate quantities
    for (const item of transfer.items) {
      const itemId = getItemId(item)
      const received = receivedQuantities[itemId] || 0
      if (received <= 0) {
        toast.error(`Invalid quantity for ${item.itemName}`)
        return
      }
    }

    setAction('receive')
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/stock-transfers/${transfer._id}/receive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: transfer.items.map(item => {
            const itemId = getItemId(item)
            return {
              itemId,
              quantityReceived: receivedQuantities[itemId],
            }
          }),
        }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to receive transfer')
      }
    } catch (error) {
      console.error('Failed to receive transfer:', error)
      toast.error('Failed to receive transfer')
    } finally {
      setIsSubmitting(false)
      setAction(null)
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    setAction('reject')
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/stock-transfers/${transfer._id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to reject transfer')
      }
    } catch (error) {
      console.error('Failed to reject transfer:', error)
      toast.error('Failed to reject transfer')
    } finally {
      setIsSubmitting(false)
      setAction(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive Transfer</DialogTitle>
          <DialogDescription>
            Transfer {transfer.transferNumber} from {transfer.fromBranchId.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Items */}
          <div>
            <Label className="text-base mb-3 block">Items to Receive</Label>
            <div className="border rounded-md divide-y">
              {transfer.items.map((item) => {
                const itemId = getItemId(item)
                return (
                  <div key={itemId} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-sm text-muted-foreground">Sent: {item.quantitySent}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`qty-${itemId}`} className="text-sm">
                          Received:
                        </Label>
                        <Input
                          id={`qty-${itemId}`}
                          type="number"
                          min="0"
                          max={item.quantitySent}
                          value={receivedQuantities[itemId] || 0}
                          onChange={(e) => updateQuantity(itemId, parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              You can adjust quantities if there are discrepancies
            </p>
          </div>

          {/* Rejection Section */}
          <div className="border-t pt-4">
            <Label htmlFor="rejection-reason">Or Reject Transfer</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Provide reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isSubmitting || !rejectionReason.trim()}
            >
              {action === 'reject' && isSubmitting ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button
              onClick={handleReceive}
              disabled={isSubmitting}
            >
              {action === 'receive' && isSubmitting ? 'Receiving...' : 'Receive'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
