'use client'

import { useState, useEffect } from 'react'
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
import { Plus, Minus, X, Search, ShoppingCart, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
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

      if (isOnline()) {
        const response = await fetch('/api/products')
        if (response.ok) {
          const data = await response.json()
          prods = data.products || []
          // Cache products for offline use
          await cacheProducts(prods)
        } else {
          console.error('Failed to fetch products from API, trying cache...')
          // Fallback to cache if API fails
          const cached = await getCachedProducts()
          prods = cached as Product[]
        }
      } else {
        // Load from cache if offline
        const cached = await getCachedProducts()
        prods = cached as Product[]
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
        toast.warning('Loaded products from cache')
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
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-8 w-8 text-primary animate-pulse" />
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Left Panel - Products */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
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
        <div className="flex gap-2">
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
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
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
                      <p className="text-lg font-bold text-primary">
                        KSh {product.sellingPrice.toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="flex flex-col space-y-4">
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart size={20} />
              Cart ({cart.length})
            </CardTitle>
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
                      value={item.discount}
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
                  value={cartDiscount}
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
  )
}
