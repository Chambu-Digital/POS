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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  _id: string
  productName: string
  brand?: string
  variant?: string
  stock: number
}

interface RecordMovementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type MovementType = 'DAMAGE' | 'WASTAGE' | 'EXPIRED' | 'LOSS'

const MOVEMENT_TYPES: { value: MovementType; label: string; description: string }[] = [
  {
    value: 'DAMAGE',
    label: 'Damage',
    description: 'Product is broken, physically damaged, or defective',
  },
  {
    value: 'WASTAGE',
    label: 'Wastage',
    description: 'Product was wasted or spoiled without being sold',
  },
  {
    value: 'EXPIRED',
    label: 'Expired',
    description: 'Product has passed its expiration date',
  },
  {
    value: 'LOSS',
    label: 'Loss',
    description: 'Product is missing and cannot be accounted for',
  },
]

export function RecordMovementModal({ open, onOpenChange, onSuccess }: RecordMovementModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [type, setType] = useState<MovementType>('DAMAGE')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (open) {
      fetchProducts()
    } else {
      // Reset form when closed
      setType('DAMAGE')
      setProductId('')
      setQuantity(1)
      setReason('')
      setNotes('')
    }
  }, [open])

  async function fetchProducts() {
    try {
      setLoadingData(true)
      const response = await fetch('/api/products')

      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      toast.error('Failed to load products')
      console.error(error)
    } finally {
      setLoadingData(false)
    }
  }

  function formatProductName(product: Product) {
    const name = [product.variant, product.brand, product.productName].filter(Boolean).join(' ')
    return `${name} (Stock: ${product.stock})`
  }

  function getSelectedProduct(): Product | undefined {
    return products.find(p => p._id === productId)
  }

  function getMovementDescription(): string {
    const movement = MOVEMENT_TYPES.find(m => m.value === type)
    return movement?.description || ''
  }

  async function handleSubmit() {
    // Validation
    if (!type) {
      toast.error('Please select a movement type')
      return
    }

    if (!productId) {
      toast.error('Please select a product')
      return
    }

    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for this movement')
      return
    }

    const selectedProduct = getSelectedProduct()
    if (!selectedProduct) {
      toast.error('Selected product not found')
      return
    }

    if (quantity > selectedProduct.stock) {
      toast.error(`Insufficient stock. Available: ${selectedProduct.stock}`)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          productId,
          quantity,
          reason: reason.trim(),
          notes: notes.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Movement recorded: ${data.movement.type} - ${data.movement.productName}`)
        onOpenChange(false)
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to record movement')
      }
    } catch (error) {
      toast.error('Error recording movement')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle size={20} />
            Record Stock Movement
          </DialogTitle>
          <DialogDescription>
            Record manual stock movements for damage, wastage, expiration, or loss
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Movement Type */}
            <div>
              <Label htmlFor="type">Movement Type *</Label>
              <Select value={type} onValueChange={(value) => setType(value as MovementType)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select movement type" />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map((movementType) => (
                    <SelectItem key={movementType.value} value={movementType.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{movementType.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {movementType.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {type && (
                <p className="text-sm text-muted-foreground mt-1">
                  {getMovementDescription()}
                </p>
              )}
            </div>

            {/* Product Selection */}
            <div>
              <Label htmlFor="product">Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No products available
                    </div>
                  ) : (
                    products.map((product) => (
                      <SelectItem key={product._id} value={product._id}>
                        {formatProductName(product)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {productId && getSelectedProduct() && (
                <p className="text-sm text-muted-foreground mt-1">
                  Current stock: <span className="font-semibold">{getSelectedProduct()?.stock}</span>
                </p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={getSelectedProduct()?.stock || 999999}
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                placeholder="Enter quantity"
              />
              {productId && quantity > 0 && getSelectedProduct() && (
                <p className="text-sm text-muted-foreground mt-1">
                  Remaining stock after movement:{' '}
                  <span className="font-semibold">
                    {Math.max(0, getSelectedProduct()!.stock - quantity)}
                  </span>
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  type === 'DAMAGE' ? 'e.g., Screen damaged during handling' :
                  type === 'WASTAGE' ? 'e.g., Spoiled during storage' :
                  type === 'EXPIRED' ? 'e.g., Past expiration date' :
                  'e.g., Missing after inventory check'
                }
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide a brief explanation for this movement
              </p>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details or context..."
                rows={3}
              />
            </div>

            {/* Summary */}
            {productId && quantity > 0 && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Movement Summary</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-semibold">{MOVEMENT_TYPES.find(m => m.value === type)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product:</span>
                    <span className="font-semibold">{getSelectedProduct()?.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-semibold text-red-600">-{quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Stock:</span>
                    <span>{getSelectedProduct()?.stock}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-muted-foreground">New Stock:</span>
                    <span className="font-bold">
                      {getSelectedProduct() ? getSelectedProduct()!.stock - quantity : 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
                disabled={submitting || !type || !productId || !quantity || !reason.trim()}
              >
                {submitting ? 'Recording Movement...' : 'Record Movement'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
