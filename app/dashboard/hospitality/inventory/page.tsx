'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Package, AlertTriangle, Upload, TrendingDown, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface ServingType {
  _id: string
  name: string
  servingsPerUnit: number
  pricePerServing: number
}

interface PartialUnit {
  id: string
  servingsRemaining: Record<string, number>
  openedAt: string
  batchId?: string
}

interface Inventory {
  wholeUnits: number
  partialUnits: PartialUnit[]
  totalAvailableServings: Record<string, number>
  lastUpdated: string
  lastCountedAt: string
  variance: number
}

interface MenuItem {
  _id: string
  name: string
  description: string
  category: string
  baseUnit: string
  itemType: 'for-sale' | 'ingredient'
  isServable: boolean
  reorderPoint: number
  costPrice: number
  inventory: Inventory
  servingTypes?: ServingType[]
}

interface ReceiveItem {
  menuItemId: string
  quantity: number
  batchId?: string
}

export default function HospitalityInventoryPage() {
  return (
    <PermissionGuard requiredPermission="hospitality.inventory">
      <InventoryContent />
    </PermissionGuard>
  )
}

function InventoryContent() {
  const [tab, setTab] = useState<'for-sale' | 'ingredients' | 'receive'>('for-sale')
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  
  // Receive stock
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])
  const [receiveSearch, setReceiveSearch] = useState('')
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([])
  const [receiving, setReceiving] = useState(false)
  const [receiveNotes, setReceiveNotes] = useState('')
  const [receiveReference, setReceiveReference] = useState('')

  // Adjustment modal
  const [adjustItem, setAdjustItem] = useState<MenuItem | null>(null)
  const [adjustType, setAdjustType] = useState<'set-whole' | 'add' | 'subtract'>('add')
  const [adjustValue, setAdjustValue] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  useEffect(() => { load() }, [tab, lowStockOnly])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search, categoryFilter])
  useEffect(() => { if (tab === 'receive') loadAllMenuItems() }, [tab])

  async function load() {
    setLoading(true)
    try {
      const itemType = tab === 'for-sale' ? 'for-sale' : 'ingredient'
      const params = new URLSearchParams({ itemType })
      if (lowStockOnly) params.set('lowStockOnly', 'true')
      
      const res = await fetch(`/api/hospitality/inventory?${params}`)
      if (res.ok) {
        const data = await res.json()
        let inventory = data.inventory || []
        
        // Apply filters
        if (search) {
          inventory = inventory.filter((item: MenuItem) =>
            item.name.toLowerCase().includes(search.toLowerCase())
          )
        }
        if (categoryFilter) {
          inventory = inventory.filter((item: MenuItem) => item.category === categoryFilter)
        }
        
        setItems(inventory)
      } else {
        toast.error('Failed to load inventory')
      }
    } catch (error) {
      toast.error('Failed to load inventory')
    }
    setLoading(false)
  }

  async function loadAllMenuItems() {
    try {
      const res = await fetch('/api/hospitality/menu')
      if (res.ok) {
        const data = await res.json()
        setAllMenuItems((data.menuItems || []).filter((item: MenuItem) => item.inventoryMode === 'tracked'))
      }
    } catch (error) {
      console.error('Failed to load menu items:', error)
    }
  }

  function addToReceive(item: MenuItem) {
    if (receiveItems.find(ri => ri.menuItemId === item._id)) {
      toast.error('Item already added')
      return
    }
    setReceiveItems([...receiveItems, { menuItemId: item._id, quantity: 1 }])
  }

  function updateReceiveQuantity(index: number, quantity: number) {
    const updated = [...receiveItems]
    updated[index].quantity = quantity
    setReceiveItems(updated)
  }

  function removeReceiveItem(index: number) {
    setReceiveItems(receiveItems.filter((_, i) => i !== index))
  }

  async function submitReceive() {
    if (receiveItems.length === 0) {
      toast.error('Add at least one item')
      return
    }

    setReceiving(true)
    try {
      const res = await fetch('/api/hospitality/stock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: receiveItems,
          reason: receiveNotes || 'Stock received',
          reference: receiveReference
        })
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Received ${data.received} items`)
        setReceiveItems([])
        setReceiveNotes('')
        setReceiveReference('')
        load()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to receive stock')
      }
    } catch (error) {
      toast.error('Failed to receive stock')
    }
    setReceiving(false)
  }

  async function submitAdjustment() {
    if (!adjustItem || !adjustValue || !adjustReason) {
      toast.error('Fill all fields')
      return
    }

    setAdjusting(true)
    try {
      const res = await fetch('/api/hospitality/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: adjustItem._id,
          adjustmentType: adjustType,
          value: parseFloat(adjustValue),
          reason: adjustReason
        })
      })

      if (res.ok) {
        toast.success('Inventory adjusted')
        setAdjustItem(null)
        setAdjustValue('')
        setAdjustReason('')
        load()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to adjust inventory')
      }
    } catch (error) {
      toast.error('Failed to adjust inventory')
    }
    setAdjusting(false)
  }

  const filteredReceiveItems = allMenuItems.filter(item =>
    item.name.toLowerCase().includes(receiveSearch.toLowerCase())
  )

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Track stock levels and manage inventory</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('for-sale')}
          className={`px-4 py-2 -mb-px font-medium text-sm transition ${
            tab === 'for-sale'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package size={18} />
            For Sale
          </div>
        </button>
        <button
          onClick={() => setTab('ingredients')}
          className={`px-4 py-2 -mb-px font-medium text-sm transition ${
            tab === 'ingredients'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers size={18} />
            Ingredients
          </div>
        </button>
        <button
          onClick={() => setTab('receive')}
          className={`px-4 py-2 -mb-px font-medium text-sm transition ${
            tab === 'receive'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload size={18} />
            Receive Stock
          </div>
        </button>
      </div>

      {/* For Sale / Ingredients Tab */}
      {(tab === 'for-sale' || tab === 'ingredients') && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="w-4 h-4"
              />
              Low stock only
            </label>
          </div>

          {/* Items Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {lowStockOnly ? 'No low stock items' : 'No items found'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const isLowStock = item.inventory.wholeUnits <= item.reorderPoint
                const isOutOfStock = item.inventory.wholeUnits === 0

                return (
                  <Card 
                    key={item._id} 
                    className={`hover:shadow-md transition ${
                      isOutOfStock ? 'border-red-300 bg-red-50' : 
                      isLowStock ? 'border-orange-300 bg-orange-50' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                        </div>
                        <button
                          onClick={() => setAdjustItem(item)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Adjust
                        </button>
                      </div>

                      {/* Stock Level */}
                      <div className="mb-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-gray-900">
                            {item.inventory.wholeUnits}
                          </span>
                          <span className="text-sm text-gray-500">{item.baseUnit}(s)</span>
                        </div>
                        {isOutOfStock && (
                          <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                            <AlertTriangle size={14} />
                            Out of stock
                          </div>
                        )}
                        {isLowStock && !isOutOfStock && (
                          <div className="flex items-center gap-1 text-orange-600 text-xs mt-1">
                            <TrendingDown size={14} />
                            Low stock (reorder at {item.reorderPoint})
                          </div>
                        )}
                      </div>

                      {/* Serving Breakdown */}
                      {item.isServable && item.servingTypes && item.servingTypes.length > 0 && (
                        <div className="pt-3 border-t">
                          <p className="text-xs text-gray-500 mb-2">Available servings:</p>
                          <div className="space-y-1">
                            {item.servingTypes.map((st) => {
                              const available = item.inventory.totalAvailableServings[st._id] || 0
                              return (
                                <div key={st._id} className="flex justify-between text-sm">
                                  <span className="text-gray-700">{st.name}</span>
                                  <span className="font-medium text-gray-900">{available}</span>
                                </div>
                              )
                            })}
                          </div>
                          {item.inventory.partialUnits.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              {item.inventory.partialUnits.length} partial unit(s) open
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Receive Stock Tab */}
      {tab === 'receive' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Batch Receiving:</strong> Add multiple items to receive, then click "Complete Receiving" to process all at once.
            </p>
          </div>

          {/* Search to add items */}
          <div>
            <label className="block text-sm font-medium mb-2">Search items to add</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search menu items..."
                value={receiveSearch}
                onChange={(e) => setReceiveSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {receiveSearch && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                {filteredReceiveItems.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => addToReceive(item)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-0"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-sm text-gray-500">{item.category}</span>
                    </div>
                  </button>
                ))}
                {filteredReceiveItems.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                )}
              </div>
            )}
          </div>

          {/* Receive List */}
          {receiveItems.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Item</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Current Stock</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Qty Receiving</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">New Total</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receiveItems.map((ri, index) => {
                    const menuItem = allMenuItems.find(mi => mi._id === ri.menuItemId)
                    const currentStock = menuItem?.inventory?.wholeUnits || 0
                    return (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{menuItem?.name}</div>
                          <div className="text-xs text-gray-500">{menuItem?.category}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">{currentStock}</td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="1"
                            value={ri.quantity}
                            onChange={(e) => updateReceiveQuantity(index, parseInt(e.target.value) || 0)}
                            className="w-24"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{currentStock + ri.quantity}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeReceiveItem(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg bg-gray-50">
              <Upload size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No items added yet</p>
              <p className="text-sm text-gray-400 mt-1">Search and add items above to start receiving</p>
            </div>
          )}

          {/* Additional Info */}
          {receiveItems.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reference/Invoice # (optional)</label>
                <Input
                  value={receiveReference}
                  onChange={(e) => setReceiveReference(e.target.value)}
                  placeholder="e.g., INV-12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Add any notes about this delivery..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm('Clear all items?')) {
                      setReceiveItems([])
                      setReceiveNotes('')
                      setReceiveReference('')
                    }
                  }}
                >
                  Clear All
                </Button>
                <Button onClick={submitReceive} disabled={receiving}>
                  {receiving ? 'Processing...' : 'Complete Receiving'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjustment Modal */}
      {adjustItem && (
        <Dialog open onOpenChange={() => setAdjustItem(null)}>
          <DialogContent>
            <DialogTitle>Adjust Inventory - {adjustItem.name}</DialogTitle>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  Current stock: <span className="font-medium">{adjustItem.inventory.wholeUnits} {adjustItem.baseUnit}(s)</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="add">Add to stock</option>
                  <option value="subtract">Subtract from stock</option>
                  <option value="set-whole">Set exact amount</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {adjustType === 'set-whole' ? 'New Amount' : 'Quantity'}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason *</label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="e.g., Physical count correction, Waste, Damage..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setAdjustItem(null)} disabled={adjusting}>
                  Cancel
                </Button>
                <Button onClick={submitAdjustment} disabled={adjusting}>
                  {adjusting ? 'Adjusting...' : 'Adjust Inventory'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
