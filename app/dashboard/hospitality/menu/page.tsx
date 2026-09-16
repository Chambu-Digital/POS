'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Edit2, Trash2, Package, Utensils, Grid3x3, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface ServingType {
  _id?: string
  name: string
  servingsPerUnit: number
  pricePerServing: number
  volume?: number
  isDefault: boolean
  displayOrder: number
}

interface MenuItem {
  _id: string
  name: string
  description: string
  category: string
  sku: string
  barcode: string
  images: string[]
  itemType: 'for-sale' | 'ingredient'
  isServable: boolean
  servingMode: 'fraction' | 'volume' | null
  baseUnit: string
  wholePriceIfNotServable: number
  costPrice: number
  reorderPoint: number
  inventoryMode: 'tracked' | 'untracked'
  canConsolidate: boolean
  status: 'active' | 'inactive'
  servingTypes?: ServingType[]
}

interface Category {
  _id: string
  name: string
  description: string
  color: string
  icon: string
  displayOrder: number
  isVisible: boolean
}

export default function HospitalityMenuPage() {
  return (
    <PermissionGuard requiredPermission="hospitality.menu">
      <MenuContent />
    </PermissionGuard>
  )
}

function MenuContent() {
  const [tab, setTab] = useState<'items' | 'categories'>('items')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [itemTypeFilter, setItemTypeFilter] = useState<'' | 'for-sale' | 'ingredient'>('')
  
  // Modal states
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(loadItems, 300); return () => clearTimeout(t) }, [search, categoryFilter, itemTypeFilter])

  async function load() {
    await Promise.all([loadItems(), loadCategories()])
  }

  async function loadItems() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      if (itemTypeFilter) params.set('itemType', itemTypeFilter)
      
      const res = await fetch(`/api/hospitality/menu?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMenuItems(data.menuItems || [])
      } else {
        toast.error('Failed to load menu items')
      }
    } catch (error) {
      toast.error('Failed to load menu items')
    }
    setLoading(false)
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/hospitality/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    
    try {
      const res = await fetch(`/api/hospitality/menu/${item._id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Menu item deleted')
        loadItems()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete item')
      }
    } catch (error) {
      toast.error('Failed to delete item')
    }
  }

  async function deleteCategory(category: Category) {
    if (!confirm(`Delete category "${category.name}"?`)) return
    
    try {
      const res = await fetch(`/api/hospitality/categories/${category._id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Category deleted')
        loadCategories()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete category')
      }
    } catch (error) {
      toast.error('Failed to delete category')
    }
  }

  const filteredItems = menuItems

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your menu items and categories</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('items')}
          className={`px-4 py-2 -mb-px font-medium text-sm transition ${
            tab === 'items'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Utensils size={18} />
            Menu Items
          </div>
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`px-4 py-2 -mb-px font-medium text-sm transition ${
            tab === 'categories'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Grid3x3 size={18} />
            Categories
          </div>
        </button>
      </div>

      {/* Menu Items Tab */}
      {tab === 'items' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search menu items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="for-sale">For Sale</option>
              <option value="ingredient">Ingredient</option>
            </select>
            <Button onClick={() => { setEditingItem(null); setShowItemForm(true) }}>
              <Plus size={18} />
              Add Item
            </Button>
          </div>

          {/* Items Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No menu items found</p>
              <Button onClick={() => setShowItemForm(true)} className="mt-4">
                <Plus size={18} />
                Add Your First Item
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <Card key={item._id} className="hover:shadow-md transition">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingItem(item); setShowItemForm(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        item.itemType === 'for-sale' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {item.itemType === 'for-sale' ? 'For Sale' : 'Ingredient'}
                      </span>
                      {item.isServable && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                          Servable
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        item.inventoryMode === 'tracked'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.inventoryMode === 'tracked' ? 'Tracked' : 'Made-to-Order'}
                      </span>
                    </div>

                    {item.isServable && item.servingTypes && item.servingTypes.length > 0 ? (
                      <div className="text-sm">
                        <p className="text-gray-500 mb-1">{item.servingTypes.length} serving types:</p>
                        <div className="flex flex-wrap gap-1">
                          {item.servingTypes.slice(0, 3).map((st) => (
                            <span key={st._id} className="text-xs bg-gray-50 px-2 py-1 rounded">
                              {st.name} - KES {st.pricePerServing}
                            </span>
                          ))}
                          {item.servingTypes.length > 3 && (
                            <span className="text-xs text-gray-400">+{item.servingTypes.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Price:</span> KES {item.wholePriceIfNotServable || item.costPrice}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">{categories.length} categories</p>
            <Button onClick={() => { setEditingCategory(null); setShowCategoryForm(true) }}>
              <Plus size={18} />
              Add Category
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category._id} className="hover:shadow-md transition">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: category.color }}
                        />
                        <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        Display Order: {category.displayOrder}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingCategory(category); setShowCategoryForm(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteCategory(category)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Menu Item Form Modal */}
      {showItemForm && (
        <MenuItemFormModal
          item={editingItem}
          categories={categories}
          onClose={() => { setShowItemForm(false); setEditingItem(null) }}
          onSuccess={() => { setShowItemForm(false); setEditingItem(null); loadItems() }}
        />
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <CategoryFormModal
          category={editingCategory}
          onClose={() => { setShowCategoryForm(false); setEditingCategory(null) }}
          onSuccess={() => { setShowCategoryForm(false); setEditingCategory(null); loadCategories() }}
        />
      )}
    </div>
  )
}

// Menu Item Form Modal Component
function MenuItemFormModal({ 
  item, 
  categories, 
  onClose, 
  onSuccess 
}: { 
  item: MenuItem | null
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    category: item?.category || '',
    sku: item?.sku || '',
    barcode: item?.barcode || '',
    itemType: item?.itemType || 'for-sale' as 'for-sale' | 'ingredient',
    isServable: item?.isServable || false,
    servingMode: item?.servingMode || 'fraction' as 'fraction' | 'volume' | null,
    baseUnit: item?.baseUnit || 'unit',
    wholePriceIfNotServable: item?.wholePriceIfNotServable || 0,
    costPrice: item?.costPrice || 0,
    reorderPoint: item?.reorderPoint || 10,
    inventoryMode: item?.inventoryMode || 'tracked' as 'tracked' | 'untracked',
    canConsolidate: item?.canConsolidate || false,
  })
  const [servingTypes, setServingTypes] = useState<ServingType[]>(
    item?.servingTypes || []
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.category) { toast.error('Category is required'); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        servingTypes: form.isServable ? servingTypes : undefined
      }

      const url = item ? `/api/hospitality/menu/${item._id}` : '/api/hospitality/menu'
      const method = item ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        toast.success(item ? 'Menu item updated' : 'Menu item created')
        onSuccess()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save menu item')
      }
    } catch (error) {
      toast.error('Failed to save menu item')
    }
    setSaving(false)
  }

  function addServingType() {
    setServingTypes([...servingTypes, {
      name: '',
      servingsPerUnit: 1,
      pricePerServing: 0,
      volume: undefined,
      isDefault: servingTypes.length === 0,
      displayOrder: servingTypes.length
    }])
  }

  function updateServingType(index: number, field: string, value: any) {
    const updated = [...servingTypes]
    updated[index] = { ...updated[index], [field]: value }
    setServingTypes(updated)
  }

  function removeServingType(index: number) {
    setServingTypes(servingTypes.filter((_, i) => i !== index))
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle>{item ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Whiskey Bottle"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={2}
                placeholder="Brief description..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">SKU</label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Barcode</label>
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Base Unit</label>
                <Input
                  value={form.baseUnit}
                  onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}
                  placeholder="e.g., bottle, kg"
                />
              </div>
            </div>
          </div>

          {/* Type & Mode */}
          <div className="space-y-4">
            <h3 className="font-medium">Item Type & Inventory</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item Type</label>
                <select
                  value={form.itemType}
                  onChange={(e) => setForm({ ...form, itemType: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="for-sale">For Sale (sold to customers)</option>
                  <option value="ingredient">Ingredient (used in production)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Inventory Mode</label>
                <select
                  value={form.inventoryMode}
                  onChange={(e) => setForm({ ...form, inventoryMode: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="tracked">Tracked (requires stock)</option>
                  <option value="untracked">Untracked (made-to-order)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isServable}
                  onChange={(e) => setForm({ ...form, isServable: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Servable (supports multiple serving types)</span>
              </label>
              {form.isServable && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.canConsolidate}
                    onChange={(e) => setForm({ ...form, canConsolidate: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Can consolidate partials</span>
                </label>
              )}
            </div>

            {form.isServable && (
              <div>
                <label className="block text-sm font-medium mb-1">Serving Mode</label>
                <select
                  value={form.servingMode || 'fraction'}
                  onChange={(e) => setForm({ ...form, servingMode: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="fraction">Fraction-based (discrete servings)</option>
                  <option value="volume">Volume-based (liquid measurements)</option>
                </select>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-medium">Pricing</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cost Price</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              {!form.isServable && (
                <div>
                  <label className="block text-sm font-medium mb-1">Selling Price</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.wholePriceIfNotServable}
                    onChange={(e) => setForm({ ...form, wholePriceIfNotServable: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Reorder Point</label>
                <Input
                  type="number"
                  value={form.reorderPoint}
                  onChange={(e) => setForm({ ...form, reorderPoint: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Serving Types */}
          {form.isServable && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Serving Types</h3>
                <Button type="button" size="sm" onClick={addServingType}>
                  <Plus size={16} />
                  Add Serving Type
                </Button>
              </div>
              
              {servingTypes.map((st, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Serving Type {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeServingType(index)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Name</label>
                      <Input
                        size="sm"
                        value={st.name}
                        onChange={(e) => updateServingType(index, 'name', e.target.value)}
                        placeholder="e.g., Tot, Prime"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Servings per Unit</label>
                      <Input
                        type="number"
                        size="sm"
                        value={st.servingsPerUnit}
                        onChange={(e) => updateServingType(index, 'servingsPerUnit', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Price per Serving</label>
                      <Input
                        type="number"
                        step="0.01"
                        size="sm"
                        value={st.pricePerServing}
                        onChange={(e) => updateServingType(index, 'pricePerServing', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  {form.servingMode === 'volume' && (
                    <div>
                      <label className="block text-xs mb-1">Volume (ml)</label>
                      <Input
                        type="number"
                        size="sm"
                        value={st.volume || ''}
                        onChange={(e) => updateServingType(index, 'volume', parseInt(e.target.value) || undefined)}
                        placeholder="e.g., 250"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={st.isDefault}
                      onChange={() => {
                        const updated = servingTypes.map((s, i) => ({ ...s, isDefault: i === index }))
                        setServingTypes(updated)
                      }}
                    />
                    <span>Default serving type</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Category Form Modal Component
function CategoryFormModal({
  category,
  onClose,
  onSuccess
}: {
  category: Category | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || '#3b82f6',
    icon: category?.icon || 'utensils',
    displayOrder: category?.displayOrder || 0,
    isVisible: category?.isVisible !== false
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }

    setSaving(true)
    try {
      const url = category ? `/api/hospitality/categories/${category._id}` : '/api/hospitality/categories'
      const method = category ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (res.ok) {
        toast.success(category ? 'Category updated' : 'Category created')
        onSuccess()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save category')
      }
    } catch (error) {
      toast.error('Failed to save category')
    }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Drinks, Food"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-10 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Display Order</label>
              <Input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isVisible}
              onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Visible in POS</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : category ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
