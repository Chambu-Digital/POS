'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Pill, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Branch {
  _id: string
  name: string
  code: string
}

interface Drug {
  _id: string
  name: string
  genericName: string
  formulation: string
  strength: string
  unitPrice: number
  stock: number // Current branch stock from Inventory
}

interface TransferItem {
  drugId: string
  itemName: string
  quantitySent: number
  unitPrice: number
  availableStock: number
}

interface CreateDrugTransferModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateDrugTransferModal({ isOpen, onClose, onSuccess }: CreateDrugTransferModalProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [toBranchId, setToBranchId] = useState('')
  const [items, setItems] = useState<TransferItem[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchBranches()
      fetchDrugs()
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

  async function fetchDrugs() {
    setIsLoading(true)
    try {
      // Fetch all drugs with inventory for current branch
      const response = await fetch('/api/pharmacy/drugs')
      if (response.ok) {
        const data = await response.json()
        setDrugs(data.drugs || [])
      }
    } catch (error) {
      console.error('Failed to fetch drugs:', error)
      toast.error('Failed to load drugs')
    } finally {
      setIsLoading(false)
    }
  }

  function addItem(drug: Drug) {
    if (items.some(i => i.drugId === drug._id)) {
      toast.error('Item already added')
      return
    }

    if (drug.stock <= 0) {
      toast.error('No stock available for this drug')
      return
    }

    setItems([...items, {
      drugId: drug._id,
      itemName: `${drug.name} ${drug.strength} ${drug.formulation}`,
      quantitySent: 1,
      unitPrice: drug.unitPrice,
      availableStock: drug.stock,
    }])
    setSearchQuery('')
  }

  function updateItemQuantity(drugId: string, quantity: number) {
    setItems(items.map(item =>
      item.drugId === drugId
        ? { ...item, quantitySent: Math.min(Math.max(1, quantity), item.availableStock) }
        : item
    ))
  }

  function removeItem(drugId: string) {
    setItems(items.filter(item => item.drugId !== drugId))
  }

  async function handleSubmit() {
    if (!toBranchId) {
      toast.error('Please select destination branch')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toBranchId,
          items: items.map(item => ({
            drugId: item.drugId,
            itemName: item.itemName,
            quantitySent: item.quantitySent,
            unitPrice: item.unitPrice,
          })),
          notes,
        }),
      })

      if (response.ok) {
        toast.success('Transfer created successfully')
        onSuccess()
        onClose()
        // Reset form
        setToBranchId('')
        setItems([])
        setNotes('')
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

  const filteredDrugs = drugs.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.genericName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer - Pharmacy Drugs</DialogTitle>
          <DialogDescription>
            Transfer drugs from your current branch to another branch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Drug Search */}
          <div>
            <Label>Add Drugs</Label>
            <div className="relative">
              <Input
                placeholder="Search drugs by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Pill className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            {searchQuery && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {filteredDrugs.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No drugs found
                  </div>
                ) : (
                  filteredDrugs.slice(0, 10).map(drug => (
                    <button
                      key={drug._id}
                      onClick={() => addItem(drug)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                    >
                      <div>
                        <div className="font-medium text-sm">{drug.name}</div>
                        <div className="text-xs text-gray-500">
                          {drug.strength} {drug.formulation} {drug.genericName && `• ${drug.genericName}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">KES {drug.unitPrice}</div>
                        <div className="text-xs text-gray-500">Stock: {drug.stock}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>Transfer Items ({items.length})</Label>
              <div className="border rounded-lg divide-y">
                {items.map(item => (
                  <div key={item.drugId} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.itemName}</div>
                      <div className="text-xs text-gray-500">
                        Available: {item.availableStock} units
                      </div>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.quantitySent}
                        onChange={(e) => updateItemQuantity(item.drugId, parseInt(e.target.value) || 1)}
                        className="text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.drugId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
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
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0 || !toBranchId}
            >
              {isSubmitting ? 'Creating...' : 'Create Transfer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
