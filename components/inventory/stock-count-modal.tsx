'use client'

import { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  _id: string
  productName: string
  brand?: string
  variant?: string
  stock: number
}

interface CountItem {
  productId: string
  productName: string
  systemStock: number
  physicalStock: number
}

interface StockCountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function StockCountModal({ open, onOpenChange, onSuccess }: StockCountModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<CountItem[]>([])
  const [reason, setReason] = useState('Weekly stock count')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      fetchProducts()
    } else {
      // Reset on close
      setCounts([])
      setReason('Weekly stock count')
      setNotes('')
    }
  }, [open])

  async function fetchProducts() {
    try {
      setLoading(true)
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        const prods = data.products || []
        setProducts(prods)
        
        // Initialize counts with system stock
        setCounts(
          prods.map((p: Product) => ({
            productId: p._id,
            productName: formatProductName(p),
            systemStock: p.stock || 0,
            physicalStock: p.stock || 0, // Start with system stock
          }))
        )
      }
    } catch (error) {
      toast.error('Failed to load products')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function formatProductName(product: Product) {
    return [product.variant, product.brand, product.productName].filter(Boolean).join(' ')
  }

  function updatePhysicalCount(productId: string, value: number) {
    setCounts(counts.map(count =>
      count.productId === productId
        ? { ...count, physicalStock: value }
        : count
    ))
  }

  function getDifference(count: CountItem) {
    return count.physicalStock - count.systemStock
  }

  function getDifferenceColor(difference: number) {
    if (difference === 0) return 'text-green-600'
    if (difference > 0) return 'text-blue-600'
    return 'text-red-600'
  }

  function getDifferenceBadge(difference: number) {
    if (difference === 0) {
      return <Badge className="bg-green-100 text-green-800">Match</Badge>
    }
    if (difference > 0) {
      return <Badge className="bg-blue-100 text-blue-800">+{difference}</Badge>
    }
    return <Badge className="bg-red-100 text-red-800">{difference}</Badge>
  }

  function getTotalDifference() {
    return counts.reduce((sum, count) => sum + Math.abs(getDifference(count)), 0)
  }

  function getAdjustmentCount() {
    return counts.filter(count => getDifference(count) !== 0).length
  }

  async function handleSubmit() {
    // Check if any counts were modified
    const hasChanges = counts.some(count => getDifference(count) !== 0)
    
    if (!hasChanges) {
      toast.info('All counts match system stock. No adjustments needed.')
      onOpenChange(false)
      return
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the stock count')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/inventory/stock-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counts: counts.map(count => ({
            productId: count.productId,
            systemStock: count.systemStock,
            physicalStock: count.physicalStock,
          })),
          reason,
          notes,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.adjustmentCount > 0) {
          toast.success(`Stock count complete. ${data.adjustmentCount} adjustments made.`)
        } else {
          toast.success('Stock count complete. All counts match.')
        }
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to process stock count')
      }
    } catch (error) {
      toast.error('Error processing stock count')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  const totalDifference = getTotalDifference()
  const adjustmentCount = getAdjustmentCount()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck size={20} />
            Stock Count
          </DialogTitle>
          <DialogDescription>
            Compare system stock with physical count and create automatic adjustments
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading products...</div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Products</span>
                  <CheckCircle2 size={16} className="text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-1">{counts.length}</p>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Adjustments</span>
                  <AlertTriangle size={16} className={adjustmentCount > 0 ? 'text-orange-600' : 'text-muted-foreground'} />
                </div>
                <p className={`text-2xl font-bold mt-1 ${adjustmentCount > 0 ? 'text-orange-600' : ''}`}>
                  {adjustmentCount}
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Difference</span>
                </div>
                <p className={`text-2xl font-bold mt-1 ${totalDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {totalDifference}
                </p>
              </div>
            </div>

            {/* Count Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">Product</th>
                      <th className="text-right p-3 font-medium text-sm">System</th>
                      <th className="text-right p-3 font-medium text-sm">Physical</th>
                      <th className="text-right p-3 font-medium text-sm">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map((count) => {
                      const difference = getDifference(count)
                      return (
                        <tr key={count.productId} className="border-t hover:bg-muted/50">
                          <td className="p-3 font-medium">{count.productName}</td>
                          <td className="p-3 text-right text-muted-foreground">{count.systemStock}</td>
                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              min="0"
                              value={count.physicalStock}
                              onChange={(e) => updatePhysicalCount(count.productId, parseInt(e.target.value) || 0)}
                              className="w-24 ml-auto text-right"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className={`font-semibold ${getDifferenceColor(difference)}`}>
                                {difference > 0 ? '+' : ''}{difference}
                              </span>
                              {getDifferenceBadge(difference)}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reason and Notes */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason *</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Weekly stock count, Monthly audit"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional observations or comments..."
                  rows={3}
                />
              </div>
            </div>

            {/* Warning if there are differences */}
            {adjustmentCount > 0 && (
              <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-orange-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-orange-900">
                    {adjustmentCount} product{adjustmentCount !== 1 ? 's' : ''} will be adjusted
                  </p>
                  <p className="text-orange-700 mt-1">
                    Stock levels will be updated to match physical counts. Adjustment movements will be recorded in the stock ledger.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Submit Count'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
