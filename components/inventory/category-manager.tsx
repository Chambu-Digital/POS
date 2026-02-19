'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Package, RefreshCw } from 'lucide-react'

interface Category {
  _id: string
  name: string
  description: string
  productCount: number
  color: string
  icon: string
  isActive: boolean
}

interface CategoryManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoryManager({ open, onOpenChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  })

  useEffect(() => {
    if (open) {
      fetchCategories()
    }
  }, [open])

  async function fetchCategories() {
    setLoading(true)
    try {
      const response = await fetch('/api/categories?includeCount=true')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setLoading(true)
    try {
      const response = await fetch('/api/categories/sync', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(`Synced: ${data.created} created, ${data.updated} updated`)
        fetchCategories()
      }
    } catch (error) {
      toast.error('Failed to sync categories')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const method = editingCategory ? 'PUT' : 'POST'
      const url = editingCategory
        ? `/api/categories/${editingCategory._id}`
        : '/api/categories'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save category')
      }

      toast.success(editingCategory ? 'Category updated' : 'Category created')
      setIsFormOpen(false)
      setEditingCategory(null)
      setFormData({ name: '', description: '', color: '#3b82f6' })
      fetchCategories()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save category')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(category: Category) {
    if (!confirm(`Delete category "${category.name}"? This will fail if products exist in this category.`)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/categories/${category._id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete category')
      }

      toast.success('Category deleted')
      fetchCategories()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete category')
    } finally {
      setLoading(false)
    }
  }

  function handleEdit(category: Category) {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description,
      color: category.color,
    })
    setIsFormOpen(true)
  }

  function handleCreate() {
    setEditingCategory(null)
    setFormData({ name: '', description: '', color: '#3b82f6' })
    setIsFormOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Category Management</DialogTitle>
            <DialogDescription>
              Manage product categories. Categories are auto-created during import.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleCreate} size="sm">
                <Plus size={16} className="mr-2" />
                New Category
              </Button>
              <Button onClick={handleSync} variant="outline" size="sm" disabled={loading}>
                <RefreshCw size={16} className="mr-2" />
                Sync from Products
              </Button>
            </div>

            {loading && categories.length === 0 ? (
              <div className="text-center py-8">Loading...</div>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No categories found. Import products or create categories manually.
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {category.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Package size={14} />
                          {category.productCount}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleEdit(category)}
                            variant="ghost"
                            size="sm"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            onClick={() => handleDelete(category)}
                            variant="ghost"
                            size="sm"
                            disabled={category.productCount > 0}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  disabled={loading}
                  className="w-20"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

