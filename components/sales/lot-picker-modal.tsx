'use client'

// ── LotPickerModal ─────────────────────────────────────────────────────────────
// Two sell modes for lot-tracked products:
//
// PIECES mode (default):
//   Shows every active lot as a row. Cashier manually picks how many pieces
//   to draw from each lot. Full FIFO control.
//
// BOX mode (shown only when product has lotContainerName + lotSize > 1):
//   Shows a single simple card. Cashier types how many boxes (whole or
//   fractional, e.g. 0.5). The system auto-allocates FIFO across untouched lots.
//
//   "Available boxes" = sum of Math.floor(batch.quantity / lotSize) across lots
//   where batch.quantity === batch.initialQuantity (untouched / sealed full).
//   Touched lots (partially sold) are invisible in box mode.
//
//   On confirm the requested box quantity is allocated FIFO:
//     - Fill whole boxes from oldest lot first
//     - If the last allocation is a partial box, that many base units are taken
//       from that lot — making it "touched" so next time it won't appear in
//       the available-box count.

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
import { Layers, AlertCircle, Check, Package, Puzzle } from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Batch {
  _id: string
  lotId: string
  lotLabel: string
  quantity: number          // remaining in base units
  initialQuantity: number   // quantity when first received
  status: string
  receivedDate: string
}

export interface LotSelection {
  batchId: string
  lotLabel: string
  quantity: number          // base units
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
  soldInBoxes?: boolean
  boxSize?: number
  boxUnit?: string
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
  lotContainerName?: string  // e.g. "box", "carton", "roll"
  lotSize?: number           // base units per container
  lotPrice?: number          // selling price per whole container
}

interface LotPickerModalProps {
  open: boolean
  product: Product | null
  isWholesaleMode: boolean
  onConfirm: (item: CartItemBase) => void
  onCancel: () => void
}

type SellMode = 'pieces' | 'boxes'

// Simple pluralization — handles the common container names without naively
// appending 's' to words that already end in one.
function pl(word: string, count: number): string {
  if (count === 1) return word
  const w = word.toLowerCase()
  if (w.endsWith('x') || w.endsWith('ch') || w.endsWith('sh') || (w.endsWith('s') && !w.endsWith('ss'))) return word + 'es'
  return word + 's'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LotPickerModal({
  open,
  product,
  isWholesaleMode,
  onConfirm,
  onCancel,
}: LotPickerModalProps) {
  const [batches, setBatches]       = useState<Batch[]>([])
  const [selections, setSelections] = useState<Record<string, number>>({})  // pieces mode: batchId → pieces
  const [boxQty, setBoxQty]         = useState<string>('')                  // boxes mode: single input
  const [loading, setLoading]       = useState(false)
  const [sellMode, setSellMode]     = useState<SellMode>('pieces')

  // ── Derived product config ───────────────────────────────────────────────
  const lotSize    = product?.lotSize && product.lotSize > 1 ? product.lotSize : 1
  const boxUnit    = product?.lotContainerName || 'box'
  const lotUnit    = product?.lotUnit || 'units'
  const hasBoxMode = !!(product?.lotContainerName && product?.lotSize && product.lotSize > 1)

  // Batches sorted FIFO (API already returns oldest first).
  // Roll/box mode: a lot is eligible if it has enough remaining for at least
  // one full container — regardless of whether it was received as whole
  // containers or has been partially used.
  const eligibleBatches = batches.filter(b => b.quantity >= lotSize)
  const availableBoxes = eligibleBatches.reduce(
    (sum, b) => sum + Math.floor(b.quantity / lotSize),
    0
  )

  // ── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && product) {
      setSellMode('pieces')
      setBoxQty('')
      loadBatches(product._id)
    } else {
      setBatches([])
      setSelections({})
      setBoxQty('')
    }
  }, [open, product?._id])

  function switchMode(mode: SellMode) {
    setSellMode(mode)
    setSelections({})
    setBoxQty('')
  }

  async function loadBatches(productId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/batches?status=active`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBatches(data.batches || [])
      setSelections({})
      setBoxQty('')
    } catch {
      toast.error('Failed to load lots')
      onCancel()
    } finally {
      setLoading(false)
    }
  }

  // ── Pieces mode helpers ──────────────────────────────────────────────────

  function updateSelection(batchId: string, raw: string) {
    const val = parseFloat(raw)
    setSelections(prev => ({
      ...prev,
      [batchId]: isNaN(val) || val < 0 ? 0 : val,
    }))
  }

  function isOverLimit(batchId: string, batch: Batch): boolean {
    return (selections[batchId] || 0) > batch.quantity
  }

  // ── Box mode: FIFO lot allocation ────────────────────────────────────────
  // Given a requested box count (may be fractional), allocate base units
  // from untouched lots FIFO. Returns lotBreakdown array.

  function allocateFifo(requestedBoxes: number): Array<{ batchId: string; lotLabel: string; quantity: number }> {
    const breakdown: Array<{ batchId: string; lotLabel: string; quantity: number }> = []
    let remaining = requestedBoxes

    for (const batch of eligibleBatches) {
      if (remaining <= 0) break
      const batchBoxes = Math.floor(batch.quantity / lotSize) // whole boxes in this lot
      const take = Math.min(remaining, batchBoxes)
      const takeUnits = Math.round(take * lotSize)
      if (takeUnits > 0) {
        breakdown.push({
          batchId:  batch._id,
          lotLabel: batch.lotLabel || batch.lotId,
          quantity: takeUnits,
        })
        remaining -= take
      }
    }

    return breakdown
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validatePieces(): string | null {
    const total = Object.values(selections).reduce((s, v) => s + v, 0)
    if (total <= 0) return 'Enter a quantity for at least one lot'
    for (const batch of batches) {
      const sel = selections[batch._id] || 0
      if (sel > batch.quantity) {
        return `"${batch.lotLabel || batch.lotId}" only has ${batch.quantity} ${lotUnit} remaining`
      }
    }
    return null
  }

  function validateBoxes(): string | null {
    const qty = parseFloat(boxQty)
    if (!boxQty || isNaN(qty) || qty <= 0) return 'Enter number of boxes'
    if (availableBoxes === 0) return 'No full boxes available'
    if (qty > availableBoxes) return `Only ${availableBoxes} ${pl(boxUnit, availableBoxes)} available`
    return null
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!product) return

    if (sellMode === 'boxes') {
      const err = validateBoxes()
      if (err) { toast.error(err); return }

      const requestedBoxes = parseFloat(boxQty)
      const priceToUse = product.lotPrice && product.lotPrice > 0
        ? product.lotPrice
        : (isWholesaleMode && product.wholeSale > 0
            ? product.wholeSale
            : (product.sellingPrice * lotSize) || product.sellingPrice)

      const breakdown = allocateFifo(requestedBoxes)
      if (breakdown.length === 0) { toast.error('No stock available'); return }

      onConfirm({
        productId:    product._id,
        productName:  product.productName,
        brand:        product.brand,
        model:        product.model,
        variant:      product.variant,
        sellingPrice: priceToUse,
        quantity:     requestedBoxes,          // boxes — drives price calc in cart
        discount:     0,
        soldInBoxes:  true,
        boxSize:      lotSize,
        boxUnit,
        lotBreakdown: breakdown,               // base units — drives stock deduction
      })
    } else {
      const err = validatePieces()
      if (err) { toast.error(err); return }

      const selectedLots = batches.filter(b => (selections[b._id] || 0) > 0)
      const totalQty     = selectedLots.reduce((s, b) => s + selections[b._id], 0)

      const priceToUse = isWholesaleMode && product.wholeSale > 0
        ? product.wholeSale
        : product.sellingPrice

      onConfirm({
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
      })
    }
  }

  // ── Derived display values ────────────────────────────────────────────────

  const piecesTotalSelected = Object.values(selections).reduce((s, v) => s + v, 0)
  const piecesErr           = piecesTotalSelected > 0 ? validatePieces() : null
  const boxesErr            = boxQty ? validateBoxes() : null
  const boxQtyNum           = parseFloat(boxQty) || 0

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

        {/* Sell mode toggle — only when product has container config */}
        {hasBoxMode && !loading && batches.length > 0 && (
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg self-start">
            <button
              type="button"
              onClick={() => switchMode('pieces')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sellMode === 'pieces'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Puzzle size={12} />
              {lotUnit.charAt(0).toUpperCase() + lotUnit.slice(1)}
            </button>
            <button
              type="button"
              onClick={() => switchMode('boxes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sellMode === 'boxes'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package size={12} />
              {boxUnit.charAt(0).toUpperCase() + pl(boxUnit, 2).slice(1)}
            </button>
          </div>
        )}

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
              <p>3. Enter the quantity and define lots</p>
            </div>
            <Button variant="outline" onClick={onCancel} className="mt-1">Close</Button>
          </div>

        ) : sellMode === 'boxes' ? (
          /* ── Box mode: simple flat card ───────────────────────────────── */
          <div className="space-y-5">
            {/* Product summary */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
              <p className="font-semibold text-sm">{product?.productName}</p>
              <p className="text-xs text-muted-foreground">
                KSh {((product?.lotPrice && product.lotPrice > 0
                  ? product.lotPrice
                  : (isWholesaleMode && (product?.wholeSale ?? 0) > 0
                    ? product?.wholeSale
                    : ((product?.sellingPrice ?? 0) * lotSize) || product?.sellingPrice)) ?? 0
                ).toLocaleString()} per {boxUnit}
              </p>
              <p className="text-xs font-medium text-green-700">
                {availableBoxes} full {pl(boxUnit, availableBoxes)} available
              </p>
            </div>

            {availableBoxes === 0 ? (
              <div className="text-center py-2 space-y-1">
                <AlertCircle size={22} className="mx-auto text-orange-400" />
                <p className="text-sm text-muted-foreground">
                  No full {pl(boxUnit, 2)} available. Switch to {lotUnit} mode to sell partial stock.
                </p>
              </div>
            ) : (
              <>
                {/* Quantity input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    How many {pl(boxUnit, 2)}?
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="0.01"
                      max={availableBoxes}
                      step="0.01"
                      value={boxQty}
                      onChange={e => setBoxQty(e.target.value)}
                      onFocus={e => e.target.select()}
                      placeholder={`e.g. 1 or 0.5`}
                      className={`text-lg h-11 flex-1 ${boxesErr ? 'border-red-400' : ''}`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setBoxQty(String(availableBoxes))}
                      className="text-xs text-blue-600 hover:text-blue-800 underline shrink-0"
                    >
                      All ({availableBoxes})
                    </button>
                  </div>
                  {boxesErr && (
                    <p className="text-xs text-red-600">{boxesErr}</p>
                  )}
                  {/* Show piece equivalent when a valid non-zero qty is entered */}
                  {boxQtyNum > 0 && !boxesErr && (
                    <p className="text-xs text-blue-600">
                      = {Math.round(boxQtyNum * lotSize)} {lotUnit}
                    </p>
                  )}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between text-sm font-medium border-t pt-3">
                  <span className="text-muted-foreground">Total:</span>
                  <span>
                    KSh {(boxQtyNum * ((product?.lotPrice && product.lotPrice > 0
                      ? product.lotPrice
                      : (isWholesaleMode && (product?.wholeSale ?? 0) > 0
                        ? product?.wholeSale
                        : ((product?.sellingPrice ?? 0) * lotSize) || product?.sellingPrice)) ?? 0)
                    ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
              <Button
                onClick={handleConfirm}
                disabled={!boxQty || !!boxesErr || availableBoxes === 0}
                className="flex-1"
              >
                Add to Cart
              </Button>
            </div>
          </div>

        ) : (
          /* ── Pieces mode: per-lot rows (unchanged) ────────────────────── */
          <div className="space-y-4">
            <div className="space-y-2">
              {batches.map(batch => {
                const sel  = selections[batch._id] || 0
                const over = isOverLimit(batch._id, batch)
                const pct  = batch.initialQuantity > 0
                  ? (batch.quantity / batch.initialQuantity) * 100
                  : 0

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

                    {/* Input */}
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
                        className={`h-8 text-sm flex-1 ${over ? 'border-red-400' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateSelection(batch._id, String(batch.quantity))}
                        className="text-[10px] text-blue-600 hover:text-blue-800 shrink-0 underline"
                        title={`Use all ${batch.quantity} ${lotUnit}`}
                      >
                        All
                      </button>
                      {sel > 0 && !over && <Check size={16} className="text-green-500 shrink-0" />}
                      {over && <AlertCircle size={16} className="text-red-500 shrink-0" />}
                    </div>

                    {over && (
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
              piecesErr ? 'text-red-600' : 'text-foreground'
            }`}>
              <span className="text-muted-foreground">Total selected:</span>
              <span className="font-bold">{piecesTotalSelected} {lotUnit}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
              <Button
                onClick={handleConfirm}
                disabled={piecesTotalSelected <= 0 || !!piecesErr}
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
