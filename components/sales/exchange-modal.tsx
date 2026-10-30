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
import { ArrowRightLeft, Search, Plus, X, Pencil, Check, CreditCard, Banknote, Smartphone, Building2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { getCachedBankProviders, cacheBankProviders, getCachedPaymentMethods, cachePaymentMethods } from '@/lib/indexeddb'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  _id: string
  productName: string
  category: string
  brand?: string
  model?: string
  variant?: string
  sellingPrice: number
  stock: number
}

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
  customerId?: string
  total: number
  status: string
  createdAt: string
}

// A line in the "returning" basket
interface ReturnLine {
  id: string           // local key
  saleItem: SaleItem   // original sale line
  productDetails?: Product
  quantity: number
}

// A line in the "new items" basket
interface NewLine {
  id: string           // local key
  product: Product
  quantity: number
  discount: number          // KSh per unit
  overridePrice: number | null  // replaces catalog price when set
}

interface ExchangeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
  onSuccess: () => void
}

interface BankProvider {
  _id: string
  name: string
}

interface CustomMethod {
  _id: string
  name: string
  type: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatProductName(p: Product): string {
  return [p.category, p.brand, p.variant, p.productName].filter(Boolean).join(' › ')
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExchangeModal({ open, onOpenChange, sale, onSuccess }: ExchangeModalProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [enrichedSaleItems, setEnrichedSaleItems] = useState<Array<SaleItem & { productDetails?: Product }>>([])
  const [loading, setLoading] = useState(false)

  // Returning basket
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])
  const [searchReturn, setSearchReturn] = useState('')
  const [showReturnPicker, setShowReturnPicker] = useState(true)

  // New items basket
  const [newLines, setNewLines] = useState<NewLine[]>([])
  const [searchNew, setSearchNew] = useState('')
  const [showNewPicker, setShowNewPicker] = useState(false)
  // Price override editor — one at a time, tracked outside the line objects
  // so the committed value is always the latest keystroke (no stale closure)
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState('')

  // Reason / notes / payment
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [selectedBankId, setSelectedBankId] = useState('')
  const [selectedCustomMethodId, setSelectedCustomMethodId] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [bankProviders, setBankProviders] = useState<BankProvider[]>([])
  const [customMethods, setCustomMethods] = useState<CustomMethod[]>([])

  // Eagerly load from IndexedDB on first mount so methods are available
  // immediately when the modal first opens (before any fetch completes)
  useEffect(() => {
    getCachedBankProviders().then(cached => { if (cached.length > 0) setBankProviders(cached) }).catch(() => {})
    getCachedPaymentMethods().then(cached => { if (cached.length > 0) setCustomMethods(cached) }).catch(() => {})
  }, [])
  const [submitting, setSubmitting] = useState(false)

  // ── Load products on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (open && sale) {
      loadProducts()
      loadPaymentMethods()
    }
  }, [open])

  async function loadProducts() {
    setLoading(true)
    try {
      const res = await fetch('/api/products')
      if (res.ok) {
        const data = await res.json()
        const prods: Product[] = data.products || []
        setAllProducts(prods)
        setEnrichedSaleItems(
          sale!.items.map(item => ({
            ...item,
            productDetails: prods.find(p => p._id === item.productId),
          }))
        )
      }
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  async function loadPaymentMethods() {
    // Server refresh — cache already populated eagerly on mount
    try {
      const res = await fetch('/api/bank-providers')
      if (res.ok) {
        const data = await res.json()
        const providers = data.providers || []
        setBankProviders(providers)
        await cacheBankProviders(providers).catch(() => {})
      }
    } catch {}
    try {
      const res = await fetch('/api/payment-methods')
      if (res.ok) {
        const data = await res.json()
        const methods = data.methods || []
        setCustomMethods(methods)
        await cachePaymentMethods(methods).catch(() => {})
      }
    } catch {}
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function handleReset() {
    setReturnLines([])
    setNewLines([])
    setSearchReturn('')
    setSearchNew('')
    setShowReturnPicker(true)
    setShowNewPicker(false)
    setReason('')
    setNotes('')
    setPaymentMethod('cash')
    setSelectedBankId('')
    setSelectedCustomMethodId('')
    setMpesaPhone('')
    setMpesaCode('')
    setEditingLineId(null)
    setEditingPriceValue('')
  }

  // ── Return basket operations ───────────────────────────────────────────────

  // Items already added to the return basket (by productId)
  const returnedProductIds = new Set(returnLines.map(l => l.saleItem.productId))

  function addReturnLine(item: SaleItem & { productDetails?: Product }) {
    setReturnLines(prev => [
      ...prev,
      {
        id: uid(),
        saleItem: item,
        productDetails: item.productDetails,
        quantity: 1,
      },
    ])
    setSearchReturn('')
    setShowReturnPicker(false)
  }

  function removeReturnLine(lineId: string) {
    setReturnLines(prev => prev.filter(l => l.id !== lineId))
  }

  function updateReturnQty(lineId: string, qty: number) {
    setReturnLines(prev =>
      prev.map(l => {
        if (l.id !== lineId) return l
        return { ...l, quantity: Math.max(1, Math.min(qty, l.saleItem.quantity)) }
      })
    )
  }

  // ── New items basket operations ────────────────────────────────────────────

  function addNewLine(product: Product) {
    setNewLines(prev => [
      ...prev,
      {
        id: uid(),
        product,
        quantity: 1,
        discount: 0,
        overridePrice: null,
      },
    ])
    setSearchNew('')
    setShowNewPicker(false)
  }

  function removeNewLine(lineId: string) {
    setNewLines(prev => prev.filter(l => l.id !== lineId))
  }

  function updateNewQty(lineId: string, qty: number) {
    setNewLines(prev =>
      prev.map(l =>
        l.id === lineId
          ? { ...l, quantity: Math.max(1, Math.min(qty, l.product.stock)) }
          : l
      )
    )
  }

  function updateNewDiscount(lineId: string, discount: number) {
    setNewLines(prev =>
      prev.map(l => (l.id === lineId ? { ...l, discount: Math.max(0, discount) } : l))
    )
  }

  function openPriceEditor(lineId: string) {
    const line = newLines.find(l => l.id === lineId)
    if (!line) return
    setEditingLineId(lineId)
    setEditingPriceValue(String(line.overridePrice ?? line.product.sellingPrice))
  }

  function commitPriceOverride() {
    if (!editingLineId) return
    const parsed = parseFloat(editingPriceValue)
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Invalid price')
      return
    }
    setNewLines(prev =>
      prev.map(l => l.id === editingLineId ? { ...l, overridePrice: parsed } : l)
    )
    setEditingLineId(null)
    setEditingPriceValue('')
  }

  function clearPriceOverride(lineId: string) {
    setNewLines(prev =>
      prev.map(l => l.id === lineId ? { ...l, overridePrice: null } : l)
    )
    if (editingLineId === lineId) {
      setEditingLineId(null)
      setEditingPriceValue('')
    }
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  function effectivePrice(line: NewLine): number {
    const base = line.overridePrice !== null ? line.overridePrice : line.product.sellingPrice
    return Math.max(0, base - line.discount)
  }

  const totalReturnedValue = returnLines.reduce(
    (sum, l) => sum + l.quantity * l.saleItem.price, 0
  )
  const totalNewValue = newLines.reduce(
    (sum, l) => sum + l.quantity * effectivePrice(l), 0
  )
  const priceDifference = Math.round((totalNewValue - totalReturnedValue) * 100) / 100

  // ── Filtered lists for pickers ────────────────────────────────────────────

  const filteredReturnItems = enrichedSaleItems.filter(item => {
    if (returnedProductIds.has(item.productId)) return false  // already added
    if (!searchReturn.trim()) return true
    const q = searchReturn.toLowerCase()
    return (
      item.productName.toLowerCase().includes(q) ||
      item.productDetails?.brand?.toLowerCase().includes(q) ||
      item.productDetails?.variant?.toLowerCase().includes(q)
    )
  })

  const filteredNewProducts = searchNew.trim()
    ? allProducts.filter(p => {
        const q = searchNew.toLowerCase()
        return (
          p.productName.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.variant?.toLowerCase().includes(q)
        )
      })
    : []

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!sale) return

    if (returnLines.length === 0) {
      toast.error('Add at least one item to return')
      return
    }
    if (newLines.length === 0) {
      toast.error('Add at least one new item')
      return
    }
    // Payment method completeness checks (only when customer pays extra)
    if (priceDifference > 0) {
      if (paymentMethod === 'bank' && !selectedBankId) {
        toast.error('Please select a bank provider')
        return
      }
      if (paymentMethod === 'custom' && !selectedCustomMethodId) {
        toast.error('Please select a payment method')
        return
      }
    }
    // Stock check (UI-side guard; server re-validates)
    for (const l of newLines) {
      if (l.quantity > l.product.stock) {
        toast.error(`Insufficient stock for ${l.product.productName}. Available: ${l.product.stock}`)
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/sales/${sale._id}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnedItems: returnLines.map(l => ({
            productId: l.saleItem.productId || '',
            productName: l.productDetails ? formatProductName(l.productDetails) : l.saleItem.productName,
            quantity: l.quantity,
            price: l.saleItem.price,
          })),
          newItems: newLines.map(l => ({
            productId: l.product._id,
            productName: formatProductName(l.product),
            quantity: l.quantity,
            price: l.product.sellingPrice,
            overridePrice: l.overridePrice,
            discount: l.discount,
          })),
          reason: reason.trim(),
          notes: notes.trim(),
          paymentMethod,
          ...(paymentMethod === 'bank' && selectedBankId ? {
            bankProviderId: selectedBankId,
            bankProviderName: bankProviders.find(b => b._id === selectedBankId)?.name || '',
          } : {}),
          ...(paymentMethod === 'custom' && selectedCustomMethodId ? {
            customMethodId: selectedCustomMethodId,
            customMethodName: customMethods.find(m => m._id === selectedCustomMethodId)?.name || '',
          } : {}),
          ...((paymentMethod === 'mpesa_stk' || paymentMethod === 'mpesa_manual') ? {
            mpesaPhone,
            mpesaCode,
          } : {}),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const diff = data.exchange?.priceDifference ?? priceDifference
        let msg = `Exchange submitted for ${sale.orderNumber}`
        if (diff > 0) msg += ` • Customer pays KES ${Math.abs(diff).toLocaleString()}`
        else if (diff < 0) msg += ` • Customer receives credit KES ${Math.abs(diff).toLocaleString()}`
        else msg += ' • 1:1 swap'
        toast.success(msg)
        handleReset()
        onOpenChange(false)
        onSuccess()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to process exchange')
      }
    } catch {
      toast.error('Error processing exchange')
    } finally {
      setSubmitting(false)
    }
  }

  if (!sale) return null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleReset(); onOpenChange(isOpen) }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft size={20} />
            Process Exchange
          </DialogTitle>
          <DialogDescription>
            Sale #{sale.orderNumber} • {new Date(sale.createdAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading products…</div>
        ) : (
          <div className="space-y-6">

            {/* ── RETURNING SECTION ─────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Items Being Returned</Label>
                {returnLines.length > 0 && !showReturnPicker && (
                  <button
                    type="button"
                    onClick={() => setShowReturnPicker(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus size={13} /> Add another
                  </button>
                )}
              </div>

              {/* Added return lines */}
              {returnLines.length > 0 && (
                <div className="space-y-2 mb-3">
                  {returnLines.map(line => {
                    const displayName = line.productDetails
                      ? formatProductName(line.productDetails)
                      : line.saleItem.productName
                    return (
                      <div key={line.id} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            Sold: {line.saleItem.quantity} • KES {line.saleItem.price.toLocaleString()} each
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Label className="text-xs text-muted-foreground">Qty</Label>
                          <Input
                            type="number"
                            min={1}
                            max={line.saleItem.quantity}
                            value={line.quantity}
                            onChange={e => updateReturnQty(line.id, parseInt(e.target.value) || 1)}
                            className="w-16 h-7 text-center text-xs p-1"
                          />
                        </div>
                        <p className="text-xs font-semibold text-blue-700 shrink-0 w-20 text-right">
                          KES {(line.quantity * line.saleItem.price).toLocaleString()}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeReturnLine(line.id)}
                          className="text-muted-foreground hover:text-red-500 shrink-0"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Return item picker */}
              {(showReturnPicker || returnLines.length === 0) && (
                <div className="space-y-2">
                  <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden">
                    <Search className="h-4 w-4 ml-3 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={searchReturn}
                      onChange={e => setSearchReturn(e.target.value)}
                      placeholder="Search items from this sale…"
                      className="flex-1 px-3 py-2 text-sm focus:outline-none"
                      autoFocus={returnLines.length === 0}
                    />
                    {returnLines.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setShowReturnPicker(false); setSearchReturn('') }}
                        className="px-2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {filteredReturnItems.length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {filteredReturnItems.map((item, idx) => {
                        const displayName = item.productDetails
                          ? formatProductName(item.productDetails)
                          : item.productName
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => addReturnLine(item)}
                            className="w-full text-left px-3 py-2 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          >
                            <p className="text-sm font-medium">{displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity} • KES {item.price.toLocaleString()}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">
                      {enrichedSaleItems.length === returnLines.length
                        ? 'All items from this sale have been added.'
                        : 'No items match your search.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <ArrowRightLeft className="h-5 w-5 text-gray-300 rotate-90" />
            </div>

            {/* ── NEW ITEMS SECTION ──────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">New Items Going Out</Label>
                {newLines.length > 0 && !showNewPicker && (
                  <button
                    type="button"
                    onClick={() => setShowNewPicker(true)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    <Plus size={13} /> Add another
                  </button>
                )}
              </div>

              {/* Added new lines */}
              {newLines.length > 0 && (
                <div className="space-y-3 mb-3">
                  {newLines.map(line => {
                    const ep = effectivePrice(line)
                    const catalogPrice = line.product.sellingPrice
                    const hasOverride = line.overridePrice !== null
                    const isEditing = editingLineId === line.id
                    return (
                      <div key={line.id} className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{formatProductName(line.product)}</p>
                            <p className="text-xs text-muted-foreground">Stock: {line.product.stock}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeNewLine(line.id)}
                            className="text-muted-foreground hover:text-red-500 shrink-0 mt-0.5"
                          >
                            <X size={15} />
                          </button>
                        </div>

                        {/* Controls row */}
                        <div className="flex flex-wrap items-end gap-3">
                          {/* Quantity */}
                          <div>
                            <Label className="text-xs text-muted-foreground block mb-1">Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              max={line.product.stock}
                              value={line.quantity}
                              onChange={e => updateNewQty(line.id, parseInt(e.target.value) || 1)}
                              className="w-16 h-7 text-center text-xs p-1"
                            />
                          </div>

                          {/* Price — override or catalog */}
                          <div>
                            <Label className="text-xs text-muted-foreground block mb-1">
                              Unit Price
                              {hasOverride && (
                                <span className="ml-1 text-orange-600 font-semibold">(overridden)</span>
                              )}
                            </Label>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  value={editingPriceValue}
                                  onChange={e => setEditingPriceValue(e.target.value)}
                                  className="w-24 h-7 text-xs p-1"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') commitPriceOverride()
                                    if (e.key === 'Escape') { setEditingLineId(null); setEditingPriceValue('') }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={commitPriceOverride}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingLineId(null); setEditingPriceValue('') }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">
                                  KES {(hasOverride ? line.overridePrice! : catalogPrice).toLocaleString()}
                                </span>
                                {hasOverride && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {catalogPrice.toLocaleString()}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openPriceEditor(line.id)}
                                  className="text-muted-foreground hover:text-blue-600"
                                  title="Override price"
                                >
                                  <Pencil size={12} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Discount */}
                          <div>
                            <Label className="text-xs text-muted-foreground block mb-1">Discount (KES)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={line.discount || ''}
                              onChange={e => updateNewDiscount(line.id, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="w-20 h-7 text-xs p-1"
                            />
                          </div>

                          {/* Line total */}
                          <div className="ml-auto text-right">
                            <Label className="text-xs text-muted-foreground block mb-1">Line Total</Label>
                            <p className="text-sm font-semibold text-green-700">
                              KES {(line.quantity * ep).toLocaleString()}
                            </p>
                            {(hasOverride || line.discount > 0) && (
                              <p className="text-xs text-muted-foreground">
                                @ KES {ep.toLocaleString()} each
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* New product picker */}
              {(showNewPicker || newLines.length === 0) && (
                <div className="space-y-2">
                  <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden">
                    <Search className="h-4 w-4 ml-3 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={searchNew}
                      onChange={e => setSearchNew(e.target.value)}
                      placeholder="Search products by name, brand, category…"
                      className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    />
                    {newLines.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setShowNewPicker(false); setSearchNew('') }}
                        className="px-2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {filteredNewProducts.length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {filteredNewProducts.slice(0, 10).map(product => (
                        <button
                          key={product._id}
                          type="button"
                          onClick={() => addNewLine(product)}
                          disabled={product.stock === 0}
                          className={`w-full text-left px-3 py-2 border rounded transition-colors ${
                            product.stock === 0
                              ? 'opacity-50 cursor-not-allowed bg-gray-50'
                              : 'hover:bg-green-50 hover:border-green-300'
                          }`}
                        >
                          <p className="text-sm font-medium">{formatProductName(product)}</p>
                          <p className={`text-xs ${product.stock > 0 ? 'text-muted-foreground' : 'text-red-600'}`}>
                            Stock: {product.stock} • KES {product.sellingPrice.toLocaleString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : searchNew.trim() ? (
                    <p className="text-xs text-muted-foreground px-1">No products match your search.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">Start typing to search inventory.</p>
                  )}
                </div>
              )}
            </div>

            {/* ── EXCHANGE SUMMARY ───────────────────────────────────────── */}
            {returnLines.length > 0 && newLines.length > 0 && (
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold mb-1">Exchange Summary</p>

                <div className="space-y-0.5">
                  {returnLines.map(l => (
                    <div key={l.id} className="flex justify-between text-muted-foreground">
                      <span>↩ {l.productDetails ? formatProductName(l.productDetails) : l.saleItem.productName} ×{l.quantity}</span>
                      <span>KES {(l.quantity * l.saleItem.price).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium pt-0.5">
                    <span>Return value</span>
                    <span>KES {totalReturnedValue.toLocaleString()}</span>
                  </div>
                </div>

                <div className="border-t my-1" />

                <div className="space-y-0.5">
                  {newLines.map(l => (
                    <div key={l.id} className="flex justify-between text-muted-foreground">
                      <span>↪ {l.product.productName} ×{l.quantity}</span>
                      <span>KES {(l.quantity * effectivePrice(l)).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium pt-0.5">
                    <span>New value</span>
                    <span>KES {totalNewValue.toLocaleString()}</span>
                  </div>
                </div>

                <div className="border-t my-1" />

                <div className={`flex justify-between font-semibold text-base ${
                  priceDifference > 0 ? 'text-orange-600' :
                  priceDifference < 0 ? 'text-green-600' :
                  'text-gray-600'
                }`}>
                  <span>
                    {priceDifference > 0 ? 'Customer pays extra' :
                     priceDifference < 0 ? 'Customer receives credit' :
                     'Net difference'}
                  </span>
                  <span>
                    {priceDifference === 0
                      ? 'KES 0 (1:1 swap)'
                      : `KES ${Math.abs(priceDifference).toLocaleString()}`}
                  </span>
                </div>
              </div>
            )}

            {/* ── PAYMENT METHOD (only when customer pays extra) ─────────── */}
            {priceDifference > 0 && returnLines.length > 0 && newLines.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium block">
                  Customer pays KES {priceDifference.toLocaleString()} via
                </Label>

                {/* Method buttons — same grid as payment page */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'Cash', icon: <Banknote className="w-5 h-5 mb-0.5" /> },
                    { id: 'mpesa_stk', label: 'M-Pesa STK', icon: <Smartphone className="w-5 h-5 mb-0.5" /> },
                    { id: 'mpesa_manual', label: 'M-Pesa Code', icon: <Smartphone className="w-5 h-5 mb-0.5" /> },
                    { id: 'card', label: 'Card', icon: <CreditCard className="w-5 h-5 mb-0.5" /> },
                    { id: 'bank', label: 'Bank', icon: <Building2 className="w-5 h-5 mb-0.5" /> },
                    { id: 'credit', label: 'Credit', icon: <Wallet className="w-5 h-5 mb-0.5" /> },
                    ...customMethods.map(m => ({
                      id: `custom:${m._id}`,
                      label: m.name,
                      icon: <Wallet className="w-5 h-5 mb-0.5" />,
                    })),
                  ].map(method => {
                    const isCustom = method.id.startsWith('custom:')
                    const activeId = isCustom ? `custom:${selectedCustomMethodId}` : paymentMethod
                    const isActive = activeId === method.id
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          if (isCustom) {
                            const customId = method.id.replace('custom:', '')
                            setPaymentMethod('custom')
                            setSelectedCustomMethodId(customId)
                            setSelectedBankId('')
                          } else {
                            setPaymentMethod(method.id)
                            setSelectedCustomMethodId('')
                            if (method.id !== 'bank') setSelectedBankId('')
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-medium ${
                          isActive
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-gray-50'
                        }`}
                      >
                        {method.icon}
                        {method.label}
                      </button>
                    )
                  })}
                </div>

                {/* Bank provider selector */}
                {paymentMethod === 'bank' && (
                  bankProviders.length > 0 ? (
                    <select
                      value={selectedBankId}
                      onChange={e => setSelectedBankId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select bank provider…</option>
                      {bankProviders.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      No bank providers configured. Add one in Settings → Payment.
                    </p>
                  )
                )}

                {/* M-Pesa fields */}
                {(paymentMethod === 'mpesa_manual' || paymentMethod === 'mpesa_stk') && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone (optional)</Label>
                      <Input
                        value={mpesaPhone}
                        onChange={e => setMpesaPhone(e.target.value)}
                        placeholder="e.g. 0712345678"
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">M-Pesa Code (optional)</Label>
                      <Input
                        value={mpesaCode}
                        onChange={e => setMpesaCode(e.target.value)}
                        placeholder="e.g. QHX1234ABC"
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── REASON & NOTES ─────────────────────────────────────────── */}
            <div>
              <Label htmlFor="ex-reason">Exchange Reason (Optional)</Label>
              <Input
                id="ex-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., Customer preferred different item, wrong size, etc."
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ex-notes">Additional Notes (Optional)</Label>
              <Textarea
                id="ex-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional context about this exchange…"
                rows={2}
                className="mt-1"
              />
            </div>

            {/* ── ACTIONS ───────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => { handleReset(); onOpenChange(false) }}
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                className="flex-1"
                disabled={
                  submitting ||
                  returnLines.length === 0 ||
                  newLines.length === 0 ||
                  (priceDifference > 0 && paymentMethod === 'bank' && !selectedBankId) ||
                  (priceDifference > 0 && paymentMethod === 'custom' && !selectedCustomMethodId)
                }
              >
                {submitting ? 'Submitting…' : 'Process Exchange'}
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
