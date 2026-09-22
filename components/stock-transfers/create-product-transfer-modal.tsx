'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Package } from 'lucide-react'
import { toast } from 'sonner'

interface Branch {
  _id: string
  name: string
  code: string
}

interface Product {
  _id: string
  productName: string
  sku: string
  sellingPrice: number
  stock: number // Current branch stock from ProductInventory
}

interface TransferItem {
  productId: string
  itemName: string
  quantitySent: number
  unitPrice: number
  availableStock: number
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

  function addItem(product: Product) {
    if (items.some(i => i.productId === product._id)) {
      toast.error('Item already added')
      return
    }

    if (product.stock <= 0) {
      toast.error('No stock available for this product')
      return
    }

    setItems([...items, {
      productId: product._id,
      itemName: product.productName,
      quantitySent: 1,
      unitPrice: product.sellingPrice,
      availableStock: product.stock,
    }])
    setSearchQuery('')
  }

  function updateItemQuantity(productId: string, quantity: number) {
    setItems(items.map(item =>
      item.productId === productId
        ? { ...item, quantitySent: Math.min(Math.max(1, quantity), item.availableStock) }
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

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toBranchId,
          items: items.map(item => ({
            productId: item.productId,
            itemName: item.itemName,
            quantitySent: item.quantitySent,
            unitPrice: item.unitPrice,
          })),
          notes,
        }),
      })

      if (response.ok) {
        toast.success('Transfer created successfully')
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

  const filteredProducts = products.filter(p =>
    p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer - Retail Products</DialogTitle>
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
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Package className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            {searchQuery && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No products found
                  </div>
                ) : (
                  filteredProducts.slice(0, 10).map(product => (
                    <button
                      key={product._id}
                      onClick={() => addItem(product)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                    >
                      <div>
                        <div className="font-medium text-sm">{product.productName}</div>
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
                {items.map(item => (
                  <div key={item.productId} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.itemName}</div>
                      <div className="text-xs text-gray-500">
                        Available: {item.availableStock} units
                      </div>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.quantitySent}
                        onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                        className="text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.productId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
              {isSubmitting ? 'Creating...' : 'Create Transfer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
