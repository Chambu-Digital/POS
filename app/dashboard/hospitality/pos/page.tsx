'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, Minus, X, ShoppingCart, Trash2, AlertTriangle,
  UtensilsCrossed, Package, TrendingDown, Pause, User, Barcode, Printer,
  Keyboard, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { ManualBarcodeEntry } from '@/components/barcode/manual-barcode-entry'
import { ScannerFeedback } from '@/components/barcode/scanner-feedback'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServingType {
  _id: string
  name: string
  servingsPerUnit: number
  pricePerServing: number
  volume?: number
  isDefault: boolean
  displayOrder: number
}

interface MenuItem {
  _id: string
  name: string
  description: string
  category: string
  images: string[]
  itemType: 'for-sale' | 'ingredient'
  isServable: boolean
  servingMode: 'fraction' | 'volume' | null
  baseUnit: string
  wholePriceIfNotServable: number
  inventoryMode: 'tracked' | 'untracked'
  servingTypes?: ServingType[]
  inventory?: {
    wholeUnits: number
    totalAvailableServings: Record<string, number>
  }
}

interface CartItem {
  menuItemId: string
  name: string
  isServable: boolean
  inventoryMode: 'tracked' | 'untracked'
  servingTypeId?: string
  servingTypeName?: string
  servingsOrdered?: number
  quantity: number
  pricePerUnit: number
  totalPrice: number
  availableStock?: number | string
  barcode?: string
}

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  loyaltyPoints?: number
}

interface Category {
  _id: string
  name: string
  color: string
  isVisible: boolean
  displayOrder: number
}

interface HeldOrder {
  id: string
  cart: CartItem[]
  timestamp: string
  tableName?: string
}

export default function HospitalityPOSPage() {
  return (
    <PermissionGuard requiredPermission="hospitality.pos">
      <POSContent />
    </PermissionGuard>
  )
}

function POSContent() {
  const router = useRouter()
  
  // Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [filtered, setFiltered] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  
  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  
  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartDiscount, setCartDiscount] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  
  // Modals
  const [servingModal, setServingModal] = useState<MenuItem | null>(null)
  const [servingQuantity, setServingQuantity] = useState(1)
  const [selectedServing, setSelectedServing] = useState<ServingType | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showReceipt, setShowReceipt] = useState<any>(null)
  
  // Held orders
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([])
  const [showHeld, setShowHeld] = useState(false)
  const [holdName, setHoldName] = useState('')
  
  // Payment
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [tableNumber, setTableNumber] = useState('')
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>('dine-in')
  const [processing, setProcessing] = useState(false)
  
  // Mobile tabs
  const [mobileTab, setMobileTab] = useState<'menu' | 'cart'>('menu')
  
  const searchRef = useRef<HTMLInputElement>(null)

  // Barcode scanner integration
  const scanner = useBarcodeScanner({
    context: 'sales',
    onResult: (result) => {
      if (result.action === 'add-to-cart' && result.product) {
        // Find menu item by barcode
        const item = menuItems.find(m => m._id === result.product?._id)
        if (item) {
          handleMenuItemClick(item)
        }
      }
    },
    canAddProducts: false,
    enabled: true,
  })

  // ── Initialize ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMenu()
    loadHeldOrders()
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    let f = menuItems
    if (categoryFilter !== 'all') {
      f = f.filter(item => item.category === categoryFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      )
    }
    setFiltered(f)
  }, [menuItems, search, categoryFilter])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'F9':
          e.preventDefault()
          if (cart.length > 0) holdOrder()
          break
        case 'F10':
          e.preventDefault()
          if (heldOrders.length > 0) setShowHeld(true)
          break
        case 'F11':
          e.preventDefault()
          setShowCustomerModal(true)
          break
        case 'F12':
          e.preventDefault()
          if (cart.length > 0) openCheckout()
          break
        case 'Escape':
          if (servingModal) setServingModal(null)
          if (showPayment) setShowPayment(false)
          if (showCustomerModal) setShowCustomerModal(false)
          if (showHeld) setShowHeld(false)
          if (showReceipt) setShowReceipt(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, heldOrders, servingModal, showPayment, showCustomerModal, showHeld, showReceipt])

  async function loadMenu() {
    setLoading(true)
    try {
      const res = await fetch('/api/hospitality/pos/menu')
      if (res.ok) {
        const data = await res.json()
        setMenuItems(data.menuItems || [])
        setCategories(data.categories || [])
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to load menu. Please refresh the page.')
      }
    } catch (error) {
      console.error('Menu load error:', error)
      toast.error('Network error loading menu. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function loadCustomers(searchTerm = '') {
    setLoadingCustomers(true)
    try {
      const url = searchTerm 
        ? `/api/customers?search=${encodeURIComponent(searchTerm)}&limit=10`
        : '/api/customers?limit=10'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || data || [])
      }
    } catch (error) {
      console.error('Customer load error:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  function loadHeldOrders() {
    try {
      const stored = localStorage.getItem('hospitalityHeldOrders')
      if (stored) {
        setHeldOrders(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load held orders:', error)
    }
  }

  function saveHeldOrders(orders: HeldOrder[]) {
    try {
      localStorage.setItem('hospitalityHeldOrders', JSON.stringify(orders))
      setHeldOrders(orders)
    } catch (error) {
      console.error('Failed to save held orders:', error)
    }
  }

  // ── Cart Operations ───────────────────────────────────────────────────────

  function handleMenuItemClick(item: MenuItem) {
    // Check if item is available (tracked items only)
    if (item.inventoryMode === 'tracked' && item.inventory) {
      if (item.isServable) {
        // Check if any serving type has stock
        const hasStock = item.servingTypes?.some(st => 
          (item.inventory?.totalAvailableServings[st._id] || 0) > 0
        )
        if (!hasStock) {
          toast.error(`${item.name} is out of stock`)
          return
        }
      } else {
        // Check whole units
        if (item.inventory.wholeUnits <= 0) {
          toast.error(`${item.name} is out of stock`)
          return
        }
      }
    }

    // If servable, show serving selection modal
    if (item.isServable && item.servingTypes && item.servingTypes.length > 0) {
      setServingModal(item)
      setServingQuantity(1)
      // Pre-select default serving type
      const defaultServing = item.servingTypes.find(st => st.isDefault) || item.servingTypes[0]
      setSelectedServing(defaultServing)
    } else {
      // Add whole item directly
      addWholeItemToCart(item)
    }
  }

  function addServingToCart() {
    if (!servingModal || !selectedServing) {
      toast.error('Please select a serving type')
      return
    }

    if (servingQuantity < 1) {
      toast.error('Quantity must be at least 1')
      return
    }

    const available = servingModal.inventory?.totalAvailableServings[selectedServing._id] || Infinity
    
    if (servingModal.inventoryMode === 'tracked' && servingQuantity > available) {
      toast.error(`Only ${available} ${selectedServing.name}(s) available`)
      return
    }

    const cartItem: CartItem = {
      menuItemId: servingModal._id,
      name: servingModal.name,
      isServable: true,
      inventoryMode: servingModal.inventoryMode,
      servingTypeId: selectedServing._id,
      servingTypeName: selectedServing.name,
      servingsOrdered: servingQuantity,
      quantity: 1, // For servable items, quantity is always 1 (order multiple servings instead)
      pricePerUnit: selectedServing.pricePerServing * servingQuantity,
      totalPrice: selectedServing.pricePerServing * servingQuantity,
      availableStock: servingModal.inventoryMode === 'tracked' ? available : 'Made to Order'
    }

    setCart(prev => [...prev, cartItem])
    toast.success(`Added ${servingQuantity} ${selectedServing.name}(s) of ${servingModal.name}`)
    setServingModal(null)
    setSelectedServing(null)
    setServingQuantity(1)
  }

  function addWholeItemToCart(item: MenuItem) {
    const available = item.inventory?.wholeUnits || Infinity
    
    if (item.inventoryMode === 'tracked' && available <= 0) {
      toast.error(`${item.name} is out of stock`)
      return
    }

    const existingItem = cart.find(ci => 
      ci.menuItemId === item._id && !ci.servingTypeId
    )

    if (existingItem) {
      updateCartItemQuantity(cart.indexOf(existingItem), existingItem.quantity + 1)
    } else {
      const cartItem: CartItem = {
        menuItemId: item._id,
        name: item.name,
        isServable: false,
        inventoryMode: item.inventoryMode,
        quantity: 1,
        pricePerUnit: item.wholePriceIfNotServable,
        totalPrice: item.wholePriceIfNotServable,
        availableStock: item.inventoryMode === 'tracked' ? available : 'Made to Order'
      }

      setCart(prev => [...prev, cartItem])
      toast.success(`Added ${item.name} to cart`)
    }
  }

  function updateCartItemQuantity(index: number, newQuantity: number) {
    if (newQuantity < 1) {
      removeCartItem(index)
      return
    }

    const item = cart[index]
    
    // For servable items, update servings ordered
    if (item.isServable && item.servingTypeId) {
      const available = typeof item.availableStock === 'number' ? item.availableStock : Infinity
      if (item.inventoryMode === 'tracked' && newQuantity > available) {
        toast.error(`Only ${available} servings available`)
        return
      }
      
      const pricePerServing = item.pricePerUnit / (item.servingsOrdered || 1)
      setCart(prev => prev.map((ci, i) => i === index ? {
        ...ci,
        servingsOrdered: newQuantity,
        pricePerUnit: pricePerServing * newQuantity,
        totalPrice: pricePerServing * newQuantity
      } : ci))
    } else {
      // For whole items, update quantity
      const available = typeof item.availableStock === 'number' ? item.availableStock : Infinity
      if (item.inventoryMode === 'tracked' && newQuantity > available) {
        toast.error(`Only ${available} in stock`)
        return
      }
      
      setCart(prev => prev.map((ci, i) => i === index ? {
        ...ci,
        quantity: newQuantity,
        totalPrice: ci.pricePerUnit * newQuantity
      } : ci))
    }
  }

  function removeCartItem(index: number) {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  function clearCart() {
    if (cart.length > 0 && !confirm('Clear entire cart?')) return
    setCart([])
    setCartDiscount(0)
  }

  // ── Hold / Recall ─────────────────────────────────────────────────────────

  function holdOrder() {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    const order: HeldOrder = {
      id: `hold-${Date.now()}`,
      cart: [...cart],
      timestamp: new Date().toISOString(),
      tableName: holdName || undefined
    }

    saveHeldOrders([...heldOrders, order])
    setCart([])
    setCartDiscount(0)
    setHoldName('')
    toast.success('Order held')
  }

  function recallOrder(order: HeldOrder) {
    if (cart.length > 0 && !confirm('Replace current cart with held order?')) return
    
    setCart(order.cart)
    const updated = heldOrders.filter(o => o.id !== order.id)
    saveHeldOrders(updated)
    setShowHeld(false)
    toast.success('Order recalled')
  }

  function deleteHeldOrder(orderId: string) {
    if (!confirm('Delete this held order?')) return
    const updated = heldOrders.filter(o => o.id !== orderId)
    saveHeldOrders(updated)
  }

  // ── Checkout ──────────────────────────────────────────────────────────────

  function openCheckout() {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    setShowPayment(true)
  }

  async function processPayment() {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    if (!paymentMethod) {
      toast.error('Please select a payment method')
      return
    }

    setProcessing(true)

    try {
      const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0)
      const total = subtotal - cartDiscount

      if (total < 0) {
        toast.error('Total cannot be negative')
        setProcessing(false)
        return
      }

      const res = await fetch('/api/hospitality/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            servingTypeId: item.servingTypeId || null,
            servingTypeName: item.servingTypeName || '',
            servingsOrdered: item.servingsOrdered || null,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.totalPrice
          })),
          subtotal,
          discount: cartDiscount,
          tax: 0,
          total: Math.max(0, total),
          paymentMethod,
          tableNumber: tableNumber || '',
          orderType,
          paymentStatus: 'paid',
          customerId: selectedCustomer?._id || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to complete sale')
      }

      const data = await res.json()
      
      toast.success('Sale completed successfully!')
      
      // Show receipt
      setShowReceipt({
        ...data.sale,
        customer: selectedCustomer,
        items: cart
      })
      
      // Clear cart
      setCart([])
      setCartDiscount(0)
      setTableNumber('')
      setSelectedCustomer(null)
      setShowPayment(false)
      
      // Refresh menu to update stock levels
      loadMenu()
    } catch (error: any) {
      console.error('Payment error:', error)
      toast.error(error.message || 'Payment failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  // ── Calculations ──────────────────────────────────────────────────────────

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0)
  const total = Math.max(0, subtotal - cartDiscount)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
      
      {/* ── LEFT: Menu Items ─────────────────────────────────────────────── */}
      <div className={`flex flex-col lg:w-[60%] bg-white border-r ${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'} flex-1 lg:flex-none`}>
        
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="text-green-600" size={24} />
              <h1 className="text-xl font-bold">Menu</h1>
              {scanner.isActive && (
                <Badge variant="secondary" className="text-[10px]">
                  <Barcode size={12} className="mr-1" />
                  Scanner Active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {heldOrders.length > 0 && (
                <button
                  onClick={() => setShowHeld(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                  title="View Held Orders (F10)"
                >
                  <Pause size={16} />
                  Held ({heldOrders.length})
                </button>
              )}
              <button
                className="text-gray-400 hover:text-gray-600 text-xs"
                title="Keyboard Shortcuts: F9=Hold | F10=Held | F11=Customer | F12=Checkout"
              >
                <Keyboard size={18} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              ref={searchRef}
              placeholder="Search menu items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`shrink-0 px-3 py-1 text-sm rounded-full transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.filter(c => c.isVisible).map(cat => (
              <button
                key={cat._id}
                onClick={() => setCategoryFilter(cat.name)}
                className={`shrink-0 px-3 py-1 text-sm rounded-full transition-colors ${
                  categoryFilter === cat.name
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={categoryFilter === cat.name ? { backgroundColor: cat.color } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Package size={48} className="mb-2" />
              <p className="text-sm">No items found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map(item => {
                const isTracked = item.inventoryMode === 'tracked'
                const isLowStock = isTracked && item.inventory && (
                  item.isServable 
                    ? Object.values(item.inventory.totalAvailableServings).some(v => v > 0 && v < 10)
                    : item.inventory.wholeUnits > 0 && item.inventory.wholeUnits < 10
                )
                const isOutOfStock = isTracked && item.inventory && (
                  item.isServable
                    ? Object.values(item.inventory.totalAvailableServings).every(v => v <= 0)
                    : item.inventory.wholeUnits <= 0
                )

                return (
                  <button
                    key={item._id}
                    onClick={() => handleMenuItemClick(item)}
                    disabled={isOutOfStock}
                    className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                      isOutOfStock
                        ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                        : 'border-gray-100 bg-white hover:border-green-400 hover:shadow-md active:scale-95'
                    }`}
                  >
                    {isLowStock && !isOutOfStock && (
                      <div className="absolute top-2 right-2">
                        <TrendingDown size={14} className="text-orange-500" />
                      </div>
                    )}
                    
                    {item.inventoryMode === 'untracked' && (
                      <Badge variant="secondary" className="absolute top-2 right-2 text-[9px] px-1 py-0">
                        MTO
                      </Badge>
                    )}

                    <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                      {item.name}
                    </h3>
                    
                    {item.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div>
                        {item.isServable ? (
                          <p className="text-sm font-bold text-green-700">
                            {item.servingTypes?.length || 0} options
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-green-700">
                            KES {item.wholePriceIfNotServable.toLocaleString()}
                          </p>
                        )}
                      </div>
                      
                      {isTracked && item.inventory && (
                        <p className={`text-xs ${
                          isOutOfStock ? 'text-red-500' :
                          isLowStock ? 'text-orange-500' :
                          'text-gray-400'
                        }`}>
                          {isOutOfStock ? 'Out' : 
                           item.isServable ? 'In Stock' :
                           `${item.inventory.wholeUnits} left`}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart ──────────────────────────────────────────────────── */}
      <div className={`flex flex-col lg:w-[40%] bg-white ${mobileTab === 'menu' ? 'hidden lg:flex' : 'flex'} flex-1 lg:flex-none`}>
        
        {/* Scanner Feedback */}
        <ScannerFeedback result={scanner.lastResult} state={scanner.state} />
        
        {/* Cart Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-green-600" size={20} />
              <h2 className="font-semibold">Cart ({cart.length})</h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHoldName('')
                  const name = prompt('Enter table number or name (optional):')
                  setHoldName(name || '')
                  holdOrder()
                }}
                disabled={cart.length === 0}
                title="Hold Order (F9)"
              >
                <Pause size={16} className="mr-1" />
                Hold
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                <Trash2 size={16} className="mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">{selectedCustomer.name}</p>
                    <p className="text-xs text-gray-600">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCustomerModal(true)
                  loadCustomers()
                }}
                className="w-full"
                title="Select Customer (F11)"
              >
                <User size={16} className="mr-2" />
                Add Customer
              </Button>
            )}
          </div>

          {/* Manual Barcode Entry */}
          <ManualBarcodeEntry onSubmit={scanner.submitManual} disabled={!scanner.isActive} />
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCart size={48} className="mb-2" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Add items from menu</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <Card key={index} className="bg-gray-50">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.name}</p>
                      {item.servingTypeName && (
                        <p className="text-xs text-blue-600">
                          {item.servingsOrdered} × {item.servingTypeName}
                        </p>
                      )}
                      {item.inventoryMode === 'untracked' && (
                        <Badge variant="secondary" className="text-[9px] mt-1">
                          Made to Order
                        </Badge>
                      )}
                    </div>
                    <button
                      onClick={() => removeCartItem(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartItemQuantity(
                          index,
                          item.isServable ? (item.servingsOrdered || 1) - 1 : item.quantity - 1
                        )}
                        className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm">
                        {item.isServable ? item.servingsOrdered : item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartItemQuantity(
                          index,
                          item.isServable ? (item.servingsOrdered || 1) + 1 : item.quantity + 1
                        )}
                        className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Price */}
                    <p className="font-bold text-sm">
                      KES {item.totalPrice.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Cart Summary & Checkout */}
        <div className="border-t p-4 space-y-3 pb-20 lg:pb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>KES {subtotal.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Discount</span>
              <Input
                type="number"
                value={cartDiscount || ''}
                onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-24 h-8 text-right text-sm"
              />
            </div>

            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-green-600">KES {total.toLocaleString()}</span>
            </div>
          </div>

          <Button
            onClick={openCheckout}
            disabled={cart.length === 0}
            className="w-full h-12 text-base font-semibold relative group"
            title="Complete Sale (F12)"
          >
            <span className="flex items-center justify-center gap-2">
              Complete Sale — KES {total.toLocaleString()}
              <Keyboard size={14} className="opacity-50 group-hover:opacity-100" />
            </span>
          </Button>
        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t flex">
        <button
          onClick={() => setMobileTab('menu')}
          className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
            mobileTab === 'menu' ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          <UtensilsCrossed size={20} />
          <span className="mt-0.5">Menu</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors relative ${
            mobileTab === 'cart' ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          <ShoppingCart size={20} />
          {cart.length > 0 && (
            <span className="absolute top-2 right-[calc(50%-20px)] w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cart.length}
            </span>
          )}
          <span className="mt-0.5">Cart</span>
        </button>
      </div>

      {/* ── SERVING SELECTION MODAL ──────────────────────────────────────── */}
      {servingModal && (
        <Dialog open={!!servingModal} onOpenChange={() => setServingModal(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Select Serving - {servingModal.name}</DialogTitle>
            
            <div className="space-y-4 mt-2">
              {/* Serving types */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Serving Type</label>
                {servingModal.servingTypes?.map(st => {
                  const available = servingModal.inventory?.totalAvailableServings[st._id] || Infinity
                  const isAvailable = servingModal.inventoryMode === 'untracked' || available > 0
                  
                  return (
                    <button
                      key={st._id}
                      onClick={() => setSelectedServing(st)}
                      disabled={!isAvailable}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        selectedServing?._id === st._id
                          ? 'border-green-600 bg-green-50'
                          : isAvailable
                          ? 'border-gray-200 hover:border-green-300'
                          : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{st.name}</p>
                          <p className="text-sm text-gray-600">
                            KES {st.pricePerServing.toLocaleString()} per serving
                          </p>
                        </div>
                        <div className="text-right">
                          {servingModal.inventoryMode === 'tracked' ? (
                            <Badge variant={isAvailable ? 'default' : 'destructive'}>
                              {available > 0 ? `${available} avail` : 'Out'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">MTO</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium block mb-2">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setServingQuantity(Math.max(1, servingQuantity - 1))}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  >
                    <Minus size={16} />
                  </button>
                  <Input
                    type="number"
                    value={servingQuantity}
                    onChange={(e) => setServingQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center font-semibold"
                    min="1"
                  />
                  <button
                    onClick={() => setServingQuantity(servingQuantity + 1)}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Total */}
              {selectedServing && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total</span>
                    <span className="text-xl font-bold text-green-700">
                      KES {(selectedServing.pricePerServing * servingQuantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setServingModal(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={addServingToCart}
                  disabled={!selectedServing}
                  className="flex-1"
                >
                  Add to Cart
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── PAYMENT DIALOG ───────────────────────────────────────────────── */}
      {showPayment && (
        <Dialog open={showPayment} onOpenChange={setShowPayment}>
          <DialogContent className="max-w-md">
            <DialogTitle>Complete Payment</DialogTitle>
            
            <div className="space-y-4 mt-2">
              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium block mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">M-Pesa</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit (Pay Later)</option>
                </select>
              </div>

              {/* Order Type */}
              <div>
                <label className="text-sm font-medium block mb-2">Order Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dine-in', 'takeaway', 'delivery'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        orderType === type
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      {type === 'dine-in' ? 'Dine In' : 
                       type === 'takeaway' ? 'Takeaway' : 
                       'Delivery'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Number */}
              {orderType === 'dine-in' && (
                <div>
                  <label className="text-sm font-medium block mb-2">Table Number (optional)</label>
                  <Input
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="e.g., Table 5"
                  />
                </div>
              )}

              {/* Total */}
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount</span>
                  <span className="text-2xl font-bold text-green-700">
                    KES {total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPayment(false)}
                  disabled={processing}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processPayment}
                  disabled={processing}
                  className="flex-1"
                >
                  {processing ? 'Processing...' : 'Complete Sale'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── HELD ORDERS DIALOG ───────────────────────────────────────────── */}
      {showHeld && (
        <Dialog open={showHeld} onOpenChange={setShowHeld}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogTitle>Held Orders ({heldOrders.length})</DialogTitle>
            
            <div className="space-y-2 mt-2">
              {heldOrders.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No held orders</p>
              ) : (
                heldOrders.map(order => (
                  <Card key={order.id} className="hover:shadow-md transition">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-sm">
                            {order.tableName || `Order ${order.id.slice(-6)}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <Badge>{order.cart.length} items</Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => recallOrder(order)}
                          className="flex-1"
                        >
                          Recall
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteHeldOrder(order.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── CUSTOMER SELECTION MODAL ─────────────────────────────────────── */}
      {showCustomerModal && (
        <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
          <DialogContent className="max-w-md">
            <DialogTitle>Select Customer</DialogTitle>
            
            <div className="space-y-3 mt-2">
              <Input
                placeholder="Search by name or phone..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  if (e.target.value.length >= 2) {
                    loadCustomers(e.target.value)
                  }
                }}
                autoFocus
              />

              <div className="max-h-80 overflow-y-auto space-y-2">
                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-gray-400" size={24} />
                  </div>
                ) : customers.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">
                    {customerSearch ? 'No customers found' : 'Start typing to search'}
                  </p>
                ) : (
                  customers.map(customer => (
                    <button
                      key={customer._id}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setShowCustomerModal(false)
                        setCustomerSearch('')
                        toast.success(`Customer ${customer.name} selected`)
                      }}
                      className="w-full p-3 text-left border rounded-lg hover:border-green-400 hover:bg-green-50 transition"
                    >
                      <p className="font-semibold text-sm">{customer.name}</p>
                      <p className="text-xs text-gray-600">{customer.phone}</p>
                      {customer.email && (
                        <p className="text-xs text-gray-500">{customer.email}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── RECEIPT MODAL ────────────────────────────────────────────────── */}
      {showReceipt && (
        <Dialog open={!!showReceipt} onOpenChange={() => setShowReceipt(null)}>
          <DialogContent className="max-w-md">
            <DialogTitle>Receipt</DialogTitle>
            
            <div className="space-y-4 mt-2">
              {/* Receipt Content */}
              <div className="p-4 bg-white border rounded-lg font-mono text-xs space-y-2">
                <div className="text-center border-b pb-2">
                  <p className="font-bold text-sm">HOSPITALITY RECEIPT</p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    {new Date(showReceipt.createdAt).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-600">Order #{showReceipt._id?.slice(-8)}</p>
                </div>

                {showReceipt.customer && (
                  <div className="border-b pb-2">
                    <p className="font-semibold">Customer:</p>
                    <p>{showReceipt.customer.name}</p>
                    <p className="text-[10px] text-gray-600">{showReceipt.customer.phone}</p>
                  </div>
                )}

                <div className="border-b pb-2">
                  <p className="font-semibold mb-1">Items:</p>
                  {showReceipt.items.map((item: CartItem, i: number) => (
                    <div key={i} className="flex justify-between mb-1">
                      <div className="flex-1">
                        <p>{item.name}</p>
                        {item.servingTypeName && (
                          <p className="text-[10px] text-gray-600">
                            {item.servingsOrdered}x {item.servingTypeName}
                          </p>
                        )}
                      </div>
                      <p className="ml-2">KES {item.totalPrice.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <p>Subtotal:</p>
                    <p>KES {showReceipt.subtotal.toLocaleString()}</p>
                  </div>
                  {showReceipt.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <p>Discount:</p>
                      <p>-KES {showReceipt.discount.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t pt-1">
                    <p>TOTAL:</p>
                    <p>KES {showReceipt.total.toLocaleString()}</p>
                  </div>
                </div>

                <div className="border-t pt-2 text-center">
                  <p className="text-[10px] text-gray-600">Payment: {showReceipt.paymentMethod}</p>
                  {showReceipt.tableNumber && (
                    <p className="text-[10px] text-gray-600">Table: {showReceipt.tableNumber}</p>
                  )}
                  <p className="text-[10px] text-gray-600 mt-2">Thank you for your visit!</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex-1"
                >
                  <Printer size={16} className="mr-2" />
                  Print
                </Button>
                <Button
                  onClick={() => setShowReceipt(null)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
