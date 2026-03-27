'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Plus, Minus, X, Search, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { FloatingCartButton } from '@/components/sales/floating-cart-button'
import { useOffline } from '@/hooks/use-offline'
import {
  cacheProducts,
  getCachedProducts,
  isOnline,
} from '@/lib/indexeddb'
import { initAutoSync } from '@/lib/sync'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { ScannerFeedback } from '@/components/barcode/scanner-feedback'
import { ManualBarcodeEntry } from '@/components/barcode/manual-barcode-entry'
import { HeldOrders } from '@/components/sales/held-orders'
import { ProductImage } from '@/components/ui/product-image'
import type { ScanResult } from '@/lib/barcode-scanner/types'

interface Product {
  _id: string
  productName: string
  category: string
  sellingPrice: number
  stock: number
  brand?: string
  model?: string
  variant?: string
  barcode?: string
  images?: string[]
}

interface CartItem {
  productId: string
  productName: string
  brand?: string
  model?: string
  variant?: string
  sellingPrice: number
  quantity: number
  discount: number
}

export default function SalesPage() {
  return (
    <PermissionGuard requiredPermission="canMakeSales">
      <SalesPageContent />
    </PermissionGuard>
  )
}

function SalesPageContent() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = sessionStorage.getItem('activeCart')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [cartDiscount, setCartDiscount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const saved = sessionStorage.getItem('activeCartDiscount')
      return saved ? parseFloat(saved) : 0
    } catch { return 0 }
  })
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<{ shopName: string; name: string } | null>(null)
  const isOffline = useOffline()
  const cartRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLDivElement>(null)
  const productsRef2 = useRef<Product[]>([])

  // Keep a ref to products so the scanner callback always has the latest list
  useEffect(() => { productsRef2.current = products }, [products])

  // ── Barcode Scanner ──────────────────────────────────────────────────────────
  function handleScanResult(result: ScanResult) {
    if (result.action === 'not_found' || !result.product) {
      toast.error(`Barcode not found: ${result.input.code}`)
      return
    }
    // Find the product in the local list (may have stock info)
    const local = productsRef2.current.find((p) => p._id === result.product._id) ?? result.product
    addToCart(local)
  }

  const { state: scannerState, lastResult, submitManual, enterEditing, exitEditing } =
    useBarcodeScanner({
      context: 'sales',
      onResult: handleScanResult,
    })
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    sessionStorage.removeItem('sessionProducts') // always fetch fresh so images are current
    fetchProducts()
    fetchUserInfo()
    initAutoSync()
  }, [])

  // Persist cart to sessionStorage on every change so navigation doesn't wipe it
  useEffect(() => {
    sessionStorage.setItem('activeCart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    sessionStorage.setItem('activeCartDiscount', String(cartDiscount))
  }, [cartDiscount])

  useEffect(() => {
    filterProducts()
  }, [search, categoryFilter, products])

  async function fetchProducts() {
    try {
      let prods: Product[] = []

      // Check if products are already in sessionStorage (cached during this session)
      const cachedSessionProducts = sessionStorage.getItem('sessionProducts')
      if (cachedSessionProducts) {
        try {
          prods = JSON.parse(cachedSessionProducts)
          // Invalidate cache if products don't have images field yet (stale cache)
          const hasImagesField = prods.length === 0 || 'images' in prods[0]
          if (prods.length > 0 && hasImagesField) {
            setProducts(prods)
            const cats = Array.from(new Set(prods.map((p: Product) => p.category))).sort()
            setCategories(cats as string[])
            setLoading(false)
            return
          }
        } catch (e) {
          console.error('Failed to parse session cache:', e)
        }
      }

      if (isOnline()) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

          const response = await fetch('/api/products', { signal: controller.signal })
          clearTimeout(timeoutId)

          if (response.ok) {
            const data = await response.json()
            prods = data.products || []
            // Only cache in IndexedDB if not demo data (demo IDs start with 'demo_')
            const isDemo = prods.length > 0 && String(prods[0]._id).startsWith('demo_')
            if (!isDemo) {
              await cacheProducts(prods)
            }
            // Also cache in sessionStorage for fast access
            sessionStorage.setItem('sessionProducts', JSON.stringify(prods))
          } else {
            console.error('Failed to fetch products from API, trying cache...')
            // Fallback to cache if API fails
            const cached = await getCachedProducts()
            prods = cached as Product[]
          }
        } catch (fetchError) {
          console.error('Fetch error:', fetchError)
          // Fallback to cache if fetch fails
          const cached = await getCachedProducts()
          prods = cached as Product[]
          if (prods.length === 0) {
            toast.warning('Network error. No cached products available.')
          }
        }
      } else {
        // Load from cache if offline
        const cached = await getCachedProducts()
        prods = cached as Product[]
        if (prods.length === 0) {
          toast.warning('You are offline and no products are cached. Please go online to load products.')
        }
      }

      setProducts(prods)
      const cats = Array.from(new Set(prods.map((p: Product) => p.category))).sort()
      setCategories(cats as string[])
    } catch (error) {
      console.error('Error in fetchProducts:', error)
      // Try to load from cache as last resort
      try {
        const cached = await getCachedProducts()
        setProducts(cached as Product[])
        const cats = Array.from(new Set((cached as Product[]).map((p: Product) => p.category))).sort()
        setCategories(cats as string[])
        if ((cached as Product[]).length > 0) {
          toast.warning('Loaded products from cache')
        } else {
          toast.error('No products available. Please go online and refresh.')
        }
      } catch (cacheError) {
        console.error('Failed to load from cache:', cacheError)
        toast.error('Failed to load products. Please refresh the page.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserInfo() {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUserInfo({
          shopName: data.user.shopName || 'Shop',
          name: data.user.name || 'Cashier',
        })
      } else {
        console.error('Failed to fetch user info, status:', response.status)
        // Set default user info if API fails
        setUserInfo({
          shopName: 'Shop',
          name: 'Cashier',
        })
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      // Set default user info on error
      setUserInfo({
        shopName: 'Shop',
        name: 'Cashier',
      })
    }
  }

  function filterProducts() {
    let filtered = products

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category === categoryFilter)
    }

    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.productName.toLowerCase().includes(search.toLowerCase()) ||
          p.brand?.toLowerCase().includes(search.toLowerCase()) ||
          p.model?.toLowerCase().includes(search.toLowerCase()) ||
          p.variant?.toLowerCase().includes(search.toLowerCase())
      )
    }

    setFilteredProducts(filtered)
  }

  // Structured name: [Variant] [Brand] [ProductName]
  function formatProductName(p: { productName: string; brand?: string; variant?: string }) {
    return [p.variant, p.brand, p.productName].filter(Boolean).join(' ')
  }

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      toast.error('Product out of stock')
      return
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === product._id)

      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          toast.error('Not enough stock')
          return prevCart
        }
        return prevCart.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [
        ...prevCart,
        {
          productId: product._id,
          productName: product.productName,
          brand: product.brand,
          model: product.model,
          variant: product.variant,
          sellingPrice: product.sellingPrice,
          quantity: 1,
          discount: 0,
        },
      ]
    })
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      removeFromCart(productId)
      return
    }

    const product = products.find((p) => p._id === productId)
    if (product && quantity > product.stock) {
      toast.error('Not enough stock')
      return
    }

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    )
  }

  function updateDiscount(productId: string, discount: number) {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId ? { ...item, discount } : item
      )
    )
  }

  function removeFromCart(productId: string) {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId))
  }

  function scrollToCart() {
    cartRef.current?.scrollIntoView({ behavior: 'auto' })
  }

  function scrollToTop() {
    productsRef.current?.scrollIntoView({ behavior: 'auto' })
  }

  async function completeSale() {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    // Save cart data to sessionStorage for payment page
    sessionStorage.setItem('pendingSale', JSON.stringify({ cart, cartDiscount }))
    // Clear the active cart — payment page takes over from here
    sessionStorage.removeItem('activeCart')
    sessionStorage.removeItem('activeCartDiscount')

    router.push('/dashboard/sales/payment')
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity - item.discount,
    0
  )
  const total = subtotal - cartDiscount

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 10h14l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 10z" fill="#d1fae5" stroke="#059669" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                </div>
              <div>
                <h3 className="font-semibold text-lg">Loading Products</h3>
                <p className="text-sm text-muted-foreground">
                  Please wait while we fetch your inventory...
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Left Panel - Products */}
      <div className="lg:col-span-2 flex flex-col space-y-4" ref={productsRef}>
        {isOffline && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700">
              You are offline. Sales will be saved locally and synced when you reconnect.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Make Sale</h1>
            <p className="text-muted-foreground">Search and add products to cart</p>
          </div>
          <HeldOrders onRecall={(order) => {
            setCart(order.cart)
            setCartDiscount(order.cartDiscount)
          }} />
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2 sticky top-0 bg-white z-30 pb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search by name, brand, model, variant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={enterEditing}
              onBlur={exitEditing}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manual barcode entry */}
        <ManualBarcodeEntry
          onSubmit={submitManual}
          onFocus={enterEditing}
          onBlur={exitEditing}
        />

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((product) => (
                <Card
                  key={product._id}
                  className="hover:shadow-md hover:ring-2 hover:ring-green-500 transition-all cursor-pointer"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3 flex gap-3 items-center">
                    {/* Thumbnail */}
                    <ProductImage
                      src={product.images?.[0]}
                      alt={formatProductName(product)}
                      size="md"
                      className="shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate leading-tight">
                        {formatProductName(product)}
                      </p>
                      {product.model && (
                        <p className="text-xs text-muted-foreground truncate">{product.model}</p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm font-bold text-primary">
                          KSh {product.sellingPrice.toLocaleString()}
                        </p>
                        <Badge
                          variant={product.stock > 0 ? 'default' : 'destructive'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {product.stock > 0 ? `${product.stock}` : '0'}
                        </Badge>
                      </div>
                    </div>

                    <span className="text-xl font-bold text-green-600 shrink-0">+</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="flex flex-col space-y-4 lg:pb-0 pb-32" ref={cartRef}>
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 10h14l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 10z" fill="#d1fae5" stroke="#059669" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                </span>
                Cart ({cart.length})
              </CardTitle>
              {cart.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={scrollToTop}
                  className="md:hidden"
                >
                  Add More Items
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto space-y-3">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Cart is empty</p>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="border rounded-lg p-2.5 flex gap-2.5">

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm truncate leading-tight pr-1">
                        {formatProductName(item)}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <X size={14} />
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      KSh {item.sellingPrice.toLocaleString()} each
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 w-6 p-0"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus size={12} />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.productId, parseInt(e.target.value) || 0)
                        }
                        onFocus={enterEditing}
                        onBlur={exitEditing}
                        className="w-10 h-6 text-center text-xs p-0"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 w-6 p-0"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus size={12} />
                      </Button>
                      <Input
                        type="number"
                        placeholder="Disc."
                        value={item.discount || ''}
                        onChange={(e) =>
                          updateDiscount(item.productId, parseFloat(e.target.value) || 0)
                        }
                        className="w-16 h-6 text-xs"
                      />
                      <p className="text-xs font-semibold ml-auto whitespace-nowrap">
                        KSh {(item.sellingPrice * item.quantity - item.discount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Summary and Checkout */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">KSh {subtotal.toLocaleString()}</span>
              </div>

              <div className="flex gap-2">
                <Label htmlFor="discount" className="text-sm">
                  Cart Discount:
                </Label>
                <Input
                  id="discount"
                  type="number"
                  placeholder="Discount"
                  value={cartDiscount || ''}
                  onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0)}
                  className="h-8 w-24"
                />
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">KSh {Math.max(0, total).toLocaleString()}</span>
              </div>
            </div>

            <Button
              onClick={completeSale}
              disabled={cart.length === 0}
              className="w-full"
              size="lg"
            >
              Complete Sale
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Floating Cart Button - Mobile Only */}
    <FloatingCartButton itemCount={cart.length} onClick={scrollToCart} />

    {/* Scanner feedback overlay */}
    <ScannerFeedback state={scannerState} lastResult={lastResult} />

    {/* Powered by Footer - Mobile Only */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden py-2 px-4 text-center text-xs text-muted-foreground">
      Powered by{' '}
      <a
        href="https://www.chambudigital.co.ke/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline font-medium"
      >
        Chambu Digital
      </a>
    </div>
    </>
  )
}
