'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  PackageSearch,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Clock,
  Package,
  FileText,
  Loader2,
  CheckCircle2,
  X,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  FilterX,
  Download
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { FloatingSelectionButton } from '@/components/restocking/floating-selection-button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  addToBasket,
  updateBasketItemQuantity,
  removeFromBasket,
  clearBasket,
  getBasketSummary,
  type BasketItem
} from '@/lib/restocking/basket'
import { generateRFQCSV, downloadCSV } from '@/lib/restocking/csv-export'

interface LowStockItem {
  moduleItemId: string
  name: string
  module: string
  category: string
  currentStock: number
  lowStockThreshold: number
  buyingPrice: number
  sellingPrice: number
  supplier: { id: string; name: string } | null
}

interface LowStockResponse {
  items: LowStockItem[]
  stats: {
    total: number
    critical: number
    low: number
    estimatedCost: number
  }
}

interface Recommendation {
  moduleItemId: string
  module: string
  itemName: string
  category: string
  currentStock: number
  velocity: number
  daysRemaining: number
  urgency: number
  confidence: string
  recommendedQty: number
  unitPrice: number
  totalCost: number
  reason: string
  supplier: { id: string; name: string } | null
  deferred?: boolean
}

interface GenerateResponse {
  recommendations: Recommendation[]
  summary: {
    itemsRecommended: number
    totalCost: number
    leadTimeDays: number
    safetyBufferDays: number
  }
}

interface AssistedAllocation extends Recommendation {
  allocatedQty: number
  allocatedCost: number
  reason: string
}

interface AssistedDeferred extends Recommendation {
  deferredReason: string
}

interface AssistedResponse {
  budget: number
  totalSpent: number
  remainingBudget: number
  allocated: AssistedAllocation[]
  deferred: AssistedDeferred[]
  summary: {
    itemsAllocated: number
    itemsDeferred: number
    budgetUtilization: string
    leadTimeDays: number
    safetyBufferDays: number
  }
}

function formatKES(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`
}

function RestockingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('low-stock')
  const [budget, setBudget] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [safetyBuffer, setSafetyBuffer] = useState('')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [lowStockData, setLowStockData] = useState<LowStockResponse | null>(null)
  const [generateData, setGenerateData] = useState<GenerateResponse | null>(null)
  const [assistedData, setAssistedData] = useState<AssistedResponse | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Filter and sort state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all')
  const [supplierFilter, setSupplierFilter] = useState(searchParams.get('supplier') || 'all')
  const [minQuantity, setMinQuantity] = useState(searchParams.get('minQty') || '')
  const [maxQuantity, setMaxQuantity] = useState(searchParams.get('maxQty') || '')
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price' | 'category'>(
    (searchParams.get('sortBy') as any) || 'name'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as any) || 'asc'
  )
  const [activePreset, setActivePreset] = useState<string | null>(null)

  // Pagination
  const [displayCount, setDisplayCount] = useState(50)

  // Basket state
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [showBasket, setShowBasket] = useState(false)
  const [creatingPO, setCreatingPO] = useState(false)
  const [poNotes, setPoNotes] = useState('')
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)
  const [generatedRFQ, setGeneratedRFQ] = useState<any>(null)
  const basketSummary = getBasketSummary(basket)

  // Extract unique categories and suppliers for filters
  const categories = useMemo(() => {
    if (!lowStockData) return []
    const cats = new Set(lowStockData.items.map(item => item.category))
    return Array.from(cats).sort()
  }, [lowStockData])

  const suppliers = useMemo(() => {
    if (!lowStockData) return []
    const sups = new Set(
      lowStockData.items
        .map(item => item.supplier?.name)
        .filter(Boolean) as string[]
    )
    return Array.from(sups).sort()
  }, [lowStockData])

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    if (!lowStockData) return []

    let items = [...lowStockData.items]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      )
    }

    // Apply category filter
    if (categoryFilter && categoryFilter !== 'all') {
      items = items.filter(item => item.category === categoryFilter)
    }

    // Apply supplier filter
    if (supplierFilter && supplierFilter !== 'all') {
      items = items.filter(item => item.supplier?.name === supplierFilter)
    }

    // Apply quantity range filters
    if (minQuantity) {
      const min = parseInt(minQuantity)
      if (!isNaN(min)) {
        items = items.filter(item => item.currentStock >= min)
      }
    }
    if (maxQuantity) {
      const max = parseInt(maxQuantity)
      if (!isNaN(max)) {
        items = items.filter(item => item.currentStock <= max)
      }
    }

    // Apply sorting
    items.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'stock':
          comparison = a.currentStock - b.currentStock
          break
        case 'price':
          comparison = a.buyingPrice - b.buyingPrice
          break
        case 'category':
          comparison = a.category.localeCompare(b.category)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return items
  }, [lowStockData, searchQuery, categoryFilter, supplierFilter, minQuantity, maxQuantity, sortBy, sortOrder])

  // Paginated display items
  const displayedItems = useMemo(
    () => filteredItems.slice(0, displayCount),
    [filteredItems, displayCount]
  )

  // Fetch low stock items on mount
  useEffect(() => {
    fetchLowStock()
  }, [])

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('search', searchQuery)
    if (categoryFilter !== 'all') params.set('category', categoryFilter)
    if (supplierFilter !== 'all') params.set('supplier', supplierFilter)
    if (minQuantity) params.set('minQty', minQuantity)
    if (maxQuantity) params.set('maxQty', maxQuantity)
    if (sortBy !== 'name') params.set('sortBy', sortBy)
    if (sortOrder !== 'asc') params.set('sortOrder', sortOrder)

    const query = params.toString()
    const newUrl = query ? `?${query}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [searchQuery, categoryFilter, supplierFilter, minQuantity, maxQuantity, sortBy, sortOrder])

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayCount(50)
  }, [searchQuery, categoryFilter, supplierFilter, minQuantity, maxQuantity, sortBy, sortOrder])

  async function fetchLowStock() {
    setLoading(true)
    try {
      const response = await fetch('/api/restocking/low-stock?modules=retail')
      if (response.ok) {
        const data = await response.json()
        setLowStockData(data)
      }
    } catch (error) {
      console.error('Failed to fetch low stock:', error)
    } finally {
      setLoading(false)
    }
  }

  async function generateRestock() {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/restocking/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadTimeDays: parseInt(leadTime) || 7,
          safetyBufferDays: parseInt(safetyBuffer) || 2,
          modules: ['retail']
        })
      })
      if (response.ok) {
        const data = await response.json()
        setGenerateData(data)
      }
    } catch (error) {
      console.error('Failed to generate restock:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  async function assistedRestock() {
    if (!budget || parseFloat(budget) <= 0) {
      toast.error('Please enter a valid budget')
      return
    }
    setAnalyzing(true)
    try {
      const response = await fetch('/api/restocking/assisted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: parseFloat(budget),
          leadTimeDays: parseInt(leadTime) || 7,
          safetyBufferDays: parseInt(safetyBuffer) || 2,
          modules: ['retail']
        })
      })
      if (response.ok) {
        const data = await response.json()
        setAssistedData(data)
      }
    } catch (error) {
      console.error('Failed to run assisted restock:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  function toggleItem(itemId: string) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  function toggleAll() {
    if (!filteredItems) return
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.moduleItemId)))
    }
  }

  function handleSort(column: 'name' | 'stock' | 'price' | 'category') {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  function clearFilters() {
    setSearchQuery('')
    setCategoryFilter('all')
    setSupplierFilter('all')
    setMinQuantity('')
    setMaxQuantity('')
    setSortBy('name')
    setSortOrder('asc')
    setSelectedItems(new Set())
    setActivePreset(null)
  }

  function applyPreset(preset: string) {
    clearFilters()
    setActivePreset(preset)

    switch (preset) {
      case 'out-of-stock':
        setMaxQuantity('0')
        break
      case 'critical':
        setMaxQuantity('5')
        break
      case 'low':
        setMaxQuantity('10')
        break
      case 'below-threshold':
        // This will be handled by the existing filter logic
        break
    }
  }

  function addCategoryToBasket(category: string) {
    if (!lowStockData) return

    const categoryItems = filteredItems.filter(item => item.category === category)
    let newBasket = [...basket]

    categoryItems.forEach((item) => {
      const deficit = Math.max(0, item.lowStockThreshold - item.currentStock)
      newBasket = addToBasket(newBasket, {
        moduleItemId: item.moduleItemId,
        module: item.module,
        itemName: item.name,
        category: item.category,
        quantity: deficit || 1,
        unitPrice: item.buyingPrice,
        supplier: item.supplier
      })
    })

    setBasket(newBasket)
    setShowBasket(true)
    toast.success(`Added ${categoryItems.length} item${categoryItems.length !== 1 ? 's' : ''} from ${category} to basket`)
  }

  function getItemStatus(item: LowStockItem) {
    const deficit = item.lowStockThreshold - item.currentStock
    const percentBelow = deficit / item.lowStockThreshold

    if (percentBelow > 0.5) {
      return { label: 'Critical', variant: 'destructive' as const, icon: AlertTriangle }
    }
    return { label: 'Low', variant: 'secondary' as const, icon: Clock }
  }

  // Basket handlers
  function handleAddSelectedToBasket() {
    if (!lowStockData || selectedItems.size === 0) return

    let newBasket = [...basket]
    lowStockData.items.forEach((item) => {
      if (selectedItems.has(item.moduleItemId)) {
        const deficit = Math.max(0, item.lowStockThreshold - item.currentStock)
        newBasket = addToBasket(newBasket, {
          moduleItemId: item.moduleItemId,
          module: item.module,
          itemName: item.name,
          category: item.category,
          quantity: deficit || 1,
          unitPrice: item.buyingPrice,
          supplier: item.supplier
        })
      }
    })

    setBasket(newBasket)
    setSelectedItems(new Set())
    setShowBasket(true)
    toast.success(`Added ${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''} to basket`)
  }

  function handleAddRecommendationToBasket(rec: Recommendation) {
    const newBasket = addToBasket(basket, {
      moduleItemId: rec.moduleItemId,
      module: rec.module,
      itemName: rec.itemName,
      category: rec.category,
      quantity: rec.recommendedQty,
      unitPrice: rec.unitPrice,
      supplier: rec.supplier
    })
    setBasket(newBasket)
    setShowBasket(true)
  }

  function handleAddAllAllocatedToBasket() {
    if (!assistedData) return

    let newBasket = [...basket]
    assistedData.allocated.forEach((item) => {
      newBasket = addToBasket(newBasket, {
        moduleItemId: item.moduleItemId,
        module: item.module,
        itemName: item.itemName,
        category: item.category,
        quantity: item.allocatedQty,
        unitPrice: item.unitPrice,
        supplier: item.supplier
      })
    })

    setBasket(newBasket)
    setShowBasket(true)
  }

  function handleUpdateBasketQuantity(moduleItemId: string, module: string, quantity: number) {
    setBasket(updateBasketItemQuantity(basket, moduleItemId, module, quantity))
  }

  function handleRemoveFromBasket(moduleItemId: string, module: string) {
    setBasket(removeFromBasket(basket, moduleItemId, module))
  }

  function handleClearBasket() {
    setBasket(clearBasket())
    setShowBasket(false)
    setPoNotes('')
  }

  async function handleGeneratePOs() {
    if (basket.length === 0) {
      toast.error('Basket is empty')
      return
    }

    setCreatingPO(true)
    try {
      const response = await fetch('/api/restocking/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basketItems: basket,
          notes: poNotes
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedRFQ(data.rfq)
        setShowDownloadPopup(true)
        handleClearBasket()
      } else {
        const error = await response.json()
        toast.error(`Failed to create RFQ: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to generate RFQ:', error)
      toast.error('Failed to generate RFQ')
    } finally {
      setCreatingPO(false)
    }
  }

  function handleDownloadCSV() {
    if (!generatedRFQ) return
    const csv = generateRFQCSV(generatedRFQ)
    downloadCSV(csv, `${generatedRFQ.poNumber}.csv`)
  }

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || supplierFilter !== 'all' || minQuantity || maxQuantity

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Restocking &amp; Purchase Orders</h1>
          <p className="text-xs text-muted-foreground">Intelligent restocking recommendations based on sales velocity and stock coverage</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="gap-2 h-9 text-sm flex-1 sm:flex-none"
            onClick={() => setShowBasket(!showBasket)}
          >
            <ShoppingCart className="h-4 w-4" />
            Basket
            {basketSummary.totalItems > 0 && (
              <Badge className="ml-1 h-5 px-1.5">{basketSummary.totalItems}</Badge>
            )}
          </Button>
          <Button
            variant="outline"
            className="gap-2 h-9 text-sm flex-1 sm:flex-none"
            onClick={() => router.push('/dashboard/restocking/purchase-orders')}
          >
            <FileText className="h-4 w-4" />
            RFQs
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-amber-600" />
            <p className="text-xs text-amber-700 font-medium">Low Stock Items</p>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          ) : (
            <>
              <p className="text-xl font-bold text-amber-900">{lowStockData?.stats.total || 0}</p>
              <p className="text-xs text-amber-600">Items below threshold</p>
            </>
          )}
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-600" />
            <p className="text-xs text-red-700 font-medium">Critical Items</p>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-red-600" />
          ) : (
            <>
              <p className="text-xl font-bold text-red-900">{lowStockData?.stats.critical || 0}</p>
              <p className="text-xs text-red-600">Below 50% threshold</p>
            </>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">Est. Restock Cost</p>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          ) : (
            <>
              <p className="text-xl font-bold text-green-900">{formatKES(lowStockData?.stats.estimatedCost || 0)}</p>
              <p className="text-xs text-green-600">To reach threshold</p>
            </>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={16} className="text-blue-600" />
            <p className="text-xs text-blue-700 font-medium">In Basket</p>
          </div>
          <p className="text-xl font-bold text-blue-900">{basketSummary.totalItems}</p>
          <p className="text-xs text-blue-600">{formatKES(basketSummary.totalCost)}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full h-10 gap-1 p-1 bg-muted rounded-lg">
          <TabsTrigger value="low-stock" className="flex-1 gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <PackageSearch className="h-4 w-4" />
            Low Stock
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex-1 gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="assisted" className="flex-1 gap-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <DollarSign className="h-4 w-4" />
            Assisted
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Low Stock */}
        <TabsContent value="low-stock" className="mt-4">
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-green-700">Low Stock Items</h3>
              <p className="text-xs text-muted-foreground">Items below their configured stock threshold</p>
            </div>

            {/* Quick filter presets */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activePreset === 'out-of-stock' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('out-of-stock')}
                className="gap-1.5 h-8 text-xs"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Out of Stock
              </Button>
              <Button
                variant={activePreset === 'critical' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('critical')}
                className="gap-1.5 h-8 text-xs"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Critical (&lt; 5)
              </Button>
              <Button
                variant={activePreset === 'low' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('low')}
                className="gap-1.5 h-8 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                Low (&lt; 10)
              </Button>
              <Button
                variant={activePreset === 'below-threshold' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('below-threshold')}
                className="gap-1.5 h-8 text-xs"
              >
                <Package className="h-3.5 w-3.5" />
                Below Threshold
              </Button>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Search by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map(sup => (
                      <SelectItem key={sup} value={sup}>{sup}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Qty:</Label>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
                    className="w-20 h-8 text-sm"
                  />
                </div>

                <div className="flex gap-2 sm:ml-auto">
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <FilterX className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLowStock}
                    disabled={loading}
                    className="h-8 text-xs"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !lowStockData || lowStockData.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PackageSearch className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium">No Low Stock Items</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Items below their stock threshold will appear here. Currently, all items have adequate stock levels.
                </p>
              </div>
            ) : (
              <>
                {/* Result count + batch add */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm">
                  <p className="text-xs text-muted-foreground">
                    Showing <strong>{Math.min(displayCount, filteredItems.length)}</strong> of <strong>{filteredItems.length}</strong> items
                  </p>
                  {categories.length > 0 && filteredItems.length > 0 && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Label className="text-xs whitespace-nowrap">Batch add:</Label>
                      <Select onValueChange={(cat) => cat && addCategoryToBasket(cat)}>
                        <SelectTrigger className="w-full sm:w-[200px] h-8 text-sm">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => {
                            const catCount = filteredItems.filter(item => item.category === cat).length
                            return (
                              <SelectItem key={cat} value={cat}>
                                {cat} ({catCount})
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium text-sm w-10">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                              onChange={toggleAll}
                            />
                          </th>
                          <th
                            className="text-left p-3 font-medium text-sm cursor-pointer hover:bg-muted/80"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center gap-1">
                              Item
                              {sortBy === 'name' && (
                                sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </th>
                          <th
                            className="text-left p-3 font-medium text-sm cursor-pointer hover:bg-muted/80"
                            onClick={() => handleSort('category')}
                          >
                            <div className="flex items-center gap-1">
                              Category
                              {sortBy === 'category' && (
                                sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </th>
                          <th
                            className="text-right p-3 font-medium text-sm cursor-pointer hover:bg-muted/80"
                            onClick={() => handleSort('stock')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Stock
                              {sortBy === 'stock' && (
                                sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </th>
                          <th className="text-right p-3 font-medium text-sm">Threshold</th>
                          <th className="text-right p-3 font-medium text-sm">Need</th>
                          <th className="text-left p-3 font-medium text-sm">Status</th>
                          <th
                            className="text-right p-3 font-medium text-sm cursor-pointer hover:bg-muted/80"
                            onClick={() => handleSort('price')}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Price
                              {sortBy === 'price' && (
                                sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </th>
                          <th className="text-left p-3 font-medium text-sm">Supplier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedItems.map((item) => {
                          const status = getItemStatus(item)
                          const StatusIcon = status.icon
                          const deficit = Math.max(0, item.lowStockThreshold - item.currentStock)
                          return (
                            <tr key={item.moduleItemId} className="border-b hover:bg-muted/50">
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={selectedItems.has(item.moduleItemId)}
                                  onChange={() => toggleItem(item.moduleItemId)}
                                />
                              </td>
                              <td className="p-3 font-medium text-sm">{item.name}</td>
                              <td className="p-3 text-sm text-muted-foreground">{item.category}</td>
                              <td className="p-3 text-right font-medium text-sm">{item.currentStock}</td>
                              <td className="p-3 text-right text-muted-foreground text-sm">{item.lowStockThreshold}</td>
                              <td className="p-3 text-right text-sm">
                                {deficit > 0 && <span className="text-red-600 font-medium">{deficit}</span>}
                              </td>
                              <td className="p-3">
                                <Badge variant={status.variant} className="gap-1 text-xs">
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="p-3 text-right text-sm">{formatKES(item.buyingPrice)}</td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {item.supplier?.name || <span className="text-muted-foreground/60">No supplier</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleAll}
                    />
                    <span className="text-xs font-medium">
                      {selectedItems.size === filteredItems.length && filteredItems.length > 0
                        ? 'Deselect All'
                        : 'Select All'}
                    </span>
                  </div>

                  {displayedItems.map((item) => {
                    const status = getItemStatus(item)
                    const StatusIcon = status.icon
                    const deficit = Math.max(0, item.lowStockThreshold - item.currentStock)
                    return (
                      <div key={item.moduleItemId} className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="rounded mt-0.5"
                            checked={selectedItems.has(item.moduleItemId)}
                            onChange={() => toggleItem(item.moduleItemId)}
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
                              <Badge variant={status.variant} className="gap-1 text-xs shrink-0">
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Package className="h-3 w-3" />
                              <span>{item.category}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Stock:</span>
                                <span className="ml-1 font-medium">{item.currentStock}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Threshold:</span>
                                <span className="ml-1">{item.lowStockThreshold}</span>
                              </div>
                              <div>
                                {deficit > 0 && (
                                  <>
                                    <span className="text-muted-foreground">Need:</span>
                                    <span className="ml-1 font-medium text-red-600">{deficit}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t text-xs">
                              <span className="font-medium">{formatKES(item.buyingPrice)}</span>
                              <span className="text-muted-foreground">
                                {item.supplier?.name || 'No supplier'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Load More */}
                {filteredItems.length > displayCount && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisplayCount(c => c + 50)}
                      className="text-xs h-8"
                    >
                      Load More ({filteredItems.length - displayCount} remaining)
                    </Button>
                  </div>
                )}

                {/* Add to Basket */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {selectedItems.size > 0 && `${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''} selected`}
                  </p>
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={selectedItems.size === 0}
                    onClick={handleAddSelectedToBasket}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add Selected to Basket ({selectedItems.size})
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Generate Restock */}
        <TabsContent value="generate" className="mt-4">
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-green-700">Generate Restock Recommendations</h3>
              <p className="text-xs text-muted-foreground">Velocity-based restocking analysis using sales movement data</p>
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="space-y-1.5">
                <Label htmlFor="leadTime" className="text-xs">Lead Time (days)</Label>
                <Input
                  id="leadTime"
                  type="number"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="7"
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">Restock cycle frequency</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="safetyBuffer" className="text-xs">Safety Buffer (days)</Label>
                <Input
                  id="safetyBuffer"
                  type="number"
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(e.target.value)}
                  placeholder="2"
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">Extra stock cushion</p>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full gap-2 h-9"
                  onClick={generateRestock}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><TrendingUp className="h-4 w-4" /> Analyze</>
                  )}
                </Button>
              </div>
            </div>

            {/* Results */}
            {analyzing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !generateData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium">No Analysis Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Configure your lead time and safety buffer, then click Analyze to generate intelligent restocking recommendations based on sales velocity.
                </p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-blue-600" />
                      <p className="text-xs text-blue-700 font-medium">Items Recommended</p>
                    </div>
                    <p className="text-xl font-bold text-blue-900">{generateData.summary.itemsRecommended}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <p className="text-xs text-green-700 font-medium">Estimated Cost</p>
                    </div>
                    <p className="text-xl font-bold text-green-900">{formatKES(generateData.summary.totalCost)}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <p className="text-xs text-gray-700 font-medium">Analysis Period</p>
                    </div>
                    <p className="text-xl font-bold text-gray-900">30 days</p>
                  </div>
                </div>

                {/* Recommendations Table */}
                {generateData.recommendations.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-sm">Item</th>
                            <th className="text-right p-3 font-medium text-sm">Stock</th>
                            <th className="text-right p-3 font-medium text-sm">Days Left</th>
                            <th className="text-right p-3 font-medium text-sm">Velocity</th>
                            <th className="text-right p-3 font-medium text-sm">Suggested</th>
                            <th className="text-right p-3 font-medium text-sm">Cost</th>
                            <th className="text-left p-3 font-medium text-sm">Priority</th>
                            <th className="text-center p-3 font-medium text-sm">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generateData.recommendations.map((rec) => (
                            <tr key={rec.moduleItemId} className="border-b hover:bg-muted/50">
                              <td className="p-3">
                                <p className="font-medium text-sm">{rec.itemName}</p>
                                <p className="text-xs text-muted-foreground">{rec.category}</p>
                              </td>
                              <td className="p-3 text-right text-sm">{rec.currentStock}</td>
                              <td className="p-3 text-right text-sm">
                                <span className={rec.daysRemaining < 3 ? 'text-red-600 font-medium' : ''}>
                                  {rec.daysRemaining.toFixed(1)}
                                </span>
                              </td>
                              <td className="p-3 text-right text-sm">{rec.velocity.toFixed(1)}/day</td>
                              <td className="p-3 text-right font-medium text-sm">{rec.recommendedQty}</td>
                              <td className="p-3 text-right text-sm">{formatKES(rec.totalCost)}</td>
                              <td className="p-3">
                                <Badge variant={rec.urgency > 2 ? 'destructive' : rec.urgency > 1 ? 'default' : 'secondary'} className="text-xs">
                                  {rec.urgency > 2 ? 'Critical' : rec.urgency > 1 ? 'High' : 'Medium'}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleAddRecommendationToBasket(rec)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No items need restocking based on current velocity analysis.
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Assisted Restock */}
        <TabsContent value="assisted" className="mt-4">
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-green-700">Budget-Aware Assisted Restock</h3>
              <p className="text-xs text-muted-foreground">Capital-constrained allocation prioritizing critical items</p>
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="space-y-1.5">
                <Label htmlFor="budget" className="text-xs">Available Budget (KES)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="50000"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assistedLeadTime" className="text-xs">Lead Time (days)</Label>
                <Input
                  id="assistedLeadTime"
                  type="number"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="7"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assistedSafetyBuffer" className="text-xs">Safety Buffer (days)</Label>
                <Input
                  id="assistedSafetyBuffer"
                  type="number"
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(e.target.value)}
                  placeholder="2"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full gap-2 h-9"
                  onClick={assistedRestock}
                  disabled={analyzing || !budget}
                >
                  {analyzing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Optimizing...</>
                  ) : (
                    <><DollarSign className="h-4 w-4" /> Optimize</>
                  )}
                </Button>
              </div>
            </div>

            {/* Results */}
            {analyzing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !assistedData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium">Enter Your Budget</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Set your available capital and parameters, then click Optimize to get an intelligent allocation plan that maximizes stockout prevention within budget.
                </p>
              </div>
            ) : (
              <>
                {/* Budget Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-700 font-medium mb-1">Total Budget</p>
                    <p className="text-xl font-bold text-gray-900">{formatKES(assistedData.budget)}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 font-medium mb-1">Allocated</p>
                    <p className="text-xl font-bold text-green-900">{formatKES(assistedData.totalSpent)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700 font-medium mb-1">Remaining</p>
                    <p className="text-xl font-bold text-blue-900">{formatKES(assistedData.remainingBudget)}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700 font-medium mb-1">Utilization</p>
                    <p className="text-xl font-bold text-amber-900">{assistedData.summary.budgetUtilization}</p>
                  </div>
                </div>

                {/* Allocation Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-xs text-green-700 font-medium">Allocated Items</p>
                    </div>
                    <p className="text-xl font-bold text-green-900">{assistedData.summary.itemsAllocated}</p>
                    <p className="text-xs text-green-600">Items receiving budget allocation</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <p className="text-xs text-orange-700 font-medium">Deferred Items</p>
                    </div>
                    <p className="text-xl font-bold text-orange-900">{assistedData.summary.itemsDeferred}</p>
                    <p className="text-xs text-orange-600">Items postponed due to constraints</p>
                  </div>
                </div>

                {/* Allocated Items Table */}
                {assistedData.allocated.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-700">Budget Allocation Plan</h4>
                      <Button
                        size="sm"
                        onClick={handleAddAllAllocatedToBasket}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add All to Basket
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium text-sm">Item</th>
                              <th className="text-right p-3 font-medium text-sm">Stock</th>
                              <th className="text-right p-3 font-medium text-sm">Days Left</th>
                              <th className="text-right p-3 font-medium text-sm">Allocated</th>
                              <th className="text-right p-3 font-medium text-sm">Cost</th>
                              <th className="text-left p-3 font-medium text-sm">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assistedData.allocated.map((item) => (
                              <tr key={item.moduleItemId} className="border-b hover:bg-muted/50">
                                <td className="p-3">
                                  <p className="font-medium text-sm">{item.itemName}</p>
                                  <p className="text-xs text-muted-foreground">{item.category}</p>
                                </td>
                                <td className="p-3 text-right text-sm">{item.currentStock}</td>
                                <td className="p-3 text-right text-sm">
                                  <span className={item.daysRemaining < 3 ? 'text-red-600 font-medium' : ''}>
                                    {item.daysRemaining.toFixed(1)}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-medium text-sm text-green-600">
                                  {item.allocatedQty}
                                </td>
                                <td className="p-3 text-right text-sm">{formatKES(item.allocatedCost)}</td>
                                <td className="p-3">
                                  <p className="text-xs">{item.reason}</p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deferred Items Table */}
                {assistedData.deferred.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Deferred Items</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium text-sm">Item</th>
                              <th className="text-right p-3 font-medium text-sm">Stock</th>
                              <th className="text-right p-3 font-medium text-sm">Days Left</th>
                              <th className="text-right p-3 font-medium text-sm">Needed</th>
                              <th className="text-right p-3 font-medium text-sm">Est. Cost</th>
                              <th className="text-left p-3 font-medium text-sm">Reason Deferred</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assistedData.deferred.map((item) => (
                              <tr key={item.moduleItemId} className="border-b hover:bg-muted/50">
                                <td className="p-3">
                                  <p className="font-medium text-sm">{item.itemName}</p>
                                  <p className="text-xs text-muted-foreground">{item.category}</p>
                                </td>
                                <td className="p-3 text-right text-sm">{item.currentStock}</td>
                                <td className="p-3 text-right text-sm">
                                  {item.daysRemaining.toFixed(1)}
                                </td>
                                <td className="p-3 text-right text-muted-foreground text-sm">
                                  {item.recommendedQty}
                                </td>
                                <td className="p-3 text-right text-muted-foreground text-sm">
                                  {formatKES(item.totalCost)}
                                </td>
                                <td className="p-3">
                                  <p className="text-xs">{item.deferredReason}</p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Basket Sidebar */}
      {showBasket && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background border-l shadow-xl z-50 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Restock Basket
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shopping list — prices confirmed later
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowBasket(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Compact item cards */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {basket.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-medium">Basket is Empty</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                  Add items from any tab to start building your restock list
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {basket.map((item) => {
                  const itemKey = `${item.module}-${item.moduleItemId}`
                  return (
                    <div key={itemKey} className="border rounded-md p-2 space-y-1.5">
                      {/* Top row: name + remove */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{item.itemName}</p>
                          <p className="text-xs text-muted-foreground truncate leading-tight">{item.category}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveFromBasket(item.moduleItemId, item.module)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* Bottom row: qty stepper + price */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleUpdateBasketQuantity(item.moduleItemId, item.module, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-7 text-center text-sm font-medium tabular-nums">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleUpdateBasketQuantity(item.moduleItemId, item.module, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {item.unitPrice > 0 ? (
                          <p className="text-xs text-muted-foreground">Est. {formatKES(item.unitPrice)}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50">Price pending</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {basket.length > 0 && (
            <div className="p-4 border-t space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Items:</span>
                <span className="font-bold">{basketSummary.totalItems}</span>
              </div>
              {basketSummary.totalCost > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Est. Total:</span>
                  <span className="font-bold text-base">{formatKES(basketSummary.totalCost)}</span>
                </div>
              )}
              <div>
                <textarea
                  placeholder="Notes (e.g. deliver to back entrance, call before coming)"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  rows={2}
                  className="w-full text-sm border rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleClearBasket}
                >
                  Clear All
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleGeneratePOs}
                  disabled={creatingPO}
                >
                  {creatingPO ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                  ) : (
                    <><FileText className="h-4 w-4" /> Generate RFQ</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Basket overlay */}
      {showBasket && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowBasket(false)}
        />
      )}

      {/* Post-generation download popup */}
      <Dialog open={showDownloadPopup} onOpenChange={setShowDownloadPopup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              RFQ Generated
            </DialogTitle>
            <DialogDescription>Your restock list has been saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {generatedRFQ && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RFQ Number</span>
                  <span className="font-medium">{generatedRFQ.poNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span className="font-medium">{generatedRFQ.items?.length || 0} items · {generatedRFQ.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(generatedRFQ.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={handleDownloadCSV}
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowDownloadPopup(false)
                  router.push('/dashboard/restocking/purchase-orders')
                }}
              >
                View RFQs
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Selection Button - Mobile Only */}
      <FloatingSelectionButton
        selectedCount={selectedItems.size}
        onClick={handleAddSelectedToBasket}
      />
    </div>
  )
}

export default function RestockingPage() {
  return (
    <PermissionGuard requiredPermission="core.restocking">
      <RestockingPageContent />
    </PermissionGuard>
  )
}

