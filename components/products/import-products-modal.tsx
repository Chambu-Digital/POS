'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Package, Download, Info } from 'lucide-react'
import { toast } from 'sonner'

interface Branch {
  _id: string
  name: string
  code: string
}

interface Product {
  _id: string
  productName: string
  brand?: string
  model?: string
  variant?: string
  sku: string
  sellingPrice: number
  category: string
  sourceStock: number
}

interface ImportItem {
  productId: string
  productName: string
  brand?: string
  model?: string
  variant?: string
  sku: string
  initialQuantity: number
  selected: boolean
}

interface ImportProductsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportProductsModal({ isOpen, onClose, onSuccess }: ImportProductsModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [sourceBranchId, setSourceBranchId] = useState('')
  const [sourceBranchName, setSourceBranchName] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [importItems, setImportItems] = useState<ImportItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingBranches, setIsLoadingBranches] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchBranches()
    } else {
      setShowReview(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (sourceBranchId) {
      fetchProducts()
    } else {
      setProducts([])
      setImportItems([])
    }
  }, [sourceBranchId])

  async function fetchBranches() {
    setIsLoadingBranches(true)
    try {
      const response = await fetch('/api/branches?status=active')
      if (response.ok) {
        const data = await response.json()
        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error)
      toast.error('Failed to load branches')
    } finally {
      setIsLoadingBranches(false)
    }
  }

  async function fetchProducts() {
    setIsLoadingProducts(true)
    try {
      const response = await fetch(`/api/products/import-from-branch?sourceBranchId=${sourceBranchId}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
        setSourceBranchName(data.sourceBranch?.name || '')
        
        // Initialize import items with all products unselected
        setImportItems((data.products || []).map((p: Product) => ({
          productId:       p._id,
          productName:     p.productName,
          brand:           p.brand,
          model:           p.model,
          variant:         p.variant,
          sku:             p.sku,
          initialQuantity: 0,
          selected:        false,
        })))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to load products')
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
      toast.error('Failed to load products')
    } finally {
      setIsLoadingProducts(false)
    }
  }

  function toggleItemSelection(productId: string) {
    setImportItems(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, selected: !item.selected }
          : item
      )
    )
  }

  function updateItemQuantity(productId: string, quantity: number) {
    setImportItems(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, initialQuantity: Math.max(0, quantity) }
          : item
      )
    )
  }

  function selectAll() {
    setImportItems(items =>
      items.map(item => ({ ...item, selected: true }))
    )
  }

  function deselectAll() {
    setImportItems(items =>
      items.map(item => ({ ...item, selected: false }))
    )
  }

  async function handleSubmit() {
    const selectedItems = importItems.filter(item => item.selected)

    if (selectedItems.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    // Validate that all selected items have quantities
    const itemsWithoutQuantity = selectedItems.filter(item => item.initialQuantity <= 0)
    if (itemsWithoutQuantity.length > 0) {
      toast.error('All selected products must have a quantity greater than 0')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/products/import-from-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBranchId,
          items: selectedItems.map(item => ({
            productId: item.productId,
            initialQuantity: item.initialQuantity,
          })),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'Products imported successfully')
        setShowReview(false)
        onSuccess()
        onClose()
        // Reset form
        setSourceBranchId('')
        setProducts([])
        setImportItems([])
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to import products')
      }
    } catch (error) {
      console.error('Failed to import products:', error)
      toast.error('Failed to import products')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredItems = importItems.filter(item => {
    const q = searchQuery.toLowerCase()
    return (
      item.productName.toLowerCase().includes(q) ||
      (item.brand?.toLowerCase() || '').includes(q) ||
      (item.model?.toLowerCase() || '').includes(q) ||
      (item.variant?.toLowerCase() || '').includes(q) ||
      (item.sku?.toLowerCase() || '').includes(q)
    )
  })

  const selectedCount = importItems.filter(item => item.selected).length

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Products from Another Branch
          </DialogTitle>
          <DialogDescription>
            Select products from another branch and set initial stock quantities for your current branch. 
            This does not affect stock in the source branch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <strong>Note:</strong> This is for initial stock setup. The source branch stock will not be affected. 
              Use Stock Transfers to move existing stock between branches.
            </div>
          </div>

          {/* Source Branch Selection */}
          <div>
            <Label>Source Branch</Label>
            <Select value={sourceBranchId} onValueChange={setSourceBranchId} disabled={isLoadingBranches}>
              <SelectTrigger>
                <SelectValue placeholder="Select source branch" />
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

          {/* Loading State */}
          {isLoadingProducts && (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-8 w-8 animate-pulse mx-auto mb-2" />
              Loading products...
            </div>
          )}

          {/* Products List */}
          {!isLoadingProducts && products.length > 0 && (
            <>
              {/* Search and Selection Controls */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search by name, brand, model, variant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>

              {/* Selected Count */}
              <div className="text-sm text-gray-600">
                {selectedCount} of {importItems.length} products selected
              </div>

              {/* Products Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">
                          Select
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">
                          Reference Stock
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40">
                          Initial Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredItems.map((item) => {
                        const product = products.find(p => p._id === item.productId)
                        return (
                          <tr key={item.productId} className={item.selected ? 'bg-blue-50' : ''}>
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={() => toggleItemSelection(item.productId)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">
                                {[item.variant, item.brand, item.productName].filter(Boolean).join(' ')}
                              </div>
                              {item.model && (
                                <div className="text-xs text-gray-500">{item.model}</div>
                              )}
                              {item.sku && (
                                <div className="text-xs text-gray-400">SKU: {item.sku}</div>
                              )}
                              {product && (
                                <div className="text-xs text-gray-500">
                                  KES {product.sellingPrice.toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {product?.sourceStock || 0} units
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min="0"
                                value={item.initialQuantity || ''}
                                onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 0)}
                                disabled={!item.selected}
                                placeholder="0"
                                className="w-full"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* No Products State */}
          {!isLoadingProducts && sourceBranchId && products.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No products found in the selected branch
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const selectedItems = importItems.filter(item => item.selected)
                const itemsWithoutQuantity = selectedItems.filter(item => item.initialQuantity <= 0)
                if (itemsWithoutQuantity.length > 0) {
                  toast.error('All selected products must have a quantity greater than 0')
                  return
                }
                setShowReview(true)
              }}
              disabled={selectedCount === 0 || !sourceBranchId}
            >
              Review {selectedCount} Product{selectedCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Review Modal ─────────────────────────────────────────────────── */}
    <Dialog open={showReview} onOpenChange={(open) => {
      if (!open) setShowReview(false)
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Review Import — {sourceBranchName}
          </DialogTitle>
          <DialogDescription>
            Confirm the products and quantities to import into your branch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Review Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Price
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40">
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importItems.filter(item => item.selected).map((item) => {
                    const product = products.find(p => p._id === item.productId)
                    return (
                      <tr key={item.productId}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">
                            {[item.variant, item.brand, item.productName].filter(Boolean).join(' ')}
                          </div>
                          {item.model && (
                            <div className="text-xs text-gray-500">{item.model}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          KES {product?.sellingPrice.toLocaleString() || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="1"
                            value={item.initialQuantity || ''}
                            onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {importItems.filter(i => i.selected).length} products · {importItems.filter(i => i.selected).reduce((s, i) => s + i.initialQuantity, 0)} total units
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setShowReview(false)}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Importing...' : 'Confirm Import'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
