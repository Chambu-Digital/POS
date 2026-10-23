'use client'

// ── LotPickerModal ─────────────────────────────────────────────────────────────
// Opens when a cashier taps a lot-tracked product card in the POS.
// Fetches active batches for the product, lets the cashier enter how much to
// draw from each lot, then calls onConfirm with one CartItem per lot selected.
//
// Behaviour:
//  • Lots are listed FIFO (oldest received first — same order as the API returns).
//  • The first lot is pre-selected with the full quantity = 1 unit so the cashier
//    can just hit Confirm for the common case.
//  • Splitting across lots is supported: add a non-zero quantity to any lot row.
//  • Validation: sum of selections must be > 0.
//  • If there is only ONE active lot, the modal is skipped and onConfirm is
//    called immediately by the parent (handled in the sales page intercept).

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Layers, AlertCircle, Check } from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Batch {
  _id: string
  lotId: string
  lotLabel: string
  quantity: number       // remaining
  initialQuantity: number
  status: string
  receivedDate: string
}

export interface LotSelection {
  batchId: string
  lotLabel: string
  quantity: number       // how much to sell from this lot
}

interface CartItemBase {
  productId: string
  productName: string
  brand?: string
  model?: string
  variant?: string
  sellingPrice: number
  quantity: number
  discount: number
  lotBreakdown?: Array<{ batchId: string; lotLabel: string; quantity: number }>
}

interface Product {
  _id: string
  productName: string
  brand?: string
  model?: string
  variant?: string
  sellingPrice: number
  wholeSale: number
  stock: number
  lotUnit?: string
}

interface LotPickerModalProps {
  open: boolean
  product: Product | null
  isWholesaleMode: boolean
  onConfirm: (item: CartItemBase) => void
  onCancel: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LotPickerModal({
  open,
  product,
  isWholesaleMode,
  onConfirm,
  onCancel,
}: LotPickerModalProps) {
  const [batches, setBatches]         = useState<Batch[]>([])
  const [selections, setSelections]   = useState<Record<string, number>>({})  // batchId → qty
  const [loading, setLoading]         = useState(false)

  // Fetch batches whenever the modal opens for a product
  useEffect(() => {
    if (open && product) {
      loadBatches(product._id)
    } else {
      setBatches([])
      setSelections({})
    }
  }, [open, product?._id])

  async function loadBatches(productId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/batches?status=active`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const fetched: Batch[] = data.batches || []
      setBatches(fetched)
      // Start with all inputs empty — cashier enters exactly what they want
      setSelections({})
    } catch {
      toast.error('Failed to load lots')
      onCancel()
    } finally {
      setLoading(false)
    }
  }

  function updateSelection(batchId: string, raw: string) {
    const val = parseFloat(raw)
    setSelections(prev => ({
      ...prev,
      [batchId]: isNaN(val) || val < 0 ? 0 : val,
    }))
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): string | null {
    const totalSelected = Object.values(selections).reduce((s, v) => s + v, 0)
    if (totalSelected <= 0) return 'Enter a quantity for at least one lot'

    for (const batch of batches) {
      const sel = selections[batch._id] || 0
      if (sel > batch.quantity) {
        return `"${batch.lotLabel}" only has ${batch.quantity} ${product?.lotUnit || 'units'} remaining`
      }
    }
    return null
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  function handleConfirm() {
    const err = validate()
    if (err) { toast.error(err); return }
    if (!product) return

    const priceToUse = isWholesaleMode && product.wholeSale > 0
      ? product.wholeSale
      : product.sellingPrice

    const selectedLots = batches.filter(b => (selections[b._id] || 0) > 0)
    const totalQty     = selectedLots.reduce((s, b) => s + selections[b._id], 0)

    // One cart item with the lot breakdown embedded
    const item: CartItemBase = {
      productId:    product._id,
      productName:  product.productName,
      brand:        product.brand,
      model:        product.model,
      variant:      product.variant,
      sellingPrice: priceToUse,
      quantity:     totalQty,
      discount:     0,
      lotBreakdown: selectedLots.map(b => ({
        batchId:  b._id,
        lotLabel: b.lotLabel || b.lotId,
        quantity: selections[b._id],
      })),
    }

    onConfirm(item)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalSelected = Object.values(selections).reduce((s, v) => s + v, 0)
  const lotUnit       = product?.lotUnit || 'units'
  const validationErr = totalSelected > 0 ? validate() : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers size={18} className="text-blue-500" />
            Select Lot
          </DialogTitle>
          <DialogDescription>
            {product?.productName} — choose which lot(s) to draw from
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading lots…</div>
        ) : batches.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <AlertCircle size={28} className="mx-auto text-orange-400" />
            <div>
              <p className="text-sm font-medium">No active lots for this product</p>
              <p className="text-xs text-muted-foreground mt-1">
                This product has stock recorded but no individual lots defined.
              </p>
            </div>
            <div className="text-xs bg-muted rounded-lg p-3 text-left space-y-1">
              <p className="font-medium">To fix this:</p>
              <p>1. Go to <strong>Inventory → Stock In</strong></p>
              <p>2. Select this product</p>
              <p>3. Enter the quantity and define lots (e.g. Roll 1 — 90m)</p>
            </div>
            <Button variant="outline" onClick={onCancel} className="mt-1">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lot rows */}
            <div className="space-y-2">
              {batches.map((batch, i) => {
                const sel       = selections[batch._id] || 0
                const pct       = batch.initialQuantity > 0
                  ? (batch.quantity / batch.initialQuantity) * 100
                  : 0
                const overLimit = sel > batch.quantity

                return (
                  <div
                    key={batch._id}
                    className={`border rounded-lg p-3 space-y-2 transition-colors ${
                      sel > 0 ? 'border-blue-400 bg-blue-50/40' : 'border-border'
                    }`}
                  >
                    {/* Lot header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold">
                          {batch.lotLabel || batch.lotId}
                        </span>
                        <div className="text-[10px] text-muted-foreground">{batch.lotId}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-green-700">
                          {batch.quantity}
                          <span className="text-xs font-normal ml-0.5 text-muted-foreground">
                            {lotUnit}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">remaining</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    {/* Quantity input + Use all shortcut */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground shrink-0">
                        Sell ({lotUnit}):
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max={batch.quantity}
                        step="any"
                        value={sel || ''}
                        onChange={e => updateSelection(batch._id, e.target.value)}
                        onFocus={e => e.target.select()}
                        placeholder="0"
                        className={`h-8 text-sm flex-1 ${overLimit ? 'border-red-400' : ''}`}
                      />
                      {/* Use all shortcut */}
                      <button
                        type="button"
                        onClick={() => updateSelection(batch._id, String(batch.quantity))}
                        className="text-[10px] text-blue-600 hover:text-blue-800 shrink-0 underline"
                        title={`Use all ${batch.quantity} ${lotUnit}`}
                      >
                        All
                      </button>
                      {sel > 0 && !overLimit && (
                        <Check size={16} className="text-green-500 shrink-0" />
                      )}
                      {overLimit && (
                        <AlertCircle size={16} className="text-red-500 shrink-0" />
                      )}
                    </div>

                    {overLimit && (
                      <p className="text-[10px] text-red-600">
                        Only {batch.quantity} {lotUnit} available in this lot
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Running total */}
            <div className={`flex items-center justify-between text-sm px-1 ${
              validationErr ? 'text-red-600' : 'text-foreground'
            }`}>
              <span className="text-muted-foreground">Total selected:</span>
              <span className="font-bold">
                {totalSelected} {lotUnit}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={totalSelected <= 0 || !!validationErr}
                className="flex-1"
              >
                Add to Cart
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
