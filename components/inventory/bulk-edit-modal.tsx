'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Product {
  _id: string
  productName: string
  category: string
  brand?: string
  variant?: string
  model?: string
  buyingPrice: number
  sellingPrice: number
  wholeSale?: number
  barcode?: string
  stock: number
}

interface EditRow {
  id: string
  productName: string
  buyingPrice: number | string
  sellingPrice: number | string
  wholeSale: number | string
  barcode: string
}

interface BulkEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  onSuccess: () => void
}

export function BulkEditModal({ open, onOpenChange, products, onSuccess }: BulkEditModalProps) {
  const [editRows, setEditRows] = useState<EditRow[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Extract unique categories
  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map(p => p.category).filter(Boolean)))
    return ['all', ...unique.sort()]
  }, [products])

  function formatProductName(product: Product) {
    if (!product) return 'Unknown Product'
    const parts = [
      product.brand,
      product.variant,
      product.model,
      product.productName,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' › ') : 'Unknown Product'
  }

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Category filter
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase()
        const productName = product.productName?.toLowerCase() || ''
        const brand = product.brand?.toLowerCase() || ''
        const variant = product.variant?.toLowerCase() || ''
        const model = product.model?.toLowerCase() || ''
        const category = product.category?.toLowerCase() || ''

        return (
          productName.includes(searchLower) ||
          brand.includes(searchLower) ||
          variant.includes(searchLower) ||
          model.includes(searchLower) ||
          category.includes(searchLower)
        )
      }

      return true
    })
  }, [products, searchQuery, selectedCategory])

  // Initialize edit rows when modal opens or filters change
  useEffect(() => {
    if (!open) {
      setEditRows([])
      return
    }

    if (filteredProducts.length > 0) {
      setEditRows(
        filteredProducts.map((p) => ({
          id: p._id,
          productName: formatProductName(p),
          buyingPrice: p.buyingPrice ?? 0,
          sellingPrice: p.sellingPrice ?? 0,
          wholeSale: p.wholeSale ?? 0,
          barcode: p.barcode ?? '',
        }))
      )
    } else {
      setEditRows([])
    }
  }, [open, filteredProducts])  // Add formatProductName to deps if it uses external state

  function handleFieldChange(id: string, field: keyof EditRow, value: string | number) {
    setEditRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    )
  }

  // Calculate what changed
  const changes = useMemo(() => {
    const changedItems = editRows
      .map((edit) => {
        const original = filteredProducts.find(p => p._id === edit.id)
        if (!original) return null

        const changed: any = {}
        if (edit.buyingPrice !== original.buyingPrice) changed.buyingPrice = edit.buyingPrice
        if (edit.sellingPrice !== original.sellingPrice) changed.sellingPrice = edit.sellingPrice
        if (edit.wholeSale !== (original.wholeSale || 0)) changed.wholeSale = edit.wholeSale
        if (edit.barcode !== (original.barcode || '')) changed.barcode = edit.barcode

        return Object.keys(changed).length > 0
          ? { id: edit.id, productName: edit.productName, ...changed }
          : null
      })
      .filter(Boolean)

    return changedItems
  }, [editRows, filteredProducts])

  async function handleSubmit() {
    if (changes.length === 0) {
      toast.error('No changes to save')
      return
    }

    setSubmitting(true)
    try {
      const items = changes.map((change) => {
        const { id, productName, ...updates } = change
        return {
          id,
          updates: Object.keys(updates).reduce((acc: any, key) => {
            if (['buyingPrice', 'sellingPrice', 'wholeSale', 'barcode'].includes(key)) {
              acc[key] = updates[key]
            }
            return acc
          }, {}),
        }
      })

      const response = await fetch('/api/products/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to update products')
      }

      const result = await response.json()
      toast.success(result.message)
      setShowConfirm(false)
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update products')
    } finally {
      setSubmitting(false)
    }
  }

  if (showConfirm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Update</DialogTitle>
            <DialogDescription>
              Review the changes below before confirming
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {changes.map((change) => (
              <div key={change.id} className="border rounded-lg p-3 space-y-2">
                <p className="font-semibold text-sm">{formatProductName(products.find((p) => p._id === change.id) || { productName: change.productName, category: '', brand: '', variant: '' })}</p>
                <div className="text-xs space-y-1 text-muted-foreground">
                  {change.buyingPrice !== undefined && (
                    <p>
                      Buying Price: KSh {(products.find((p) => p._id === change.id)?.buyingPrice ?? 0).toLocaleString()} →{' '}
                      <span className="text-primary font-semibold">
                        KSh {Number(change.buyingPrice).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {change.sellingPrice !== undefined && (
                    <p>
                      Selling Price: KSh {(products.find((p) => p._id === change.id)?.sellingPrice ?? 0).toLocaleString()} →{' '}
                      <span className="text-primary font-semibold">
                        KSh {Number(change.sellingPrice).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {change.wholeSale !== undefined && (
                    <p>
                      Wholesale: KSh {(products.find((p) => p._id === change.id)?.wholeSale || 0).toLocaleString()} →{' '}
                      <span className="text-primary font-semibold">
                        KSh {Number(change.wholeSale).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {change.barcode !== undefined && (
                    <p>
                      Barcode: {products.find((p) => p._id === change.id)?.barcode || 'N/A'} →{' '}
                      <span className="text-primary font-semibold">{change.barcode}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are about to update {changes.length} product(s). This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Back to Edit
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Edit Products</DialogTitle>
          <DialogDescription>
            Edit prices and barcodes for multiple items. Click "Review & Save" when done.
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filter Bar */}
        <div className="flex gap-3 pb-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name, brand, variant, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
          <div className="text-sm text-muted-foreground flex items-center whitespace-nowrap">
            Showing {filteredProducts.length} of {products.length}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-semibold min-w-[200px]">Product Name</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[120px]">Buying Price</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[120px]">Selling Price</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[120px]">Wholesale</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[150px]">Barcode</th>
              </tr>
            </thead>
            <tbody>
              {editRows.map((row) => {
                const original = filteredProducts.find(p => p._id === row.id)
                const isChanged =
                  row.buyingPrice !== original?.buyingPrice ||
                  row.sellingPrice !== original?.sellingPrice ||
                  row.wholeSale !== (original?.wholeSale || 0) ||
                  row.barcode !== (original?.barcode || '')

                return (
                  <tr key={row.id} className={`border-t ${isChanged ? 'bg-yellow-50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-xs">{row.productName}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={row.buyingPrice}
                        onChange={(e) => handleFieldChange(row.id, 'buyingPrice', e.target.value ? parseFloat(e.target.value) : '')}
                        className="h-8 text-xs"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={row.sellingPrice}
                        onChange={(e) => handleFieldChange(row.id, 'sellingPrice', e.target.value ? parseFloat(e.target.value) : '')}
                        className="h-8 text-xs"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={row.wholeSale}
                        onChange={(e) => handleFieldChange(row.id, 'wholeSale', e.target.value ? parseFloat(e.target.value) : '')}
                        className="h-8 text-xs"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={row.barcode}
                        onChange={(e) => handleFieldChange(row.id, 'barcode', e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Barcode"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-muted-foreground pt-2">
          {changes.length > 0 && <p className="text-amber-600 font-semibold">{changes.length} item(s) have changes</p>}
          {changes.length === 0 && editRows.length > 0 && <p>No changes made yet</p>}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => setShowConfirm(true)} disabled={changes.length === 0}>
            Review & Save ({changes.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
