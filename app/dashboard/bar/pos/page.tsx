'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Plus, Minus, X, Search, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { FloatingCartButton } from '@/components/sales/floating-cart-button'
import { useOffline } from '@/hooks/use-offline'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { ScannerFeedback } from '@/components/barcode/scanner-feedback'
import { ManualBarcodeEntry } from '@/components/barcode/manual-barcode-entry'
import { HeldOrders } from '@/components/sales/held-orders'
import { BarTabs } from '@/components/bar/BarTabs'
import { setTabLines, type LocalTab } from '@/lib/bar-tabs-cache'
import { initAutoSync } from '@/lib/sync'
import type { ScanResult } from '@/lib/barcode-scanner/types'

import { OpenBottleModal } from '@/components/bar/open-bottle-modal'
import { CloseBottleModal } from '@/components/bar/close-bottle-modal'
import { SelectBottleModal } from '@/components/bar/select-bottle-modal'

interface BarProduct {
  _id: string
  name: string
  size: string
  brandName: string
  brandCategory: string
  sellingPrice: number
  bottleSellingPrice: number
  stock: number
  lowStockThreshold: number
  barcode?: string
  hasOpenBottle?: boolean
  openBottleCount: number
  servings: { _id: string; name: string; sellingPrice: number; servingsPerContainer: number }[]
}

interface CartItem {
  productId: string
  productName: string
  brand?: string
  sellingPrice: number
  quantity: number
  discount: number
  _meta?: {
    inventoryItemId: string
    servingId?: string
    bottleId?: string
  }
}

const CART_KEY     = 'barActiveCart'
const DISCOUNT_KEY = 'barActiveCartDiscount'

export default function BarPOSPage() {
  return (
    <PermissionGuard requiredPermission="bar.tabs">
      <BarPOSContent />
    </PermissionGuard>
  )
}

function BarPOSContent() {
  const router = useRouter()

  const [products, setProducts]               = useState<BarProduct[]>([])
  const [filteredProducts, setFilteredProducts] = useState<BarProduct[]>([])
  const [categories, setCategories]           = useState<string[]>([])
  const [categoryFilter, setCategoryFilter]   = useState<string>('all')
  const [search, setSearch]                   = useState('')
  const [loading, setLoading]                 = useState(true)
  const isOffline = useOffline()

  const [activeTabId,   setActiveTabId]   = useState<string | null>(null)
  const [activeTabName, setActiveTabName] = useState<string | null>(null)

  // Customer selection for credit sales
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')

  // ── Open-bottle warning state (REMOVED in V2) ────────────────────────────────
  // V2: Auto-open bottles when needed, no warning modal

  // ── V2: Modal states ──────────────────────────────────────────────────────────
  const [openBottleModalOpen, setOpenBottleModalOpen] = useState(false)
  const [closeBottleModalOpen, setCloseBottleModalOpen] = useState(false)
  const [closeBottleProduct, setCloseBottleProduct] = useState<BarProduct | null>(null)
  
  const [selectBottleModalOpen, setSelectBottleModalOpen] = useState(false)
  const [selectBottleContext, setSelectBottleContext] = useState<{
    product: BarProduct
    serving: { _id: string; name: string; sellingPrice: number; servingsPerContainer: number }
    quantity: number
    bottles: any[]
  } | null>(null)

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]') } catch { return [] }
  })

  const [cartDiscount, setCartDiscount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try { return parseFloat(sessionStorage.getItem(DISCOUNT_KEY) || '0') } catch { return 0 }
  })

  const cartRef      = useRef<HTMLDivElement>(null)
  const productsRef  = useRef<HTMLDivElement>(null)
  const productsRef2 = useRef<BarProduct[]>([])

  useEffect(() => { productsRef2.current = products }, [products])

  function handleScanResult(result: ScanResult) {
    if (result.action === 'not_found' || !result.product) {
      toast.error(`Barcode not found: ${result.input.code}`)
      return
    }
    const local = productsRef2.current.find(p => p._id === result.product._id)
    if (local) addToCart(local)
    else toast.error('Product not found in bar inventory')
  }

  const { state: scannerState, lastResult, submitManual, enterEditing, exitEditing } =
    useBarcodeScanner({ context: 'sales', onResult: handleScanResult })

  async function fetchProducts() {
    setLoading(true)
    try {
      const res = await fetch('/api/bar/products')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const prods: BarProduct[] = (data.products || []).map((p: any) => ({
        ...p, sellingPrice: p.bottleSellingPrice ?? 0,
      }))
      setProducts(prods)
      setCategories([...new Set(prods.map(p => p.brandCategory).filter(Boolean))].sort() as string[])
    } catch { toast.error('Failed to load bar products') }
    finally { setLoading(false) }
  }

  async function fetchCustomers() {
    try {
      const res = await fetch('/api/customers')
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch { console.error('Failed to load customers') }
  }

  useEffect(() => { fetchProducts(); fetchCustomers(); initAutoSync() }, [])

  // Re-fetch when the page regains visibility (e.g. after returning from payment)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') fetchProducts()
    }
    function onFocus() { fetchProducts() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  useEffect(() => { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  useEffect(() => { sessionStorage.setItem(DISCOUNT_KEY, String(cartDiscount)) }, [cartDiscount])
  useEffect(() => { filterProducts() }, [search, categoryFilter, products])

  async function fetchProducts() {
    setLoading(true)
    try {
      const res = await fetch('/api/bar/products')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const prods: BarProduct[] = (data.products || []).map((p: any) => ({
        ...p, sellingPrice: p.bottleSellingPrice ?? 0,
      }))
      setProducts(prods)
      setCategories([...new Set(prods.map(p => p.brandCategory).filter(Boolean))].sort() as string[])
    } catch { toast.error('Failed to load bar products') }
    finally { setLoading(false) }
  }

  async function fetchCustomers() {
    try {
      const res = await fetch('/api/customers')
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch { console.error('Failed to load customers') }
  }

  function filterProducts() {
    let f = products
    if (categoryFilter !== 'all') f = f.filter(p => p.brandCategory === categoryFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      f = f.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q)
      )
    }
    setFilteredProducts(f)
  }

  async function addToCart(product: BarProduct, price?: number, nameSuffix?: string, serving?: any) {
    if (product.stock <= 0) { toast.error('Out of stock'); return }

    // V2: Handle serving sales with multi-bottle logic
    if (nameSuffix && serving) {
      // Check how many bottles are open
      if (product.openBottleCount === 0) {
        // No bottles open — will auto-open on backend, add to cart directly
        toast.info(`Will open new ${product.name} ${product.size}`)
        addToCartDirect(product, price, nameSuffix, serving)
      } else if (product.openBottleCount === 1) {
        // Single bottle open — add to cart directly (backend will auto-select)
        addToCartDirect(product, price, nameSuffix, serving)
      } else {
        // Multiple bottles open — show selection modal
        await showBottleSelectionModal(product, serving, 1)
      }
    } else {
      // Sealed bottle sale — no changes
      addToCartDirect(product, price, nameSuffix, serving)
    }
  }

  async function showBottleSelectionModal(
    product: BarProduct,
    serving: { _id: string; name: string; sellingPrice: number; servingsPerContainer: number },
    quantity: number
  ) {
    try {
      // Fetch bottle availability
      const res = await fetch(
        `/api/bar/bottles/availability?inventoryItemId=${product._id}&servingId=${serving._id}&quantity=${quantity}`
      )
      
      if (!res.ok) throw new Error('Failed to fetch bottle availability')
      
      const data = await res.json()
      
      const bottles = data.bottles.map((b: any) => ({
        bottleId: b.bottleId,
        bottleNumber: b.bottleNumber,
        remainingFraction: b.remainingFraction,
        openedAt: b.openedAt,
        canProvide: b.availability[serving._id]?.canProvide || false,
        availableServings: b.availability[serving._id]?.available || 0,
      }))

      setSelectBottleContext({ product, serving, quantity, bottles })
      setSelectBottleModalOpen(true)
    } catch (error) {
      console.error('Failed to fetch bottle availability:', error)
      toast.error('Failed to check bottle availability')
    }
  }

  function handleBottleSelected(bottleId: string) {
    if (!selectBottleContext) return
    
    const { product, serving } = selectBottleContext
    
    // Add to cart with bottleId embedded
    const sellingPrice = serving.sellingPrice
    const productName  = `${product.name} ${product.size} — ${serving.name}`
    const productId    = `${product._id}__${serving.name}__${bottleId}`
    
    setCart(prev => {
      const ex = prev.find(i => i.productId === productId)
      if (ex) {
        if (ex.quantity >= product.stock) { toast.error('Not enough stock'); return prev }
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { 
        productId, 
        productName, 
        brand: product.brandCategory, 
        sellingPrice, 
        quantity: 1, 
        discount: 0,
        // Store metadata for API call
        _meta: {
          inventoryItemId: product._id,
          servingId: serving._id,
          bottleId,
        }
      }]
    })
    
    setSelectBottleContext(null)
  }

  function addToCartDirect(product: BarProduct, price?: number, nameSuffix?: string, serving?: any) {
    if (product.stock <= 0) { toast.error('Out of stock'); return }
    const sellingPrice = price ?? product.bottleSellingPrice
    const productName  = nameSuffix ? `${product.name} ${product.size} — ${nameSuffix}` : `${product.name} ${product.size}`
    const productId    = nameSuffix ? `${product._id}__${nameSuffix}` : product._id
    
    setCart(prev => {
      const ex = prev.find(i => i.productId === productId)
      if (ex) {
        if (ex.quantity >= product.stock) { toast.error('Not enough stock'); return prev }
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      
      // Build cart item with metadata if it's a serving sale
      const cartItem: CartItem = {
        productId,
        productName,
        brand: product.brandCategory,
        sellingPrice,
        quantity: 1,
        discount: 0,
      }
      
      // Add metadata for serving sales
      if (serving) {
        cartItem._meta = {
          inventoryItemId: product._id,
          servingId: serving._id,
          // bottleId will be set when bottle selection happens or auto-assigned by backend
        }
      }
      
      return [...prev, cartItem]
    })
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity < 1) { setCart(prev => prev.filter(i => i.productId !== productId)); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i))
  }

  function updateDiscount(productId: string, discount: number) {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, discount } : i))
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }

  function scrollToCart() { cartRef.current?.scrollIntoView({ behavior: 'auto' }) }
  function scrollToTop()  { productsRef.current?.scrollIntoView({ behavior: 'auto' }) }

  // ── Tab recall — called by BarTabs when user clicks "Recall Tab" ─────────────
  function handleTabRecall(tab: LocalTab, tabCart: CartItem[], tabDiscount: number) {
    setActiveTabId(tab.localId)
    setActiveTabName(tab.customerName)
    setCart(tabCart)
    setCartDiscount(tabDiscount)
  }

  // ── Save tab without checking out (keep tab open, clear cart) ────────────────
  function saveTabAndClear() {
    if (!activeTabId) return
    setTabLines(activeTabId, cart, cartDiscount)
    setActiveTabId(null)
    setActiveTabName(null)
    setCart([])
    setCartDiscount(0)
    toast.success('Tab saved')
  }

  // ── V2: Bottle management handlers ───────────────────────────────────────────
  async function handleOpenBottle(product?: BarProduct) {
    // If product context provided (from card) → instant open
    if (product) {
      await openBottleDirectly(product)
    } else {
      // No context (from toolbar) → show modal with dropdown
      setOpenBottleModalOpen(true)
    }
  }

  async function openBottleDirectly(product: BarProduct) {
    try {
      const res = await fetch('/api/bar/bottles/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryItemId: product._id })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to open bottle')
      }
      
      const data = await res.json()
      const bottleNumber = data.bottle?.bottleNumber || '?'
      
      // Show feedback based on how many bottles are already open
      if (product.openBottleCount === 0) {
        // First bottle → green success
        toast.success(`Bottle #${bottleNumber} of ${product.name} ${product.size} opened`)
      } else if (product.openBottleCount === 1) {
        // Second bottle → yellow warning
        toast.warning(
          `Bottle #${bottleNumber} opened`,
          { description: `Note: Bottle #1 of ${product.name} is still active` }
        )
      } else {
        // Third+ bottle → yellow warning with count
        toast.warning(
          `Bottle #${bottleNumber} opened`,
          { description: `${product.openBottleCount} bottles of ${product.name} already open` }
        )
      }
      
      await fetchProducts()  // Refresh product list
    } catch (error: any) {
      console.error('Failed to open bottle:', error)
      toast.error(error.message || 'Failed to open bottle')
    }
  }

  async function handleCloseBottle(product: BarProduct) {
    // Fetch open bottles for this product
    try {
      const res = await fetch(`/api/bar/products/${product._id}/open-bottles`)
      if (!res.ok) throw new Error('Failed to fetch bottles')
      
      const data = await res.json()
      const openBottles = data.bottles || []

      if (openBottles.length === 0) {
        toast.error('No open bottles to close')
        return
      }

      if (openBottles.length === 1) {
        // Single bottle — close it directly
        const closeRes = await fetch(`/api/bar/bottles/${openBottles[0].bottleId}/close`, {
          method: 'POST',
        })
        if (!closeRes.ok) throw new Error('Failed to close bottle')
        
        const closeData = await closeRes.json()
        const variancePct = ((closeData.bottle.varianceFraction || 0) * 100).toFixed(1)
        
        toast.success(
          `Closed ${product.name} ${product.size} bottle #${closeData.bottle.bottleNumber}`,
          variancePct !== '0.0'
            ? { description: `Variance: ${variancePct}% remaining` }
            : undefined
        )
        await fetchProducts()  // Refresh
      } else {
        // Multiple bottles — show selector
        setCloseBottleProduct(product)
        setCloseBottleModalOpen(true)
      }
    } catch (error: any) {
      console.error('Failed to close bottle:', error)
      toast.error(error.message || 'Failed to close bottle')
    }
  }

  async function handleBottleOpened() {
    await fetchProducts()  // Refresh product list
  }

  async function handleBottleClosed() {
    // Fetch updated open bottles for the current product
    if (closeBottleProduct) {
      try {
        const res = await fetch(`/api/bar/products/${closeBottleProduct._id}/open-bottles`)
        if (res.ok) {
          const data = await res.json()
          const remaining = data.bottles || []
          
          if (remaining.length === 0) {
            // No more bottles open, close modal
            setCloseBottleModalOpen(false)
            setCloseBottleProduct(null)
          } else {
            // Update the product state to reflect remaining bottles
            setCloseBottleProduct(prev => prev ? { ...prev, openBottleCount: remaining.length } : null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch updated bottles:', error)
      }
    }
    await fetchProducts()  // Refresh product list
  }

  // ── Checkout ─────────────────────────────────────────────────────────────────
  async function completeSale() {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    // If an active tab is open, save the current cart back to it before going to payment
    if (activeTabId) setTabLines(activeTabId, cart, cartDiscount)
    sessionStorage.setItem('pendingSale', JSON.stringify({
      cart,
      cartDiscount,
      source:        'bar',
      saleEndpoint:  '/api/bar/pos-sale',
      returnUrl:     '/dashboard/bar/pos',
      activeTabId:   activeTabId ?? undefined,
      activeTabName: activeTabName ?? undefined,
      customerId:    selectedCustomer?._id ?? undefined,
      customerName:  selectedCustomer?.name ?? undefined,
    }))
    sessionStorage.removeItem(CART_KEY)
    sessionStorage.removeItem(DISCOUNT_KEY)
    router.push('/dashboard/sales/payment')
  }

  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.quantity - i.discount, 0)
  const total    = subtotal - cartDiscount

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="animate-pulse">
                <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 10h14l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 10z" fill="#d1fae5" stroke="#059669" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Loading Bar Products</h3>
              <p className="text-sm text-muted-foreground">Please wait…</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">

        {/* Left panel — products */}
        <div className="lg:col-span-2 flex flex-col space-y-4" ref={productsRef}>
          {isOffline && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700">
                You are offline. Bar products require an internet connection to load.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Bar POS</h1>
              {activeTabName ? (
                <p className="text-muted-foreground">
                  Tab: <span className="font-semibold text-orange-600">{activeTabName}</span>
                  <button onClick={saveTabAndClear} className="ml-2 text-xs underline text-muted-foreground hover:text-foreground">
                    save &amp; close
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">Search and add items to cart</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* General Open Bottle Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenBottle()}
                className="hidden sm:flex items-center gap-1.5"
              >
                <Plus size={16} />
                Open Bottle
              </Button>
              
              {/* Customer selector */}
              <div className="relative">
                <Select
                  value={selectedCustomer?._id || 'none'}
                  onValueChange={(val) => {
                    if (val === 'none') {
                      setSelectedCustomer(null)
                    } else {
                      const customer = customers.find(c => c._id === val)
                      setSelectedCustomer(customer || null)
                    }
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Customer</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                        {c.creditLimit > 0 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Limit: KES {c.creditLimit.toLocaleString()})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <BarTabs activeTabId={activeTabId} onRecall={handleTabRecall} />
              <HeldOrders storageKey="barHeldOrders" onRecall={(order) => {
                setActiveTabId(null); setActiveTabName(null)
                setCart(order.cart); setCartDiscount(order.cartDiscount)
              }} />
            </div>
          </div>

          <div className="flex gap-2 sticky top-0 bg-white z-30 pb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <Input placeholder="Search by name, brand, size…" value={search}
                onChange={e => setSearch(e.target.value)} onFocus={enterEditing} onBlur={exitEditing}
                className="pl-10" />
            </div>
            <Select value={categoryFilter} onValueChange={(val) => setTimeout(() => setCategoryFilter(val), 0)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <ManualBarcodeEntry onSubmit={submitManual} onFocus={enterEditing} onBlur={exitEditing} />

          <div className="flex-1 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">No products found</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredProducts.map(product => (
                  <BarProductCard
                    key={product._id}
                    product={product}
                    onAdd={addToCart}
                    onOpenBottle={handleOpenBottle}
                    onCloseBottle={handleCloseBottle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — cart */}
        <div className="flex flex-col space-y-4 lg:pb-0 pb-32" ref={cartRef}>
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 10h14l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 10z" fill="#d1fae5" stroke="#059669" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  {activeTabName
                    ? <span><span className="text-orange-600">{activeTabName}</span> <span className="text-muted-foreground font-normal text-sm">({cart.length})</span></span>
                    : <span>Cart ({cart.length})</span>
                  }
                </CardTitle>
                {cart.length > 0 && (
                  <Button size="sm" variant="outline" onClick={scrollToTop} className="md:hidden">+ Items</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {activeTabId ? 'Tab is empty — add items above' : 'Cart is empty'}
                </p>
              ) : cart.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="border rounded-lg p-2.5">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm truncate leading-tight pr-1">{item.productName}</p>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => removeFromCart(item.productId)}>
                      <X size={14} />
                    </Button>
                  </div>
                  {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                  <p className="text-xs text-muted-foreground">KSh {item.sellingPrice.toLocaleString()} each</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus size={12} /></Button>
                    <Input type="number" value={item.quantity}
                      onChange={e => updateQuantity(item.productId, parseInt(e.target.value) || 0)}
                      onFocus={enterEditing} onBlur={exitEditing} className="w-10 h-6 text-center text-xs p-0" />
                    <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus size={12} /></Button>
                    <Input type="number" placeholder="Disc." value={item.discount || ''}
                      onChange={e => updateDiscount(item.productId, parseFloat(e.target.value) || 0)}
                      className="w-16 h-6 text-xs" />
                    <p className="text-xs font-semibold ml-auto whitespace-nowrap">
                      KSh {(item.sellingPrice * item.quantity - item.discount).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Customer credit info */}
              {selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-800">{selectedCustomer.name}</span>
                    <span className="text-blue-600">
                      Balance: KSh {selectedCustomer.creditBalance?.toLocaleString() || 0}
                    </span>
                  </div>
                  {selectedCustomer.creditLimit > 0 && (
                    <div className="text-xs text-blue-600 mt-1">
                      Available Credit: KSh {Math.max(0, selectedCustomer.creditLimit - (selectedCustomer.creditBalance || 0)).toLocaleString()}
                    </div>
                  )}
                  {!selectedCustomer.idNumber && selectedCustomer.creditLimit > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800 font-medium">⚠️ ID Number Required for Credit</p>
                      <a 
                        href="/dashboard/retail/customers" 
                        className="text-xs text-yellow-700 underline hover:text-yellow-900"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Add ID to enable credit sales →
                      </a>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span><span className="font-medium">KSh {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <Label htmlFor="bar-discount" className="text-sm">Cart Discount:</Label>
                  <Input id="bar-discount" type="number" placeholder="0" value={cartDiscount || ''}
                    onChange={e => setCartDiscount(parseFloat(e.target.value) || 0)} className="h-8 w-24" />
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">KSh {Math.max(0, total).toLocaleString()}</span>
                </div>
              </div>
              <Button onClick={completeSale} disabled={cart.length === 0} className="w-full" size="lg">
                {activeTabId ? `Charge Tab — KSh ${Math.max(0, total).toLocaleString()}` : 'Complete Sale'}
              </Button>
              {activeTabId && (
                <Button variant="outline" className="w-full" size="sm" onClick={saveTabAndClear}>
                  Save Tab &amp; Keep Open
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* V2 Modals */}
      <OpenBottleModal
        isOpen={openBottleModalOpen}
        onClose={() => setOpenBottleModalOpen(false)}
        products={products}
        onBottleOpened={handleBottleOpened}
      />

      {closeBottleProduct && (
        <CloseBottleModalWrapper
          isOpen={closeBottleModalOpen}
          onClose={() => {
            setCloseBottleModalOpen(false)
            setCloseBottleProduct(null)
          }}
          product={closeBottleProduct}
          onBottleClosed={handleBottleClosed}
        />
      )}

      {selectBottleContext && (
        <SelectBottleModal
          isOpen={selectBottleModalOpen}
          onClose={() => {
            setSelectBottleModalOpen(false)
            setSelectBottleContext(null)
          }}
          productName={selectBottleContext.product.name}
          productSize={selectBottleContext.product.size}
          servingName={selectBottleContext.serving.name}
          quantity={selectBottleContext.quantity}
          bottles={selectBottleContext.bottles}
          onBottleSelected={handleBottleSelected}
        />
      )}

      <FloatingCartButton itemCount={cart.length} onClick={scrollToCart} />
      <ScannerFeedback state={scannerState} lastResult={lastResult} />
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden py-2 px-4 text-center text-xs text-muted-foreground">
        Powered by{' '}
        <a href="https://www.chambudigital.co.ke/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
          Chambu Digital
        </a>
      </div>
    </>
  )
}

// ── Bar product card ───────────────────────────────────────────────────────────

interface BarProductCardProps {
  product: BarProduct
  onAdd:   (product: BarProduct, price?: number, nameSuffix?: string, serving?: any) => void
  onOpenBottle?: (product: BarProduct) => void
  onCloseBottle?: (product: BarProduct) => void
}

function BarProductCard({ product, onAdd, onOpenBottle, onCloseBottle }: BarProductCardProps) {
  const outOfStock = product.stock <= 0
  const lowStock   = !outOfStock && product.stock <= product.lowStockThreshold
  const hasServings = product.servings.length > 0

  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">
              {product.name} <span className="text-muted-foreground font-normal">{product.size}</span>
            </p>
            {product.brandCategory && (
              <p className="text-xs text-muted-foreground">{product.brandCategory}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Open bottle count badge */}
            {hasServings && product.openBottleCount > 0 && (
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 ${
                  product.openBottleCount === 1 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                }`}
              >
                {product.openBottleCount === 1 ? '🟢' : '🟡'} {product.openBottleCount}
              </Badge>
            )}
            {/* Stock badge */}
            <Badge variant={outOfStock ? 'destructive' : lowStock ? 'outline' : 'default'} className="text-[10px] px-1.5 py-0">
              {outOfStock ? 'Out' : `${product.stock}`}
            </Badge>
          </div>
        </div>

        {/* V2: Open/Close Bottle Buttons - Only show if servings exist */}
        {hasServings && (
          <div className="flex gap-1">
            <button
              onClick={() => onOpenBottle?.(product)}
              disabled={outOfStock}
              className="flex-1 px-2 py-1 text-xs rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Open Bottle
            </button>
            {product.openBottleCount > 0 && (
              <button
                onClick={() => onCloseBottle?.(product)}
                className="flex-1 px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
              >
                Close {product.openBottleCount > 1 ? `(${product.openBottleCount})` : ''}
              </button>
            )}
          </div>
        )}

        {product.bottleSellingPrice > 0 && (
          <button disabled={outOfStock} onClick={() => onAdd(product)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-primary/10 hover:ring-1 hover:ring-primary transition-all disabled:opacity-50 disabled:pointer-events-none">
            <span className="text-sm font-medium">Full Bottle</span>
            <span className="text-sm font-bold text-primary">KSh {product.bottleSellingPrice.toLocaleString()}</span>
          </button>
        )}

        {product.servings.length > 0 && (
          <div className="space-y-1">
            {product.bottleSellingPrice > 0 && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Servings</p>
            )}
            {product.servings.map(serving => (
              <button key={serving._id} onClick={() => onAdd(product, serving.sellingPrice, serving.name, serving)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-primary/10 hover:ring-1 hover:ring-primary transition-all">
                <span className="text-sm font-medium">{serving.name}</span>
                <span className="text-sm font-bold text-primary">KSh {serving.sellingPrice.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        {product.bottleSellingPrice === 0 && product.servings.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-1">No price configured</p>
        )}
      </CardContent>
    </Card>
  )
}


// ─── CloseBottleModalWrapper ─────────────────────────────────────────────────
// Fetches open bottles dynamically when the modal is opened
// ─────────────────────────────────────────────────────────────────────────────

interface CloseBottleModalWrapperProps {
  isOpen: boolean
  onClose: () => void
  product: BarProduct
  onBottleClosed: () => void
}

function CloseBottleModalWrapper({ isOpen, onClose, product, onBottleClosed }: CloseBottleModalWrapperProps) {
  const [bottles, setBottles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchBottles()
    }
  }, [isOpen, product._id])

  async function fetchBottles() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bar/products/${product._id}/open-bottles`)
      if (!res.ok) throw new Error('Failed to fetch bottles')
      
      const data = await res.json()
      setBottles(data.bottles || [])
    } catch (error) {
      console.error('Failed to fetch bottles:', error)
      toast.error('Failed to load bottles')
    } finally {
      setLoading(false)
    }
  }

  function handleBottleClosed() {
    // Refetch bottles to update the list
    fetchBottles()
    onBottleClosed()
  }

  if (!isOpen) return null
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <p className="text-sm text-muted-foreground">Loading bottles...</p>
        </div>
      </div>
    )
  }

  return (
    <CloseBottleModal
      isOpen={isOpen}
      onClose={onClose}
      productName={product.name}
      productSize={product.size}
      bottles={bottles.map(b => ({
        _id: b.bottleId,
        bottleNumber: b.bottleNumber,
        openedAt: b.openedAt,
        remainingFraction: b.remainingFraction,
      }))}
      onBottleClosed={handleBottleClosed}
    />
  )
}
