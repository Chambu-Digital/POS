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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AlertCircle, ArrowRightLeft, Search } from 'lucide-react'
import { toast } from 'sonner'

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

interface ExchangeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
  onSuccess: () => void
}

export function ExchangeModal({ open, onOpenChange, sale, onSuccess }: ExchangeModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [saleItemsEnriched, setSaleItemsEnriched] = useState<Array<SaleItem & { productDetails?: Product }>>([])
  const [loading, setLoading] = useState(false)
  const [searchReturnedProduct, setSearchReturnedProduct] = useState('')
  const [searchNewProduct, setSearchNewProduct] = useState('')
  const [selectedReturnedItem, setSelectedReturnedItem] = useState<SaleItem | null>(null)
  const [selectedReturnedProductData, setSelectedReturnedProductData] = useState<Product | null>(null)
  const [selectedNewProduct, setSelectedNewProduct] = useState<Product | null>(null)
  const [quantityReturned, setQuantityReturned] = useState(1)
  const [quantityReceived, setQuantityReceived] = useState(1)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash')
  const [submitting, setSubmitting] = useState(false)

  // Fetch products and enrich sale items on mount
  useEffect(() => {
    if (open) {
      fetchProductsAndEnrichSaleItems()
    }
  }, [open])

  async function fetchProductsAndEnrichSaleItems() {
    setLoading(true)
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        const allProducts = data.products || []
        setProducts(allProducts)

        // Enrich sale items with product details (brand, model, variant)
        if (sale?.items) {
          const enriched = sale.items.map(item => ({
            ...item,
            productDetails: allProducts.find(p => p._id === item.productId),
          }))
          setSaleItemsEnriched(enriched)
        }
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setSearchReturnedProduct('')
    setSearchNewProduct('')
    setSelectedReturnedItem(null)
    setSelectedReturnedProductData(null)
    setSelectedNewProduct(null)
    setQuantityReturned(1)
    setQuantityReceived(1)
    setReason('')
    setNotes('')
    setPaymentMethod('cash')
  }

  async function selectReturnedItem(item: SaleItem) {
    setSelectedReturnedItem(item)
    setQuantityReturned(1)
    setSearchReturnedProduct('')
    
    // Fetch full product details (with brand, model, variant) for returned item
    if (item.productId) {
      try {
        const response = await fetch(`/api/products/${item.productId}`)
        if (response.ok) {
          const productData = await response.json()
          setSelectedReturnedProductData(productData)
        }
      } catch (error) {
        console.error('Failed to fetch returned product details:', error)
      }
    }
  }

  function selectNewProduct(product: Product) {
    setSelectedNewProduct(product)
    setQuantityReceived(1)
    setSearchNewProduct('')
  }

  function formatProductName(product: Product): string {
    const parts = [
      product.category,
      product.brand,
      product.variant,
      product.productName,
    ].filter(Boolean)
    return parts.join(' › ')
  }

  // Filter products for search
  const filteredReturnedProducts = searchReturnedProduct
    ? saleItemsEnriched.filter(item =>
        item.productName.toLowerCase().includes(searchReturnedProduct.toLowerCase()) ||
        item.productDetails?.brand?.toLowerCase().includes(searchReturnedProduct.toLowerCase()) ||
        item.productDetails?.variant?.toLowerCase().includes(searchReturnedProduct.toLowerCase())
      )
    : saleItemsEnriched

  const filteredNewProducts = searchNewProduct.trim()
    ? products.filter(p =>
        p.productName.toLowerCase().includes(searchNewProduct.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchNewProduct.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchNewProduct.toLowerCase()) ||
        p.variant?.toLowerCase().includes(searchNewProduct.toLowerCase())
      )
    : []

  async function handleSubmit() {
    if (!sale) return

    // Validation
    if (!selectedReturnedItem) {
      toast.error('Please select an item to return')
      return
    }

    if (!selectedNewProduct) {
      toast.error('Please select a new product')
      return
    }

    if (quantityReturned <= 0) {
      toast.error('Return quantity must be greater than 0')
      return
    }

    if (quantityReceived <= 0) {
      toast.error('Receive quantity must be greater than 0')
      return
    }

    if (quantityReturned > selectedReturnedItem.quantity) {
      toast.error(`Cannot return more than ${selectedReturnedItem.quantity} items`)
      return
    }

    if (quantityReceived > selectedNewProduct.stock) {
      toast.error(`Insufficient stock. Available: ${selectedNewProduct.stock}`)
      return
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the exchange')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/sales/${sale._id}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnedProductId: selectedReturnedItem.productId || '',
          returnedProductName: selectedReturnedItem.productName,
          quantityReturned,
          returnedPrice: selectedReturnedItem.price,
          newProductId: selectedNewProduct._id,
          newProductName: selectedNewProduct.productName,
          quantityReceived,
          newPrice: selectedNewProduct.sellingPrice,
          reason: reason.trim(),
          notes: notes.trim(),
          paymentMethod,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const diff = data.exchange.priceDifference
        
        let message = `Exchange processed for ${sale.orderNumber}`
        if (diff > 0) {
          message += ` • Customer pays ${Math.abs(diff).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}`
        } else if (diff < 0) {
          message += ` • Customer receives credit ${Math.abs(diff).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}`
        } else {
          message += ' • 1:1 swap'
        }

        toast.success(message)
        handleReset()
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to process exchange')
      }
    } catch (error) {
      toast.error('Error processing exchange')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!sale) return null

  const totalReturnedValue = quantityReturned * selectedReturnedItem?.price || 0
  const totalNewValue = quantityReceived * selectedNewProduct?.sellingPrice || 0
  const priceDifference = totalNewValue - totalReturnedValue

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleReset()
      onOpenChange(isOpen)
    }}>
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

        <div className="space-y-6">
          {/* Returned Item Selection */}
          <div>
            <Label className="text-base font-semibold">Item Being Returned</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Select an item from this sale
            </p>

            {!selectedReturnedItem ? (
              <div className="space-y-2">
                <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden">
                  <Search className="h-4 w-4 ml-3 text-gray-500" />
                  <input
                    type="text"
                    value={searchReturnedProduct}
                    onChange={(e) => setSearchReturnedProduct(e.target.value)}
                    placeholder="Search products in this sale..."
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredReturnedProducts.map((item, idx) => {
                    const displayName = item.productDetails ? formatProductName(item.productDetails) : item.productName
                    return (
                      <button
                        key={idx}
                        onClick={() => selectReturnedItem(item)}
                        className="w-full text-left p-3 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} • Price: KES {item.price.toLocaleString()}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{selectedReturnedProductData ? formatProductName(selectedReturnedProductData) : selectedReturnedItem.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {selectedReturnedItem.quantity} • Price: KES {selectedReturnedItem.price.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReturnedItem(null)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Change
                  </button>
                </div>

                {/* Return Quantity */}
                <div className="mt-4 border-t border-blue-200 pt-4">
                  <Label className="text-sm">Return Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedReturnedItem.quantity}
                    value={quantityReturned}
                    onChange={(e) => setQuantityReturned(Math.min(parseInt(e.target.value) || 1, selectedReturnedItem.quantity))}
                    className="w-24 h-8 text-sm mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Arrow Indicator */}
          {selectedReturnedItem && selectedNewProduct && (
            <div className="flex justify-center">
              <ArrowRightLeft className="h-6 w-6 text-gray-400 rotate-90" />
            </div>
          )}

          {/* New Product Selection */}
          <div>
            <Label className="text-base font-semibold">New Product</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Search for a product from inventory
            </p>

            {!selectedNewProduct ? (
              <div className="space-y-2">
                <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden">
                  <Search className="h-4 w-4 ml-3 text-gray-500" />
                  <input
                    type="text"
                    value={searchNewProduct}
                    onChange={(e) => setSearchNewProduct(e.target.value)}
                    placeholder="Search products by name, brand, category..."
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredNewProducts.slice(0, 10).map((product) => (
                    <button
                      key={product._id}
                      onClick={() => selectNewProduct(product)}
                      disabled={product.stock === 0}
                      className={`w-full text-left p-3 border rounded transition-colors ${
                        product.stock === 0
                          ? 'opacity-50 cursor-not-allowed bg-gray-50'
                          : 'hover:bg-green-50 hover:border-green-300'
                      }`}
                    >
                      <p className="font-medium">{formatProductName(product)}</p>
                      <p className={`text-sm ${product.stock > 0 ? 'text-muted-foreground' : 'text-red-600'}`}>
                        Stock: {product.stock} • Price: KES {product.sellingPrice.toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{formatProductName(selectedNewProduct)}</p>
                    <p className="text-sm text-muted-foreground">
                      Stock: {selectedNewProduct.stock} • Price: KES {selectedNewProduct.sellingPrice.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedNewProduct(null)}
                    className="text-sm text-green-600 hover:text-green-700"
                  >
                    Change
                  </button>
                </div>

                {/* Receive Quantity */}
                <div className="mt-4 border-t border-green-200 pt-4">
                  <Label className="text-sm">Receive Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedNewProduct.stock}
                    value={quantityReceived}
                    onChange={(e) => setQuantityReceived(Math.min(parseInt(e.target.value) || 1, selectedNewProduct.stock))}
                    className="w-24 h-8 text-sm mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Price Difference Summary */}
          {selectedReturnedItem && selectedNewProduct && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-3">Exchange Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Returning:</span>
                  <span className="font-medium">{selectedReturnedItem.productName} (×{quantityReturned})</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Return value:</span>
                  <span>KES {totalReturnedValue.toLocaleString()}</span>
                </div>

                <div className="border-t my-2" />

                <div className="flex justify-between">
                  <span>Receiving:</span>
                  <span className="font-medium">{selectedNewProduct.productName} (×{quantityReceived})</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>New value:</span>
                  <span>KES {totalNewValue.toLocaleString()}</span>
                </div>

                <div className="border-t my-2" />

                <div className={`flex justify-between font-semibold ${
                  priceDifference > 0 ? 'text-orange-600' :
                  priceDifference < 0 ? 'text-green-600' :
                  'text-gray-600'
                }`}>
                  <span>Price difference:</span>
                  <span>
                    {priceDifference > 0 ? '+' : ''}
                    {priceDifference === 0 ? 'KES 0 (1:1 swap)' : `KES ${priceDifference.toLocaleString()}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method (if price difference > 0) */}
          {selectedReturnedItem && selectedNewProduct && priceDifference > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Customer Pays Extra Via</Label>
              <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'cash' | 'credit')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cash" id="payment-cash" />
                  <Label htmlFor="payment-cash" className="font-normal cursor-pointer">
                    Cash (collect now)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="credit" id="payment-credit" />
                  <Label htmlFor="payment-credit" className="font-normal cursor-pointer">
                    Credit (add to customer balance)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Exchange Reason *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer preferred different item, better features, etc."
              maxLength={200}
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context about this exchange..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleReset()
                onOpenChange(false)
              }}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              className="flex-1"
              disabled={submitting || !selectedReturnedItem || !selectedNewProduct || !reason.trim()}
            >
              {submitting ? 'Processing Exchange...' : 'Process Exchange'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
