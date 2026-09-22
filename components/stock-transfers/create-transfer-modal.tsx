'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Branch {
  _id: string
  name: string
  code: string
}

interface Item {
  module: 'retail' | 'pharmacy'
  moduleItemId: string
  itemName: string
  quantitySent: number
  unitPrice: number
  stock?: number
}

interface CreateTransferModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateTransferModal({ isOpen, onClose, onSuccess }: CreateTransferModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [toBranchId, setToBranchId] = useState('')
  const [module, setModule] = useState<'retail' | 'pharmacy'>('retail')
  const [items, setItems] = useState<Item[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchBranches()
    }
  }, [isOpen])

  async function fetchBranches() {
    try {
      const response = await fetch('/api/branches?status=active')
      if (response.ok) {
        const data = await response.json()
        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error)
    }
  }

  async function searchItems() {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const endpoint = module === 'retail' 
        ? `/api/products?search=${encodeURIComponent(searchQuery)}&limit=20`
        : `/api/pharmacy/drugs?search=${encodeURIComponent(searchQuery)}&limit=20`

      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(module === 'retail' ? data.products || [] : data.drugs || [])
      }
    } catch (error) {
      console.error('Failed to search items:', error)
      toast.error('Failed to search items')
    } finally {
      setIsSearching(false)
    }
  }

  function addItem(item: any) {
    // Check if already added
    if (items.some(i => i.moduleItemId === item._id)) {
      toast.error('Item already added')
      return
    }

    const newItem: Item = {
      module,
      moduleItemId: item._id,
      itemName: module === 'retail' ? item.productName : item.genericName,
      quantitySent: 1,
      unitPrice: module === 'retail' ? item.sellingPrice : item.sellingPrice,
      stock: item.stock,
    }

    setItems([...items, newItem])
    setSearchQuery('')
    setSearchResults([])
  }

  function updateItemQuantity(index: number, quantity: number) {
    const newItems = [...items]
    newItems[index].quantitySent = quantity
    setItems(newItems)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!toBranchId) {
      toast.error('Please select a destination branch')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    // Validate quantities
    for (const item of items) {
      if (item.quantitySent <= 0) {
        toast.error(`Invalid quantity for ${item.itemName}`)
        return
      }
      if (item.stock !== undefined && item.quantitySent > item.stock) {
        toast.error(`Insufficient stock for ${item.itemName}. Available: ${item.stock}`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toBranchId,
          items: items.map(({ stock, ...item }) => item), // Remove stock field
          notes,
        }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to create transfer')
      }
    } catch (error) {
      console.error('Failed to create transfer:', error)
      toast.error('Failed to create transfer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
          <DialogDescription>Transfer items to another branch</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Destination Branch */}
          <div>
            <Label>Destination Branch</Label>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch._id} value={branch._id}>
                    {branch.name} ({branch.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Module Selection */}
          <div>
            <Label>Module</Label>
            <Select value={module} onValueChange={(val: any) => { setModule(val); setSearchResults([]); setItems([]) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail Products</SelectItem>
                <SelectItem value="pharmacy">Pharmacy Drugs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Items */}
          <div>
            <Label>Add Items</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchItems()}
              />
              <Button type="button" onClick={searchItems} disabled={isSearching}>
                <Search size={16} />
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                {searchResults.map(item => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="w-full p-2 text-left hover:bg-muted flex justify-between items-center border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">
                        {module === 'retail' ? item.productName : item.genericName}
                      </p>
                      <p className="text-sm text-muted-foreground">Stock: {item.stock}</p>
                    </div>
                    <Plus size={16} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Items */}
          {items.length > 0 && (
            <div className="border rounded-md p-4 space-y-3">
              <h4 className="font-medium">Selected Items ({items.length})</h4>
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-3 pb-3 border-b last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.itemName}</p>
                    {item.stock !== undefined && (
                      <p className="text-sm text-muted-foreground">Available: {item.stock}</p>
                    )}
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max={item.stock}
                    value={item.quantitySent}
                    onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                    className="w-24"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any notes about this transfer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || items.length === 0}>
              {isSubmitting ? 'Creating...' : 'Create Transfer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
