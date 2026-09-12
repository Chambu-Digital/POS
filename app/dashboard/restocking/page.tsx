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
  Filter,
  FilterX
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { FloatingSelectionButton } from '@/components/restocking/floating-selection-button'
import { 
  addToBasket, 
  updateBasketItemQuantity,
  updateBasketItemPrice,
  updateBasketItemNotes,
  removeFromBasket, 
  clearBasket,
  getBasketSummary,
  groupBasketBySupplier,
  type BasketItem 
} from '@/lib/restocking/basket'

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
  
  // Basket state
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [showBasket, setShowBasket] = useState(false)
  const [creatingPO, setCreatingPO] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null) // moduleItemId:module
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
      alert('Please enter a valid budget')
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

  function handleUpdateBasketPrice(moduleItemId: string, module: string, unitPrice: number) {
    setBasket(updateBasketItemPrice(basket, moduleItemId, module, unitPrice))
  }

  function handleUpdateBasketNotes(moduleItemId: string, module: string, notes: string) {
    setBasket(updateBasketItemNotes(basket, moduleItemId, module, notes))
  }

  function handleRemoveFromBasket(moduleItemId: string, module: string) {
    setBasket(removeFromBasket(basket, moduleItemId, module))
  }

  function handleClearBasket() {
    setBasket(clearBasket())
    setShowBasket(false)
  }

  async function handleGeneratePOs() {
    if (basket.length === 0) {
      alert('Basket is empty')
      return
    }

    setCreatingPO(true)
    try {
      const response = await fetch('/api/restocking/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basketItems: basket,
          notes: ''
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully created ${data.count} purchase order(s)`)
        handleClearBasket()
        router.push('/dashboard/restocking/purchase-orders')
      } else {
        const error = await response.json()
        alert(`Failed to create POs: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to generate POs:', error)
      alert('Failed to generate purchase orders')
    } finally {
      setCreatingPO(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Restocking & Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">
            Intelligent restocking recommendations based on sales velocity and stock coverage
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="gap-2 relative"
            onClick={() => setShowBasket(!showBasket)}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Basket</span>
            <span className="sm:hidden">Basket</span>
            {basketSummary.totalItems > 0 && (
              <Badge className="ml-2">{basketSummary.totalItems}</Badge>
            )}
          </Button>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => router.push('/dashboard/restocking/purchase-orders')}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">View PO History</span>
            <span className="sm:hidden">PO History</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : lowStockData?.stats.total || 0}
              </span>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-red-600">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : lowStockData?.stats.critical || 0}
              </span>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Est. Restock Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : `KES ${lowStockData?.stats.estimatedCost.toLocaleString() || 0}`}
              </span>
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Basket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold">{basketSummary.totalItems}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  KES {basketSummary.totalCost.toLocaleString()}
                </p>
              </div>
              <ShoppingCart className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 h-auto bg-transparent p-0">
          <TabsTrigger value="low-stock" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <PackageSearch className="h-4 w-4" />
            <span className="hidden sm:inline">Low Stock</span>
            <span className="sm:hidden">Low Stock</span>
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Generate Restock</span>
            <span className="sm:hidden">Generate</span>
          </TabsTrigger>
          <TabsTrigger value="assisted" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Assisted Restock</span>
            <span className="sm:hidden">Assisted</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Low Stock */}
        <TabsContent value="low-stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Items</CardTitle>
              <CardDescription>
                Items below their configured stock threshold
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preset Filters */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activePreset === 'out-of-stock' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('out-of-stock')}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Out of Stock
                </Button>
                <Button
                  variant={activePreset === 'critical' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('critical')}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Critical (&lt; 5)
                </Button>
                <Button
                  variant={activePreset === 'low' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('low')}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  <Clock className="h-4 w-4" />
                  Low (&lt; 10)
                </Button>
                <Button
                  variant={activePreset === 'below-threshold' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset('below-threshold')}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  <Package className="h-4 w-4" />
                  Below Threshold
                </Button>
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input 
                      placeholder="Search by name or category..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
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
                    <SelectTrigger className="w-full sm:w-[180px]">
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

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-xs whitespace-nowrap">Quantity:</Label>
                    <Input 
                      type="number"
                      placeholder="Min"
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(e.target.value)}
                      className="w-20 h-8"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input 
                      type="number"
                      placeholder="Max"
                      value={maxQuantity}
                      onChange={(e) => setMaxQuantity(e.target.value)}
                      className="w-20 h-8"
                    />
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                    {(searchQuery || categoryFilter !== 'all' || supplierFilter !== 'all' || minQuantity || maxQuantity) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={clearFilters}
                        className="gap-2 flex-1 sm:flex-none"
                      >
                        <FilterX className="h-4 w-4" />
                        <span className="hidden sm:inline">Clear Filters</span>
                        <span className="sm:hidden">Clear</span>
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchLowStock} 
                      disabled={loading}
                      className="flex-1 sm:flex-none"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !lowStockData || lowStockData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 border rounded-lg">
                  <PackageSearch className="h-16 w-16 text-muted-foreground/50" />
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">No Low Stock Items</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Items below their stock threshold will appear here. Currently, all items have adequate stock levels.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Result count */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
                    <p className="text-muted-foreground">
                      Showing <strong>{filteredItems.length}</strong> of <strong>{lowStockData.items.length}</strong> items
                    </p>
                    {categories.length > 0 && filteredItems.length > 0 && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Label className="text-xs whitespace-nowrap">Batch Add by Category:</Label>
                        <Select onValueChange={(cat) => cat && addCategoryToBasket(cat)}>
                          <SelectTrigger className="w-full sm:w-[200px] h-8">
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
                  <div className="hidden lg:block border rounded-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-sm">
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
                                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
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
                                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </th>
                            <th 
                              className="text-right p-3 font-medium text-sm cursor-pointer hover:bg-muted/80"
                              onClick={() => handleSort('stock')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Current
                                {sortBy === 'stock' && (
                                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </th>
                            <th className="text-right p-3 font-medium text-sm">Threshold</th>
                            <th className="text-left p-3 font-medium text-sm">Status</th>
                            <th 
                              className="text-right p-3 font-medium text-sm cursor-pointer hover:bg-muted/80"
                              onClick={() => handleSort('price')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Unit Price
                                {sortBy === 'price' && (
                                  sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </th>
                            <th className="text-left p-3 font-medium text-sm">Supplier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((item) => {
                            const status = getItemStatus(item)
                            const StatusIcon = status.icon
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
                                <td className="p-3 font-medium">{item.name}</td>
                                <td className="p-3 text-sm text-muted-foreground">{item.category}</td>
                                <td className="p-3 text-right font-medium">{item.currentStock}</td>
                                <td className="p-3 text-right text-muted-foreground">{item.lowStockThreshold}</td>
                                <td className="p-3">
                                  <Badge variant={status.variant} className="gap-1">
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right">KES {item.buyingPrice.toLocaleString()}</td>
                                <td className="p-3 text-sm text-muted-foreground">
                                  {item.supplier?.name || 'No supplier'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden space-y-3">
                    {/* Select All on Mobile */}
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <input 
                        type="checkbox" 
                        className="rounded" 
                        checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                        onChange={toggleAll}
                      />
                      <span className="text-sm font-medium">
                        {selectedItems.size === filteredItems.length && filteredItems.length > 0 
                          ? 'Deselect All' 
                          : 'Select All'}
                      </span>
                    </div>

                    {filteredItems.map((item) => {
                      const status = getItemStatus(item)
                      const StatusIcon = status.icon
                      return (
                        <Card key={item.moduleItemId} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <input 
                                type="checkbox" 
                                className="rounded mt-1" 
                                checked={selectedItems.has(item.moduleItemId)}
                                onChange={() => toggleItem(item.moduleItemId)}
                              />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between">
                                  <h3 className="font-semibold text-base leading-tight">{item.name}</h3>
                                  <Badge variant={status.variant} className="gap-1 ml-2">
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Package className="h-3 w-3" />
                                  <span>{item.category}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Stock:</span>
                                    <span className="ml-1 font-medium">{item.currentStock}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Threshold:</span>
                                    <span className="ml-1">{item.lowStockThreshold}</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t">
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Price:</span>
                                    <span className="ml-1 font-semibold">KES {item.buyingPrice.toLocaleString()}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {item.supplier?.name || 'No supplier'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4">
                    <p className="text-sm text-muted-foreground">
                      {selectedItems.size > 0 && `${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''} selected`}
                    </p>
                    <Button 
                      className="gap-2 w-full sm:w-auto" 
                      disabled={selectedItems.size === 0}
                      onClick={handleAddSelectedToBasket}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Add Selected to Basket ({selectedItems.size})</span>
                      <span className="sm:hidden">Add to Basket ({selectedItems.size})</span>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Generate Restock */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Restock Recommendations</CardTitle>
              <CardDescription>
                Velocity-based restocking analysis using sales movement data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="leadTime">Lead Time (days)</Label>
                  <Input 
                    id="leadTime"
                    type="number" 
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    placeholder="7"
                  />
                  <p className="text-xs text-muted-foreground">
                    Restock cycle frequency
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="safetyBuffer">Safety Buffer (days)</Label>
                  <Input 
                    id="safetyBuffer"
                    type="number" 
                    value={safetyBuffer}
                    onChange={(e) => setSafetyBuffer(e.target.value)}
                    placeholder="2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Extra stock cushion
                  </p>
                </div>
                <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                  <Button 
                    className="w-full gap-2" 
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
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Package className="h-16 w-16 text-muted-foreground/50" />
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">No Analysis Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Configure your lead time and safety buffer, then click Analyze to generate
                      intelligent restocking recommendations based on sales velocity.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Items Recommended</p>
                      <p className="text-2xl font-bold">{generateData.summary.itemsRecommended}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Cost</p>
                      <p className="text-2xl font-bold">KES {generateData.summary.totalCost.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Analysis Period</p>
                      <p className="text-2xl font-bold">30 days</p>
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
                              <th className="text-right p-3 font-medium text-sm">Suggested Qty</th>
                              <th className="text-right p-3 font-medium text-sm">Cost</th>
                              <th className="text-left p-3 font-medium text-sm">Priority</th>
                              <th className="text-center p-3 font-medium text-sm">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {generateData.recommendations.map((rec) => (
                              <tr key={rec.moduleItemId} className="border-b hover:bg-muted/50">
                                <td className="p-3">
                                  <div>
                                    <p className="font-medium">{rec.itemName}</p>
                                    <p className="text-xs text-muted-foreground">{rec.category}</p>
                                  </div>
                                </td>
                                <td className="p-3 text-right">{rec.currentStock}</td>
                                <td className="p-3 text-right">
                                  <span className={rec.daysRemaining < 3 ? 'text-red-600 font-medium' : ''}>
                                    {rec.daysRemaining.toFixed(1)}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-sm">{rec.velocity.toFixed(1)}/day</td>
                                <td className="p-3 text-right font-medium">{rec.recommendedQty}</td>
                                <td className="p-3 text-right">KES {rec.totalCost.toLocaleString()}</td>
                                <td className="p-3">
                                  <Badge variant={rec.urgency > 2 ? 'destructive' : rec.urgency > 1 ? 'default' : 'secondary'}>
                                    {rec.urgency > 2 ? 'Critical' : rec.urgency > 1 ? 'High' : 'Medium'}
                                  </Badge>
                                </td>
                                <td className="p-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
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
                    <p className="text-center text-muted-foreground py-8">
                      No items need restocking based on current velocity analysis.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Assisted Restock */}
        <TabsContent value="assisted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget-Aware Assisted Restock</CardTitle>
              <CardDescription>
                Capital-constrained allocation prioritizing critical items
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="budget">Available Budget (KES)</Label>
                  <Input 
                    id="budget"
                    type="number" 
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistedLeadTime">Lead Time (days)</Label>
                  <Input 
                    id="assistedLeadTime"
                    type="number" 
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    placeholder="7"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistedSafetyBuffer">Safety Buffer (days)</Label>
                  <Input 
                    id="assistedSafetyBuffer"
                    type="number" 
                    value={safetyBuffer}
                    onChange={(e) => setSafetyBuffer(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                  <Button 
                    className="w-full gap-2" 
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
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground/50" />
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium">Enter Your Budget</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Set your available capital and parameters, then click Optimize to get an
                      intelligent allocation plan that maximizes stockout prevention within budget.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Budget Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Budget</p>
                      <p className="text-2xl font-bold">KES {assistedData.budget.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Allocated</p>
                      <p className="text-2xl font-bold text-green-600">KES {assistedData.totalSpent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="text-2xl font-bold text-blue-600">KES {assistedData.remainingBudget.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Utilization</p>
                      <p className="text-2xl font-bold">{assistedData.summary.budgetUtilization}</p>
                    </div>
                  </div>

                  {/* Allocation Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Allocated Items
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{assistedData.summary.itemsAllocated}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Items receiving budget allocation
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          Deferred Items
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{assistedData.summary.itemsDeferred}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Items postponed due to constraints
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Allocated Items Table */}
                  {assistedData.allocated.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          Budget Allocation Plan
                        </h3>
                        <Button
                          size="sm"
                          onClick={handleAddAllAllocatedToBasket}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add All to Basket
                        </Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr className="border-b">
                                <th className="text-left p-3 font-medium text-sm">Item</th>
                                <th className="text-right p-3 font-medium text-sm">Current</th>
                                <th className="text-right p-3 font-medium text-sm">Days Left</th>
                                <th className="text-right p-3 font-medium text-sm">Allocated Qty</th>
                                <th className="text-right p-3 font-medium text-sm">Cost</th>
                                <th className="text-left p-3 font-medium text-sm">Allocation Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assistedData.allocated.map((item) => (
                                <tr key={item.moduleItemId} className="border-b hover:bg-muted/50">
                                  <td className="p-3">
                                    <div>
                                      <p className="font-medium">{item.itemName}</p>
                                      <p className="text-xs text-muted-foreground">{item.category}</p>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">{item.currentStock}</td>
                                  <td className="p-3 text-right">
                                    <span className={item.daysRemaining < 3 ? 'text-red-600 font-medium' : ''}>
                                      {item.daysRemaining.toFixed(1)}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-medium text-green-600">
                                    {item.allocatedQty}
                                  </td>
                                  <td className="p-3 text-right">KES {item.allocatedCost.toLocaleString()}</td>
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
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-600" />
                        Deferred Items
                      </h3>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr className="border-b">
                                <th className="text-left p-3 font-medium text-sm">Item</th>
                                <th className="text-right p-3 font-medium text-sm">Current</th>
                                <th className="text-right p-3 font-medium text-sm">Days Left</th>
                                <th className="text-right p-3 font-medium text-sm">Needed Qty</th>
                                <th className="text-right p-3 font-medium text-sm">Est. Cost</th>
                                <th className="text-left p-3 font-medium text-sm">Reason Deferred</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assistedData.deferred.map((item) => (
                                <tr key={item.moduleItemId} className="border-b hover:bg-muted/50">
                                  <td className="p-3">
                                    <div>
                                      <p className="font-medium">{item.itemName}</p>
                                      <p className="text-xs text-muted-foreground">{item.category}</p>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">{item.currentStock}</td>
                                  <td className="p-3 text-right">
                                    {item.daysRemaining.toFixed(1)}
                                  </td>
                                  <td className="p-3 text-right text-muted-foreground">
                                    {item.recommendedQty}
                                  </td>
                                  <td className="p-3 text-right text-muted-foreground">
                                    KES {item.totalCost.toLocaleString()}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Basket Sidebar */}
      {showBasket && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background border-l shadow-xl z-50 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Restock Basket
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowBasket(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {basket.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/50" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium">Basket is Empty</h3>
                  <p className="text-sm text-muted-foreground">
                    Add items from any tab to start building your purchase orders
                  </p>
                </div>
              </div>
            ) : (
              <>
                {Array.from(groupBasketBySupplier(basket)).map(([key, items]) => {
                  const [supplierId, supplierName] = key.split(':')
                  const supplierTotal = items.reduce((sum, item) => sum + item.totalCost, 0)
                  
                  return (
                    <Card key={key}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          {supplierName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {items.length} item{items.length !== 1 ? 's' : ''} · KES {supplierTotal.toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {items.map((item) => {
                          const itemKey = `${item.module}-${item.moduleItemId}`
                          const isEditing = editingItem === itemKey
                          const hasQuantityChange = item.originalQuantity && item.quantity !== item.originalQuantity
                          const hasPriceChange = item.originalPrice && item.unitPrice !== item.originalPrice

                          return (
                            <div key={itemKey} className="border rounded p-2 space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{item.itemName}</p>
                                  <p className="text-xs text-muted-foreground">{item.category}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleRemoveFromBasket(item.moduleItemId, item.module)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Quantity Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleUpdateBasketQuantity(item.moduleItemId, item.module, item.quantity - 1)}
                                    disabled={item.quantity <= 1}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={item.quantity || ''}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1
                                      if (val > 0) {
                                        handleUpdateBasketQuantity(item.moduleItemId, item.module, val)
                                      }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className="h-6 w-16 text-center text-sm p-1"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleUpdateBasketQuantity(item.moduleItemId, item.module, item.quantity + 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  {hasQuantityChange && (
                                    <Badge variant="secondary" className="text-xs">
                                      was {item.originalQuantity}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Quantity</p>
                                </div>
                              </div>

                              {/* Price Row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">@</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unitPrice || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0
                                      if (val >= 0) {
                                        handleUpdateBasketPrice(item.moduleItemId, item.module, val)
                                      }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className="h-6 w-24 text-sm p-1"
                                  />
                                  {hasPriceChange && (
                                    <Badge variant="secondary" className="text-xs">
                                      was {item.originalPrice}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">
                                    KES {item.totalCost.toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              {/* Notes Row */}
                              <div>
                                <Input
                                  placeholder="Add notes (optional)"
                                  value={item.notes || ''}
                                  onChange={(e) => handleUpdateBasketNotes(item.moduleItemId, item.module, e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  )
                })}
              </>
            )}
          </div>

          <div className="p-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Items:</span>
              <span className="font-bold">{basketSummary.totalItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Cost:</span>
              <span className="font-bold text-lg">KES {basketSummary.totalCost.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClearBasket}
                disabled={basket.length === 0}
              >
                Clear All
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleGeneratePOs}
                disabled={basket.length === 0 || creatingPO}
              >
                {creatingPO ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  <><FileText className="h-4 w-4" /> Generate PO</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Basket overlay */}
      {showBasket && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowBasket(false)}
        />
      )}

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
