'use client'

import { useState, useEffect } from 'react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface MenuItem {
  id: string
  name: string
  description: string
  category: string
  price: number
  prepTime: number
  station: string
  available: boolean
  popular: boolean
  image: string
  productId?: {
    id: string
    name: string
    stock: number
  }
  vegetarian: boolean
  vegan: boolean
  glutenFree: boolean
  spicyLevel: number
}

interface Product {
  _id: string
  name: string
  stock: number
}

export default function MenuManagementPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [importing, setImporting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'main',
    price: '',
    prepTime: '15',
    station: 'all',
    available: true,
    popular: false,
    productId: 'none',
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    spicyLevel: 0,
  })

  useEffect(() => {
    loadMenuItems()
    loadProducts()
  }, [])

  const loadMenuItems = async () => {
    try {
      const res = await fetch('/api/kds/menu')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setMenuItems(data.menuItems)
    } catch (error) {
      toast.error('Failed to load menu items')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/products')
      if (!res.ok) return
      const data = await res.json()
      setProducts(data.products)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter item name')
      return
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error('Please enter valid price')
      return
    }

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        price: parseFloat(formData.price),
        prepTime: parseInt(formData.prepTime) || 15,
        station: formData.station,
        available: formData.available,
        popular: formData.popular,
        vegetarian: formData.vegetarian,
        vegan: formData.vegan,
        glutenFree: formData.glutenFree,
        spicyLevel: formData.spicyLevel,
        productId: formData.productId === 'none' ? undefined : formData.productId,
      }

      const res = await fetch('/api/kds/menu', {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem ? { id: editingItem.id, ...payload } : payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.details || error.error || 'Failed to save')
      }

      toast.success(editingItem ? 'Menu item updated!' : 'Menu item created!')
      setShowDialog(false)
      resetForm()
      loadMenuItems()
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save menu item')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu item?')) return

    try {
      const res = await fetch(`/api/kds/menu?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Menu item deleted')
      loadMenuItems()
    } catch (error) {
      toast.error('Failed to delete menu item')
    }
  }

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price.toString(),
      prepTime: item.prepTime.toString(),
      station: item.station,
      available: item.available,
      popular: item.popular,
      productId: item.productId?.id || 'none',
      vegetarian: item.vegetarian,
      vegan: item.vegan,
      glutenFree: item.glutenFree,
      spicyLevel: item.spicyLevel,
    })
    setShowDialog(true)
  }

  const toggleAvailability = async (item: MenuItem, checked: boolean) => {
    try {
      const res = await fetch('/api/kds/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, available: checked }),
      })
      if (!res.ok) throw new Error('Failed to update')
      loadMenuItems()
      toast.success('Availability updated')
    } catch (error) {
      toast.error('Failed to update')
    }
  }

  const resetForm = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      description: '',
      category: 'main',
      price: '',
      prepTime: '15',
      station: 'all',
      available: true,
      popular: false,
      productId: 'none',
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      spicyLevel: 0,
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
      const res = await fetch('/api/kds/menu/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.details || error.error || 'Import failed')
      }

      const result = await res.json()
      toast.success(`Successfully imported ${result.imported} menu items!`)
      setShowImportDialog(false)
      loadMenuItems()
    } catch (error) {
      console.error('Import error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to import menu')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const downloadTemplate = () => {
    const template = `Name,Description,Category,Price,PrepTime,Station,Vegetarian,Vegan,GlutenFree,SpicyLevel
Grilled Salmon,Fresh Atlantic salmon with herbs,main,850,20,grill,no,no,yes,0
Caesar Salad,Classic Caesar with croutons,starter,450,10,all,yes,no,no,0
Margherita Pizza,Fresh mozzarella and basil,main,650,15,pizza,yes,no,no,0
Chocolate Cake,Rich chocolate dessert,dessert,350,5,dessert,yes,no,no,0
Fresh Juice,Seasonal fruit juice,drink,200,5,drinks,yes,yes,yes,0`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'menu-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredItems = menuItems.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return item.name.toLowerCase().includes(search) || 
             item.description.toLowerCase().includes(search)
    }
    return true
  })

  const categoryColors: Record<string, string> = {
    starter: 'bg-blue-100 text-blue-700',
    main: 'bg-orange-100 text-orange-700',
    side: 'bg-green-100 text-green-700',
    dessert: 'bg-purple-100 text-purple-700',
    drink: 'bg-cyan-100 text-cyan-700',
  }

  return (
    <PermissionGuard requiredPermission="kds.menu">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Menu </h1>
            <p className="text-gray-600 mt-1">Manage your restaurant menu items</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowImportDialog(true)}
              variant="outline"
            >
               Import Menu
            </Button>
            <Button 
              onClick={() => { resetForm(); setShowDialog(true); }}
              className="bg-green-600 hover:bg-green-700"
            >
              + Add Menu Item
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{menuItems.length}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {menuItems.filter(i => i.available).length}
              </div>
              <div className="text-sm text-gray-600">Available</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600">
                {menuItems.filter(i => i.popular).length}
              </div>
              <div className="text-sm text-gray-600">Popular Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">
                {menuItems.filter(i => i.productId).length}
              </div>
              <div className="text-sm text-gray-600">Linked to Stock</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="starter">Starters</SelectItem>
              <SelectItem value="main">Mains</SelectItem>
              <SelectItem value="side">Sides</SelectItem>
              <SelectItem value="dessert">Desserts</SelectItem>
              <SelectItem value="drink">Drinks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Menu Items Table */}
        {loading ? (
          <div className="text-center py-20">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <div className="text-6xl mb-4"></div>
              <div className="text-xl font-semibold text-gray-700">No Menu Items</div>
              <div className="text-gray-500 mt-2">Add your first menu item to get started</div>
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
                      <th className="px-4 py-3 text-right text-sm font-semibold">Price</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Prep Time</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Station</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Dietary</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Stock Link</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id} className={`border-b hover:bg-gray-50 ${!item.available ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {item.name}
                              {item.popular && <span className="text-xs"></span>}
                            </div>
                            {item.description && (
                              <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={categoryColors[item.category]}>
                            {item.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-green-600">
                            KES {item.price.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {item.prepTime}min
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs bg-gray-100 px-2 py-1">
                            {item.station === 'grill' && 'Grill'}
                            {item.station === 'drinks' && ' Drinks'}
                            {item.station === 'dessert' && ' Dessert'}
                            {item.station === 'pizza' && ' Pizza'}
                            {item.station === 'all' && 'All'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center flex-wrap">
                            {item.vegetarian && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5"></span>
                            )}
                            {item.vegan && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5"></span>
                            )}
                            {item.glutenFree && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5"></span>
                            )}
                            {item.spicyLevel > 0 && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5">
                                {''.repeat(Math.min(item.spicyLevel, 3))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.productId ? (
                            <div className="text-xs">
                              <div className="font-medium">{item.productId.name}</div>
                              <div className="text-gray-500">Stock: {item.productId.stock}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={item.available}
                            onCheckedChange={(checked) => toggleAvailability(item, checked)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(item)}
                              className="h-8 px-2 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(item.id)}
                              className="h-8 px-2 text-xs text-red-600 hover:text-red-700"
                            >
                              Delete
                            </Button>
                          </div>
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
              <DialogTitle>Import Menu Items</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 border border-blue-200">
                <p className="text-sm text-blue-900 mb-2">
                  Upload an Excel or CSV file with your menu items. The file should have these columns:
                </p>
                <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Name (required)</li>
                  <li>Description</li>
                  <li>Category (starter/main/side/dessert/drink)</li>
                  <li>Price (required, in KES)</li>
                  <li>PrepTime (minutes)</li>
                  <li>Station (grill/drinks/dessert/pizza/all)</li>
                  <li>Vegetarian (yes/no)</li>
                  <li>Vegan (yes/no)</li>
                  <li>GlutenFree (yes/no)</li>
                  <li>SpicyLevel (0-5)</li>
                </ul>
              </div>

              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="w-full"
              >
                 Download Template
              </Button>

              <div className="border-2 border-dashed border-gray-300 p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileImport}
                  disabled={importing}
                  className="hidden"
                  id="menu-file-upload"
                />
                <label
                  htmlFor="menu-file-upload"
                  className="cursor-pointer"
                >
                  <div className="text-4xl mb-2"></div>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Item Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Grilled Salmon"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="main">Main</SelectItem>
                      <SelectItem value="side">Side</SelectItem>
                      <SelectItem value="dessert">Dessert</SelectItem>
                      <SelectItem value="drink">Drink</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Kitchen Station</Label>
                  <Select 
                    value={formData.station} 
                    onValueChange={(v) => setFormData({ ...formData, station: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stations</SelectItem>
                      <SelectItem value="grill"> Grill</SelectItem>
                      <SelectItem value="drinks"> Drinks</SelectItem>
                      <SelectItem value="dessert"> Dessert</SelectItem>
                      <SelectItem value="pizza"> Pizza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Price (KES) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Prep Time (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.prepTime}
                    onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Link to Inventory Product (Optional)</Label>
                  <Select 
                    value={formData.productId || 'none'} 
                    onValueChange={(v) => setFormData({ ...formData, productId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {products.map(p => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name} (Stock: {p.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Link to track stock levels for this menu item
                  </p>
                </div>

                <div>
                  <Label>Spicy Level</Label>
                  <Select 
                    value={formData.spicyLevel.toString()} 
                    onValueChange={(v) => setFormData({ ...formData, spicyLevel: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Not Spicy</SelectItem>
                      <SelectItem value="1">Mild</SelectItem>
                      <SelectItem value="2"> Medium</SelectItem>
                      <SelectItem value="3"> Hot</SelectItem>
                      <SelectItem value="4"> Very Hot</SelectItem>
                      <SelectItem value="5"> Extreme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Available</Label>
                    <Switch
                      checked={formData.available}
                      onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Popular Item</Label>
                    <Switch
                      checked={formData.popular}
                      onCheckedChange={(checked) => setFormData({ ...formData, popular: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Vegetarian</Label>
                    <Switch
                      checked={formData.vegetarian}
                      onCheckedChange={(checked) => setFormData({ ...formData, vegetarian: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Vegan</Label>
                    <Switch
                      checked={formData.vegan}
                      onCheckedChange={(checked) => setFormData({ ...formData, vegan: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Gluten Free</Label>
                    <Switch
                      checked={formData.glutenFree}
                      onCheckedChange={(checked) => setFormData({ ...formData, glutenFree: checked })}
                    />
                  </div>
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
                  {editingItem ? 'Update' : 'Create'} Menu Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
