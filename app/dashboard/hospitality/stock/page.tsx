'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Download, Plus, AlertTriangle, TrendingDown, Package, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Movement {
  _id: string
  menuItemId: string
  menuItemName?: string
  movementType: 'sale' | 'receive' | 'production' | 'adjustment' | 'waste' | 'consolidation'
  servingTypeId?: string
  servingTypeName?: string
  quantity: number
  wholeUnitsChanged: number
  beforeState: {
    wholeUnits: number
    partialUnits: number
    totalServings: Record<string, number>
  }
  afterState: {
    wholeUnits: number
    partialUnits: number
    totalServings: Record<string, number>
  }
  reason: string
  referenceType?: string
  referenceId?: string
  performedBy: string
  timestamp: string
  metadata?: any
}

interface MenuItem {
  _id: string
  name: string
  baseUnit: string
  canConsolidate: boolean
  inventory?: {
    wholeUnits: number
    partialUnits: any[]
  }
}

export default function HospitalityStockPage() {
  return (
    <PermissionGuard requiredPermission="hospitality.stock">
      <StockContent />
    </PermissionGuard>
  )
}

function StockContent() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('today')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Operation modals
  const [showWaste, setShowWaste] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [showConsolidate, setShowConsolidate] = useState(false)

  // Waste modal
  const [wasteSearch, setWasteSearch] = useState('')
  const [wasteItems, setWasteItems] = useState<MenuItem[]>([])
  const [selectedWasteItem, setSelectedWasteItem] = useState<MenuItem | null>(null)
  const [wasteQuantity, setWasteQuantity] = useState('')
  const [wasteReason, setWasteReason] = useState('')
  const [wastingItem, setWastingItem] = useState(false)

  // Adjustment modal
  const [adjustSearch, setAdjustSearch] = useState('')
  const [adjustItems, setAdjustItems] = useState<MenuItem[]>([])
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<MenuItem | null>(null)
  const [adjustType, setAdjustType] = useState<'add' | 'subtract' | 'set-whole'>('add')
  const [adjustValue, setAdjustValue] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // Consolidation modal
  const [consolidateItems, setConsolidateItems] = useState<MenuItem[]>([])
  const [selectedConsolidateItem, setSelectedConsolidateItem] = useState<MenuItem | null>(null)
  const [consolidating, setConsolidating] = useState(false)

  useEffect(() => {
    loadMovements()
  }, [typeFilter, dateFilter, page])

  useEffect(() => {
    const timer = setTimeout(() => loadMovements(), 300)
    return () => clearTimeout(timer)
  }, [search])

  async function loadMovements() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (typeFilter !== 'all') params.set('movementType', typeFilter)
      
      // Date filtering
      if (dateFilter !== 'all') {
        const now = new Date()
        let startDate: Date | null = null
        
        if (dateFilter === 'today') {
          startDate = new Date(now.setHours(0, 0, 0, 0))
        } else if (dateFilter === 'week') {
          startDate = new Date(now.setDate(now.getDate() - 7))
        } else if (dateFilter === 'month') {
          startDate = new Date(now.setMonth(now.getMonth() - 1))
        }
        
        if (startDate) params.set('startDate', startDate.toISOString())
      }
      
      params.set('limit', '50')
      params.set('offset', String((page - 1) * 50))

      const res = await fetch(`/api/hospitality/stock/history?${params}`)
      if (res.ok) {
        const data = await res.json()
        let filtered = data.movements || []
        
        // Client-side search filtering
        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter((m: Movement) =>
            m.menuItemName?.toLowerCase().includes(q) ||
            m.reason?.toLowerCase().includes(q) ||
            m.servingTypeName?.toLowerCase().includes(q)
          )
        }
        
        setMovements(filtered)
        setHasMore(filtered.length === 50)
      } else {
        toast.error('Failed to load stock movements')
      }
    } catch (error) {
      toast.error('Failed to load stock movements')
    }
    setLoading(false)
  }

  // ── Waste Logging ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!showWaste) return
    const timer = setTimeout(async () => {
      if (!wasteSearch) return
      const res = await fetch(`/api/hospitality/menu?search=${wasteSearch}&itemType=for-sale`)
      if (res.ok) {
        const data = await res.json()
        setWasteItems(data.menuItems || [])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [wasteSearch, showWaste])

  async function logWaste() {
    if (!selectedWasteItem || !wasteQuantity || !wasteReason.trim()) {
      toast.error('Fill all required fields')
      return
    }

    setWastingItem(true)
    try {
      const res = await fetch('/api/hospitality/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: selectedWasteItem._id,
          adjustmentType: 'subtract',
          value: parseFloat(wasteQuantity),
          reason: `Waste: ${wasteReason}`
        })
      })

      if (res.ok) {
        toast.success('Waste logged successfully')
        setShowWaste(false)
        setSelectedWasteItem(null)
        setWasteQuantity('')
        setWasteReason('')
        loadMovements()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to log waste')
      }
    } catch (error) {
      toast.error('Failed to log waste')
    }
    setWastingItem(false)
  }

  // ── Adjustment ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!showAdjust) return
    const timer = setTimeout(async () => {
      if (!adjustSearch) return
      const res = await fetch(`/api/hospitality/menu?search=${adjustSearch}`)
      if (res.ok) {
        const data = await res.json()
        setAdjustItems(data.menuItems || [])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [adjustSearch, showAdjust])

  async function submitAdjustment() {
    if (!selectedAdjustItem || !adjustValue || !adjustReason.trim()) {
      toast.error('Fill all required fields')
      return
    }

    setAdjusting(true)
    try {
      const res = await fetch('/api/hospitality/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: selectedAdjustItem._id,
          adjustmentType: adjustType,
          value: parseFloat(adjustValue),
          reason: adjustReason
        })
      })

      if (res.ok) {
        toast.success('Adjustment completed')
        setShowAdjust(false)
        setSelectedAdjustItem(null)
        setAdjustValue('')
        setAdjustReason('')
        loadMovements()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to adjust inventory')
      }
    } catch (error) {
      toast.error('Failed to adjust inventory')
    }
    setAdjusting(false)
  }

  // ── Consolidation ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (showConsolidate) {
      loadConsolidatableItems()
    }
  }, [showConsolidate])

  async function loadConsolidatableItems() {
    try {
      const res = await fetch('/api/hospitality/inventory?itemType=for-sale')
      if (res.ok) {
        const data = await res.json()
        const items = (data.inventory || []).filter((item: MenuItem) => 
          item.canConsolidate && 
          item.inventory && 
          item.inventory.partialUnits.length > 1
        )
        setConsolidateItems(items)
      }
    } catch (error) {
      console.error('Failed to load consolidatable items:', error)
    }
  }

  async function consolidatePartials() {
    if (!selectedConsolidateItem) {
      toast.error('Select an item')
      return
    }

    if (!confirm(`Consolidate ${selectedConsolidateItem.inventory?.partialUnits.length} partial units of ${selectedConsolidateItem.name}?`)) {
      return
    }

    setConsolidating(true)
    try {
      const res = await fetch('/api/hospitality/stock/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: selectedConsolidateItem._id,
          reason: 'Manual consolidation'
        })
      })

      if (res.ok) {
        toast.success('Partials consolidated')
        setShowConsolidate(false)
        setSelectedConsolidateItem(null)
        loadMovements()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to consolidate')
      }
    } catch (error) {
      toast.error('Failed to consolidate')
    }
    setConsolidating(false)
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportToCSV() {
    const headers = ['Date', 'Time', 'Item', 'Type', 'Serving', 'Quantity', 'Units Changed', 'Reason']
    const rows = movements.map(m => [
      new Date(m.timestamp).toLocaleDateString(),
      new Date(m.timestamp).toLocaleTimeString(),
      m.menuItemName || 'Unknown',
      m.movementType,
      m.servingTypeName || '-',
      m.quantity,
      m.wholeUnitsChanged,
      m.reason || '-'
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-movements-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const movementTypeColors: Record<string, string> = {
    sale: 'bg-red-100 text-red-700',
    receive: 'bg-green-100 text-green-700',
    production: 'bg-blue-100 text-blue-700',
    adjustment: 'bg-yellow-100 text-yellow-700',
    waste: 'bg-orange-100 text-orange-700',
    consolidation: 'bg-purple-100 text-purple-700'
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
          <p className="text-sm text-gray-500 mt-1">View movement history and perform stock operations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={movements.length === 0}>
            <Download size={16} className="mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex-col items-start"
          onClick={() => setShowWaste(true)}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-orange-600" />
            <span className="font-semibold">Log Waste</span>
          </div>
          <p className="text-xs text-gray-500">Record spillage, breakage, or expiry</p>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-4 flex-col items-start"
          onClick={() => setShowAdjust(true)}
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={18} className="text-yellow-600" />
            <span className="font-semibold">Adjust Inventory</span>
          </div>
          <p className="text-xs text-gray-500">Manual corrections and stock counts</p>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-4 flex-col items-start"
          onClick={() => setShowConsolidate(true)}
        >
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw size={18} className="text-purple-600" />
            <span className="font-semibold">Consolidate Partials</span>
          </div>
          <p className="text-xs text-gray-500">Merge partial units to reduce fragmentation</p>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="receive">Receiving</option>
              <option value="production">Production</option>
              <option value="adjustment">Adjustments</option>
              <option value="waste">Waste</option>
              <option value="consolidation">Consolidation</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>

            <Button variant="outline" onClick={loadMovements}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Movements Timeline */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading movements...</div>
      ) : movements.length === 0 ? (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No stock movements found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {movements.map((movement) => (
            <Card key={movement._id} className="hover:shadow-md transition">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={movementTypeColors[movement.movementType] || 'bg-gray-100 text-gray-700'}>
                        {movement.movementType}
                      </Badge>
                      <span className="font-semibold">{movement.menuItemName}</span>
                      {movement.servingTypeName && (
                        <span className="text-sm text-gray-500">({movement.servingTypeName})</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Quantity</p>
                        <p className="font-medium">{movement.quantity} servings</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Units Changed</p>
                        <p className={`font-medium ${movement.wholeUnitsChanged > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {movement.wholeUnitsChanged > 0 ? '+' : ''}{movement.wholeUnitsChanged}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Before → After</p>
                        <p className="font-medium">
                          {movement.beforeState.wholeUnits} → {movement.afterState.wholeUnits} units
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date & Time</p>
                        <p className="font-medium">
                          {new Date(movement.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {movement.reason && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Reason:</span> {movement.reason}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={() => setPage(page + 1)}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── WASTE MODAL ─────────────────────────────────────────────────── */}
      {showWaste && (
        <Dialog open={showWaste} onOpenChange={setShowWaste}>
          <DialogContent className="max-w-md">
            <DialogTitle>Log Waste/Spillage</DialogTitle>
            
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium block mb-2">Search Item</label>
                <Input
                  placeholder="Search item name..."
                  value={wasteSearch}
                  onChange={(e) => setWasteSearch(e.target.value)}
                />
                {wasteSearch && wasteItems.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                    {wasteItems.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => {
                          setSelectedWasteItem(item)
                          setWasteSearch('')
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-0"
                      >
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          Current: {item.inventory?.wholeUnits || 0} {item.baseUnit}(s)
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedWasteItem && (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-semibold">{selectedWasteItem.name}</p>
                    <p className="text-sm text-gray-600">
                      Current stock: {selectedWasteItem.inventory?.wholeUnits || 0} {selectedWasteItem.baseUnit}(s)
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Quantity Wasted *</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wasteQuantity}
                      onChange={(e) => setWasteQuantity(e.target.value)}
                      placeholder={`Number of ${selectedWasteItem.baseUnit}(s)`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Reason *</label>
                    <select
                      value={wasteReason}
                      onChange={(e) => setWasteReason(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select reason</option>
                      <option value="Spillage">Spillage</option>
                      <option value="Breakage">Breakage</option>
                      <option value="Expiry">Expiry</option>
                      <option value="Contamination">Contamination</option>
                      <option value="Staff consumption">Staff consumption</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => {
                      setShowWaste(false)
                      setSelectedWasteItem(null)
                    }} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={logWaste} disabled={wastingItem} className="flex-1">
                      {wastingItem ? 'Logging...' : 'Log Waste'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── ADJUSTMENT MODAL ────────────────────────────────────────────── */}
      {showAdjust && (
        <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
          <DialogContent className="max-w-md">
            <DialogTitle>Adjust Inventory</DialogTitle>
            
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium block mb-2">Search Item</label>
                <Input
                  placeholder="Search item name..."
                  value={adjustSearch}
                  onChange={(e) => setAdjustSearch(e.target.value)}
                />
                {adjustSearch && adjustItems.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                    {adjustItems.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => {
                          setSelectedAdjustItem(item)
                          setAdjustSearch('')
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-0"
                      >
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          Current: {item.inventory?.wholeUnits || 0} {item.baseUnit}(s)
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedAdjustItem && (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-semibold">{selectedAdjustItem.name}</p>
                    <p className="text-sm text-gray-600">
                      Current stock: {selectedAdjustItem.inventory?.wholeUnits || 0} {selectedAdjustItem.baseUnit}(s)
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Adjustment Type</label>
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
                    <label className="text-sm font-medium block mb-2">
                      {adjustType === 'set-whole' ? 'New Amount *' : 'Quantity *'}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={adjustValue}
                      onChange={(e) => setAdjustValue(e.target.value)}
                      placeholder={`Number of ${selectedAdjustItem.baseUnit}(s)`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Reason *</label>
                    <textarea
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                      placeholder="e.g., Physical count correction, System error..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => {
                      setShowAdjust(false)
                      setSelectedAdjustItem(null)
                    }} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={submitAdjustment} disabled={adjusting} className="flex-1">
                      {adjusting ? 'Adjusting...' : 'Adjust Inventory'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── CONSOLIDATION MODAL ─────────────────────────────────────────── */}
      {showConsolidate && (
        <Dialog open={showConsolidate} onOpenChange={setShowConsolidate}>
          <DialogContent className="max-w-md">
            <DialogTitle>Consolidate Partial Units</DialogTitle>
            
            <div className="space-y-4 mt-2">
              {consolidateItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package size={48} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">No items with multiple partials found</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Select an item with multiple partial units to consolidate them into fewer partials.
                  </p>

                  <div className="space-y-2">
                    {consolidateItems.map((item) => (
                      <button
                        key={item._id}
                        onClick={() => setSelectedConsolidateItem(item)}
                        className={`w-full p-3 rounded-lg border-2 text-left transition ${
                          selectedConsolidateItem?._id === item._id
                            ? 'border-green-600 bg-green-50'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          {item.inventory?.wholeUnits} whole + {item.inventory?.partialUnits.length} partials
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowConsolidate(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={consolidatePartials}
                      disabled={!selectedConsolidateItem || consolidating}
                      className="flex-1"
                    >
                      {consolidating ? 'Consolidating...' : 'Consolidate'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
