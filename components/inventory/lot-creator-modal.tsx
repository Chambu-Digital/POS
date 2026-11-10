'use client'

// ── LotCreatorModal ────────────────────────────────────────────────────────────
// Opens from the inventory page for any lot-tracked product.
// Top section  — displays the product's lot config (read-only summary).
// Bottom section — lets the user add new batch rows and save them.
// Existing batches are shown for reference but are not editable here.
// Saving calls:
//   PATCH /api/products/:id  — updates lotContainerName, lotSize, lotPrice, sellingPrice
//   POST  /api/products/:id/batches — creates the new batch records

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
import { Label } from '@/components/ui/label'
import { Layers, Plus, Trash2, AlertCircle, Package } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LotProduct {
  _id: string
  productName: string
  lotUnit?: string
  lotContainerName?: string
  lotSize?: number
  lotPrice?: number
  sellingPrice: number
}

interface ExistingBatch {
  _id: string
  lotId: string
  lotLabel: string
  quantity: number
  initialQuantity: number
  status: string
}

interface NewBatchRow {
  id: string          // local key only, not sent to API
  label: string
  quantity: number    // pieces currently in this batch
}

interface LotCreatorModalProps {
  open: boolean
  product: LotProduct | null
  onClose: () => void
  onSaved: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function makeRow(label: string, defaultQty: number): NewBatchRow {
  return { id: uid(), label, quantity: defaultQty }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LotCreatorModal({ open, product, onClose, onSaved }: LotCreatorModalProps) {
  // ── Config state (product-level fields) ───────────────────────────────────
  const [containerName, setContainerName] = useState('')
  const [baseUnit,       setBaseUnit]       = useState('')
  const [lotSize,        setLotSize]         = useState(1)
  const [lotPrice,       setLotPrice]        = useState(0)
  const [piecePrice,     setPiecePrice]      = useState(0)

  // ── Batch rows ────────────────────────────────────────────────────────────
  const [rows,      setRows]      = useState<NewBatchRow[]>([])
  const [existing,  setExisting]  = useState<ExistingBatch[]>([])
  const [loadingEx, setLoadingEx] = useState(false)
  const [saving,    setSaving]    = useState(false)

  // ── Seed state when product changes ───────────────────────────────────────
  useEffect(() => {
    if (!open || !product) return

    setContainerName(product.lotContainerName ?? '')
    setBaseUnit(product.lotUnit ?? '')
    setLotSize(product.lotSize && product.lotSize > 0 ? product.lotSize : 1)
    setLotPrice(product.lotPrice ?? 0)
    setPiecePrice(product.sellingPrice ?? 0)
    setRows([makeRow('Batch 1', product.lotSize && product.lotSize > 0 ? product.lotSize : 1)])

    loadExisting(product._id)
  }, [open, product?._id])

  async function loadExisting(productId: string) {
    setLoadingEx(true)
    try {
      const res = await fetch(`/api/products/${productId}/batches?status=all`)
      if (res.ok) {
        const data = await res.json()
        setExisting(data.batches || [])
      }
    } catch {
      // silently ignore — existing batches are just for context
    } finally {
      setLoadingEx(false)
    }
  }

  // ── Row helpers ───────────────────────────────────────────────────────────

  function addRow() {
    const nextLabel = `Batch ${existing.length + rows.length + 1}`
    setRows(prev => [...prev, makeRow(nextLabel, lotSize)])
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function updateRow(id: string, field: 'label' | 'quantity', value: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      return {
        ...r,
        [field]: field === 'quantity' ? (parseFloat(value) || 0) : value,
      }
    }))
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (!containerName.trim()) return 'Container name is required'
    if (!baseUnit.trim())      return 'Base unit is required'
    if (lotSize < 1)           return 'Units per container must be at least 1'
    if (piecePrice <= 0)       return 'Price per unit must be greater than 0'
    if (rows.length === 0)     return 'Add at least one batch'
    for (const row of rows) {
      if (!row.label.trim())   return 'All batches must have a label'
      if (row.quantity <= 0)   return `"${row.label}" must have a quantity greater than 0`
    }
    return null
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const err = validate()
    if (err) { toast.error(err); return }
    if (!product) return

    setSaving(true)
    try {
      // 1. Update product lot config
      const productRes = await fetch(`/api/products/${product._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotContainerName: containerName.trim(),
          lotUnit:          baseUnit.trim(),
          lotSize,
          lotPrice,
          sellingPrice: piecePrice,
        }),
      })
      if (!productRes.ok) {
        const d = await productRes.json()
        throw new Error(d.error || 'Failed to update product config')
      }

      // 2. Create batch records
      const batchRes = await fetch(`/api/products/${product._id}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lots: rows.map(r => ({ label: r.label.trim(), quantity: r.quantity })),
          buyingPrice: product.sellingPrice, // sensible fallback; owner can adjust later
          notes: 'Created via lot creator',
        }),
      })
      if (!batchRes.ok) {
        const d = await batchRes.json()
        throw new Error(d.error || 'Failed to create batches')
      }

      toast.success(`${rows.length} batch${rows.length > 1 ? 'es' : ''} created`)
      onSaved()
      handleClose()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setRows([])
    setExisting([])
    onClose()
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalNewPieces  = rows.reduce((s, r) => s + r.quantity, 0)
  const containerLabel  = containerName.trim() || 'container'
  const unitLabel       = baseUnit.trim() || product?.lotUnit || 'units'
  const suggestedLotPrice = lotSize * piecePrice

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers size={18} className="text-blue-500" />
            Manage Lots
          </DialogTitle>
          <DialogDescription>
            {product?.productName} — configure container pricing and add new batches
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">

          {/* ── Top: lot config ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Container configuration
            </p>

            {/* Row 1: container name + base unit */}
            <div className="grid grid-cols-2 gap-3">
              {/* Container name */}
              <div className="space-y-1.5">
                <Label htmlFor="lc-name" className="text-xs">Container name</Label>
                <Input
                  id="lc-name"
                  value={containerName}
                  onChange={e => setContainerName(e.target.value)}
                  placeholder="e.g. roll, box, carton"
                  disabled={saving}
                  className="h-8 text-sm"
                />
              </div>

              {/* Base unit */}
              <div className="space-y-1.5">
                <Label htmlFor="lc-unit" className="text-xs">Base unit (sold individually)</Label>
                <Input
                  id="lc-unit"
                  value={baseUnit}
                  onChange={e => setBaseUnit(e.target.value)}
                  placeholder="e.g. metres, pieces, kg"
                  disabled={saving}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Row 2: qty per container + price per base unit + price per container */}
            <div className="grid grid-cols-3 gap-3">
              {/* Qty per container */}
              <div className="space-y-1.5">
                <Label htmlFor="lc-size" className="text-xs">
                  {baseUnit || unitLabel} per {containerLabel}
                </Label>
                <Input
                  id="lc-size"
                  type="number"
                  min="1"
                  step="any"
                  value={lotSize}
                  onChange={e => setLotSize(parseFloat(e.target.value) || 1)}
                  onFocus={e => e.target.select()}
                  disabled={saving}
                  className="h-8 text-sm"
                />
              </div>

              {/* Price per base unit */}
              <div className="space-y-1.5">
                <Label htmlFor="lc-piece-price" className="text-xs">
                  Price per {baseUnit || unitLabel}
                </Label>
                <Input
                  id="lc-piece-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={piecePrice || ''}
                  onChange={e => setPiecePrice(parseFloat(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                  disabled={saving}
                  className="h-8 text-sm"
                />
              </div>

              {/* Price per container */}
              <div className="space-y-1.5">
                <Label htmlFor="lc-lot-price" className="text-xs">
                  Price per {containerLabel}
                </Label>
                <Input
                  id="lc-lot-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={lotPrice || ''}
                  onChange={e => setLotPrice(parseFloat(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                  disabled={saving}
                  className="h-8 text-sm"
                />
                {lotSize > 1 && piecePrice > 0 && lotPrice > 0 && lotPrice < suggestedLotPrice && (
                  <p className="text-[10px] text-blue-600">
                    Bulk discount: saves {(suggestedLotPrice - lotPrice).toFixed(2)} vs buying by {baseUnit || unitLabel}
                  </p>
                )}
                {lotSize > 1 && piecePrice > 0 && lotPrice === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Suggested: {suggestedLotPrice.toFixed(2)} ({lotSize} × {piecePrice})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Existing batches (reference only) ─────────────────────────── */}
          {(loadingEx || existing.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Existing batches
              </p>
              {loadingEx ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 font-medium">Label</th>
                        <th className="text-right p-2 font-medium">Initial</th>
                        <th className="text-right p-2 font-medium">Remaining</th>
                        <th className="text-center p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existing.map(b => (
                        <tr key={b._id} className="border-t">
                          <td className="p-2 font-medium">{b.lotLabel || b.lotId}</td>
                          <td className="p-2 text-right text-muted-foreground">{b.initialQuantity}</td>
                          <td className="p-2 text-right">
                            <span className={b.status === 'active' ? 'text-green-700 font-semibold' : 'text-muted-foreground'}>
                              {b.quantity}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                              b.status === 'active'   && 'bg-green-100 text-green-800',
                              b.status === 'depleted' && 'bg-gray-100 text-gray-600',
                              b.status === 'sealed'   && 'bg-orange-100 text-orange-700',
                            )}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── New batch rows ────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New batches
              </p>
              {rows.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {totalNewPieces} {unitLabel} total
                </p>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="border border-dashed rounded-lg p-4 text-center">
                <Package size={20} className="mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">No new batches added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={row.id} className="flex items-center gap-2">
                    {/* Label */}
                    <div className="flex-1">
                      {i === 0 && (
                        <Label className="text-[10px] text-muted-foreground mb-1 block">Label</Label>
                      )}
                      <Input
                        value={row.label}
                        onChange={e => updateRow(row.id, 'label', e.target.value)}
                        placeholder={`${containerLabel} ${existing.length + i + 1}`}
                        disabled={saving}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="w-28">
                      {i === 0 && (
                        <Label className="text-[10px] text-muted-foreground mb-1 block">
                          {unitLabel} in this batch
                        </Label>
                      )}
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.quantity || ''}
                        onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                        onFocus={e => e.target.select()}
                        disabled={saving}
                        className={cn(
                          'h-8 text-sm',
                          row.quantity > 0 && row.quantity < lotSize && 'border-orange-400'
                        )}
                      />
                    </div>

                    {/* Partial hint */}
                    <div className="w-5 shrink-0 mt-auto mb-1">
                      {row.quantity > 0 && row.quantity < lotSize && (
                        <AlertCircle size={14} className="text-orange-400" title={`Partial ${containerLabel}`} />
                      )}
                    </div>

                    {/* Remove */}
                    <div className={i === 0 ? 'mt-5' : ''}>
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={saving}
                        className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Remove batch"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={saving}
              className="w-full mt-1 text-xs h-8 border-dashed"
            >
              <Plus size={14} className="mr-1" />
              Add {containerLabel}
            </Button>
          </div>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} disabled={saving} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || rows.length === 0}
              className="flex-1"
            >
              {saving ? 'Saving…' : `Save${rows.length > 0 ? ` (${rows.length} batch${rows.length > 1 ? 'es' : ''})` : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
