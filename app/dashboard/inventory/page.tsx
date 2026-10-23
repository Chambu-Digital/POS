'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Upload, Download, Trash2, Edit2, Search, FolderTree, ArrowLeftRight, PackageOpen, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { ProductForm } from '@/components/inventory/product-form'
import { BatchProductForm } from '@/components/inventory/batch-product-form'
import { ImportModal } from '@/components/inventory/import-modal'
import { CategoryManager } from '@/components/inventory/category-manager'
import { StockInModal } from '@/components/inventory/stock-in-modal'
import { StockCountModal } from '@/components/inventory/stock-count-modal'
import { CreateProductTransferModal } from '@/components/stock-transfers/create-product-transfer-modal'
import { ImportProductsModal } from '@/components/products/import-products-modal'
import { BulkEditModal } from '@/components/inventory/bulk-edit-modal'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/currency'

interface Product {
  _id: string
  productName: string
  category: string
  stock: number
  buyingPrice: number
  sellingPrice: number
  description?: string
  images?: string[]
  trackLots?: boolean
  lotUnit?: string
}

export default function InventoryPage() {
  return (
    <PermissionGuard requiredPermission="pos.inventory">
      <InventoryPageContent />
    </PermissionGuard>
  )
}

function InventoryPageContent() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isStockInOpen, setIsStockInOpen] = useState(false)
  const [isStockCountOpen, setIsStockCountOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [isImportProductsOpen, setIsImportProductsOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [currency, setCurrency] = useState('KSh')

  useEffect(() => {
    fetchProducts()
    fetchCurrency()
  }, [])

  useEffect(() => {
    const searchLower = search.toLowerCase()
    const filtered = products.filter((p) => {
      // Search across multiple fields
      const productName = p.productName?.toLowerCase() || ''
      const category = p.category?.toLowerCase() || ''
      const brand = (p as any).brand?.toLowerCase() || ''
      const model = (p as any).model?.toLowerCase() || ''
      const variant = (p as any).variant?.toLowerCase() || ''
      const description = p.description?.toLowerCase() || ''
      const barcode = (p as any).barcode?.toLowerCase() || ''
      
      // Search by price (convert to string for partial matching)
      const buyingPrice = p.buyingPrice?.toString() || ''
      const sellingPrice = p.sellingPrice?.toString() || ''
      
      return (
        productName.includes(searchLower) ||
        category.includes(searchLower) ||
        brand.includes(searchLower) ||
        model.includes(searchLower) ||
        variant.includes(searchLower) ||
        description.includes(searchLower) ||
        barcode.includes(searchLower) ||
        buyingPrice.includes(searchLower) ||
        sellingPrice.includes(searchLower)
      )
    })
    setFilteredProducts(filtered)
  }, [search, products])

  async function fetchProducts() {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      toast.error('Failed to load products')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCurrency() {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setCurrency(data.settings?.general?.currency || data.settings?.currency || 'KSh')
      }
    } catch (error) {
      // Silently fail and use default
      console.error('Failed to load currency settings:', error)
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setProducts(products.filter((p) => p._id !== id))
        toast.success('Product deleted')
      } else {
        toast.error('Failed to delete product')
      }
    } catch (error) {
      toast.error('Error deleting product')
      console.error(error)
    }
  }

  function handleDownloadStock() {
    const headers = ['productName', 'category', 'brand', 'model', 'variant', 'unit', 'buyingPrice', 'sellingPrice', 'wholeSale', 'stock', 'description', 'barcode']
    let csv = headers.join(',') + '\n'
    
    // Add actual product data
    products.forEach((product) => {
      const row = [
        `"${(product.productName || '').replace(/"/g, '""')}"`,
        `"${(product.category || '').replace(/"/g, '""')}"`,
        `"${((product as any).brand || '').replace(/"/g, '""')}"`,
        `"${((product as any).model || '').replace(/"/g, '""')}"`,
        `"${((product as any).variant || '').replace(/"/g, '""')}"`,
        `"${((product as any).unit || 'pieces').replace(/"/g, '""')}"`,
        product.buyingPrice || 0,
        product.sellingPrice || 0,
        (product as any).wholeSale || 0,
        product.stock || 0,
        `"${(product.description || '').replace(/"/g, '""')}"`,
        `"${((product as any).barcode || '').replace(/"/g, '""')}"`,
      ]
      csv += row.join(',') + '\n'
    })
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().split('T')[0]
    a.download = `stock_export_${dateStr}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success(`Exported ${products.length} products`)
  }

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0)
  const stockValue = products.reduce((sum, p) => sum + (p.stock * p.sellingPrice), 0)
  const stockValueAtCost = products.reduce((sum, p) => sum + (p.stock * p.buyingPrice), 0)
  const estimatedProfit = products.reduce((sum, p) => sum + (p.stock * (p.sellingPrice - p.buyingPrice)), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-muted-foreground mt-2">Manage by Admin User</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-2xl font-bold">{products.length}</div>
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Estimated Profit</CardTitle>
              <div className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(estimatedProfit, currency, false)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-2xl font-bold">{totalStock.toLocaleString()}</div>
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Stock Value At Cost</CardTitle>
              <div className="text-2xl font-bold text-primary mt-2">{formatCurrency(stockValueAtCost, currency, false)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setIsBulkEditOpen(true)}
            size="sm"
            variant="default"
          >
            <Edit2 size={16} className="mr-2" />
            Bulk Edit
          </Button>
          <Button
            onClick={() => setIsImportProductsOpen(true)}
            size="sm"
            variant="default"
          >
            <PackageOpen size={16} className="mr-2" />
            Import from Branch
          </Button>
          <Button
            onClick={() => setIsStockInOpen(true)}
            size="sm"
            variant="outline"
          >
            <Plus size={16} className="mr-2" />
            Stock In
          </Button>
          <Button
            onClick={() => setIsStockCountOpen(true)}
            size="sm"
            variant="outline"
          >
            <Plus size={16} className="mr-2" />
            Stock Count
          </Button>
          <Button
            onClick={() => setIsTransferOpen(true)}
            size="sm"
            variant="outline"
          >
            <ArrowLeftRight size={16} className="mr-2" />
            Stock Out
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            variant="outline"
          >
            <Plus size={16} className="mr-2" />
            Create Item
          </Button>
          <Button
            onClick={() => setIsImportOpen(true)}
            variant="outline"
            size="sm"
          >
            <Upload size={16} className="mr-2" />
            Import Items
          </Button>
          <Button
            onClick={handleDownloadStock}
            variant="outline"
            size="sm"
          >
            <Download size={16} className="mr-2" />
            Download Stock
          </Button>
          <Button
            onClick={() => setIsCategoryManagerOpen(true)}
            variant="outline"
            size="sm"
          >
            <FolderTree size={16} className="mr-2" />
            Manage Categories
          </Button>
        </CardContent>
      </Card>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Search size={20} className="text-muted-foreground" />
            <Input
              placeholder="Search by name, brand, model, price, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No products found. Create your first product to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product) => {
                const stockLevel = product.stock
                const stockColor = stockLevel === 0 ? 'text-red-600' : stockLevel < 10 ? 'text-yellow-600' : 'text-green-600'
                const stockBg = stockLevel === 0 ? 'bg-red-50' : stockLevel < 10 ? 'bg-yellow-50' : 'bg-green-50'
                
                return (
                  <div
                    key={product._id}
                    onClick={() => {
                      setSelectedProduct(product)
                      setIsViewOpen(true)
                    }}
                    className="flex flex-wrap items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-muted/50 hover:border-gray-300 transition-all cursor-pointer"
                  >
                    {/* Image */}
                    <div className="flex-shrink-0">
                      <ProductImage
                        src={product.images?.[0]}
                        alt={product.productName}
                        size="sm"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold text-sm">{product.productName}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-1 mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{product.category}</span>
                        {(product as any).brand && <span>• {(product as any).brand}</span>}
                        {(product as any).model && <span>• {(product as any).model}</span>}
                        {(product as any).variant && <span>• {(product as any).variant}</span>}
                      </div>
                    </div>

                    {/* Stock Badge */}
                    <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg ${stockBg} min-w-[80px]`}>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        Stock
                        {product.trackLots && (
                          <Layers size={10} className="text-blue-500" title="Lot tracked" />
                        )}
                      </div>
                      <div className={`font-bold ${stockColor}`}>
                        {product.stock}{' '}
                        <span className="text-xs font-normal">
                          {product.trackLots ? (product.lotUnit || 'units') : ((product as any).unit || 'pcs')}
                        </span>
                      </div>
                    </div>

                    {/* Prices */}
                    <div className="flex gap-4 flex-wrap text-sm">
                      <div className="min-w-[90px]">
                        <div className="text-xs text-muted-foreground">Buy</div>
                        <div className="font-semibold">{formatCurrency(product.buyingPrice || 0, currency)}</div>
                      </div>
                      <div className="min-w-[90px]">
                        <div className="text-xs text-muted-foreground">Sell</div>
                        <div className="font-semibold text-primary">{formatCurrency(product.sellingPrice || 0, currency)}</div>
                      </div>
                      {(product as any).wholeSale > 0 && (
                        <div className="min-w-[90px]">
                          <div className="text-xs text-muted-foreground">W/Sale</div>
                          <div className="font-semibold">{formatCurrency((product as any).wholeSale || 0, currency)}</div>
                        </div>
                      )}
                    </div>

                    {/* Value - Hidden on mobile */}
                    <div className="hidden lg:block min-w-[100px]">
                      <div className="text-xs text-muted-foreground">Value</div>
                      <div className="font-bold text-primary">{formatCurrency((product.stock || 0) * (product.sellingPrice || 0), currency, false)}</div>
                    </div>

                    {/* Actions */}
                    <div 
                      className="flex gap-1.5 ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProduct(product)
                          setIsEditOpen(true)
                        }}
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProduct(product._id)
                        }}
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Product Dialog - Batch Form */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setSelectedProduct(null)
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Products</DialogTitle>
            <DialogDescription>
              Add one or multiple products to your inventory
            </DialogDescription>
          </DialogHeader>
          <BatchProductForm
            onSuccess={() => {
              setIsCreateOpen(false)
              fetchProducts()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog - Single Form */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditOpen(false)
          setSelectedProduct(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update product information
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            product={selectedProduct}
            onSuccess={() => {
              setIsEditOpen(false)
              setSelectedProduct(null)
              fetchProducts()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={isViewOpen} onOpenChange={(open) => {
        if (!open) {
          setIsViewOpen(false)
          setSelectedProduct(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>
              View and manage product information
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                {selectedProduct.trackLots && (
                  <TabsTrigger value="lots" className="flex-1 flex items-center gap-1.5">
                    <Layers size={13} />
                    Lots
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ── Details tab ───────────────────────────────────────────── */}
              <TabsContent value="details">
                <div className="space-y-6 pt-2">
                  {/* Image gallery */}
                  {selectedProduct.images && selectedProduct.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {selectedProduct.images.map((src, i) => (
                        <div key={i} className={`rounded-lg overflow-hidden border border-gray-200 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                          <ProductImage
                            src={src}
                            alt={`${selectedProduct.productName} ${i + 1}`}
                            size="lg"
                            className="aspect-square w-full h-full"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Product Information Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Product Name</Label>
                      <p className="text-lg font-semibold">{selectedProduct.productName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <p className="text-lg font-semibold">{selectedProduct.category}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Brand</Label>
                      <p className="text-lg font-semibold">{(selectedProduct as any).brand || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Model</Label>
                      <p className="text-lg font-semibold">{(selectedProduct as any).model || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Variant</Label>
                      <p className="text-lg font-semibold">{(selectedProduct as any).variant || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Unit</Label>
                      <p className="text-lg font-semibold">{(selectedProduct as any).unit || 'pieces'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Stock</Label>
                      <p className="text-lg font-semibold text-green-600">
                        {selectedProduct.stock}
                        {selectedProduct.trackLots && (
                          <span className="text-sm font-normal ml-1 text-muted-foreground">
                            {selectedProduct.lotUnit || 'units'}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Stock Value</Label>
                      <p className="text-lg font-semibold text-primary">
                        {formatCurrency(selectedProduct.stock * selectedProduct.sellingPrice, currency, false)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Buying Price</Label>
                      <p className="text-lg font-semibold">{formatCurrency(selectedProduct.buyingPrice, currency)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Selling Price</Label>
                      <p className="text-lg font-semibold">{formatCurrency(selectedProduct.sellingPrice, currency)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Wholesale Price</Label>
                      <p className="text-lg font-semibold">{formatCurrency((selectedProduct as any).wholeSale || 0, currency)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Profit Margin</Label>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(selectedProduct.sellingPrice - selectedProduct.buyingPrice, currency)}
                      </p>
                    </div>
                    {selectedProduct.trackLots && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Lot Tracking</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Layers size={14} className="text-blue-500" />
                          <span className="text-sm font-medium text-blue-700">
                            Enabled — tracked per {selectedProduct.lotUnit || 'unit'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {selectedProduct.description && (
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="text-sm mt-1">{selectedProduct.description}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={() => { setIsViewOpen(false); setIsEditOpen(true) }} className="flex-1">
                      <Edit2 size={16} className="mr-2" />Edit Product
                    </Button>
                    <Button onClick={() => { setIsViewOpen(false); handleDeleteProduct(selectedProduct._id) }}
                      variant="destructive" className="flex-1">
                      <Trash2 size={16} className="mr-2" />Delete Product
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ── Lots tab ──────────────────────────────────────────────── */}
              {selectedProduct.trackLots && (
                <TabsContent value="lots">
                  <LotsTabContent product={selectedProduct} currency={currency} />
                </TabsContent>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={() => {
          setIsImportOpen(false)
          fetchProducts()
        }}
      />

      {/* Category Manager */}
      <CategoryManager
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />

      {/* Stock In Modal */}
      <StockInModal
        open={isStockInOpen}
        onOpenChange={setIsStockInOpen}
        onSuccess={() => {
          setIsStockInOpen(false)
          fetchProducts()
        }}
      />

      {/* Stock Count Modal */}
      <StockCountModal
        open={isStockCountOpen}
        onOpenChange={setIsStockCountOpen}
        onSuccess={() => {
          setIsStockCountOpen(false)
          fetchProducts()
        }}
      />

      {/* Stock Out Modal */}
      <CreateProductTransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSuccess={() => {
          setIsTransferOpen(false)
          fetchProducts()
        }}
      />

      {/* Import Products from Branch Modal */}
      <ImportProductsModal
        isOpen={isImportProductsOpen}
        onClose={() => setIsImportProductsOpen(false)}
        onSuccess={() => {
          setIsImportProductsOpen(false)
          fetchProducts()
        }}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={isBulkEditOpen}
        onOpenChange={setIsBulkEditOpen}
        products={filteredProducts}
        onSuccess={() => {
          setIsBulkEditOpen(false)
          fetchProducts()
        }}
      />
    </div>
  )
}

// ── LotsTabContent ─────────────────────────────────────────────────────────────
// Read-only view of all batches for a lot-tracked product.
// Shown inside the "Lots" tab of the product view dialog.
// Stock changes happen only through Stock In / Stock Count / Sales.

interface Batch {
  _id: string
  lotId: string
  lotLabel: string
  quantity: number
  initialQuantity: number
  status: string
  receivedDate: string
  supplier?: string
  notes?: string
}

function LotsTabContent({ product, currency }: { product: Product; currency: string }) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (product._id) fetchBatches()
  }, [product._id])

  async function fetchBatches() {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${product._id}/batches?status=all`)
      if (res.ok) {
        const data = await res.json()
        setBatches(data.batches || [])
      }
    } catch {
      toast.error('Failed to load lots')
    } finally {
      setLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    active:   'bg-green-100 text-green-800',
    depleted: 'bg-gray-100 text-gray-600',
    sealed:   'bg-orange-100 text-orange-700',
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading lots…</div>

  if (batches.length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <Layers size={32} className="mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No lots yet for this product.</p>
        <p className="text-xs text-muted-foreground">
          Use <strong>Stock In</strong> to receive stock and create lots.
        </p>
      </div>
    )
  }

  const totalRemaining = batches
    .filter(b => b.status === 'active')
    .reduce((s, b) => s + b.quantity, 0)

  return (
    <div className="space-y-4 pt-2">
      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{batches.length} lot{batches.length !== 1 ? 's' : ''} total</span>
        <span className="font-semibold text-green-700">
          {totalRemaining} {product.lotUnit || 'units'} available
        </span>
      </div>

      {/* Read-only lot table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2 text-xs font-medium">Lot</th>
              <th className="text-right p-2 text-xs font-medium">Initial</th>
              <th className="text-right p-2 text-xs font-medium">Remaining</th>
              <th className="text-center p-2 text-xs font-medium">Status</th>
              <th className="text-left p-2 text-xs font-medium hidden sm:table-cell">Received</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(b => (
              <tr key={b._id} className="border-t hover:bg-muted/30">
                <td className="p-2">
                  <div className="font-medium text-xs">{b.lotLabel || b.lotId}</div>
                  <div className="text-[10px] text-muted-foreground">{b.lotId}</div>
                  {b.notes && <div className="text-[10px] text-muted-foreground italic">{b.notes}</div>}
                </td>
                <td className="p-2 text-right text-xs text-muted-foreground">{b.initialQuantity}</td>
                <td className="p-2 text-right">
                  <span className={`text-xs font-semibold ${b.status === 'active' ? 'text-green-700' : 'text-muted-foreground'}`}>
                    {b.quantity}
                  </span>
                </td>
                <td className="p-2 text-center">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[b.status] || 'bg-gray-100 text-gray-600'}`}>
                    {b.status}
                  </span>
                </td>
                <td className="p-2 text-xs text-muted-foreground hidden sm:table-cell">
                  {new Date(b.receivedDate).toLocaleDateString()}
                  {b.supplier && <div className="text-[10px]">{b.supplier}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
