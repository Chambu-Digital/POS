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
import { Plus, Upload, Download, Trash2, Edit2, Search, FolderTree } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { ProductForm } from '@/components/inventory/product-form'
import { ImportModal } from '@/components/inventory/import-modal'
import { CategoryManager } from '@/components/inventory/category-manager'
import { ProductImage } from '@/components/ui/product-image'

interface Product {
  _id: string
  productName: string
  category: string
  stock: number
  buyingPrice: number
  sellingPrice: number
  description?: string
  images?: string[]
}

export default function InventoryPage() {
  return (
    <PermissionGuard requiredPermission="canViewInventory">
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
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    const filtered = products.filter((p) =>
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    )
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

  function handleDownloadTemplate() {
    const headers = ['productName', 'category', 'brand', 'model', 'unit', 'buyingPrice', 'sellingPrice', 'stock', 'description']
    const csv = headers.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0)
  const stockValue = products.reduce((sum, p) => sum + (p.stock * p.sellingPrice), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-muted-foreground mt-2">Manage by Admin User</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-sm text-muted-foreground">Estimated Sales</p>
            <p className="text-lg font-semibold text-primary mt-2">
              KSh {(products.reduce((sum, p) => sum + (p.stock * (p.sellingPrice - p.buyingPrice)), 0)).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Stock Value</p>
            <p className="text-lg font-semibold text-primary mt-2">
              KSh {stockValue.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="w-full"
              size="sm"
            >
              <Plus size={16} className="mr-2" />
              Create Item
            </Button>
            <Button
              onClick={() => setIsImportOpen(true)}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Upload size={16} className="mr-2" />
              Import Items
            </Button>
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Download size={16} className="mr-2" />
              Download Template
            </Button>
            <Button
              onClick={() => setIsCategoryManagerOpen(true)}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <FolderTree size={16} className="mr-2" />
              Manage Categories
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Search size={20} className="text-muted-foreground" />
            <Input
              placeholder="Search products..."
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Buying Price</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead>W/Sale</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow 
                      key={product._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedProduct(product)
                        setIsViewOpen(true)
                      }}
                    >
                      <TableCell>
                        <ProductImage
                          src={product.images?.[0]}
                          alt={product.productName}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{product.productName}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{(product as any).variant || '-'}</TableCell>
                      <TableCell>{(product as any).brand || '-'}</TableCell>
                      <TableCell>{(product as any).model || '-'}</TableCell>
                      <TableCell className="text-green-600 font-semibold">{product.stock}</TableCell>
                      <TableCell>{(product as any).unit || 'pieces'}</TableCell>
                      <TableCell>KSh {product.buyingPrice.toLocaleString()}</TableCell>
                      <TableCell>KSh {product.sellingPrice.toLocaleString()}</TableCell>
                      <TableCell>KSh {((product as any).wholeSale || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.description || '-'}</TableCell>
                      <TableCell className="text-primary font-semibold">
                        KSh {(product.stock * product.sellingPrice).toLocaleString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedProduct(product)
                              setIsEditOpen(true)
                            }}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProduct(product._id)
                            }}
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Product Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setIsEditOpen(false)
          setSelectedProduct(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? 'Edit Product' : 'Create Product'}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct ? 'Update product information' : 'Add a new product to your inventory'}
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            product={selectedProduct}
            onSuccess={() => {
              setIsCreateOpen(false)
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
            <div className="space-y-6">
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
                  <p className="text-lg font-semibold text-green-600">{selectedProduct.stock}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Stock Value</Label>
                  <p className="text-lg font-semibold text-primary">
                    KSh {(selectedProduct.stock * selectedProduct.sellingPrice).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Buying Price</Label>
                  <p className="text-lg font-semibold">KSh {selectedProduct.buyingPrice.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Selling Price</Label>
                  <p className="text-lg font-semibold">KSh {selectedProduct.sellingPrice.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Wholesale Price</Label>
                  <p className="text-lg font-semibold">KSh {((selectedProduct as any).wholeSale || 0).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Profit Margin</Label>
                  <p className="text-lg font-semibold text-green-600">
                    KSh {(selectedProduct.sellingPrice - selectedProduct.buyingPrice).toLocaleString()}
                  </p>
                </div>
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
                <Button
                  onClick={() => {
                    setIsViewOpen(false)
                    setIsEditOpen(true)
                  }}
                  className="flex-1"
                >
                  <Edit2 size={16} className="mr-2" />
                  Edit Product
                </Button>
                <Button
                  onClick={() => {
                    setIsViewOpen(false)
                    handleDeleteProduct(selectedProduct._id)
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Product
                </Button>
              </div>
            </div>
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
    </div>
  )
}
