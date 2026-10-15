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
  category: string
  brand?: string
  variant?: string
  model?: string
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

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
    const parts = [
      product.brand,
      product.variant,
      product.model,
      product.productName,
    ].filter(Boolean)
    return parts.join(' › ')
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

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.category))).sort()

  // Filter counts based on search and category
  const filteredCounts = counts.filter(count => {
    const product = products.find(p => p._id === count.productId)
    if (!product) return false
    
    // Category filter
    if (selectedCategory !== 'all' && product.category !== selectedCategory) {
      return false
    }
    
    // Search filter (search in formatted product name)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const productName = product.productName?.toLowerCase() || ''
      const brand = product.brand?.toLowerCase() || ''
      const variant = product.variant?.toLowerCase() || ''
      const category = product.category?.toLowerCase() || ''
      
      return (
        productName.includes(searchLower) ||
        brand.includes(searchLower) ||
        variant.includes(searchLower) ||
        category.includes(searchLower)
      )
    }
    
    return true
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl h-[calc(100vh-2rem)] sm:h-auto sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ClipboardCheck size={18} className="sm:w-5 sm:h-5" />
            Stock Count
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Compare system stock with physical count
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading products...</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="border rounded-lg p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Products</span>
                    <CheckCircle2 size={14} className="text-muted-foreground sm:w-4 sm:h-4" />
                  </div>
                  <p className="text-lg sm:text-2xl font-bold mt-1">{counts.length}</p>
                </div>
                <div className="border rounded-lg p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Adjustments</span>
                    <AlertTriangle size={14} className={`sm:w-4 sm:h-4 ${adjustmentCount > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
                  </div>
                  <p className={`text-lg sm:text-2xl font-bold mt-1 ${adjustmentCount > 0 ? 'text-orange-600' : ''}`}>
                    {adjustmentCount}
                  </p>
                </div>
                <div className="border rounded-lg p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Total Diff</span>
                  </div>
                  <p className={`text-lg sm:text-2xl font-bold mt-1 ${totalDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalDifference}
                  </p>
                </div>
              </div>

              {/* Search and Category Filter */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex-1">
                  <Label htmlFor="search" className="text-xs font-medium mb-1 block">
                    Search
                  </Label>
                  <Input
                    id="search"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor="category" className="text-xs font-medium mb-1 block">
                    Category
                  </Label>
                  <select
                    id="category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-9 w-full px-3 border border-input rounded-md text-sm bg-background"
                  >
                    <option value="all">All ({products.length})</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({products.filter(p => p.category === cat).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Count Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 480px)', minHeight: '200px' }}>
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-2 font-medium text-xs sm:text-sm whitespace-nowrap">Product</th>
                        <th className="text-right p-2 font-medium text-xs sm:text-sm whitespace-nowrap">System</th>
                        <th className="text-right p-2 font-medium text-xs sm:text-sm whitespace-nowrap">Physical</th>
                        <th className="text-right p-2 font-medium text-xs sm:text-sm whitespace-nowrap">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCounts.map((count) => {
                        const difference = getDifference(count)
                        return (
                          <tr key={count.productId} className="border-t hover:bg-muted/50">
                            <td className="p-2 font-medium text-xs sm:text-sm">
                              <div className="max-w-[120px] sm:max-w-none truncate">{count.productName}</div>
                            </td>
                            <td className="p-2 text-right text-muted-foreground text-xs sm:text-sm whitespace-nowrap">{count.systemStock}</td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                min="0"
                                value={count.physicalStock}
                                onChange={(e) => updatePhysicalCount(count.productId, parseInt(e.target.value) || 0)}
                                className="w-16 sm:w-20 ml-auto text-right text-sm h-8"
                              />
                            </td>
                            <td className="p-2 text-right whitespace-nowrap">
                              <span className={`font-semibold text-xs sm:text-sm ${getDifferenceColor(difference)}`}>
                                {difference > 0 ? '+' : ''}{difference}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reason and Notes */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="reason" className="text-xs sm:text-sm">Reason *</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Weekly stock count"
                    className="text-sm h-9 mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-xs sm:text-sm">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional observations..."
                    rows={2}
                    className="text-sm mt-1"
                  />
                </div>
              </div>

              {/* Warning */}
              {adjustmentCount > 0 && (
                <div className="border border-orange-200 bg-orange-50 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-semibold text-orange-900">
                      {adjustmentCount} product{adjustmentCount !== 1 ? 's' : ''} will be adjusted
                    </p>
                    <p className="text-orange-700 mt-1 hidden sm:block">
                      Stock levels will be updated to match physical counts.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 text-sm h-9"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 text-sm h-9"
                  disabled={submitting}
                >
                  {submitting ? 'Processing...' : 'Submit'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
