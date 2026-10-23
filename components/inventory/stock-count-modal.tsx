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
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductMeta {
  _id: string
  productName: string
  category: string
  brand?: string
  variant?: string
  model?: string
  stock: number
  trackLots?: boolean
  lotUnit?: string
}

interface BatchRow {
  batchId: string
  lotId: string
  lotLabel: string
  systemQuantity: number   // what the DB says right now
  physicalQuantity: number // what staff count physically
  status: string
}

interface CountItem {
  productId: string
  productName: string
  systemStock: number
  physicalStock: number    // used only for non-lot products
  // lot fields
  isLotProduct: boolean
  lotUnit: string
  lotsExpanded: boolean
  batches: BatchRow[]      // populated on expand
  batchesLoading: boolean
}

interface StockCountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StockCountModal({ open, onOpenChange, onSuccess }: StockCountModalProps) {
  const [products, setProducts]           = useState<ProductMeta[]>([])
  const [counts, setCounts]               = useState<CountItem[]>([])
  const [reason, setReason]               = useState('Weekly stock count')
  const [notes, setNotes]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [loading, setLoading]             = useState(true)
  const [searchQuery, setSearchQuery]     = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    if (open) {
      fetchProducts()
    } else {
      setCounts([])
      setReason('Weekly stock count')
      setNotes('')
      setSearchQuery('')
      setSelectedCategory('all')
    }
  }, [open])

  // ── Data loading ───────────────────────────────────────────────────────────

  async function fetchProducts() {
    try {
      setLoading(true)
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const prods: ProductMeta[] = data.products || []
      setProducts(prods)
      setCounts(
        prods.map(p => ({
          productId:    p._id,
          productName:  formatProductName(p),
          systemStock:  p.stock || 0,
          physicalStock: p.stock || 0,
          isLotProduct: p.trackLots === true,
          lotUnit:      p.lotUnit || 'units',
          lotsExpanded: false,
          batches:      [],
          batchesLoading: false,
        }))
      )
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBatchesForProduct(productId: string, countIndex: number) {
    setCounts(prev => prev.map((c, i) =>
      i === countIndex ? { ...c, batchesLoading: true } : c
    ))
    try {
      const res = await fetch(`/api/products/${productId}/batches?status=active,depleted`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const batches: BatchRow[] = (data.batches || []).map((b: any) => ({
        batchId:          b._id,
        lotId:            b.lotId,
        lotLabel:         b.lotLabel || b.lotId,
        systemQuantity:   b.quantity,
        physicalQuantity: b.quantity, // start at system value
        status:           b.status,
      }))
      setCounts(prev => prev.map((c, i) =>
        i === countIndex ? { ...c, batches, batchesLoading: false } : c
      ))
    } catch {
      toast.error('Failed to load lots')
      setCounts(prev => prev.map((c, i) =>
        i === countIndex ? { ...c, batchesLoading: false } : c
      ))
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function formatProductName(p: ProductMeta) {
    return [p.brand, p.variant, p.model, p.productName].filter(Boolean).join(' › ')
  }

  function toggleLots(countIndex: number) {
    const item = counts[countIndex]
    if (!item.isLotProduct) return
    const willExpand = !item.lotsExpanded
    setCounts(prev => prev.map((c, i) =>
      i === countIndex ? { ...c, lotsExpanded: willExpand } : c
    ))
    // Lazy-load batches on first expand
    if (willExpand && item.batches.length === 0 && !item.batchesLoading) {
      fetchBatchesForProduct(item.productId, countIndex)
    }
  }

  function updatePhysicalCount(productId: string, value: number) {
    setCounts(prev => prev.map(c =>
      c.productId === productId ? { ...c, physicalStock: value } : c
    ))
  }

  function updateBatchPhysical(countIndex: number, batchId: string, value: number) {
    setCounts(prev => prev.map((c, i) => {
      if (i !== countIndex) return c
      const updatedBatches = c.batches.map(b =>
        b.batchId === batchId ? { ...b, physicalQuantity: value } : b
      )
      // Recompute physicalStock as the sum of all batch physicalQuantities
      const newPhysical = updatedBatches.reduce((s, b) => s + (Number(b.physicalQuantity) || 0), 0)
      return { ...c, batches: updatedBatches, physicalStock: newPhysical }
    }))
  }

  function batchDiff(b: BatchRow) { return b.physicalQuantity - b.systemQuantity }

  function productDiff(c: CountItem) {
    if (c.isLotProduct && c.batches.length > 0) {
      return c.batches.reduce((s, b) => s + batchDiff(b), 0)
    }
    return c.physicalStock - c.systemStock
  }

  function diffColor(d: number) {
    if (d === 0) return 'text-green-600'
    if (d > 0)  return 'text-blue-600'
    return 'text-red-600'
  }

  function diffBadge(d: number) {
    if (d === 0) return <Badge className="bg-green-100 text-green-800 text-[10px]">Match</Badge>
    if (d > 0)  return <Badge className="bg-blue-100 text-blue-800 text-[10px]">+{d}</Badge>
    return <Badge className="bg-red-100 text-red-800 text-[10px]">{d}</Badge>
  }

  function totalAdjustments() {
    return counts.filter(c => productDiff(c) !== 0).length
  }

  function totalAbsDiff() {
    return counts.reduce((s, c) => s + Math.abs(productDiff(c)), 0)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const hasChanges = counts.some(c => productDiff(c) !== 0)
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
      const payload = {
        reason,
        notes,
        counts: counts.map(c => {
          const base = {
            productId:    c.productId,
            systemStock:  c.systemStock,
            physicalStock: c.physicalStock,
          }
          // Include per-batch breakdown for lot products that have been expanded
          if (c.isLotProduct && c.batches.length > 0) {
            return {
              ...base,
              batches: c.batches.map(b => ({
                batchId:         b.batchId,
                physicalQuantity: b.physicalQuantity,
              })),
            }
          }
          return base
        }),
      }

      const res = await fetch('/api/inventory/stock-count', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        const lotMsg = data.batchAdjustmentCount
          ? `, ${data.batchAdjustmentCount} lot${data.batchAdjustmentCount !== 1 ? 's' : ''} updated`
          : ''
        toast.success(
          data.adjustmentCount > 0
            ? `Stock count complete. ${data.adjustmentCount} adjustment${data.adjustmentCount !== 1 ? 's' : ''} made${lotMsg}.`
            : 'Stock count complete. All counts match.'
        )
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to process stock count')
      }
    } catch {
      toast.error('Error processing stock count')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived display data ───────────────────────────────────────────────────

  const adjustmentCount = totalAdjustments()
  const totalDiff       = totalAbsDiff()
  const categories      = Array.from(new Set(products.map(p => p.category))).sort()

  const filteredCounts = counts.filter(c => {
    const p = products.find(pr => pr._id === c.productId)
    if (!p) return false
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        p.productName?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.variant?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl h-[calc(100vh-2rem)] sm:h-auto sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ClipboardCheck size={18} />
            Stock Count
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Compare system stock with physical count. Expand lot-tracked products to count per unit.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">Loading products...</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="space-y-4">

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="border rounded-lg p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Products</span>
                    <CheckCircle2 size={14} className="text-muted-foreground" />
                  </div>
                  <p className="text-lg sm:text-2xl font-bold mt-1">{counts.length}</p>
                </div>
                <div className="border rounded-lg p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Adjustments</span>
                    <AlertTriangle size={14} className={adjustmentCount > 0 ? 'text-orange-600' : 'text-muted-foreground'} />
                  </div>
                  <p className={`text-lg sm:text-2xl font-bold mt-1 ${adjustmentCount > 0 ? 'text-orange-600' : ''}`}>
                    {adjustmentCount}
                  </p>
                </div>
                <div className="border rounded-lg p-2 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Total Diff</span>
                  </div>
                  <p className={`text-lg sm:text-2xl font-bold mt-1 ${totalDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalDiff}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex-1">
                  <Label htmlFor="search" className="text-xs font-medium mb-1 block">Search</Label>
                  <Input id="search" placeholder="Search products..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="h-9 text-sm" />
                </div>
                <div className="w-full sm:w-48">
                  <Label htmlFor="category" className="text-xs font-medium mb-1 block">Category</Label>
                  <select id="category" value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="h-9 w-full px-3 border border-input rounded-md text-sm bg-background">
                    <option value="all">All ({products.length})</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat} ({products.filter(p => p.category === cat).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Count table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 500px)', minHeight: '200px' }}>
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-2 font-medium text-xs sm:text-sm">Product</th>
                        <th className="text-right p-2 font-medium text-xs sm:text-sm whitespace-nowrap">System</th>
                        <th className="text-right p-2 font-medium text-xs sm:text-sm whitespace-nowrap">Physical</th>
                        <th className="text-right p-2 font-medium text-xs sm:text-sm whitespace-nowrap">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCounts.map((count, countIndex) => {
                        const diff = productDiff(count)
                        return (
                          <>
                            {/* ── Product row ── */}
                            <tr key={count.productId}
                              className={`border-t ${count.isLotProduct ? 'hover:bg-blue-50/50 cursor-pointer' : 'hover:bg-muted/50'}`}
                              onClick={() => count.isLotProduct && toggleLots(countIndex)}>
                              <td className="p-2 text-xs sm:text-sm">
                                <div className="flex items-center gap-1.5">
                                  {count.isLotProduct && (
                                    <span className="text-blue-500 shrink-0">
                                      {count.lotsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </span>
                                  )}
                                  <span className="font-medium truncate max-w-[140px] sm:max-w-none">
                                    {count.productName}
                                  </span>
                                  {count.isLotProduct && (
                                    <Layers size={12} className="text-blue-400 shrink-0" />
                                  )}
                                </div>
                              </td>
                              <td className="p-2 text-right text-muted-foreground text-xs sm:text-sm whitespace-nowrap">
                                {count.systemStock}
                                {count.isLotProduct && (
                                  <span className="text-[10px] ml-0.5 text-muted-foreground">{count.lotUnit}</span>
                                )}
                              </td>
                              <td className="p-2 text-right" onClick={e => count.isLotProduct && e.stopPropagation()}>
                                {count.isLotProduct ? (
                                  /* For lot products show computed total (read-only) */
                                  <span className="text-xs sm:text-sm font-medium">
                                    {count.batches.length > 0
                                      ? count.batches.reduce((s, b) => s + (Number(b.physicalQuantity) || 0), 0)
                                      : count.physicalStock}
                                    <span className="text-[10px] ml-0.5 text-muted-foreground">{count.lotUnit}</span>
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    min="0"
                                    value={count.physicalStock}
                                    onChange={e => updatePhysicalCount(count.productId, parseInt(e.target.value) || 0)}
                                    className="w-16 sm:w-20 ml-auto text-right text-sm h-8"
                                  />
                                )}
                              </td>
                              <td className="p-2 text-right whitespace-nowrap">
                                {diffBadge(diff)}
                              </td>
                            </tr>

                            {/* ── Lot sub-rows (expanded) ── */}
                            {count.isLotProduct && count.lotsExpanded && (
                              <tr key={`${count.productId}-lots`} className="bg-blue-50/30">
                                <td colSpan={4} className="px-2 pb-3 pt-1">
                                  {count.batchesLoading ? (
                                    <div className="text-xs text-muted-foreground py-2 pl-6">Loading lots…</div>
                                  ) : count.batches.length === 0 ? (
                                    <div className="text-xs text-muted-foreground py-2 pl-6">
                                      No active lots found. Receive stock first to create lots.
                                    </div>
                                  ) : (
                                    <div className="pl-6 space-y-1.5">
                                      {/* Sub-header */}
                                      <div className="grid grid-cols-12 gap-2 text-[10px] text-muted-foreground px-1 pb-0.5 border-b">
                                        <span className="col-span-4">Lot</span>
                                        <span className="col-span-2 text-right">System</span>
                                        <span className="col-span-3 text-right">Physical</span>
                                        <span className="col-span-2 text-right">Diff</span>
                                        <span className="col-span-1" />
                                      </div>

                                      {count.batches.map(batch => {
                                        const bd = batchDiff(batch)
                                        return (
                                          <div key={batch.batchId}
                                            className="grid grid-cols-12 gap-2 items-center py-0.5">
                                            <div className="col-span-4">
                                              <div className="text-xs font-medium truncate">{batch.lotLabel}</div>
                                              <div className="text-[10px] text-muted-foreground">{batch.lotId}</div>
                                            </div>
                                            <div className="col-span-2 text-right text-xs text-muted-foreground">
                                              {batch.systemQuantity}
                                            </div>
                                            <div className="col-span-3 text-right">
                                              <Input
                                                type="number"
                                                min="0"
                                                value={batch.physicalQuantity}
                                                onChange={e => updateBatchPhysical(
                                                  countIndex,
                                                  batch.batchId,
                                                  parseFloat(e.target.value) || 0
                                                )}
                                                onClick={e => e.stopPropagation()}
                                                className="w-full text-right text-xs h-7"
                                              />
                                            </div>
                                            <div className="col-span-2 text-right">
                                              <span className={`text-xs font-semibold ${diffColor(bd)}`}>
                                                {bd > 0 ? '+' : ''}{bd !== 0 ? bd : ''}
                                                {bd === 0 && <span className="text-green-500">✓</span>}
                                              </span>
                                            </div>
                                            <div className="col-span-1 text-[10px] text-muted-foreground text-right">
                                              {batch.status === 'depleted' && (
                                                <span className="text-orange-500">dep.</span>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}

                                      {/* Lot totals bar */}
                                      <div className="grid grid-cols-12 gap-2 items-center pt-1.5 border-t text-xs font-semibold">
                                        <div className="col-span-4 text-muted-foreground">Total</div>
                                        <div className="col-span-2 text-right text-muted-foreground">
                                          {count.batches.reduce((s, b) => s + b.systemQuantity, 0)}
                                        </div>
                                        <div className="col-span-3 text-right">
                                          {count.batches.reduce((s, b) => s + (Number(b.physicalQuantity) || 0), 0)}
                                          <span className="text-[10px] font-normal ml-0.5 text-muted-foreground">
                                            {count.lotUnit}
                                          </span>
                                        </div>
                                        <div className="col-span-2 text-right">
                                          {(() => {
                                            const td = count.batches.reduce((s, b) => s + batchDiff(b), 0)
                                            return (
                                              <span className={diffColor(td)}>
                                                {td > 0 ? '+' : ''}{td}
                                              </span>
                                            )
                                          })()}
                                        </div>
                                        <div className="col-span-1" />
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reason & notes */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="reason" className="text-xs sm:text-sm">Reason *</Label>
                  <Input id="reason" value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g., Weekly stock count"
                    className="text-sm h-9 mt-1" />
                </div>
                <div>
                  <Label htmlFor="notes" className="text-xs sm:text-sm">Notes</Label>
                  <Textarea id="notes" value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Additional observations..." rows={2}
                    className="text-sm mt-1" />
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
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
                  className="flex-1 text-sm h-9" disabled={submitting}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSubmit}
                  className="flex-1 text-sm h-9" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Submit Count'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
