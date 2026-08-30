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
import { Plus, Trash2, Package, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { QuickAddSupplierDialog } from '@/components/suppliers/quick-add-supplier-dialog'

interface Supplier {
  _id: string
  name: string
}

interface Product {
  _id: string
  productName: string
  brand?: string
  variant?: string
}

interface StockInItem {
  productId: string
  productName: string
  quantity: number
  unitCost: number
}

interface StockInModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function StockInModal({ open, onOpenChange, onSuccess }: StockInModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<StockInItem[]>([
    { productId: '', productName: '', quantity: 0, unitCost: 0 }
  ])
  const [productOpenStates, setProductOpenStates] = useState<Record<number, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (open) {
      fetchInitialData()
    } else {
      // Reset form when closed
      setSupplierId('')
      setSupplierOpen(false)
      setReference('')
      setNotes('')
      setItems([{ productId: '', productName: '', quantity: 0, unitCost: 0 }])
      setProductOpenStates({})
    }
  }, [open])

  async function fetchInitialData() {
    try {
      setLoadingData(true)
      const [suppliersRes, productsRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/products')
      ])

      if (suppliersRes.ok) {
        const data = await suppliersRes.json()
        setSuppliers(data.suppliers || [])
      }

      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      toast.error('Failed to load data')
      console.error(error)
    } finally {
      setLoadingData(false)
    }
  }

  function addItem() {
    setItems([...items, { productId: '', productName: '', quantity: 0, unitCost: 0 }])
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      toast.error('At least one item is required')
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof StockInItem, value: any) {
    const updated = [...items]
    
    if (field === 'productId') {
      const product = products.find(p => p._id === value)
      if (product) {
        updated[index].productId = value
        updated[index].productName = formatProductName(product)
      }
    } else {
      updated[index][field] = value
    }
    
    setItems(updated)
  }

  function formatProductName(product: Product) {
    return [product.variant, product.brand, product.productName].filter(Boolean).join(' ')
  }

  function handleQuickAddSupplierSuccess(newSupplier: { _id: string; name: string }) {
    // Add to suppliers list
    setSuppliers(prev => [...prev, newSupplier])
    // Auto-select the new supplier
    setSupplierId(newSupplier._id)
  }

  function calculateTotal() {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)
  }

  async function handleSubmit() {
    // Validation
    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }

    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.unitCost > 0)
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/inventory/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          reference,
          notes,
          items: validItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Stock received: ${data.itemCount} items from ${data.supplier}`)
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
            {/* Supplier Selection */}
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <div className="flex gap-2">
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierOpen}
                      className="flex-1 justify-between"
                      type="button"
                    >
                      {supplierId
                        ? suppliers.find((s) => s._id === supplierId)?.name || 'Select supplier...'
                        : 'Select supplier...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search suppliers..." />
                      <CommandList>
                        <CommandEmpty>
                          {suppliers.length === 0 
                            ? 'No suppliers available. Add a supplier first.'
                            : 'No supplier found.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {suppliers.map((supplier) => (
                            <CommandItem
                              key={supplier._id}
                              value={supplier.name}
                              onSelect={() => {
                                setSupplierId(supplier._id)
                                setSupplierOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  supplierId === supplier._id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {supplier.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuickAddSupplierOpen(true)}
                  title="Add new supplier"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {/* Reference */}
            <div>
              <Label htmlFor="reference">Reference / Invoice No.</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="INV-2024-001"
              />
            </div>

            {/* Products */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Products *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus size={16} className="mr-2" />
                  Add Product
                </Button>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground mb-1">Product</Label>
                      )}
                      <Popover
                        open={productOpenStates[index] || false}
                        onOpenChange={(open) => setProductOpenStates(prev => ({ ...prev, [index]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={productOpenStates[index] || false}
                            className="w-full justify-between"
                            type="button"
                          >
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
                                {products.map((product) => (
                                  <CommandItem
                                    key={product._id}
                                    value={formatProductName(product)}
                                    onSelect={() => {
                                      updateItem(index, 'productId', product._id)
                                      setProductOpenStates(prev => ({ ...prev, [index]: false }))
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        item.productId === product._id ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    {formatProductName(product)}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="col-span-2">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground mb-1">Quantity</Label>
                      )}
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity || ''}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    <div className="col-span-2">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground mb-1">Unit Cost</Label>
                      )}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost || ''}
                        onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="col-span-2">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground mb-1">Total</Label>
                      )}
                      <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm font-semibold">
                        {(item.quantity * item.unitCost).toLocaleString()}
                      </div>
                    </div>

                    <div className="col-span-1">
                      {index === 0 && <div className="h-5" />}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
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
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional information..."
                rows={3}
              />
            </div>

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
                disabled={submitting || !supplierId || items.length === 0}
              >
                {submitting ? 'Receiving Stock...' : 'Receive Stock'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Quick Add Supplier Dialog */}
      <QuickAddSupplierDialog
        open={quickAddSupplierOpen}
        onOpenChange={setQuickAddSupplierOpen}
        onSuccess={handleQuickAddSupplierSuccess}
      />
    </Dialog>
  )
}
