'use client'

import { useState, useEffect } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface InventoryItem {
  _id: string
  name: string
  category: string
  stock: number
  unit: string
  lowStockThreshold: number
  buyingPrice: number
  sellingPrice: number
}

export default function KDSInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [importing, setImporting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    stock: '',
    unit: 'kg',
    lowStockThreshold: '10',
    buyingPrice: '',
    sellingPrice: '',
  })

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setItems(data.products)
    } catch (error) {
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter item name')
      return
    }

    try {
      const payload = {
        productName: formData.name.trim(),
        category: formData.category.trim() || 'Restaurant Supplies',
        stock: parseFloat(formData.stock) || 0,
        unit: formData.unit,
        lowStockThreshold: parseInt(formData.lowStockThreshold) || 10,
        buyingPrice: parseFloat(formData.buyingPrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
      }

      const res = await fetch('/api/products', {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem ? { id: editingItem._id, ...payload } : payload),
      })

      if (!res.ok) throw new Error('Failed to save')

      toast.success(editingItem ? 'Item updated!' : 'Item added!')
      setShowDialog(false)
      resetForm()
      loadInventory()
    } catch (error) {
      toast.error('Failed to save item')
    }
  }

  const handleStockUpdate = async (item: InventoryItem, newStock: number) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item._id, stock: newStock }),
      })

      if (!res.ok) throw new Error('Failed to update')
      toast.success('Stock updated')
      loadInventory()
    } catch (error) {
      toast.error('Failed to update stock')
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: item.category,
      stock: item.stock.toString(),
      unit: item.unit || 'kg',
      lowStockThreshold: item.lowStockThreshold.toString(),
      buyingPrice: item.buyingPrice.toString(),
      sellingPrice: item.sellingPrice.toString(),
    })
    setShowDialog(true)
  }

  const resetForm = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      category: '',
      stock: '',
      unit: 'kg',
      lowStockThreshold: '10',
      buyingPrice: '',
      sellingPrice: '',
    })
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV file')
      return
    }

    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/kds/inventory/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.details || error.error || 'Import failed')
      }

      const result = await res.json()
      toast.success(`Successfully imported ${result.imported} inventory items!`)
      setShowImportDialog(false)
      loadInventory()
    } catch (error) {
      console.error('Import error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to import inventory')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const downloadTemplate = () => {
    const template = `Name,Category,Stock,Unit,LowStockThreshold,BuyingPrice,SellingPrice
Tomatoes,Vegetables,50,kg,10,80,120
Chicken Breast,Meat,30,kg,5,450,650
Cooking Oil,Pantry,20,liters,5,180,250
Rice,Grains,100,kg,20,90,130
Onions,Vegetables,40,kg,10,60,90`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inventory-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportInventory = () => {
    if (items.length === 0) {
      toast.error('No inventory items to export')
      return
    }

    const headers = 'Name,Category,Stock,Unit,LowStockThreshold,BuyingPrice,SellingPrice'
    const rows = items.map(item => 
      `${item.name},${item.category},${item.stock},${item.unit},${item.lowStockThreshold},${item.buyingPrice},${item.sellingPrice}`
    )
    const csv = [headers, ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Inventory exported successfully')
  }

  const filteredItems = items.filter(item => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return item.name.toLowerCase().includes(search) || 
           item.category.toLowerCase().includes(search)
  })

  const lowStockItems = items.filter(i => i.stock <= i.lowStockThreshold)
  const outOfStockItems = items.filter(i => i.stock === 0)

  return (
    <PermissionGuard requiredPermission="kds.inventory">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Restaurant Inventory</h1>
            <p className="text-gray-600 mt-1">Track and manage restaurant stock</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={exportInventory}
              variant="outline"
              disabled={items.length === 0}
            >
               Export
            </Button>
            <Button 
              onClick={() => setShowImportDialog(true)}
              variant="outline"
            >
               Import
            </Button>
            <Button 
              onClick={() => { resetForm(); setShowDialog(true); }}
              className="bg-green-600 hover:bg-green-700"
            >
              + Add Item
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600">{lowStockItems.length}</div>
              <div className="text-sm text-gray-600">Low Stock</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{outOfStockItems.length}</div>
              <div className="text-sm text-gray-600">Out of Stock</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                KES {items.reduce((sum, i) => sum + (i.stock * i.buyingPrice), 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Total Value</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Inventory Table */}
        {loading ? (
          <div className="text-center py-20">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <div className="text-xl font-semibold text-gray-700">No Inventory Items</div>
              <div className="text-gray-500 mt-2">Add your first item to get started</div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Item</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Stock</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Unit</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Buying Price</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Selling Price</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item._id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStockUpdate(item, Math.max(0, item.stock - 1))}
                              className="h-6 w-6 p-0"
                            >
                              -
                            </Button>
                            <span className="font-semibold min-w-[40px] text-center">
                              {item.stock}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStockUpdate(item, item.stock + 1)}
                              className="h-6 w-6 p-0"
                            >
                              +
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{item.unit}</td>
                        <td className="px-4 py-3 text-right">KES {item.buyingPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">KES {item.sellingPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {item.stock === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : item.stock <= item.lowStockThreshold ? (
                            <Badge className="bg-amber-500">Low Stock</Badge>
                          ) : (
                            <Badge className="bg-green-500">In Stock</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(item)}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Import Inventory Items</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm text-blue-900 mb-2">
                  Upload an Excel or CSV file with your inventory items. The file should have these columns:
                </p>
                <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Name (required)</li>
                  <li>Category</li>
                  <li>Stock (required, quantity)</li>
                  <li>Unit (kg, pcs, liters, etc.)</li>
                  <li>LowStockThreshold</li>
                  <li>BuyingPrice (in KES)</li>
                  <li>SellingPrice (in KES)</li>
                </ul>
              </div>

              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="w-full"
              >
                📄 Download Template
              </Button>

              <div className="border-2 border-dashed border-gray-300 p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileImport}
                  disabled={importing}
                  className="hidden"
                  id="inventory-file-upload"
                />
                <label
                  htmlFor="inventory-file-upload"
                  className="cursor-pointer"
                >
                  <div className="text-4xl mb-2">📁</div>
                  <div className="text-sm text-gray-600">
                    {importing ? 'Importing...' : 'Click to select file'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Excel (.xlsx, .xls) or CSV
                  </div>
                </label>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowImportDialog(false)}
                className="w-full"
                disabled={importing}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Item Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Tomatoes"
                />
              </div>

              <div>
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g. Vegetables"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stock Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Unit</Label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="kg, pcs, liters"
                  />
                </div>
              </div>

              <div>
                <Label>Low Stock Alert Threshold</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Buying Price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.buyingPrice}
                    onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Selling Price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {editingItem ? 'Update' : 'Add'} Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
