'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Clock, CheckCircle, XCircle, ArrowRight, User } from 'lucide-react'

interface Transfer {
  _id: string
  transferNumber: string
  fromBranchId: { name: string; code: string }
  toBranchId: { name: string; code: string }
  items: Array<{
    module: string
    itemName: string
    quantitySent: number
    quantityReceived: number | null
    unitPrice: number
  }>
  status: string
  createdBy: { name: string; email: string } | null
  receivedBy: { name: string; email: string } | null
  rejectedBy: { name: string; email: string } | null
  notes: string
  rejectionReason: string
  createdAt: string
  receivedAt: string | null
  rejectedAt: string | null
}

interface TransferDetailsModalProps {
  isOpen: boolean
  transfer: Transfer
  onClose: () => void
  onRefresh?: () => void
}

export function TransferDetailsModal({ isOpen, transfer, onClose }: TransferDetailsModalProps) {
  function getStatusInfo() {
    switch (transfer.status) {
      case 'pending_receipt':
        return {
          icon: <Clock size={20} className="text-yellow-500" />,
          label: 'Pending Receipt',
          color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        }
      case 'received':
        return {
          icon: <CheckCircle size={20} className="text-green-500" />,
          label: 'Received',
          color: 'bg-green-50 text-green-700 border-green-200',
        }
      case 'rejected':
        return {
          icon: <XCircle size={20} className="text-red-500" />,
          label: 'Rejected',
          color: 'bg-red-50 text-red-700 border-red-200',
        }
      default:
        return { icon: null, label: transfer.status, color: '' }
    }
  }

  const statusInfo = getStatusInfo()
  const totalItems = transfer.items.reduce((sum, item) => sum + item.quantitySent, 0)
  const totalValue = transfer.items.reduce((sum, item) => sum + (item.quantitySent * item.unitPrice), 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Transfer Details
            <Badge variant="outline" className={statusInfo.color}>
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.label}</span>
            </Badge>
          </DialogTitle>
          <DialogDescription>{transfer.transferNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Transfer Route */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-sm text-muted-foreground mb-1">From</p>
                <p className="font-semibold">{transfer.fromBranchId.name}</p>
                <p className="text-xs text-muted-foreground">{transfer.fromBranchId.code}</p>
              </div>
              <ArrowRight size={24} className="text-muted-foreground mx-4" />
              <div className="text-center flex-1">
                <p className="text-sm text-muted-foreground mb-1">To</p>
                <p className="font-semibold">{transfer.toBranchId.name}</p>
                <p className="text-xs text-muted-foreground">{transfer.toBranchId.code}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h4 className="font-semibold mb-3">Items ({transfer.items.length})</h4>
            <div className="border rounded-lg divide-y">
              {transfer.items.map((item, index) => (
                <div key={index} className="p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.itemName}</p>
                    <p className="text-sm text-muted-foreground capitalize">{item.module}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {transfer.status === 'received' && item.quantityReceived !== null
                        ? `${item.quantityReceived} / ${item.quantitySent}`
                        : item.quantitySent
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      @ ${item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-3 pt-3 border-t flex justify-between text-sm">
              <span className="text-muted-foreground">Total Items:</span>
              <span className="font-semibold">{totalItems}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Value:</span>
              <span className="font-semibold">${totalValue.toFixed(2)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h4 className="font-semibold mb-3">Timeline</h4>
            <div className="space-y-3">
              {/* Created */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <User size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Transfer Created</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(transfer.createdAt), 'PPp')}
                  </p>
                  {transfer.createdBy && (
                    <p className="text-sm text-muted-foreground">By {transfer.createdBy.name}</p>
                  )}
                </div>
              </div>

              {/* Received */}
              {transfer.status === 'received' && transfer.receivedAt && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle size={16} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Transfer Received</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transfer.receivedAt), 'PPp')}
                    </p>
                    {transfer.receivedBy && (
                      <p className="text-sm text-muted-foreground">By {transfer.receivedBy.name}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Rejected */}
              {transfer.status === 'rejected' && transfer.rejectedAt && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle size={16} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Transfer Rejected</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transfer.rejectedAt), 'PPp')}
                    </p>
                    {transfer.rejectedBy && (
                      <p className="text-sm text-muted-foreground">By {transfer.rejectedBy.name}</p>
                    )}
                    {transfer.rejectionReason && (
                      <p className="text-sm text-red-600 mt-1">
                        Reason: {transfer.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground border rounded-lg p-3 bg-muted/30">
                {transfer.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
