'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Package, Layers, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Branch {
  _id: string
  name: string
  code: string
}

interface Product {
  _id: string
  productName: string
  category: string
  brand?: string
  variant?: string
  model?: string
  sku: string
  sellingPrice: number
  stock: number
  trackLots?: boolean
  lotUnit?: string
  lotContainerName?: string
}

interface BatchRow {
  batchId: string
  lotLabel: string
  lotId: string
  available: number   // remaining qty in this batch
  quantity: number    // how much to transfer from this batch
  wholeLot: boolean   // true = transfer the entire batch
}

interface TransferItem {
  productId: string
  itemName: string
  quantitySent: number
  unitPrice: number
  availableStock: number
  // lot fields
  trackLots: boolean
  lotUnit: string
  batches: BatchRow[]
  batchesLoading: boolean
  batchesLoaded: boolean
  lotsExpanded: boolean
}

interface CreateProductTransferModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateProductTransferModal({ isOpen, onClose, onSuccess }: CreateProductTransferModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [toBranchId, setToBranchId] = useState('')
  const [items, setItems] = useState<TransferItem[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchBranches()
      fetchProducts()
    }
  }, [isOpen])

  async function fetchBranches() {
    try {
      const response = await fetch('/api/branches?status=active')
      if (response.ok) {
        const data = await response.json()
        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error)
    }
  }

  async function fetchProducts() {
    setIsLoading(true)
    try {
      // Fetch all products with inventory for current branch
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
      toast.error('Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }

  function formatProductName(product: Product) {
    // Compose a unique display name from brand / variant / model / productName
    // so two items that share a productName but differ by brand/model/variant
    // don't look like the same item. Matches the format used by the Stock In
    // and Stock Count modals.
    return [product.brand, product.variant, product.model, product.productName]
      .filter(Boolean)
      .join(' › ')
  }

  function addItem(product: Product) {
    if (items.some(i => i.productId === product._id)) {
      toast.error('Item already added')
      return
    }

    if (product.stock <= 0) {
      toast.error('No stock available for this product')
      return
    }

    const newItem: TransferItem = {
      productId:      product._id,
      itemName:       formatProductName(product),
      quantitySent:   0,
      unitPrice:      product.sellingPrice,
      availableStock: product.stock,
      trackLots:      product.trackLots ?? false,
      lotUnit:        product.lotUnit ?? 'units',
      batches:        [],
      batchesLoading: false,
      batchesLoaded:  false,
      lotsExpanded:   product.trackLots ?? false,
    }

    setItems(prev => [...prev, newItem])
    setSearchQuery('')

    // Auto-fetch batches for lot-tracked products
    if (product.trackLots) {
      fetchBatchesForItem(product._id, items.length)
    }
  }

  async function fetchBatchesForItem(productId: string, itemIndex: number) {
    setItems(prev => prev.map((it, i) =>
      i === itemIndex ? { ...it, batchesLoading: true } : it
    ))
    try {
      const res = await fetch(`/api/products/${productId}/batches?status=active`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const batches: BatchRow[] = (data.batches || []).map((b: any) => ({
        batchId:   b._id,
        lotLabel:  b.lotLabel || b.lotId,
        lotId:     b.lotId,
        available: b.quantity,
        quantity:  0,
        wholeLot:  false,
      }))
      setItems(prev => prev.map((it, i) =>
        i === itemIndex
          ? { ...it, batches, batchesLoading: false, batchesLoaded: true }
          : it
      ))
    } catch {
      toast.error('Failed to load lots')
      setItems(prev => prev.map((it, i) =>
        i === itemIndex ? { ...it, batchesLoading: false, batchesLoaded: true } : it
      ))
    }
  }

  function updateBatchQty(itemIndex: number, batchId: string, raw: string) {
    const val = parseFloat(raw) || 0
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIndex) return it
      const batches = it.batches.map(b =>
        b.batchId === batchId
          ? { ...b, quantity: Math.min(Math.max(0, val), b.available) }
          : b
      )
      const total = batches.reduce((s, b) => s + b.quantity, 0)
      return { ...it, batches, quantitySent: total }
    }))
  }

  function toggleWholeLot(itemIndex: number, batchId: string) {
    setItems(prev => prev.map((it, i) => {
      if (i !== itemIndex) return it
      const batches = it.batches.map(b => {
        if (b.batchId !== batchId) return b
        const nowWhole = !b.wholeLot
        return { ...b, wholeLot: nowWhole, quantity: nowWhole ? b.available : 0 }
      })
      const total = batches.reduce((s, b) => s + b.quantity, 0)
      return { ...it, batches, quantitySent: total }
    }))
  }

  function toggleLotsExpanded(itemIndex: number) {
    setItems(prev => prev.map((it, i) =>
      i === itemIndex ? { ...it, lotsExpanded: !it.lotsExpanded } : it
    ))
  }

  function updateItemQuantity(productId: string, quantity: number) {
    setItems(items.map(item =>
      item.productId === productId && !item.trackLots
        ? { ...item, quantitySent: Math.min(Math.max(0, quantity), item.availableStock) }
        : item
    ))
  }

  function removeItem(productId: string) {
    setItems(items.filter(item => item.productId !== productId))
  }

  async function handleSubmit() {
    if (!toBranchId) {
      toast.error('Please select destination branch')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    const invalid = items.find(item => item.quantitySent < 1)
    if (invalid) {
      toast.error(`Enter a quantity of at least 1 for ${invalid.itemName}`)
      return
    }

    // Validate lot products have batches selected
    for (const item of items) {
      if (item.trackLots) {
        const total = item.batches.reduce((s, b) => s + b.quantity, 0)
        if (total < 1) {
          toast.error(`Select at least one lot for ${item.itemName}`)
          return
        }
        for (const b of item.batches) {
          if (b.quantity > b.available) {
            toast.error(`"${b.lotLabel}" only has ${b.available} ${item.lotUnit} available`)
            return
          }
        }
      }
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toBranchId,
          items: items.map(item => ({
            productId:    item.productId,
            itemName:     item.itemName,
            quantitySent: item.quantitySent,
            unitPrice:    item.unitPrice,
            ...(item.trackLots && item.batches.length > 0 && {
              lotBreakdown: item.batches
                .filter(b => b.quantity > 0)
                .map(b => ({
                  batchId:  b.batchId,
                  lotLabel: b.lotLabel,
                  quantity: b.quantity,
                })),
            }),
          })),
          notes,
        }),
      })

      if (response.ok) {
        toast.success('Stock out successful - transfer created')
        onSuccess()
        onClose()
        // Reset form
        setToBranchId('')
        setItems([])
        setNotes('')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to create transfer')
      }
    } catch (error) {
      console.error('Failed to create transfer:', error)
      toast.error('Failed to create transfer')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    // Match against the full composite name (brand › variant › model ›
    // productName) plus category and SKU, so an item can be found by brand,
    // model or variant alone — not just by product name.
    return (
      formatProductName(p).toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    )
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Out - Transfer to Branch</DialogTitle>
          <DialogDescription>
            Transfer products from your current branch to another branch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Destination Branch */}
          <div>
            <Label>Destination Branch</Label>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch._id} value={branch._id}>
                    {branch.name} ({branch.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Search */}
          <div>
            <Label>Add Products</Label>
            <div className="relative">
              <Input
                placeholder="Search by name, brand, model, variant or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Package className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            {searchQuery && (
              <div className="mt-2 border rounded-lg max-h-72 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No products found
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <button
                      key={product._id}
                      onClick={() => addItem(product)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                    >
                      <div>
                        <div className="font-medium text-sm">{formatProductName(product)}</div>
                        <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">KES {product.sellingPrice}</div>
                        <div className="text-xs text-gray-500">Stock: {product.stock}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Transfer Items ({items.length})</Label>
              <div className="border rounded-lg divide-y">
                {items.map((item, itemIndex) => (
                  <div key={item.productId} className="p-3 space-y-2">
                    {/* Item header row */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          {item.trackLots && (
                            <button
                              type="button"
                              onClick={() => toggleLotsExpanded(itemIndex)}
                              className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors"
                              title={item.lotsExpanded ? 'Collapse lots' : 'Expand lots'}
                            >
                              <Layers size={13} className="shrink-0" />
                              {item.lotsExpanded
                                ? <ChevronUp size={12} />
                                : <ChevronDown size={12} />
                              }
                            </button>
                          )}
                          <span className="font-medium text-sm">{item.itemName}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Available: {item.availableStock} {item.trackLots ? item.lotUnit : 'units'}
                          {item.trackLots && item.quantitySent > 0 && (
                            <span className="ml-2 text-blue-600 font-medium">
                              · {item.quantitySent} {item.lotUnit} selected
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Flat qty input — only for non-lot products */}
                      {!item.trackLots && (
                        <div className="w-28">
                          <Input
                            type="number"
                            min="0"
                            max={item.availableStock}
                            value={item.quantitySent || ''}
                            placeholder="Qty"
                            onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 0)}
                            className="text-center"
                          />
                        </div>
                      )}

                      {/* Lot product: show computed total (read-only) */}
                      {item.trackLots && (
                        <div className="w-28 text-right">
                          <div className="text-sm font-semibold">
                            {item.quantitySent} {item.lotUnit}
                          </div>
                          <div className="text-[10px] text-muted-foreground">total</div>
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Batch rows for lot-tracked products */}
                    {item.trackLots && item.lotsExpanded && (
                      <div className="ml-2 pl-3 border-l-2 border-blue-100 space-y-1.5">
                        {item.batchesLoading ? (
                          <p className="text-xs text-muted-foreground py-1">Loading lots…</p>
                        ) : item.batches.length === 0 && item.batchesLoaded ? (
                          <div className="flex items-center gap-1.5 text-xs text-orange-600 py-1">
                            <AlertCircle size={12} />
                            No active lots — receive stock first
                          </div>
                        ) : (
                          <>
                            {/* Column headers */}
                            <div className="grid grid-cols-12 gap-2 text-[10px] text-muted-foreground px-1">
                              <span className="col-span-1" />
                              <span className="col-span-5">Lot</span>
                              <span className="col-span-3 text-right">Available</span>
                              <span className="col-span-3 text-right">Transfer</span>
                            </div>
                            {item.batches.map(batch => {
                              const over = !batch.wholeLot && batch.quantity > batch.available
                              return (
                                <div key={batch.batchId} className="grid grid-cols-12 gap-2 items-center">
                                  {/* Whole-lot checkbox */}
                                  <div className="col-span-1 flex justify-center">
                                    <input
                                      type="checkbox"
                                      checked={batch.wholeLot}
                                      onChange={() => toggleWholeLot(itemIndex, batch.batchId)}
                                      title="Transfer whole lot"
                                      className="w-3.5 h-3.5 cursor-pointer accent-blue-600"
                                    />
                                  </div>
                                  <div className="col-span-5">
                                    <div className="text-xs font-medium truncate">{batch.lotLabel}</div>
                                    <div className="text-[10px] text-muted-foreground">{batch.lotId}</div>
                                  </div>
                                  <div className="col-span-3 text-right text-xs text-muted-foreground">
                                    {batch.available} {item.lotUnit}
                                  </div>
                                  <div className="col-span-3">
                                    {batch.wholeLot ? (
                                      <div className="h-7 flex items-center justify-end pr-1">
                                        <span className="text-xs font-semibold text-blue-600">
                                          {batch.available} {item.lotUnit}
                                        </span>
                                      </div>
                                    ) : (
                                      <>
                                        <Input
                                          type="number"
                                          min="0"
                                          max={batch.available}
                                          step="any"
                                          value={batch.quantity || ''}
                                          placeholder="0"
                                          onChange={e => updateBatchQty(itemIndex, batch.batchId, e.target.value)}
                                          onFocus={e => e.target.select()}
                                          className={`h-7 text-xs text-right ${over ? 'border-red-400' : ''}`}
                                        />
                                        {over && (
                                          <p className="text-[10px] text-red-500 mt-0.5">
                                            Max {batch.available}
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any notes about this transfer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0 || !toBranchId}
            >
              {isSubmitting ? 'Processing Stock Out...' : 'Stock Out'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
