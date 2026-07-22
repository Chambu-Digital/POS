'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface Brand {
  _id: string
  name: string
  category: string
}

export default function NewInventoryItemPage() {
  return (
    <PermissionGuard requiredPermission="bar.inventory">
      <NewItemContent />
    </PermissionGuard>
  )
}

function NewItemContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedBrandId = searchParams.get('brandId') || ''
  
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [form, setForm] = useState({
    brandId: preselectedBrandId,
    name: '',
    size: '',
    buyingPrice: '',
    bottleSellingPrice: '',
    stock: '0',
    lowStockThreshold: '3',
  })
  const [newBrand, setNewBrand] = useState({
    name: '',
    category: '',
    description: '',
  })

  useEffect(() => { loadBrands() }, [])

  async function loadBrands() {
    setLoading(true)
    try {
      const res = await fetch('/api/bar/brands')
      if (res.ok) {
        const data = await res.json()
        setBrands(data.brands?.filter((b: Brand) => !b.isArchived) || [])
      }
    } catch { toast.error('Failed to load brands') }
    setLoading(false)
  }

  async function createBrandInline() {
    if (!newBrand.name.trim()) { toast.error('Brand name is required'); return }
    
    setCreatingBrand(true)
    try {
      const res = await fetch('/api/bar/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBrand),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create brand')
      }
      const data = await res.json()
      toast.success('Brand created successfully')
      setForm({ ...form, brandId: data.brand._id })
      setNewBrand({ name: '', category: '', description: '' })
      loadBrands()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create brand')
    }
    setCreatingBrand(false)
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault()
    
    if (form.brandId === 'new') {
      toast.error('Please create the brand first')
      return
    }
    if (!form.brandId) { toast.error('Select a brand'); return }
    if (!form.name.trim()) { toast.error('Item name is required'); return }
    if (!form.size.trim()) { toast.error('Size is required'); return }
    
    const buyingPrice = parseFloat(form.buyingPrice)
    const bottleSellingPrice = parseFloat(form.bottleSellingPrice)
    const stock = parseInt(form.stock)
    const lowStockThreshold = parseInt(form.lowStockThreshold)
    
    if (!buyingPrice || buyingPrice <= 0) { toast.error('Valid buying price required'); return }
    if (!bottleSellingPrice || bottleSellingPrice <= 0) { toast.error('Valid selling price required'); return }
    if (stock < 0) { toast.error('Stock cannot be negative'); return }
    
    setSaving(true)
    try {
      const res = await fetch('/api/bar/inventory-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: form.brandId,
          name: form.name,
          size: form.size,
          buyingPrice,
          bottleSellingPrice,
          stock,
          lowStockThreshold,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create item')
      }
      toast.success('Item created successfully')
      router.push(`/dashboard/bar/inventory`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create item')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add Inventory Item</h1>
          <p className="text-muted-foreground">Create a new bar inventory item</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Brand *</label>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading brands...</div>
              ) : (
                <>
                  <select
                    value={form.brandId}
                    onChange={e => setForm({ ...form, brandId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select a brand...</option>
                    <option value="new">+ Create new brand</option>
                    {brands.map(brand => (
                      <option key={brand._id} value={brand._id}>
                        {brand.name} ({brand.category})
                      </option>
                    ))}
                  </select>
                  
                  {form.brandId === 'new' && (
                    <div className="mt-3 p-4 bg-muted rounded-lg space-y-3">
                      <h4 className="font-medium text-sm">Create New Brand</h4>
                      <div>
                        <label className="block text-sm font-medium mb-1">Brand Name *</label>
                        <Input
                          value={newBrand.name}
                          onChange={e => setNewBrand({ ...newBrand, name: e.target.value })}
                          placeholder="e.g., Jameson, Tusker"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Category</label>
                        <Input
                          value={newBrand.category}
                          onChange={e => setNewBrand({ ...newBrand, category: e.target.value })}
                          placeholder="e.g., Whisky, Beer, Wine"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <Input
                          value={newBrand.description}
                          onChange={e => setNewBrand({ ...newBrand, description: e.target.value })}
                          placeholder="Optional description"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={createBrandInline}
                        disabled={creatingBrand || !newBrand.name.trim()}
                        size="sm"
                      >
                        {creatingBrand ? 'Creating...' : 'Create Brand'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Item Name *</label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Jameson Irish Whiskey"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Size *</label>
              <Input
                value={form.size}
                onChange={e => setForm({ ...form, size: e.target.value })}
                placeholder="e.g., 750ml, 1L, 500ml"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Buying Price *</label>
                <Input
                  type="number"
                  value={form.buyingPrice}
                  onChange={e => setForm({ ...form, buyingPrice: e.target.value })}
                  placeholder="e.g., 2500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bottle Selling Price *</label>
                <Input
                  type="number"
                  value={form.bottleSellingPrice}
                  onChange={e => setForm({ ...form, bottleSellingPrice: e.target.value })}
                  placeholder="e.g., 3500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Initial Stock</label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
                <Input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })}
                  placeholder="3"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Item'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
