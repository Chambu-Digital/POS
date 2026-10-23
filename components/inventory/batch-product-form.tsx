'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, ImagePlus, X, Loader2, Plus, Trash2, AlertCircle, ChevronDown, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { QuickAddSupplierDialog } from '@/components/suppliers/quick-add-supplier-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'

interface Product {
  _id?: string
  productName: string
  category: string
  supplierId?: string
  variant?: string
  brand?: string
  model?: string
  barcode?: string
  unit?: string
  buyingPrice: number
  sellingPrice: number
  wholeSale?: number
  lowStockThreshold?: number
  description?: string
  stock: number
  images?: string[]
}

interface ProductVariant {
  id: string
  brand: string
  model: string
  variant: string
  stock: number
  barcode: string
  images: string[]
  errors: Record<string, string>
}

interface InitialLot {
  id: string
  label: string
  quantity: number
}

interface ProductCardState {
  id: string
  productName: string
  category: string
  supplierId?: string
  unit: string
  buyingPrice: number
  sellingPrice: number
  wholeSale: number
  lowStockThreshold: number
  description?: string
  variants: ProductVariant[]
  errors: Record<string, string>
  trackLots: boolean
  lotUnit: string
  initialLots: InitialLot[]
  duplicate: boolean
}

interface BatchProductFormProps {
  onSuccess: () => void
}

export function BatchProductForm({ onSuccess }: BatchProductFormProps) {
  const [products, setProducts] = useState<ProductCardState[]>([
    createEmptyProduct(),
  ])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ _id: string; name: string }>>([])
  const [existingProducts, setExistingProducts] = useState<Product[]>([])
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false)
  const [quickAddSupplierId, setQuickAddSupplierId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
    fetchExistingProducts()
  }, [])

  function createEmptyProduct(): ProductCardState {
    return {
      id: `temp-${Date.now()}-${Math.random()}`,
      productName: '',
      category: '',
      supplierId: '',
      unit: 'piece',
      buyingPrice: 0,
      sellingPrice: 0,
      wholeSale: 0,
      lowStockThreshold: 10,
      description: '',
      variants: [createEmptyVariant()],
      errors: {},
      trackLots: false,
      lotUnit: 'pieces',
      initialLots: [],
      duplicate: false,
    }
  }

  function createEmptyLot(): InitialLot {
    return { id: `lot-${Date.now()}-${Math.random()}`, label: '', quantity: 0 }
  }

  function createEmptyVariant(): ProductVariant {
    return {
      id: `var-${Date.now()}-${Math.random()}`,
      brand: '',
      model: '',
      variant: '',
      stock: 0,
      barcode: '',
      images: [],
      errors: {},
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories.map((c: any) => c.name).sort())
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  async function fetchSuppliers() {
    try {
      const response = await fetch('/api/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error)
    }
  }

  async function fetchExistingProducts() {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setExistingProducts(data.products || [])
      }
    } catch (error) {
      console.error('Failed to load existing products:', error)
    }
  }

  function addCard() {
    setExpandedCardId(null)
    setProducts(prev => [...prev, createEmptyProduct()])
  }

  function removeCard(id: string) {
    if (products.length > 1) {
      setProducts(prev => prev.filter(p => p.id !== id))
    } else {
      toast.error('You must keep at least one product card')
    }
  }

  function addVariant(cardId: string) {
    setProducts(prev =>
      prev.map(p =>
        p.id === cardId
          ? { ...p, variants: [...p.variants, createEmptyVariant()] }
          : p
      )
    )
  }

  function removeVariant(cardId: string, variantId: string) {
    setProducts(prev =>
      prev.map(p =>
        p.id === cardId
          ? {
              ...p,
              variants: p.variants.filter(v => v.id !== variantId),
            }
          : p
      )
    )
  }

  function updateProduct(id: string, updates: Partial<ProductCardState>) {
    setProducts(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              ...updates,
              ...(updates.buyingPrice !== undefined && { buyingPrice: typeof updates.buyingPrice === 'string' ? parseFloat(updates.buyingPrice) || 0 : updates.buyingPrice }),
              ...(updates.sellingPrice !== undefined && { sellingPrice: typeof updates.sellingPrice === 'string' ? parseFloat(updates.sellingPrice) || 0 : updates.sellingPrice }),
              ...(updates.wholeSale !== undefined && { wholeSale: typeof updates.wholeSale === 'string' ? parseFloat(updates.wholeSale) || 0 : updates.wholeSale }),
              ...(updates.lowStockThreshold !== undefined && { lowStockThreshold: typeof updates.lowStockThreshold === 'string' ? parseFloat(updates.lowStockThreshold) || 0 : updates.lowStockThreshold }),
            }
          : p
      )
    )
  }

  function updateVariant(cardId: string, variantId: string, updates: Partial<ProductVariant>) {
    setProducts(prev =>
      prev.map(p =>
        p.id === cardId
          ? {
              ...p,
              variants: p.variants.map(v =>
                v.id === variantId
                  ? {
                      ...v,
                      ...updates,
                      ...(updates.stock !== undefined && { stock: typeof updates.stock === 'string' ? parseFloat(updates.stock) || 0 : updates.stock }),
                    }
                  : v
              ),
            }
          : p
      )
    )
  }

  function clearErrors(id: string) {
    updateProduct(id, { errors: {} })
  }

  function clearVariantErrors(cardId: string, variantId: string) {
    updateVariant(cardId, variantId, { errors: {} })
  }

  // ── Initial lot helpers ────────────────────────────────────────────────────

  function addInitialLot(cardId: string) {
    setProducts(prev => prev.map(p =>
      p.id === cardId
        ? { ...p, initialLots: [...p.initialLots, createEmptyLot()] }
        : p
    ))
  }

  function removeInitialLot(cardId: string, lotId: string) {
    setProducts(prev => prev.map(p =>
      p.id === cardId
        ? { ...p, initialLots: p.initialLots.filter(l => l.id !== lotId) }
        : p
    ))
  }

  function updateInitialLot(cardId: string, lotId: string, field: keyof InitialLot, value: string | number) {
    setProducts(prev => prev.map(p =>
      p.id === cardId
        ? {
            ...p,
            initialLots: p.initialLots.map(l =>
              l.id === lotId ? { ...l, [field]: value } : l
            ),
          }
        : p
    ))
  }

  function lotsTotal(lots: InitialLot[]): number {
    return lots.reduce((s, l) => s + (Number(l.quantity) || 0), 0)
  }

  async function uploadImages(cardId: string, variantId: string, files: FileList | File[]) {
    try {
      const newUrls: string[] = []

      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('media', file)

        const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const d = await res.json()
          toast.error(d.error ?? `Failed to upload "${file.name}"`)
          continue
        }
        const data = await res.json()
        newUrls.push(data.url)
      }

      if (newUrls.length) {
        const product = products.find(p => p.id === cardId)
        const variant = product?.variants.find(v => v.id === variantId)
        if (variant) {
          updateVariant(cardId, variantId, {
            images: [...variant.images, ...newUrls],
          })
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    }
  }

  async function removeImage(cardId: string, variantId: string, index: number) {
    const product = products.find(p => p.id === cardId)
    const variant = product?.variants.find(v => v.id === variantId)
    if (variant?.images) {
      const updated = variant.images.filter((_, i) => i !== index)
      updateVariant(cardId, variantId, { images: updated })
      toast.success('Image removed')
    }
  }

  function validateVariant(variant: ProductVariant): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!variant.brand?.trim()) errors.brand = 'Brand is required'
    if (variant.stock === undefined || variant.stock < 0) errors.stock = 'Stock must be 0 or greater'
    return errors
  }

  function validateProduct(product: ProductCardState): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!product.productName?.trim()) errors.productName = 'Product name is required'
    if (!product.category?.trim()) errors.category = 'Category is required'
    if (product.buyingPrice === undefined || product.buyingPrice <= 0) errors.buyingPrice = 'Buying price must be greater than 0'
    if (product.sellingPrice === undefined || product.sellingPrice <= 0) errors.sellingPrice = 'Selling price must be greater than 0'
    if (!product.unit?.trim()) errors.unit = 'Unit is required'
    return errors
  }

  function validateAllProducts(): boolean {
    let isValid = true
    const updated = products.map(product => {
      const productErrors = validateProduct(product)
      if (Object.keys(productErrors).length > 0) {
        isValid = false
      }

      const updatedVariants = product.variants.map(variant => {
        const variantErrors = validateVariant(variant)
        // For lot-tracked products the stock field is hidden — don't validate it
        if (product.trackLots) delete variantErrors.stock
        if (Object.keys(variantErrors).length > 0) {
          isValid = false
        }
        return { ...variant, errors: variantErrors }
      })

      return { ...product, variants: updatedVariants, errors: productErrors }
    })
    setProducts(updated)
    return isValid
  }

async function submitBatch() {
    if (!validateAllProducts()) {
      toast.error('Please fix validation errors before submitting')
      return
    }

    setLoading(true)
    const results = { success: 0, failed: 0, duplicates: [] as string[], errors: [] as any[] }

    try {
      for (const product of products) {
        for (const variant of product.variants) {
          try {
            const { id: varId, errors: varErrors, images: varImages, ...varData } = variant
            const { id: prodId, errors: prodErrors, variants, initialLots, ...prodData } = product

            // For lot-tracked products, stock = sum of initial lots (or 0 if none)
            const openingStock = product.trackLots
              ? lotsTotal(product.initialLots)
              : variant.stock

            const createData = {
              ...prodData,
              ...varData,
              stock:     openingStock,
              images:    varImages,
              trackLots: product.trackLots,
              lotUnit:   product.lotUnit,
            }

            const response = await fetch('/api/products', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(createData),
            })

            if (!response.ok) {
              const data = await response.json()
              if (data.duplicate) {
                // Mark the card as duplicate so it turns orange in the UI
                setProducts(prev => prev.map(p =>
                  p.id === product.id ? { ...p, duplicate: true } : p
                ))
                const label = [variant.variant, variant.brand, product.productName].filter(Boolean).join(' ')
                results.duplicates.push(label)
              } else {
                results.failed++
                results.errors.push({
                  productName: `${product.productName}${variant.brand ? ` (${variant.brand})` : ''}`,
                  error: data.error || 'Failed to create product',
                })
              }
              continue
            }

            const created = await response.json()

            // ── Create opening-balance lots if trackLots is on ──────────────
            if (product.trackLots && product.initialLots.length > 0) {
              const validLots = product.initialLots.filter(l => Number(l.quantity) > 0)
              if (validLots.length > 0) {
                const batchRes = await fetch(`/api/products/${created._id}/batches`, {
                  method:  'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body:    JSON.stringify({
                    lots:        validLots.map(l => ({ label: l.label || `Lot ${l.id}`, quantity: Number(l.quantity) })),
                    buyingPrice: product.buyingPrice,
                    notes:       'Opening balance',
                  }),
                })
                if (!batchRes.ok) {
                  const batchData = await batchRes.json()
                  // Warn but don't fail — product exists, lots can be added via Stock In
                  toast.warning(`Product created but lots failed: ${batchData.error || 'Unknown error'}. Add lots via Stock In.`)
                }
              }
            }

            results.success++
          } catch (error) {
            results.failed++
            results.errors.push({
              productName: `${product.productName} (${variant.variant || variant.brand})`,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }
      }

      if (results.success > 0) {
        toast.success(`✓ ${results.success} product${results.success !== 1 ? 's' : ''} created`)
        onSuccess()
      }

      if (results.duplicates.length > 0) {
        toast.warning(
          `Duplicate${results.duplicates.length !== 1 ? 's' : ''} detected: ${results.duplicates.join(', ')} already exist${results.duplicates.length === 1 ? 's' : ''} in your catalog`,
          { duration: 6000 }
        )
      }

      if (results.failed > 0) {
        const errorMsg = results.errors.map(e => `${e.productName}: ${e.error}`).join('\n')
        toast.error(
          `${results.failed} item${results.failed !== 1 ? 's' : ''} failed to create`,
          { description: errorMsg, duration: 6000 }
        )
      }

      if (results.success === 0 && results.duplicates.length === 0 && results.failed === 0) {
        toast.info('Nothing to create')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleQuickAddSupplierSuccess(newSupplier: { _id: string; name: string }) {
    setSuppliers(prev => [...prev, newSupplier])
    if (quickAddSupplierId) {
      updateProduct(quickAddSupplierId, { supplierId: newSupplier._id })
      setQuickAddSupplierId(null)
    }
  }

  return (
    <div className="space-y-2">
      {/* Product Cards */}
      <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2">
        {products.map((product, index) => (
          <Card 
            key={product.id} 
            className={cn(
              'border transition-colors',
              Object.keys(product.errors).length > 0
                ? 'border-red-300 bg-red-50'
                : product.duplicate
                ? 'border-orange-300 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <CardContent className="p-3">
              {/* Header Row: Item Number, Title, Remove Button */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Item {index + 1}
                  </span>
                  {Object.keys(product.errors).length > 0 && (
                    <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      {Object.keys(product.errors).length} error(s)
                    </span>
                  )}
                  {product.duplicate && Object.keys(product.errors).length === 0 && (
                    <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      Duplicate — already in catalog
                    </span>
                  )}
                </div>
                {products.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCard(product.id)}
                    disabled={loading}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>

              {/* Error Alert - Compact */}
              {Object.keys(product.errors).length > 0 && (
                <Alert className="mb-2 py-2 px-3 border-red-200 bg-red-50/50">
                  <AlertCircle className="h-3 w-3" />
                  <AlertDescription className="text-xs leading-tight">
                    {Object.values(product.errors).join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Row 1: Product Name, Category, Supplier (balanced 2-2-2) */}
              <div className="grid grid-cols-6 gap-2 mb-2">
                {/* Product Name - 2 cols with autocomplete */}
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={`productName-${product.id}`} className="text-xs font-medium">
                    Product Name {product.errors.productName && <span className="text-red-500">*</span>}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-8 w-full justify-between text-xs"
                        disabled={loading}
                        type="button"
                      >
                        <span className="truncate">{product.productName || 'Search...'}</span>
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search existing products..." 
                          className="h-8"
                          value={product.productName}
                          onValueChange={(val) => updateProduct(product.id, { productName: val })}
                        />
                        <CommandList>
                          {!product.productName ? (
                            <CommandEmpty className="text-xs py-1 px-2">
                              Type to search or create new
                            </CommandEmpty>
                          ) : (
                            <>
                              {(() => {
                                const searchLower = product.productName.toLowerCase()
                                const matches = existingProducts.filter(ep => {
                                  const productName = ep.productName?.toLowerCase() || ''
                                  const brand = (ep as any).brand?.toLowerCase() || ''
                                  const model = (ep as any).model?.toLowerCase() || ''
                                  const variant = (ep as any).variant?.toLowerCase() || ''
                                  const category = ep.category?.toLowerCase() || ''
                                  const barcode = (ep as any).barcode?.toLowerCase() || ''
                                  
                                  return (
                                    productName.includes(searchLower) ||
                                    brand.includes(searchLower) ||
                                    model.includes(searchLower) ||
                                    variant.includes(searchLower) ||
                                    category.includes(searchLower) ||
                                    barcode.includes(searchLower)
                                  )
                                })

                                return (
                                  <>
                                    {matches.length === 0 ? (
                                      <CommandEmpty className="text-xs py-1 px-2">
                                        No matches found. Press enter or type to create new.
                                      </CommandEmpty>
                                    ) : null}
                                    <CommandGroup>
                                      {matches.map((match) => (
                                        <CommandItem
                                          key={match._id}
                                          value={match.productName}
                                          onSelect={() => {
                                            // Update product-level fields
                                            updateProduct(product.id, {
                                              productName: match.productName,
                                              category: match.category,
                                              unit: (match as any).unit || 'piece',
                                              buyingPrice: match.buyingPrice,
                                              sellingPrice: match.sellingPrice,
                                              wholeSale: (match as any).wholeSale,
                                              lowStockThreshold: (match as any).lowStockThreshold,
                                              supplierId: (match as any).supplierId,
                                            })
                                            
                                            // Fill first variant with selected product data
                                            if (product.variants.length > 0) {
                                              const firstVariant = product.variants[0]
                                              updateVariant(product.id, firstVariant.id, {
                                                brand: (match as any).brand || '',
                                                model: (match as any).model || '',
                                                variant: (match as any).variant || '',
                                              })
                                            }
                                            
                                            if (product.errors.productName) clearErrors(product.id)
                                          }}
                                          className="text-xs"
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <span>{match.productName}</span>
                                            <span className="text-gray-400 text-xs">
                                              {(match as any).brand && `Brand: ${(match as any).brand}`}
                                              {(match as any).brand && (match as any).variant && ' • '}
                                              {(match as any).variant && `Variant: ${(match as any).variant}`}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </>
                                )
                              })()}
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    id={`productName-${product.id}`}
                    value={product.productName}
                    onChange={(e) => {
                      updateProduct(product.id, { productName: e.target.value, duplicate: false })
                      if (product.errors.productName) clearErrors(product.id)
                    }}
                    required
                    disabled={loading}
                    className={cn('h-8 text-sm', product.errors.productName ? 'border-red-500' : '')}
                    placeholder="e.g. iPhone 15"
                  />
                </div>

                {/* Category - 2 cols */}
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={`category-${product.id}`} className="text-xs font-medium">
                    Category {product.errors.category && <span className="text-red-500">*</span>}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-8 w-full justify-between text-xs"
                        disabled={loading}
                        type="button"
                      >
                        <span className="truncate">{product.category || 'Select...'}</span>
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0">
                      <Command>
                        <CommandInput placeholder="Search category..." className="h-8" />
                        <CommandList>
                          <CommandEmpty className="text-xs py-1">
                            Press Enter to create
                          </CommandEmpty>
                          <CommandGroup>
                            {categories.map((category) => (
                              <CommandItem
                                key={category}
                                value={category}
                                onSelect={(currentValue) => {
                                  updateProduct(product.id, { category: currentValue })
                                  if (product.errors.category) clearErrors(product.id)
                                }}
                                className="text-xs"
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-3 w-3',
                                    product.category === category ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {category}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Supplier - 2 cols */}
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-medium">Supplier</Label>
                  <div className="flex gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="h-8 flex-1 justify-between text-xs"
                          disabled={loading}
                          type="button"
                          title={product.supplierId ? suppliers.find((s) => s._id === product.supplierId)?.name : 'None'}
                        >
                          <span className="truncate text-xs">
                            {product.supplierId
                              ? suppliers.find((s) => s._id === product.supplierId)?.name || 'None'
                              : 'None'}
                          </span>
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0">
                        <Command>
                          <CommandInput placeholder="Search..." className="h-8 text-xs" />
                          <CommandList>
                            <CommandEmpty className="text-xs py-1">None</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value=""
                                onSelect={() => {
                                  updateProduct(product.id, { supplierId: '' })
                                }}
                                className="text-xs"
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-3 w-3',
                                    !product.supplierId ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                None
                              </CommandItem>
                              {suppliers.map((supplier) => (
                                <CommandItem
                                  key={supplier._id}
                                  value={supplier.name}
                                  onSelect={() => {
                                    updateProduct(product.id, { supplierId: supplier._id })
                                  }}
                                  className="text-xs"
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-3 w-3',
                                      product.supplierId === supplier._id ? 'opacity-100' : 'opacity-0'
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
                      onClick={() => {
                        setQuickAddSupplierId(product.id)
                        setQuickAddSupplierOpen(true)
                      }}
                      disabled={loading}
                      className="h-8 w-8 p-0"
                      title="Add supplier"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Row 2: Variant fields (Brand, Model, Variant, Stock) - repeatable per variant */}
              <div className="space-y-2 mb-3 border-t border-gray-100 pt-2">
                {product.variants.map((variant, variantIndex) => (
                  <div key={variant.id} className="grid grid-cols-5 gap-2">
                    {/* Brand - 1 col */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Brand {variant.errors.brand && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        type="text"
                        value={variant.brand}
                        onChange={(e) => {
                          updateVariant(product.id, variant.id, { brand: e.target.value })
                          if (variant.errors.brand) clearVariantErrors(product.id, variant.id)
                        }}
                        disabled={loading}
                        className={cn('h-8 text-sm', variant.errors.brand ? 'border-red-500' : '')}
                        placeholder="e.g. Apple"
                      />
                    </div>

                    {/* Model - 1 col */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Model
                      </Label>
                      <Input
                        type="text"
                        value={variant.model}
                        onChange={(e) => {
                          updateVariant(product.id, variant.id, { model: e.target.value })
                          if (variant.errors.model) clearVariantErrors(product.id, variant.id)
                        }}
                        disabled={loading}
                        className={cn('h-8 text-sm', variant.errors.model ? 'border-red-500' : '')}
                        placeholder="e.g. A2846"
                      />
                    </div>

                    {/* Variant - 1 col */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Variant
                      </Label>
                      <Input
                        type="text"
                        value={variant.variant}
                        onChange={(e) => {
                          updateVariant(product.id, variant.id, { variant: e.target.value })
                          if (variant.errors.variant) clearVariantErrors(product.id, variant.id)
                        }}
                        disabled={loading}
                        className={cn('h-8 text-sm', variant.errors.variant ? 'border-red-500' : '')}
                        placeholder="e.g. Silver 64GB"
                      />
                    </div>

                    {/* Stock - 1 col — hidden when lot tracking is on (stock = sum of lots) */}
                    {!product.trackLots && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Stock {variant.errors.stock && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        type="number"
                        value={variant.stock || ''}
                        onChange={(e) => {
                          updateVariant(product.id, variant.id, { stock: e.target.value })
                          if (variant.errors.stock) clearVariantErrors(product.id, variant.id)
                        }}
                        onFocus={(e) => e.target.select()}
                        disabled={loading}
                        className={cn('h-8 text-sm', variant.errors.stock ? 'border-red-500' : '')}
                        placeholder="0"
                      />
                    </div>
                    )}

                    {/* Remove Variant Button */}
                    {product.variants.length > 1 && (
                      <div className="flex items-end pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariant(product.id, variant.id)}
                          disabled={loading}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Variant Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addVariant(product.id)}
                  disabled={loading}
                  className="h-7 text-xs gap-1 w-full"
                >
                  <Plus size={14} />
                  Add Variant
                </Button>
              </div>

              {/* Row 3: Unit, Buying, Selling, Wholesale (product-level, shared) */}
              <div className="grid grid-cols-6 gap-2 mb-3 border-t border-gray-100 pt-2">
                {/* Unit - 1 col */}
                <div className="space-y-1">
                  <Label htmlFor={`unit-${product.id}`} className="text-xs font-medium">
                    Unit {product.errors.unit && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id={`unit-${product.id}`}
                    type="text"
                    value={product.unit || ''}
                    onChange={(e) => {
                      updateProduct(product.id, { unit: e.target.value })
                      if (product.errors.unit) clearErrors(product.id)
                    }}
                    disabled={loading}
                    className={cn('h-8 text-sm', product.errors.unit ? 'border-red-500' : '')}
                    placeholder="e.g. piece"
                  />
                </div>

                {/* Buying Price - 1.5 cols */}
                <div className="col-span-1 space-y-1">
                  <Label htmlFor={`buyingPrice-${product.id}`} className="text-xs font-medium">
                    Buying {product.errors.buyingPrice && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id={`buyingPrice-${product.id}`}
                    type="number"
                    step="0.01"
                    value={product.buyingPrice || ''}
                    onChange={(e) => {
                      updateProduct(product.id, { buyingPrice: e.target.value })
                      if (product.errors.buyingPrice) clearErrors(product.id)
                    }}
                    onFocus={(e) => e.target.select()}
                    required
                    disabled={loading}
                    className={cn('h-8 text-sm', product.errors.buyingPrice ? 'border-red-500' : '')}
                    placeholder="0.00"
                  />
                </div>

                {/* Selling Price - 1.5 cols */}
                <div className="col-span-1 space-y-1">
                  <Label htmlFor={`sellingPrice-${product.id}`} className="text-xs font-medium">
                    Selling {product.errors.sellingPrice && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id={`sellingPrice-${product.id}`}
                    type="number"
                    step="0.01"
                    value={product.sellingPrice || ''}
                    onChange={(e) => {
                      updateProduct(product.id, { sellingPrice: e.target.value })
                      if (product.errors.sellingPrice) clearErrors(product.id)
                    }}
                    onFocus={(e) => e.target.select()}
                    required
                    disabled={loading}
                    className={cn('h-8 text-sm', product.errors.sellingPrice ? 'border-red-500' : '')}
                    placeholder="0.00"
                  />
                </div>

                {/* Wholesale Price - 2 cols */}
                <div className="col-span-2 space-y-1">
                  <Label htmlFor={`wholeSale-${product.id}`} className="text-xs font-medium">
                    Wholesale
                  </Label>
                  <Input
                    id={`wholeSale-${product.id}`}
                    type="number"
                    step="0.01"
                    value={product.wholeSale || ''}
                    onChange={(e) => updateProduct(product.id, { wholeSale: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    disabled={loading}
                    className="h-8 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* More Details - Collapsible Section (Accordion style) */}
              <Collapsible 
                open={expandedCardId === product.id}
                onOpenChange={(open) => {
                  if (open) {
                    setExpandedCardId(product.id)
                  } else {
                    setExpandedCardId(null)
                  }
                }}
                className="border-t border-gray-100 pt-2"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs font-medium text-gray-600 p-0 hover:text-gray-900"
                  >
                    <ChevronDown size={14} className={cn("mr-1 transition-transform", expandedCardId === product.id && "rotate-180")} />
                    More Details
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {/* Low Stock Threshold */}
                  <div className="space-y-1">
                    <Label htmlFor={`lowStockThreshold-${product.id}`} className="text-xs font-medium">
                      Low Stock Alert
                    </Label>
                    <Input
                      id={`lowStockThreshold-${product.id}`}
                      type="number"
                      value={product.lowStockThreshold ?? ''}
                      onChange={(e) => updateProduct(product.id, { lowStockThreshold: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      disabled={loading}
                      className="h-8 text-sm"
                      placeholder="10"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <Label htmlFor={`description-${product.id}`} className="text-xs font-medium">
                      Description
                    </Label>
                    <Textarea
                      id={`description-${product.id}`}
                      value={product.description}
                      onChange={(e) => updateProduct(product.id, { description: e.target.value })}
                      disabled={loading}
                      className="min-h-12 text-sm"
                      placeholder="Product details..."
                    />
                  </div>

                  {/* ── Lot / unit tracking ───────────────────────────────── */}
                  <div className="space-y-2 border rounded-lg p-3 bg-muted/30 border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Layers size={13} className="text-muted-foreground" />
                          <span className="text-xs font-semibold">Track individual lots / units</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          Enable to track each roll, box, or carton separately.
                          Stock count and sales will manage remaining quantity per lot.
                        </p>
                      </div>
                      <Switch
                        checked={product.trackLots}
                        onCheckedChange={(checked) => {
                          updateProduct(product.id, {
                            trackLots:   checked,
                            initialLots: checked && product.initialLots.length === 0
                              ? [createEmptyLot()]
                              : product.initialLots,
                          })
                          // Auto-open More Details so the lots table is immediately visible
                          if (checked) setExpandedCardId(product.id)
                        }}
                        disabled={loading}
                      />
                    </div>

                    {product.trackLots && (
                      <div className="space-y-3 pt-2 border-t border-gray-200">

                        {/* Unit of measure */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Unit of measure</Label>
                          <div className="flex gap-1.5 flex-wrap">
                            {['metres', 'pieces', 'kg', 'litres', 'rolls', 'boxes', 'cartons', 'packs'].map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => updateProduct(product.id, { lotUnit: u })}
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] border transition-all',
                                  product.lotUnit === u
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background border-input hover:border-primary'
                                )}
                                disabled={loading}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                          <Input
                            value={product.lotUnit}
                            onChange={(e) => updateProduct(product.id, { lotUnit: e.target.value })}
                            placeholder="Or type a custom unit (e.g. sheets)"
                            disabled={loading}
                            className="h-7 text-xs"
                          />
                        </div>

                        {/* Initial lots table */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">
                              Opening lots
                              <span className="text-muted-foreground font-normal ml-1">(optional — add later via Stock In)</span>
                            </Label>
                            {product.initialLots.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Total: {lotsTotal(product.initialLots)} {product.lotUnit}
                              </span>
                            )}
                          </div>

                          {product.initialLots.length > 0 && (
                            <div className="space-y-1.5">
                              {/* Column headers */}
                              <div className="grid grid-cols-12 gap-1.5 px-1">
                                <span className="col-span-7 text-[10px] text-muted-foreground">Label (e.g. Roll 1)</span>
                                <span className="col-span-4 text-[10px] text-muted-foreground">Qty ({product.lotUnit})</span>
                                <span className="col-span-1" />
                              </div>

                              {product.initialLots.map((lot, li) => (
                                <div key={lot.id} className="grid grid-cols-12 gap-1.5 items-center">
                                  <div className="col-span-7">
                                    <Input
                                      value={lot.label}
                                      onChange={(e) => updateInitialLot(product.id, lot.id, 'label', e.target.value)}
                                      placeholder={`e.g. Roll ${li + 1}`}
                                      disabled={loading}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={lot.quantity || ''}
                                      onChange={(e) => updateInitialLot(product.id, lot.id, 'quantity', parseFloat(e.target.value) || 0)}
                                      onFocus={(e) => e.target.select()}
                                      placeholder="0"
                                      disabled={loading}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => removeInitialLot(product.id, lot.id)}
                                      disabled={loading}
                                      className="text-red-400 hover:text-red-600 p-0.5"
                                    >
                                      <X size={12} />
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
                            onClick={() => addInitialLot(product.id)}
                            disabled={loading}
                            className="w-full h-7 text-xs border-dashed gap-1"
                          >
                            <Plus size={12} />
                            {product.initialLots.length === 0 ? 'Add opening lot' : 'Add another lot'}
                          </Button>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Per-Variant Images Section */}
                  <div className="space-y-2 border-t border-gray-100 pt-2">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Variant Images</div>
                    {product.variants.map((variant, varIdx) => (
                      <div key={variant.id} className="space-y-2 p-2 bg-gray-50 rounded border border-gray-100">
                        <div className="text-xs font-medium text-gray-600">
                          {variant.variant || `Variant ${varIdx + 1}`}
                        </div>
                        
                        {/* Image Upload Area */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (e.dataTransfer.files.length) uploadImages(product.id, variant.id, e.dataTransfer.files)
                          }}
                          onClick={() => fileInputRefs.current[`${product.id}-${variant.id}`]?.click()}
                          className="border-2 border-dashed rounded p-2 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400"
                        >
                          <div className="flex flex-col items-center gap-1 text-xs text-gray-500">
                            <ImagePlus className="h-4 w-4 text-gray-400" />
                            <span>Drop or click</span>
                          </div>
                        </div>
                        <input
                          ref={(ref) => {
                            fileInputRefs.current[`${product.id}-${variant.id}`] = ref
                          }}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.length) uploadImages(product.id, variant.id, e.target.files)
                            e.target.value = ''
                          }}
                        />

                        {/* Image Preview */}
                        {variant.images && variant.images.length > 0 && (
                          <div className="grid grid-cols-4 gap-1">
                            {variant.images.map((src, i) => (
                              <div key={i} className="relative group aspect-square rounded overflow-hidden border border-gray-200">
                                <ProductImage src={src} alt={`Variant ${varIdx + 1} image ${i + 1}`} size="lg" className="w-full h-full" />
                                <button
                                  type="button"
                                  onClick={() => removeImage(product.id, variant.id, i)}
                                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-2 w-2" />
                                </button>
                                {i === 0 && (
                                  <span className="absolute bottom-0.5 left-0.5 bg-green-600 text-white text-[9px] font-semibold px-0.5 py-0.5 rounded">
                                    Main
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Another Item Button */}
      <Button
        type="button"
        variant="outline"
        onClick={addCard}
        disabled={loading}
        className="w-full h-8 text-sm"
      >
        <Plus size={14} className="mr-1" />
        + Add Another Item
      </Button>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button
          type="button"
          disabled={loading}
          variant="outline"
          size="sm"
          onClick={() => {
            setProducts([createEmptyProduct()])
            setExpandedCardId(null)
          }}
          className="h-8 text-sm"
        >
          Clear All
        </Button>
        <Button
          type="button"
          onClick={submitBatch}
          disabled={loading}
          size="sm"
          className="h-8 text-sm min-w-[140px]"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="mr-1 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Save All Items ({products.length})
            </>
          )}
        </Button>
      </div>

      {/* Quick Add Supplier Dialog */}
      <QuickAddSupplierDialog
        open={quickAddSupplierOpen}
        onOpenChange={setQuickAddSupplierOpen}
        onSuccess={handleQuickAddSupplierSuccess}
      />
    </div>
  )
}
