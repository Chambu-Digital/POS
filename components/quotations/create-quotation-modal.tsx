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
import { Plus, Trash2, FileText, Check, ChevronsUpDown, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format } from 'date-fns'

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
}

interface Product {
  _id: string
  productName: string
  brand?: string
  variant?: string
  sellingPrice: number
  stock: number
}

interface QuotationItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

interface CreateQuotationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateQuotationModal({ open, onOpenChange, onSuccess }: CreateQuotationModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [validUntil, setValidUntil] = useState<Date>(() => {
    const date = new Date()
    date.setDate(date.getDate() + 14) // Default 14 days
    return date
  })
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState(0)
  const [items, setItems] = useState<QuotationItem[]>([
    { productId: '', productName: '', quantity: 1, unitPrice: 0 }
  ])
  const [productOpenStates, setProductOpenStates] = useState<Record<number, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (open) {
      fetchInitialData()
    } else {
      // Reset form when closed
      setCustomerId('')
      setCustomerOpen(false)
      const resetDate = new Date()
      resetDate.setDate(resetDate.getDate() + 14)
      setValidUntil(resetDate)
      setNotes('')
      setDiscount(0)
      setItems([{ productId: '', productName: '', quantity: 1, unitPrice: 0 }])
      setProductOpenStates({})
    }
  }, [open])

  async function fetchInitialData() {
    try {
      setLoadingData(true)
      const [customersRes, productsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/products')
      ])

      if (customersRes.ok) {
        const data = await customersRes.json()
        setCustomers(data.customers || [])
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
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0 }])
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      toast.error('At least one item is required')
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof QuotationItem, value: any) {
    const updated = [...items]
    
    if (field === 'productId') {
      const product = products.find(p => p._id === value)
      if (product) {
        updated[index].productId = value
        updated[index].productName = formatProductName(product)
        updated[index].unitPrice = product.sellingPrice
      }
    } else {
      updated[index][field] = value
    }
    
    setItems(updated)
  }

  function formatProductName(product: Product) {
    return [product.variant, product.brand, product.productName].filter(Boolean).join(' ')
  }

  function calculateSubtotal() {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  }

  function calculateTotal() {
    return calculateSubtotal() - discount
  }

  async function handleSubmit() {
    // Validation
    if (!customerId) {
      toast.error('Please select a customer')
      return
    }

    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.unitPrice > 0)
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item')
      return
    }

    if (!validUntil) {
      toast.error('Please select a valid until date')
      return
    }

    setSubmitting(true)
    try {
      const selectedCustomer = customers.find(c => c._id === customerId)
      
      const response = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          customerName: selectedCustomer?.name || '',
          customerPhone: selectedCustomer?.phone || '',
          customerEmail: selectedCustomer?.email || '',
          items: validItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          discount,
          validUntil: validUntil.toISOString(),
          notes,
          status: 'draft',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Quotation created: ${data.quotation.quotationNumber}`)
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to create quotation')
      }
    } catch (error) {
      toast.error('Error creating quotation')
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
            <FileText size={20} />
            Create Quotation
          </DialogTitle>
          <DialogDescription>
            Create a new quotation for a customer
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Customer Selection */}
            <div>
              <Label htmlFor="customer">Customer *</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between"
                    type="button"
                  >
                    {customerId
                      ? customers.find((c) => c._id === customerId)?.name || 'Select customer...'
                      : 'Select customer...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>
                        {customers.length === 0 
                          ? 'No customers available. Add a customer first.'
                          : 'No customer found.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer._id}
                            value={customer.name}
                            onSelect={() => {
                              setCustomerId(customer._id)
                              setCustomerOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                customerId === customer._id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div>
                              <div>{customer.name}</div>
                              {customer.phone && (
                                <div className="text-xs text-muted-foreground">{customer.phone}</div>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Valid Until Date */}
            <div>
              <Label htmlFor="validUntil">Valid Until *</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !validUntil && "text-muted-foreground"
                    )}
                    type="button"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {validUntil ? format(validUntil, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={validUntil}
                    onSelect={(date) => {
                      if (date) setValidUntil(date)
                      setCalendarOpen(false)
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
                                    <div className="flex-1">
                                      <div>{formatProductName(product)}</div>
                                      <div className="text-xs text-muted-foreground">
                                        Stock: {product.stock} | KSh {product.sellingPrice}
                                      </div>
                                    </div>
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
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                      />
                    </div>

                    <div className="col-span-2">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground mb-1">Unit Price</Label>
                      )}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="col-span-2">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground mb-1">Total</Label>
                      )}
                      <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm font-semibold">
                        {(item.quantity * item.unitPrice).toLocaleString()}
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

              {/* Totals */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Subtotal:</span>
                  <span className="text-lg font-semibold">
                    KSh {calculateSubtotal().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <Label htmlFor="discount" className="text-sm font-medium">Discount:</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-32"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-base font-bold">Total:</span>
                  <span className="text-xl font-bold text-primary">
                    KSh {calculateTotal().toLocaleString()}
                  </span>
                </div>
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
                disabled={submitting || !customerId || items.length === 0}
              >
                {submitting ? 'Creating...' : 'Create Quotation'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
