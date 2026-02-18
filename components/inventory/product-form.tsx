'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Product {
  _id?: string
  productName: string
  category: string
  variant?: string
  brand?: string
  model?: string
  unit?: string
  buyingPrice: number
  sellingPrice: number
  wholeSale?: number
  description?: string
  stock: number
}

interface ProductFormProps {
  product?: Product | null
  onSuccess: () => void
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<Product>(
    product || {
      productName: '',
      category: '',
      variant: '',
      brand: '',
      model: '',
      unit: 'piece',
      buyingPrice: 0,
      sellingPrice: 0,
      wholeSale: 0,
      description: '',
      stock: 0,
    }
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes('Price') || name === 'stock' ? parseFloat(value) || 0 : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const method = product ? 'PUT' : 'POST'
      const url = product ? `/api/products/${product._id}` : '/api/products'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to save product')
      }

      toast.success(product ? 'Product updated' : 'Product created')
      onSuccess()
    } catch (error) {
      toast.error('Error saving product')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2 col-span-3">
          <Label htmlFor="productName">Product Name *</Label>
          <Input
            id="productName"
            name="productName"
            value={formData.productName}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Input
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            name="model"
            value={formData.model}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="variant">Variant</Label>
          <Input
            id="variant"
            name="variant"
            value={formData.variant}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Input
            id="unit"
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock Quantity *</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            value={formData.stock}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="buyingPrice">Buying Price *</Label>
          <Input
            id="buyingPrice"
            name="buyingPrice"
            type="number"
            step="0.01"
            value={formData.buyingPrice}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sellingPrice">Selling Price *</Label>
          <Input
            id="sellingPrice"
            name="sellingPrice"
            type="number"
            step="0.01"
            value={formData.sellingPrice}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wholeSale">Wholesale Price</Label>
          <Input
            id="wholeSale"
            name="wholeSale"
            type="number"
            step="0.01"
            value={formData.wholeSale}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="space-y-2 col-span-3">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            disabled={loading}
            className="min-h-[60px]"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button
          type="submit"
          disabled={loading}
          className="min-w-[100px]"
        >
          {loading ? 'Saving...' : product ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
