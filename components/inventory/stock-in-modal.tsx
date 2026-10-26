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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Package, Check, ChevronsUpDown, Layers, ChevronDown, ChevronUp, AlertCircle, ArrowDownToLine } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { QuickAddSupplierDialog } from '@/components/suppliers/quick-add-supplier-dialog'

interface Supplier {
  _id: string
  name: string
}

interface ProductMeta {
  _id: string
  productName: string
  brand?: string
  variant?: string
  model?: string
  trackLots?: boolean
  lotUnit?: string
}

interface LotEntry {
  label: string
  quantity: number
}

interface StockInItem {
  productId: string
  productName: string
  quantity: number
  unitCost: number
  // lot fields — only populated when the chosen product has trackLots===true
  lotsExpanded: boolean
  lots: LotEntry[]
}

interface StockInModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function StockInModal({ open, onOpenChange, onSuccess }: StockInModalProps) {
  const [suppliers, setSuppliers]           = useState<Supplier[]>([])
  const [products, setProducts]             = useState<ProductMeta[]>([])
  const [supplierId, setSupplierId]         = useState('')
  const [supplierOpen, setSupplierOpen]     = useState(false)
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false)
  // Advance linking: if supplier has outstanding prepaid receipts, user can link to one
  const [advanceReceipts, setAdvanceReceipts] = useState<Array<{ _id: string; receiptNumber: string; totalCost: number }>>([])
  const [linkedAdvanceId, setLinkedAdvanceId] = useState('')
  const [reference, setReference]           = useState('')
  const [notes, setNotes]                   = useState('')
  const [paymentStatus, setPaymentStatus]   = useState<'paid' | 'unpaid'>('paid')
  const [paymentMethod, setPaymentMethod]   = useState('cash')
  const [selectedBankId, setSelectedBankId]   = useState('')
  const [selectedCustomMethodId, setSelectedCustomMethodId] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [bankProviders, setBankProviders]   = useState<Array<{ _id: string; name: string }>>([])
  const [customMethods, setCustomMethods]   = useState<Array<{ _id: string; name: string }>>([])
  const [items, setItems]                   = useState<StockInItem[]>([
    { productId: '', productName: '', quantity: 0, unitCost: 0, lotsExpanded: false, lots: [] },
  ])
  const [productOpenStates, setProductOpenStates] = useState<Record<number, boolean>>({})
  const [submitting, setSubmitting]         = useState(false)
  const [loadingData, setLoadingData]       = useState(true)

  useEffect(() => {
    if (open) {
      fetchInitialData()
    } else {
      setSupplierId('')
      setSupplierOpen(false)
      setAdvanceReceipts([])
      setLinkedAdvanceId('')
      setReference('')
      setNotes('')
      setPaymentStatus('paid')
      setPaymentMethod('cash')
      setSelectedBankId('')
      setSelectedCustomMethodId('')
      setPaymentReference('')
      setItems([{ productId: '', productName: '', quantity: 0, unitCost: 0, lotsExpanded: false, lots: [] }])
      setProductOpenStates({})
    }
  }, [open])

  async function fetchInitialData() {
    try {
      setLoadingData(true)
      const [suppliersRes, productsRes, bankRes, customRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/products'),
        fetch('/api/bank-providers'),
        fetch('/api/payment-methods'),
      ])
      if (suppliersRes.ok) {
        const d = await suppliersRes.json()
        setSuppliers(d.suppliers || [])
      }
      if (productsRes.ok) {
        const d = await productsRes.json()
        setProducts(d.products || [])
      }
      if (bankRes.ok) {
        const d = await bankRes.json()
        setBankProviders(d.providers || [])
      }
      if (customRes.ok) {
        const d = await customRes.json()
        setCustomMethods(d.methods || [])
      }
    } catch (error) {
      toast.error('Failed to load data')
      console.error(error)
    } finally {
      setLoadingData(false)
    }
  }

  function formatProductName(p: ProductMeta) {
    return [p.brand, p.variant, p.model, p.productName].filter(Boolean).join(' › ')
  }

  function getProduct(id: string): ProductMeta | undefined {
    return products.find(p => p._id === id)
  }

  // ── Lot helpers ────────────────────────────────────────────────────────────

  /** Auto-generate N lot entries with default labels from a total quantity. */
  function autoGenerateLots(item: StockInItem): LotEntry[] {
    if (item.quantity <= 0) return []
    // Default: one lot covering the whole quantity
    return [{ label: 'Lot 1', quantity: item.quantity }]
  }

  function addLotRow(itemIndex: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item
      const next = item.lots.length + 1
      return { ...item, lots: [...item.lots, { label: `Lot ${next}`, quantity: 0 }] }
    }))
  }

  function removeLotRow(itemIndex: number, lotIndex: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item
      return { ...item, lots: item.lots.filter((_, li) => li !== lotIndex) }
    }))
  }

  function updateLot(itemIndex: number, lotIndex: number, field: keyof LotEntry, value: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item
      return {
        ...item,
        lots: item.lots.map((lot, li) =>
          li === lotIndex ? { ...lot, [field]: value } : lot
        ),
      }
    }))
  }

  function toggleLotsExpanded(itemIndex: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIndex) return item
      const willExpand = !item.lotsExpanded
      // When expanding for the first time with no lots defined, auto-seed one row
      const lots = willExpand && item.lots.length === 0
        ? autoGenerateLots(item)
        : item.lots
      return { ...item, lotsExpanded: willExpand, lots }
    }))
  }

  function lotsTotal(lots: LotEntry[]): number {
    return lots.reduce((s, l) => s + (Number(l.quantity) || 0), 0)
  }

  // ── Item helpers ───────────────────────────────────────────────────────────

  function addItem() {
    setItems(prev => [
      ...prev,
      { productId: '', productName: '', quantity: 0, unitCost: 0, lotsExpanded: false, lots: [] },
    ])
  }

  function removeItem(index: number) {
    if (items.length === 1) { toast.error('At least one item is required'); return }
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof StockInItem, value: any) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      if (field === 'productId') {
        const product = products.find(p => p._id === value)
        if (!product) return item
        return {
          ...item,
          productId:   value,
          productName: formatProductName(product),
          // reset lots whenever product changes
          lots:         [],
          // Auto-expand the lot section for lot-tracked products so it
          // can't be missed — staff don't have to know to click a toggle
          lotsExpanded: product.trackLots === true,
        }
      }
      if (field === 'quantity') {
        // When quantity changes and lots are already defined, sync the first
        // lot's quantity to the new total if there's only one lot
        const updated = { ...item, quantity: value }
        if (updated.lots.length === 1) {
          updated.lots = [{ ...updated.lots[0], quantity: value }]
        }
        return updated
      }
      return { ...item, [field]: value }
    }))
  }

  function handleQuickAddSupplierSuccess(newSupplier: { _id: string; name: string }) {
    setSuppliers(prev => [...prev, newSupplier])
    setSupplierId(newSupplier._id)
    fetchAdvancesForSupplier(newSupplier._id)
  }

  async function fetchAdvancesForSupplier(id: string) {
    if (!id) { setAdvanceReceipts([]); return }
    try {
      const res = await fetch(`/api/stock-receipts?status=prepaid&supplierId=${id}`)
      if (res.ok) {
        const data = await res.json()
        setAdvanceReceipts(data.receipts || [])
      }
    } catch { /* silently fail */ }
  }

  function calculateTotal() {
    return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateLots(item: StockInItem): string | null {
    const product = getProduct(item.productId)
    if (!product?.trackLots) return null
    if (!item.lotsExpanded || item.lots.length === 0) return null // will auto-create one lot
    const total = lotsTotal(item.lots)
    if (total !== item.quantity) {
      return `Lot quantities sum to ${total} but received quantity is ${item.quantity}`
    }
    return null
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!supplierId) { toast.error('Please select a supplier'); return }

    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.unitCost > 0)
    if (validItems.length === 0) { toast.error('Please add at least one valid item'); return }

    for (const item of validItems) {
      const err = validateLots(item)
      if (err) { toast.error(err); return }
    }

    setSubmitting(true)
    try {
      const isCustom = paymentMethod.startsWith('custom:')
      const normalizedMethod = isCustom ? 'custom' : paymentMethod
      const resolvedCustomId = isCustom ? paymentMethod.split(':')[1] : selectedCustomMethodId
      const resolvedCustomName = resolvedCustomId
        ? customMethods.find(m => m._id === resolvedCustomId)?.name || ''
        : ''
      const resolvedBankName = selectedBankId
        ? bankProviders.find(b => b._id === selectedBankId)?.name || ''
        : ''

      const payload = {
        supplierId,
        reference,
        notes,
        paymentStatus,
        paymentMethod: paymentStatus === 'paid' ? normalizedMethod : '',
        bankProviderId: paymentStatus === 'paid' && normalizedMethod === 'bank' ? selectedBankId : '',
        bankProviderName: paymentStatus === 'paid' && normalizedMethod === 'bank' ? resolvedBankName : '',
        customMethodId: paymentStatus === 'paid' && normalizedMethod === 'custom' ? resolvedCustomId : '',
        customMethodName: paymentStatus === 'paid' && normalizedMethod === 'custom' ? resolvedCustomName : '',
        paymentReference: paymentStatus === 'paid' ? paymentReference : '',
        items: validItems.map(item => {
          const product = getProduct(item.productId)
          const base = {
            productId: item.productId,
            quantity:  item.quantity,
            unitCost:  item.unitCost,
          }
          // Only send lots array for lot-tracked products when staff defined them
          if (product?.trackLots && item.lots.length > 0) {
            return { ...base, lots: item.lots }
          }
          return base
        }),
      }

      // If linked to an advance, use the receive endpoint instead
      const endpoint = linkedAdvanceId
        ? `/api/stock-receipts/${linkedAdvanceId}/receive`
        : '/api/inventory/stock-in'

      const response = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    linkedAdvanceId
          ? JSON.stringify({
              items: validItems.map(item => ({
                productId: item.productId,
                quantity:  item.quantity,
                unitCost:  item.unitCost,
              })),
              notes,
            })
          : JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        if (linkedAdvanceId) {
          toast.success(`Goods received against advance ${data.receiptNumber}`)
        } else {
          const batchMsg = data.batchesCreated?.length
            ? ` (${data.batchesCreated.length} lot${data.batchesCreated.length !== 1 ? 's' : ''} created)`
            : ''
          const receiptMsg = data.receiptNumber ? ` · ${data.receiptNumber}` : ''
          const payMsg = data.paymentStatus === 'unpaid' ? ' · on credit' : ''
          toast.success(`Stock received: ${data.itemCount} item${data.itemCount !== 1 ? 's' : ''} from ${data.supplier}${batchMsg}${receiptMsg}${payMsg}`)
        }
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to receive stock')
      }
    } catch (error) {
      toast.error('Error receiving stock')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={20} />
            Stock In
          </DialogTitle>
          <DialogDescription>
            Receive stock from a supplier and update inventory
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-6">

            {/* Supplier */}
            <div>
              <Label>Supplier *</Label>
              <div className="flex gap-2 mt-1">
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={supplierOpen}
                      className="flex-1 justify-between" type="button">
                      {supplierId
                        ? suppliers.find(s => s._id === supplierId)?.name || 'Select supplier...'
                        : 'Select supplier...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search suppliers..." />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          {suppliers.map(s => (
                            <CommandItem key={s._id} value={s.name}
                              onSelect={() => { setSupplierId(s._id); setSupplierOpen(false); fetchAdvancesForSupplier(s._id); setLinkedAdvanceId('') }}>
                              <Check className={cn('mr-2 h-4 w-4', supplierId === s._id ? 'opacity-100' : 'opacity-0')} />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon"
                  onClick={() => setQuickAddSupplierOpen(true)} title="Add new supplier">
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {/* Advance linking — only shown when supplier has outstanding advances */}
            {advanceReceipts.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-purple-800 flex items-center gap-1.5">
                  <ArrowDownToLine size={12} />
                  This supplier has {advanceReceipts.length} outstanding advance{advanceReceipts.length !== 1 ? 's' : ''}. Apply these goods to one?
                </p>
                <select
                  value={linkedAdvanceId}
                  onChange={e => setLinkedAdvanceId(e.target.value)}
                  className="w-full h-9 px-3 border rounded-md text-sm bg-background"
                >
                  <option value="">No — create a new stock receipt</option>
                  {advanceReceipts.map(adv => (
                    <option key={adv._id} value={adv._id}>
                      {adv.receiptNumber} — KES {Math.round(adv.totalCost).toLocaleString()} advance
                    </option>
                  ))}
                </select>
                {linkedAdvanceId && (
                  <p className="text-xs text-purple-600">
                    Goods received will be linked to this advance and marked as settled.
                  </p>
                )}
              </div>
            )}

            {/* Reference */}
            <div>
              <Label htmlFor="reference">Reference / Invoice No.</Label>
              <Input id="reference" value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="INV-2024-001" className="mt-1" />
            </div>

            {/* Payment */}
            <div className="space-y-3">
              <div>
                <Label>Payment</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={paymentStatus === 'paid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentStatus('paid')}
                  >
                    Paid
                  </Button>
                  <Button
                    type="button"
                    variant={paymentStatus === 'unpaid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentStatus('unpaid')}
                  >
                    On Credit
                  </Button>
                </div>
              </div>
              {paymentStatus === 'paid' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Method</Label>
                    <select
                      value={paymentMethod}
                      onChange={e => {
                        setPaymentMethod(e.target.value)
                        setSelectedBankId('')
                        if (!e.target.value.startsWith('custom:')) setSelectedCustomMethodId('')
                      }}
                      className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background"
                    >
                      <optgroup label="Standard Methods">
                        <option value="cash">Cash</option>
                        <option value="mobile_money">M-Pesa / Mobile Money</option>
                        <option value="card">Card</option>
                        {bankProviders.length > 0 && <option value="bank">Bank Transfer</option>}
                      </optgroup>
                      {customMethods.length > 0 && (
                        <optgroup label="Custom Methods">
                          {customMethods.map(m => (
                            <option key={m._id} value={`custom:${m._id}`}>{m.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  {paymentMethod === 'bank' && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Bank</Label>
                      <select
                        value={selectedBankId}
                        onChange={e => setSelectedBankId(e.target.value)}
                        className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background"
                      >
                        <option value="">Select bank…</option>
                        {bankProviders.map(b => (
                          <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
                    <Input
                      value={paymentReference}
                      onChange={e => setPaymentReference(e.target.value)}
                      placeholder="MPESA code, receipt no."
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
              {paymentStatus === 'unpaid' && (
                <p className="text-xs text-muted-foreground">
                  Payment will be recorded later. You can settle this from the Payables section in Suppliers.
                </p>
              )}
            </div>

            {/* Grand total + payment summary */}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">Total Cost</span>
              <div className="text-right">
                <span className="text-lg font-bold">{calculateTotal().toLocaleString()}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {paymentStatus === 'paid' ? '(paid)' : '(on credit)'}
                </span>
              </div>
            </div>

            {/* Products */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Products *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus size={16} className="mr-2" />Add Product
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const product      = getProduct(item.productId)
                  const isLotProduct = product?.trackLots === true
                  const lotError     = validateLots(item)
                  const sumLots      = lotsTotal(item.lots)

                  return (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      {/* Row: product / qty / cost / total / delete */}
                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-5">
                          {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Product</Label>}
                          <Popover
                            open={productOpenStates[index] || false}
                            onOpenChange={o => setProductOpenStates(prev => ({ ...prev, [index]: o }))}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox"
                                aria-expanded={productOpenStates[index] || false}
                                className="w-full justify-between" type="button">
                                <span className="truncate">
                                  {item.productId
                                    ? formatProductName(products.find(p => p._id === item.productId)!)
                                    : 'Select product...'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search products..." />
                                <CommandList>
                                  <CommandEmpty>No product found.</CommandEmpty>
                                  <CommandGroup>
                                    {products.map(p => (
                                      <CommandItem key={p._id} value={formatProductName(p)}
                                        onSelect={() => {
                                          updateItem(index, 'productId', p._id)
                                          setProductOpenStates(prev => ({ ...prev, [index]: false }))
                                        }}>
                                        <Check className={cn('mr-2 h-4 w-4', item.productId === p._id ? 'opacity-100' : 'opacity-0')} />
                                        <span className="flex-1 truncate">{formatProductName(p)}</span>
                                        {p.trackLots && (
                                          <Layers size={12} className="ml-2 text-blue-500 shrink-0" />
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="col-span-2">
                          {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Quantity</Label>}
                          <Input type="number" min="1"
                            value={item.quantity || ''}
                            onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            onFocus={e => e.target.select()}
                            placeholder="0" />
                        </div>

                        <div className="col-span-2">
                          {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Unit Cost</Label>}
                          <Input type="number" min="0" step="0.01"
                            value={item.unitCost || ''}
                            onChange={e => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                            onFocus={e => e.target.select()}
                            placeholder="0.00" />
                        </div>

                        <div className="col-span-2">
                          {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Total</Label>}
                          <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm font-semibold">
                            {(item.quantity * item.unitCost).toLocaleString()}
                          </div>
                        </div>

                        <div className="col-span-1">
                          {index === 0 && <div className="h-5" />}
                          <Button type="button" variant="ghost" size="sm"
                            onClick={() => removeItem(index)} disabled={items.length === 1}>
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </div>
                      </div>

                      {/* Lot tracking section — only for trackLots products */}
                      {isLotProduct && item.productId && (
                        <div className="pt-2 border-t">
                          {/* Toggle button */}
                          <button
                            type="button"
                            onClick={() => toggleLotsExpanded(index)}
                            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Layers size={13} />
                            <span className="font-medium">Define individual lots</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {item.lots.length === 0
                                ? item.quantity > 0
                                  ? `1 auto-lot of ${item.quantity} ${product?.lotUnit || 'units'}`
                                  : `lot tracking enabled — enter quantity`
                                : `${item.lots.length} lot${item.lots.length !== 1 ? 's' : ''} — ${sumLots} / ${item.quantity || '?'} ${product?.lotUnit || 'units'}`}
                            </Badge>
                            {item.lotsExpanded
                              ? <ChevronUp size={13} />
                              : <ChevronDown size={13} />}
                          </button>

                          {/* Lot rows */}
                          {item.lotsExpanded && (
                            <div className="mt-3 space-y-2">
                              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
                                <span className="col-span-6">Lot label</span>
                                <span className="col-span-4">Quantity ({product?.lotUnit || 'units'})</span>
                                <span className="col-span-2" />
                              </div>

                              {item.lots.map((lot, li) => (
                                <div key={li} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-6">
                                    <Input
                                      value={lot.label}
                                      onChange={e => updateLot(index, li, 'label', e.target.value)}
                                      placeholder={`e.g. Roll ${li + 1}`}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={lot.quantity || ''}
                                      onChange={e => updateLot(index, li, 'quantity', parseFloat(e.target.value) || 0)}
                                      onFocus={e => e.target.select()}
                                      placeholder="0"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div className="col-span-2 flex justify-end">
                                    <Button type="button" variant="ghost" size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => removeLotRow(index, li)}
                                      disabled={item.lots.length === 1}>
                                      <Trash2 size={13} className="text-red-400" />
                                    </Button>
                                  </div>
                                </div>
                              ))}

                              <Button type="button" variant="outline" size="sm"
                                className="w-full h-8 text-xs border-dashed"
                                onClick={() => addLotRow(index)}>
                                <Plus size={13} className="mr-1" /> Add another lot
                              </Button>

                              {/* Validation feedback */}
                              {lotError ? (
                                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                                  <AlertCircle size={12} />
                                  {lotError}
                                </div>
                              ) : sumLots === item.quantity && item.lots.length > 0 ? (
                                <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1.5">
                                  <Check size={12} />
                                  All {item.quantity} {product?.lotUnit || 'units'} accounted for across {item.lots.length} lot{item.lots.length !== 1 ? 's' : ''}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Grand total */}
              <div className="flex justify-end items-center gap-4 pt-2 border-t">
                <span className="text-sm font-medium">Total Cost:</span>
                <span className="text-xl font-bold text-primary">
                  KSh {calculateTotal().toLocaleString()}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional information..." rows={3} className="mt-1" />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
                className="flex-1" disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit}
                className="flex-1"
                disabled={submitting || !supplierId || items.length === 0}>
                {submitting ? 'Receiving Stock...' : 'Receive Stock'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <QuickAddSupplierDialog
        open={quickAddSupplierOpen}
        onOpenChange={setQuickAddSupplierOpen}
        onSuccess={handleQuickAddSupplierSuccess}
      />
    </Dialog>
  )
}
