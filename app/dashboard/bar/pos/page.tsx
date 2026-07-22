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
  servings: { _id: string; name: string; sellingPrice: number; unitsProduced: number }[]
}

interface CartItem {
  productId: string
  productName: string
  brand?: string
  sellingPrice: number
  quantity: number
  discount: number
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

  useEffect(() => { fetchProducts(); initAutoSync() }, [])

  // ── Refresh products whenever the page regains focus ─────────────────────────
  // After a completed sale the user returns from /dashboard/sales/payment.
  // The component is already mounted so useEffect([]) doesn't re-fire.
  // Listening to the 'focus' / 'visibilitychange' events ensures stock counts
  // are always fresh as soon as the user is back on this page.
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
  // Re-fetch products when the user navigates back to this page (e.g. after payment)
  // so stock counts are always current without a full page reload.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') fetchProducts()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
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

  function addToCart(product: BarProduct, price?: number, nameSuffix?: string) {
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
      return [...prev, { productId, productName, brand: product.brandCategory, sellingPrice, quantity: 1, discount: 0 }]
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
                  <BarProductCard key={product._id} product={product} onAdd={addToCart} />
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
              ) : cart.map(item => (
                <div key={item.productId} className="border rounded-lg p-2.5">
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
  onAdd:   (product: BarProduct, price?: number, nameSuffix?: string) => void
}

function BarProductCard({ product, onAdd }: BarProductCardProps) {
  const outOfStock = product.stock <= 0
  const lowStock   = !outOfStock && product.stock <= product.lowStockThreshold

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
          <Badge variant={outOfStock ? 'destructive' : lowStock ? 'outline' : 'default'} className="text-[10px] px-1.5 py-0 shrink-0">
            {outOfStock ? 'Out' : `${product.stock}`}
          </Badge>
        </div>

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
              <button key={serving._id} onClick={() => onAdd(product, serving.sellingPrice, serving.name)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-primary/10 hover:ring-1 hover:ring-primary transition-all">
                <span className="text-sm font-medium">
                  {serving.name}
                  <span className="text-muted-foreground font-normal text-xs ml-1">×{serving.unitsProduced}/btl</span>
                </span>
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
