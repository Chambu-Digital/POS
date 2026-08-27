'use client'

import { useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface BarProduct {
  _id: string
  name: string
  size: string
  brandCategory: string
  stock: number
  openBottleCount: number
}

interface OpenBottleModalProps {
  isOpen: boolean
  onClose: () => void
  products: BarProduct[]
  onBottleOpened: () => void
}

export function OpenBottleModal({ isOpen, onClose, products, onBottleOpened }: OpenBottleModalProps) {
  const [search, setSearch] = useState('')
  const [opening, setOpening] = useState<string | null>(null)

  if (!isOpen) return null

  const filteredProducts = products
    .filter(p => p.stock > 0)  // Only show products with sealed stock
    .filter(p => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q) ||
        p.brandCategory.toLowerCase().includes(q)
      )
    })

  async function handleOpenBottle(product: BarProduct) {
    setOpening(product._id)
    try {
      const res = await fetch('/api/bar/bottles/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryItemId: product._id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to open bottle')
      }

      toast.success(`Opened ${product.name} ${product.size}`)
      onBottleOpened()
      onClose()
      setSearch('')
    } catch (error: any) {
      console.error('Failed to open bottle:', error)
      toast.error(error.message || 'Failed to open bottle')
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Open Bottle</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {search ? 'No products found' : 'No products with stock available'}
            </div>
          ) : (
            filteredProducts.map((product) => (
              <button
                key={product._id}
                onClick={() => handleOpenBottle(product)}
                disabled={opening !== null}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-left">
                  <p className="font-medium">
                    {product.name} <span className="text-muted-foreground font-normal">{product.size}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product.brandCategory} • {product.stock} sealed • {product.openBottleCount} open
                  </p>
                </div>
                {opening === product._id ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <div className="text-xs text-muted-foreground">Open →</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
