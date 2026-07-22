'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Archive, ArchiveRestore } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import Link from 'next/link'

interface Brand {
  _id: string
  name: string
  description: string
  category: string
  isArchived: boolean
  itemCount?: number
}

export default function BarBrandsPage() {
  return (
    <PermissionGuard requiredPermission="bar.admin">
      <BrandsContent />
    </PermissionGuard>
  )
}

function BrandsContent() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '', category: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/bar/brands')
      if (res.ok) {
        const data = await res.json()
        setBrands(data.brands || [])
      }
    } catch { toast.error('Failed to load brands') }
    setLoading(false)
  }

  async function createBrand(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) { toast.error('Brand name is required'); return }
    
    setSaving(true)
    try {
      const res = await fetch('/api/bar/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create brand')
      }
      toast.success('Brand created successfully')
      setCreateForm({ name: '', description: '', category: '' })
      setIsCreateOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create brand')
    }
    setSaving(false)
  }

  async function toggleArchive(brand: Brand) {
    try {
      const res = await fetch(`/api/bar/brands/${brand._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !brand.isArchived }),
      })
      if (!res.ok) throw new Error('Failed to update brand')
      toast.success(brand.isArchived ? 'Brand restored' : 'Brand archived')
      load()
    } catch { toast.error('Failed to update brand') }
  }

  const filtered = brands.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
                         b.category.toLowerCase().includes(search.toLowerCase())
    const matchesArchive = showArchived || !b.isArchived
    return matchesSearch && matchesArchive
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bar Brands</h1>
          <p className="text-muted-foreground">Manage alcohol brands and categories</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Brand
        </Button>
      </div>

      {isCreateOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBrand} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Brand Name *</label>
                <Input
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., Jameson, Tusker, Heineken"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Input
                  value={createForm.category}
                  onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                  placeholder="e.g., Whisky, Beer, Wine, Vodka"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Brand'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brands..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
              {showArchived ? 'Active' : 'Show Archived'}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No brands found' : 'No brands yet. Create your first brand to get started.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(brand => (
                <div
                  key={brand._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <Link href={`/dashboard/bar/brands/${brand._id}`}>
                      <h3 className="font-semibold hover:underline">{brand.name}</h3>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {brand.category && <span className="mr-2">{brand.category}</span>}
                      {brand.itemCount !== undefined && <span>• {brand.itemCount} items</span>}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleArchive(brand)}
                  >
                    {brand.isArchived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
