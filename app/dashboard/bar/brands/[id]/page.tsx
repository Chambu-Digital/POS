'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import Link from 'next/link'

interface Brand {
  _id: string
  name: string
  description: string
  category: string
  isArchived: boolean
}

interface InventoryItem {
  _id: string
  name: string
  size: string
  buyingPrice: number
  bottleSellingPrice: number
  stock: number
  lowStockThreshold: number
  isActive: boolean
}

export default function BrandDetailPage() {
  return (
    <PermissionGuard requiredPermission="bar.admin">
      <BrandDetailContent />
    </PermissionGuard>
  )
}

function BrandDetailContent() {
  const params = useParams()
  const router = useRouter()
  const [brand, setBrand] = useState<Brand | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [params.id])

  async function load() {
    setLoading(true)
    try {
      const [brandRes, itemsRes] = await Promise.all([
        fetch(`/api/bar/brands/${params.id}`),
        fetch(`/api/bar/inventory-items?brandId=${params.id}`),
      ])
      if (brandRes.ok) {
        const data = await brandRes.json()
        setBrand(data.brand)
        setEditForm({ name: data.brand.name, description: data.brand.description, category: data.brand.category })
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json()
        setItems(data.items || [])
      }
    } catch { toast.error('Failed to load brand') }
    setLoading(false)
  }

  async function updateBrand(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.name.trim()) { toast.error('Brand name is required'); return }
    
    setSaving(true)
    try {
      const res = await fetch(`/api/bar/brands/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error('Failed to update brand')
      toast.success('Brand updated successfully')
      setIsEditing(false)
      load()
    } catch { toast.error('Failed to update brand') }
    setSaving(false)
  }

  if (loading) return <div className="text-center py-8">Loading...</div>
  if (!brand) return <div className="text-center py-8">Brand not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{brand.name}</h1>
          <p className="text-muted-foreground">{brand.category || 'No category'}</p>
        </div>
        <Button onClick={() => setIsEditing(true)}>
          <Edit2 className="mr-2 h-4 w-4" /> Edit Brand
        </Button>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateBrand} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Brand Name *</label>
                <Input
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Input
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Inventory Items ({items.length})</CardTitle>
            <Link href={`/dashboard/bar/inventory/new?brandId=${brand._id}`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No inventory items yet. Add your first item to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <Link
                  key={item._id}
                  href={`/dashboard/bar/inventory/${item.brandName ? item.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + item.size.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '--' + item._id : item._id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.size} • KES {item.bottleSellingPrice.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${item.stock <= item.lowStockThreshold ? 'text-red-600' : ''}`}>
                      Stock: {item.stock}
                    </p>
                    {item.stock <= item.lowStockThreshold && (
                      <p className="text-xs text-red-600">Low stock</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
