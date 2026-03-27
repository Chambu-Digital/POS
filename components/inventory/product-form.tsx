'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, ImagePlus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'

interface Product {
  _id?: string
  productName: string
  category: string
  variant?: string
  brand?: string
  model?: string
  barcode?: string
  unit?: string
  buyingPrice: number
  sellingPrice: number
  wholeSale?: number
  description?: string
  stock: number
  images?: string[]
}

interface ProductFormProps {
  product?: Product | null
  onSuccess: () => void
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [images, setImages] = useState<string[]>(product?.images || [])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState<Product>(
    product || {
      productName: '',
      category: '',
      variant: '',
      brand: '',
      model: '',
      barcode: '',
      unit: 'piece',
      buyingPrice: 0,
      sellingPrice: 0,
      wholeSale: 0,
      description: '',
      stock: 0,
      images: [],
    }
  )

  useEffect(() => {
    fetchCategories()
  }, [])

  // Sync images when product prop changes (e.g. switching edit targets)
  useEffect(() => {
    setImages(product?.images || [])
  }, [product?._id])

  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories.map((c: any) => c.name).sort())
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  async function uploadImages(files: FileList | File[]) {
    setUploadingImages(true)
    try {
      const newUrls: string[] = []

      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('media', file)

        // Use product-specific route if we have an _id, generic route otherwise
        const endpoint = product?._id
          ? `/api/products/${product._id}/images`
          : '/api/media/upload'

        const res = await fetch(endpoint, { method: 'POST', body: fd })
        if (!res.ok) {
          const d = await res.json()
          toast.error(d.error ?? `Failed to upload "${file.name}"`)
          continue
        }
        const data = await res.json()

        if (product?._id) {
          // Route returns full updated images array
          setImages(data.images)
          setFormData(prev => ({ ...prev, images: data.images }))
          return // already updated in one shot
        } else {
          newUrls.push(data.url)
        }
      }

      if (newUrls.length) {
        setImages(prev => {
          const updated = [...prev, ...newUrls]
          setFormData(p => ({ ...p, images: updated }))
          return updated
        })
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploadingImages(false)
    }
  }

  async function removeImage(index: number) {
    if (product?._id) {
      try {
        const res = await fetch(`/api/products/${product._id}/images`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index }),
        })
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setImages(data.images)
        toast.success('Image removed')
      } catch {
        toast.error('Failed to remove image')
      }
    } else {
      const updated = images.filter((_, i) => i !== index)
      setImages(updated)
      setFormData(prev => ({ ...prev, images: updated }))
    }
  }

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
        body: JSON.stringify({ ...formData, images }),
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
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={categoryOpen}
                className="w-full justify-between"
                disabled={loading}
                type="button"
              >
                {formData.category || 'Select category...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search or type new category..." />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2 text-sm">
                      Press Enter to create &quot;{formData.category}&quot;
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {categories.map((category) => (
                      <CommandItem
                        key={category}
                        value={category}
                        onSelect={(currentValue) => {
                          setFormData({ ...formData, category: currentValue })
                          setCategoryOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            formData.category === category ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {category}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Input
            type="text"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="mt-2"
            placeholder="Or type a new category"
            disabled={loading}
            required
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
          <Label htmlFor="barcode">Barcode</Label>
          <Input
            id="barcode"
            name="barcode"
            value={formData.barcode ?? ''}
            onChange={handleChange}
            disabled={loading}
            placeholder="Scan or type barcode..."
            autoComplete="off"
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

        {/* ── Image Upload ── */}
        <div className="col-span-3 space-y-2">
          <Label>Product Images <span className="text-xs text-muted-foreground">(max 20MB each)</span></Label>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              if (e.dataTransfer.files.length) uploadImages(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              dragOver ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
            )}
          >
            {uploadingImages ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-sm text-gray-500">
                <ImagePlus className="h-8 w-8 text-gray-400" />
                <span>Drop images here or click to browse</span>
                <span className="text-xs">PNG, JPG, WEBP</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files?.length) uploadImages(e.target.files); e.target.value = '' }}
          />

          {/* Preview grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {images.map((src, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <ProductImage src={src} alt={`Product image ${i + 1}`} size="lg" className="w-full h-full aspect-square" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 bg-green-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      Main
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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
