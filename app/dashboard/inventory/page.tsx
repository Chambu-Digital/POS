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
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Upload, Download, Trash2, Edit2, Search, FolderTree, ArrowLeftRight, PackageOpen, Layers, Settings2, FileText } from 'lucide-react'
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
import { LotCreatorModal } from '@/components/inventory/lot-creator-modal'
import { ProductImage } from '@/components/ui/product-image'
import { useAuth } from '@/hooks/use-auth'
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
  lotContainerName?: string
  lotSize?: number
  lotPrice?: number
}

export default function InventoryPage() {
  return (
    <PermissionGuard requiredPermission="pos.inventory">
      <InventoryPageContent />
    </PermissionGuard>
  )
}

function InventoryPageContent() {
  const { user, permissions } = useAuth()
  const canSeeCost = user?.type === 'user' || permissions?.['pos.buying-price'] === true

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
  const [isLotCreatorOpen, setIsLotCreatorOpen] = useState(false)
  const [currency, setCurrency] = useState('KSh')

  // ── Export modal state ───────────────────────────────────────────────────
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportSearch, setExportSearch] = useState('')
  const [exportCategory, setExportCategory] = useState('all')
  const [exportStockPreset, setExportStockPreset] = useState('all')
  const [exportStockMin, setExportStockMin] = useState('')
  const [exportStockMax, setExportStockMax] = useState('')
  const [exportSelected, setExportSelected] = useState<Set<string>>(new Set())

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
      const response = await fetch('/api/products', { cache: 'no-store' })
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

  function handleDownloadStock(exportProducts?: Product[]) {
    const data = exportProducts ?? products
    const headers = ['productName', 'category', 'brand', 'model', 'variant', 'unit', 'buyingPrice', 'sellingPrice', 'wholeSale', 'stock', 'description', 'barcode']
    let csv = headers.join(',') + '\n'
    
    // Add actual product data
    data.forEach((product) => {
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
    toast.success(`Exported ${data.length} products`)
  }

  function handleDownloadPDF(exportProducts?: Product[]) {
    const data = exportProducts ?? products
    const shopName = (user as any)?.shopName || 'Stock Report'
    const dateStr = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })

    // Build product name from available parts — same logic as the sales page
    function formatName(p: Product): string {
      return [
        (p as any).variant,
        (p as any).brand,
        p.productName,
      ].filter(Boolean).join(' ')
    }

    const rows = data.map((p, i) => `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="col-num">${i + 1}</td>
        <td class="col-name">${formatName(p)}</td>
        <td class="col-num">${p.stock ?? 0}</td>
        <td class="col-num">${(p.sellingPrice ?? 0).toLocaleString()}</td>
        <td class="col-num">${((p as any).wholeSale ?? 0).toLocaleString()}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Stock Report — ${shopName}</title>
  <style>
    @page { size: A4 portrait; margin: 1.5cm 1.8cm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #111;
      background: #fff;
    }

    /* ── Header ─────────────────────────────────────────── */
    .doc-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding-bottom: 10px;
      border-bottom: 3px solid #059669;
      margin-bottom: 20px;
    }
    .doc-header .left .shop-name {
      font-size: 22px;
      font-weight: 800;
      color: #059669;
      letter-spacing: -0.5px;
    }
    .doc-header .left .doc-title {
      font-size: 12px;
      color: #6b7280;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .doc-header .right {
      text-align: right;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
    }
    .doc-header .right .date-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ── Table ──────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead tr {
      background: #059669;
      color: #fff;
    }
    thead th {
      padding: 8px 10px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    thead th.col-num { text-align: right; }
    thead th.col-name { text-align: left; }

    tbody tr td {
      padding: 7px 10px;
      vertical-align: middle;
      border-bottom: 1px solid #e5e7eb;
    }
    .row-even { background: #fff; }
    .row-odd  { background: #f0fdf4; }

    .col-num  { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col-name { text-align: left; }

    /* ── Footer ─────────────────────────────────────────── */
    .doc-footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #d1fae5;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="left">
      <div class="shop-name">${shopName}</div>
      <div class="doc-title">Stock Report</div>
    </div>
    <div class="right">
      <div class="date-label">Generated on</div>
      <div><strong>${dateStr}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-num">#</th>
        <th class="col-name">Product Name</th>
        <th class="col-num">Stock</th>
        <th class="col-num">Selling Price (${currency})</th>
        <th class="col-num">Wholesale (${currency})</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="doc-footer">
    <span>${data.length} product${data.length !== 1 ? 's' : ''}</span>
    <span>Powered by Chambu Digital</span>
  </div>
</body>
</html>`

    const printWindow = window.open('', '', 'width=900,height=700')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.onafterprint = () => printWindow.close()
      setTimeout(() => { printWindow.print() }, 300)
    }
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
            {canSeeCost && (
              <div>
                <CardTitle className="text-sm font-medium">Estimated Profit</CardTitle>
                <div className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(estimatedProfit, currency, false)}</div>
              </div>
            )}
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
            {canSeeCost && (
              <div>
                <CardTitle className="text-sm font-medium">Stock Value At Cost</CardTitle>
                <div className="text-2xl font-bold text-primary mt-2">{formatCurrency(stockValueAtCost, currency, false)}</div>
              </div>
            )}
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
            variant="outline"
            size="sm"
            onClick={() => {
              setExportSearch('')
              setExportCategory('all')
              setExportStockPreset('all')
              setExportStockMin('')
              setExportStockMax('')
              // Pre-select all products
              setExportSelected(new Set(products.map(p => p._id)))
              setIsExportOpen(true)
            }}
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
                          <span title="Lot tracked"><Layers size={10} className="text-blue-500" /></span>
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
                      {canSeeCost && (
                        <div className="min-w-[90px]">
                          <div className="text-xs text-muted-foreground">
                            Buy{product.trackLots && (product.lotSize ?? 1) > 1 && product.lotContainerName ? `/${product.lotContainerName}` : ''}
                          </div>
                          <div className="font-semibold">
                            {formatCurrency(
                              product.trackLots && (product.lotSize ?? 1) > 1 && product.lotContainerName
                                ? (product.buyingPrice || 0) * (product.lotSize || 1)
                                : product.buyingPrice || 0,
                              currency
                            )}
                          </div>
                        </div>
                      )}
                      <div className="min-w-[90px]">
                        <div className="text-xs text-muted-foreground">
                          Sell{product.trackLots && (product.lotSize ?? 1) > 1 && product.lotContainerName ? `/${product.lotContainerName}` : ''}
                        </div>
                        <div className="font-semibold text-primary">
                          {formatCurrency(
                            product.trackLots && (product.lotSize ?? 1) > 1 && product.lotContainerName
                              ? (product.lotPrice || (product.sellingPrice || 0) * (product.lotSize || 1))
                              : product.sellingPrice || 0,
                            currency
                          )}
                        </div>
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
                      {product.trackLots && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-blue-600 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedProduct(product)
                            setIsLotCreatorOpen(true)
                          }}
                          title="Manage lots"
                        >
                          <Settings2 size={14} />
                        </Button>
                      )}
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
                      <Label className="text-muted-foreground">
                        {selectedProduct.trackLots && (selectedProduct.lotSize ?? 1) > 1 && selectedProduct.lotContainerName
                          ? `Buying Price per ${selectedProduct.lotContainerName}`
                          : 'Buying Price'}
                      </Label>
                      <p className="text-lg font-semibold">{canSeeCost ? formatCurrency(
                        selectedProduct.trackLots && (selectedProduct.lotSize ?? 1) > 1 && selectedProduct.lotContainerName
                          ? selectedProduct.buyingPrice * (selectedProduct.lotSize ?? 1)
                          : selectedProduct.buyingPrice,
                        currency) : '—'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {selectedProduct.trackLots && (selectedProduct.lotSize ?? 1) > 1 && selectedProduct.lotContainerName
                          ? `Selling Price per ${selectedProduct.lotContainerName}`
                          : 'Selling Price'}
                      </Label>
                      <p className="text-lg font-semibold">{formatCurrency(
                        selectedProduct.trackLots && (selectedProduct.lotSize ?? 1) > 1 && selectedProduct.lotContainerName
                          ? (selectedProduct.lotPrice || selectedProduct.sellingPrice * (selectedProduct.lotSize ?? 1))
                          : selectedProduct.sellingPrice,
                        currency)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Wholesale Price</Label>
                      <p className="text-lg font-semibold">{formatCurrency((selectedProduct as any).wholeSale || 0, currency)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {selectedProduct.trackLots && (selectedProduct.lotSize ?? 1) > 1 && selectedProduct.lotContainerName
                          ? `Profit per ${selectedProduct.lotContainerName}`
                          : 'Profit Margin'}
                      </Label>
                      <p className="text-lg font-semibold text-green-600">
                        {canSeeCost ? formatCurrency(
                          selectedProduct.trackLots && (selectedProduct.lotSize ?? 1) > 1 && selectedProduct.lotContainerName
                            ? (selectedProduct.sellingPrice - selectedProduct.buyingPrice) * (selectedProduct.lotSize ?? 1)
                            : selectedProduct.sellingPrice - selectedProduct.buyingPrice,
                          currency) : '—'}
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

      {/* Export Stock Modal — filter, select, then download CSV or PDF */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Download Stock</DialogTitle>
            <DialogDescription>Filter products, select the ones you want, then export as CSV or PDF.</DialogDescription>
          </DialogHeader>

          {/* ── Filters ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Search by name</Label>
              <Input
                placeholder="Product name, brand..."
                value={exportSearch}
                onChange={(e) => setExportSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={exportCategory} onValueChange={setExportCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Array.from(new Set(products.map(p => p.category))).filter(Boolean).sort().map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stock level</Label>
              <Select value={exportStockPreset} onValueChange={(v) => {
                setExportStockPreset(v)
                if (v !== 'custom') {
                  setExportStockMin('')
                  setExportStockMax('')
                }
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stock levels</SelectItem>
                  <SelectItem value="out">Out of stock (= 0)</SelectItem>
                  <SelectItem value="low">Low stock (&lt; 10)</SelectItem>
                  <SelectItem value="in">In stock (&gt; 0)</SelectItem>
                  <SelectItem value="custom">Custom range…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exportStockPreset === 'custom' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stock range (min / max)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={exportStockMin}
                    onChange={(e) => setExportStockMin(e.target.value)}
                    className="h-9 w-20"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={exportStockMax}
                    onChange={(e) => setExportStockMax(e.target.value)}
                    className="h-9 w-20"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Select all toggle + count ──────────────────────────── */}
          {(() => {
            // Compute filtered products based on the export filters
            const exportCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean).sort()
            const searchLower = exportSearch.toLowerCase().trim()
            const stockMinNum = exportStockMin !== '' ? parseFloat(exportStockMin) : null
            const stockMaxNum = exportStockMax !== '' ? parseFloat(exportStockMax) : null

            const matched = products.filter((p) => {
              // Search filter
              if (searchLower) {
                const combined = [p.productName, (p as any).brand, (p as any).model, (p as any).variant]
                  .filter(Boolean).join(' ').toLowerCase()
                if (!combined.includes(searchLower)) return false
              }
              // Category filter
              if (exportCategory !== 'all' && p.category !== exportCategory) return false
              // Stock level filter
              const stock = p.stock ?? 0
              if (exportStockPreset === 'out' && stock !== 0) return false
              if (exportStockPreset === 'low' && stock >= 10) return false
              if (exportStockPreset === 'in' && stock <= 0) return false
              if (exportStockPreset === 'custom') {
                if (stockMinNum !== null && stock < stockMinNum) return false
                if (stockMaxNum !== null && stock > stockMaxNum) return false
              }
              return true
            })

            // The matched list is used in the rendered list below too,
            // so we store it on a ref-like variable via a closure.
            // However React re-renders this IIFE on every change, so it's fine.
            const allChecked = matched.length > 0 && matched.every(p => exportSelected.has(p._id))
            const someChecked = matched.some(p => exportSelected.has(p._id))

            // Only count/export products that are BOTH in the filtered list AND checked
            const exportReady = matched.filter(p => exportSelected.has(p._id))

            return (
              <>
                <div className="flex items-center justify-between gap-2 pt-2 pb-1 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="export-select-all"
                      checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                      onCheckedChange={(checked) => {
                        setExportSelected(prev => {
                          const next = new Set(prev)
                          if (checked) {
                            matched.forEach(p => next.add(p._id))
                          } else {
                            matched.forEach(p => next.delete(p._id))
                          }
                          return next
                        })
                      }}
                    />
                    <Label htmlFor="export-select-all" className="text-sm font-medium cursor-pointer">
                      Select all ({matched.length})
                    </Label>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {exportReady.length} selected
                  </span>
                </div>

                {/* ── Product list ─────────────────────────────────── */}
                <ScrollArea className="flex-1 min-h-0 max-h-[350px] border rounded-md">
                  <div className="divide-y">
                    {matched.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No products match your filters
                      </div>
                    ) : (
                      matched.map((p) => {
                        const name = [(p as any).variant, (p as any).brand, p.productName].filter(Boolean).join(' ')
                        const isSelected = exportSelected.has(p._id)
                        return (
                          <label
                            key={p._id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setExportSelected(prev => {
                                  const next = new Set(prev)
                                  if (checked) next.add(p._id)
                                  else next.delete(p._id)
                                  return next
                                })
                              }}
                            />
                            <span className="flex-1 text-sm truncate">{name}</span>
                            <Badge
                              variant={p.stock > 0 ? 'default' : 'destructive'}
                              className="text-[10px]"
                            >
                              {p.stock}
                            </Badge>
                          </label>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                {/* ── Export buttons ────────────────────────────────── */}
                <div className="flex gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={exportReady.length === 0}
                    onClick={() => handleDownloadStock(exportReady)}
                  >
                    <Download size={16} className="mr-2" />
                    Download CSV ({exportReady.length})
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={exportReady.length === 0}
                    onClick={() => handleDownloadPDF(exportReady)}
                  >
                    <FileText size={16} className="mr-2" />
                    Download PDF ({exportReady.length})
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

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
        canSeeCost={canSeeCost}
        onSuccess={() => {
          setIsBulkEditOpen(false)
          fetchProducts()
        }}
      />

      {/* Lot Creator Modal */}
      <LotCreatorModal
        open={isLotCreatorOpen}
        product={selectedProduct}
        onClose={() => {
          setIsLotCreatorOpen(false)
          setSelectedProduct(null)
        }}
        onSaved={() => {
          setIsLotCreatorOpen(false)
          setSelectedProduct(null)
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
