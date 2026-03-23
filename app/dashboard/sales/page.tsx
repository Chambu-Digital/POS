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

interface Product {
  _id: string
  productName: string
  category: string
  sellingPrice: number
  stock: number
  brand?: string
  model?: string
  variant?: string
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
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [categories, setCategories] = useState<string[]>([])
  const [cartDiscount, setCartDiscount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userInfo, setUserInfo] = useState<{ shopName: string; name: string } | null>(null)
  const isOffline = useOffline()
  const cartRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProducts()
    fetchUserInfo()
    initAutoSync()
  }, [])

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

    // Save cart data to sessionStorage
    sessionStorage.setItem('pendingSale', JSON.stringify({
      cart,
      cartDiscount
    }))

    // Redirect to payment page
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

        <div>
          <h1 className="text-3xl font-bold">Make Sale</h1>
          <p className="text-muted-foreground">Search and add products to cart</p>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2 sticky top-0 bg-white z-30 pb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Search by name, brand, model, variant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product._id}
                  className="hover:shadow-lg hover:ring-2 hover:ring-green-500 transition-all cursor-pointer"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    {/* Product image */}
                    {product.images?.[0] && (
                      <div className="w-full h-32 rounded-md overflow-hidden mb-3 bg-gray-100">
                        <img
                          src={product.images[0]}
                          alt={product.productName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{product.productName}</h3>
                        <div className="space-y-0.5 mt-1">
                          {product.brand && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Brand:</span> {product.brand}
                            </p>
                          )}
                          {product.model && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Model:</span> {product.model}
                            </p>
                          )}
                          {product.variant && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Variant:</span> {product.variant}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={product.stock > 0 ? 'default' : 'destructive'}>
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-primary">
                          KSh {product.sellingPrice.toLocaleString()}
                        </p>
                        <span className="text-2xl font-bold text-green-600">+</span>
                      </div>
                    </div>
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
                <div key={item.productId} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <div className="space-y-0.5 mt-1">
                        {item.brand && (
                          <p className="text-xs text-muted-foreground">Brand: {item.brand}</p>
                        )}
                        {item.model && (
                          <p className="text-xs text-muted-foreground">Model: {item.model}</p>
                        )}
                        {item.variant && (
                          <p className="text-xs text-muted-foreground">Variant: {item.variant}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        KSh {item.sellingPrice.toLocaleString()} each
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFromCart(item.productId)}
                    >
                      <X size={16} />
                    </Button>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    >
                      <Minus size={14} />
                    </Button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.productId, parseInt(e.target.value) || 0)
                      }
                      className="w-12 h-8 text-center"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>

                  <div className="space-y-1 text-xs">
                    <Input
                      type="number"
                      placeholder="Discount"
                      value={item.discount || ''}
                      onChange={(e) =>
                        updateDiscount(item.productId, parseFloat(e.target.value) || 0)
                      }
                      className="h-7"
                    />
                    <p className="text-right font-semibold">
                      KSh{' '}
                      {(
                        item.sellingPrice * item.quantity - item.discount
                      ).toLocaleString()}
                    </p>
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
