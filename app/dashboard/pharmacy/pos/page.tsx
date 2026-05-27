'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, Plus, Minus, X, ShoppingCart, Trash2, Printer,
  UserPlus, CreditCard, RotateCcw, Pause, Zap, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Receipt, ReceiptRef } from '@/components/sales/receipt'
import { OrderCompletionDialog } from '@/components/sales/order-completion-dialog'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { ScannerFeedback } from '@/components/barcode/scanner-feedback'
import { ManualBarcodeEntry } from '@/components/barcode/manual-barcode-entry'
import { isOnline, addPendingSale, addCachedSale } from '@/lib/indexeddb'
import type { ScanResult } from '@/lib/barcode-scanner/types'
import { PermissionGuard } from '@/components/auth/permission-guard'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Drug {
  _id: string
  genericName: string
  brandName?: string
  category: string
  dosageForm?: string
  strength?: string
  unit?: string
  sellingPrice: number
  buyingPrice: number
  stock: number
  reorderLevel?: number
  requiresPrescription?: boolean
  barcode?: string
}

interface CartItem {
  productId: string
  productName: string
  unit?: string
  brand?: string
  sellingPrice: number
  originalPrice: number
  quantity: number
  discount: number
  isPrescription?: boolean
}

interface Customer {
  _id: string
  name: string
  phone: string
  creditBalance: number
}

interface HeldSale {
  id: string
  cart: CartItem[]
  cartDiscount: number
  customer: Customer | null
  heldAt: string
}

// Unit multipliers for multi-unit selling
const UNIT_OPTIONS = [
  { label: 'Single', multiplier: 1 },
  { label: 'Strip (10)', multiplier: 10 },
  { label: 'Box (30)', multiplier: 30 },
  { label: 'Bottle', multiplier: 1 },
]

export default function PharmacyPOSPage() {
  return (
    <PermissionGuard requiredPermission="pharmacy.pos">
      <PharmacyPOSContent />
    </PermissionGuard>
  )
}

function PharmacyPOSContent() {
  const router = useRouter()
  const receiptRef = useRef<ReceiptRef>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Data
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [filtered, setFiltered] = useState<Drug[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const drugsRef = useRef<Drug[]>([])
  useEffect(() => { drugsRef.current = drugs }, [drugs])

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartDiscount, setCartDiscount] = useState(0)

  // Customer
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [showAddCustomer, setShowAddCustomer] = useState(false)

  // Payment
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaMode, setMpesaMode] = useState<'stk' | 'manual'>('stk')
  const [processing, setProcessing] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  const [showCompletion, setShowCompletion] = useState(false)

  // Held sales
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [showHeld, setShowHeld] = useState(false)

  // Price override
  const [overrideItem, setOverrideItem] = useState<string | null>(null)
  const [overridePrice, setOverridePrice] = useState('')

  // User info
  const [userInfo, setUserInfo] = useState<{ shopName: string; name: string } | null>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDrugs()
    fetchUserInfo()
    loadHeld()
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    let f = drugs
    if (categoryFilter !== 'all') f = f.filter(d => d.category === categoryFilter)
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(d =>
        d.productName.toLowerCase().includes(q) ||
        d.brand?.toLowerCase().includes(q) ||
        d.barcode?.includes(q) ||
        d.unit?.toLowerCase().includes(q)
      )
    }
    setFiltered(f)
  }, [drugs, search, categoryFilter])

  async function fetchDrugs() {
    setLoading(true)
    try {
      const res = await fetch('/api/pharmacy/drugs')
      if (res.ok) {
        const data = await res.json()
        const prods = data.drugs || []
        setDrugs(prods)
        setCategories(Array.from(new Set(prods.map((p: Drug) => p.category))).sort() as string[])
      }
    } catch { toast.error('Failed to load products') }
    setLoading(false)
  }

  async function fetchUserInfo() {
    try {
      const [meRes, settingsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/settings'),
      ])
      if (meRes.ok) {
        const d = await meRes.json()
        setUserInfo({ shopName: d.user.shopName || 'Pharmacy', name: d.user.name || 'Cashier' })
      }
      if (settingsRes.ok) {
        const d = await settingsRes.json()
        setShopSettings(d.settings)
      }
    } catch {}
  }

  function loadHeld() {
    try {
      const h = JSON.parse(localStorage.getItem('pharmacyHeld') || '[]')
      setHeldSales(h)
    } catch {}
  }

  // ── Barcode scanner ───────────────────────────────────────────────────────
  const handleScanResult = useCallback((result: ScanResult) => {
    if (result.product) {
      addToCart(result.product as Drug)
    } else if (result.action === 'not_found') {
      const code = result.input.code
      const drug = drugsRef.current.find(d => d.barcode === code)
      if (drug) addToCart(drug)
      else toast.error(`No product found for barcode: ${code}`)
    }
  }, [])

  const scanner = useBarcodeScanner({
    context: 'sales',
    onResult: handleScanResult,
    canAddProducts: false,
  })

  // ── Cart operations ───────────────────────────────────────────────────────
  function addToCart(drug: Drug) {
    if (drug.stock <= 0) { toast.error(`${drug.productName} is out of stock`); return }
    setCart(prev => {
      const existing = prev.find(i => i.productId === drug._id)
      if (existing) {
        if (existing.quantity >= drug.stock) { toast.error('Not enough stock'); return prev }
        return prev.map(i => i.productId === drug._id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        productId: drug._id,
        productName: drug.genericName,
        unit: drug.unit,
        brand: drug.brandName,
        sellingPrice: drug.sellingPrice,
        originalPrice: drug.sellingPrice,
        quantity: 1,
        discount: 0,
        isPrescription: drug.requiresPrescription,
      }]
    })
    toast.success(`${drug.productName} added`, { duration: 800 })
  }

  function updateQty(productId: string, qty: number) {
    if (qty < 1) { removeFromCart(productId); return }
    const drug = drugs.find(d => d._id === productId)
    if (drug && qty > drug.stock) { toast.error('Not enough stock'); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }

  function applyPriceOverride(productId: string) {
    const price = parseFloat(overridePrice)
    if (isNaN(price) || price < 0) { toast.error('Invalid price'); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, sellingPrice: price } : i))
    setOverrideItem(null)
    setOverridePrice('')
    toast.success('Price updated')
  }

  function clearCart() {
    setCart([])
    setCartDiscount(0)
    setCustomer(null)
  }

  // ── Hold / Recall ─────────────────────────────────────────────────────────
  function holdSale() {
    if (cart.length === 0) return
    const held: HeldSale = { id: `hold-${Date.now()}`, cart, cartDiscount, customer, heldAt: new Date().toISOString() }
    const updated = [...heldSales, held]
    localStorage.setItem('pharmacyHeld', JSON.stringify(updated))
    setHeldSales(updated)
    clearCart()
    toast.success('Sale held')
  }

  function recallSale(held: HeldSale) {
    if (cart.length > 0 && !confirm('Replace current cart with held sale?')) return
    setCart(held.cart)
    setCartDiscount(held.cartDiscount)
    setCustomer(held.customer)
    const updated = heldSales.filter(h => h.id !== held.id)
    localStorage.setItem('pharmacyHeld', JSON.stringify(updated))
    setHeldSales(updated)
    setShowHeld(false)
  }

  // ── Customer search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!showCustomerSearch) return
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}`)
      if (res.ok) { const d = await res.json(); setCustomers(d.customers || []) }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch, showCustomerSearch])

  async function addNewCustomer() {
    if (!newCustomerName.trim()) return
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone }),
    })
    if (res.ok) {
      const d = await res.json()
      setCustomer(d.customer)
      setShowCustomerSearch(false)
      setShowAddCustomer(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
      toast.success('Customer added')
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.quantity - i.discount, 0)
  const vatRate = shopSettings?.features?.taxEnabled ? (shopSettings?.features?.taxRate || 16) / 100 : 0
  const vatAmount = subtotal * vatRate
  const total = subtotal - cartDiscount
  const change = parseFloat(amountPaid || '0') - total

  // ── Process payment ───────────────────────────────────────────────────────
  async function processPayment() {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (!paymentMethod) { toast.error('Select a payment method'); return }
    if (!amountPaid || parseFloat(amountPaid) <= 0) { toast.error('Enter amount paid'); return }
    if (paymentMethod === 'credit' && !customer) { toast.error('Select a customer for credit sale'); return }
    if (paymentMethod === 'mobile_money' && mpesaMode === 'manual' && !mpesaCode.trim()) {
      toast.error('Enter M-Pesa transaction code'); return
    }

    setProcessing(true)
    setShowPayment(false)

    const saleData: any = {
      items: cart.map(i => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        price: i.sellingPrice,
        discount: i.discount,
      })),
      subtotal,
      discount: cartDiscount,
      total: Math.max(0, total),
      amountPaid: parseFloat(amountPaid),
      paymentMethod,
      customerName: customer?.name || '',
      customerId: customer?._id || null,
      source: 'pos',
      mpesaCode: paymentMethod === 'mobile_money' ? mpesaCode : undefined,
      mpesaPhone: paymentMethod === 'mobile_money' ? mpesaPhone : undefined,
    }

    try {
      if (isOnline()) {
        const res = await fetch('/api/pharmacy/sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        })
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed') }
        const result = await res.json()
        const orderNumber = result.sale?.orderNumber || `RX-${result.sale?._id?.slice(-6).toUpperCase()}`

        setLastSale({
          items: cart.map(i => ({
            productName: i.productName, brand: i.brand, variant: i.variant,
            quantity: i.quantity, price: i.sellingPrice, discount: i.discount,
            total: i.sellingPrice * i.quantity - i.discount,
          })),
          subtotal, discount: cartDiscount, total: Math.max(0, total),
          amountPaid: parseFloat(amountPaid),
          paymentMethod, customerName: customer?.name || 'Cash Sale',
          date: new Date(), receiptNumber: orderNumber,
        })

        await addCachedSale({ _id: result.sale._id, userId: userInfo?.shopName || '', ...saleData, createdAt: new Date().toISOString(), synced: true })
        toast.success('Sale completed')
        setShowCompletion(true)
        clearCart()
      } else {
        await addPendingSale(saleData)
        setLastSale({
          items: cart.map(i => ({ productName: i.productName, quantity: i.quantity, price: i.sellingPrice, discount: i.discount, total: i.sellingPrice * i.quantity - i.discount })),
          subtotal, discount: cartDiscount, total: Math.max(0, total),
          paymentMethod, customerName: customer?.name || 'Cash Sale',
          date: new Date(), receiptNumber: `OFFLINE-${Date.now()}`,
        })
        toast.success('Sale saved offline')
        setShowCompletion(true)
        clearCart()
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  function openPayment() {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    setAmountPaid(total.toFixed(2))
    setShowPayment(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products')

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-gray-100 overflow-hidden">
      <ScannerFeedback state={scanner.state} lastResult={scanner.lastResult} />

      {/* ── LEFT: Product search ─────────────────────────────────────────── */}
      <div className={`flex flex-col lg:w-[55%] bg-white border-r border-gray-200 ${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'} flex-1 lg:flex-none`}>
        {/* Search bar */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                ref={searchRef}
                className="pl-9 h-10 text-sm"
                placeholder="Search drug name, brand, barcode..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => scanner.enterEditing()}
                onBlur={() => scanner.exitEditing()}
              />
            </div>
            <ManualBarcodeEntry onSubmit={scanner.submitManual} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${categoryFilter === 'all' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:border-green-400'}`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${categoryFilter === c ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:border-green-400'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3 pb-20 lg:pb-3">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[...Array(9)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No products found</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {filtered.map(drug => {
                const isLow = drug.stock <= (drug.reorderLevel || 10) && drug.stock > 0
                const isOut = drug.stock <= 0
                return (
                  <button
                    key={drug._id}
                    onClick={() => addToCart(drug)}
                    disabled={isOut}
                    className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                      isOut ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                      : 'border-gray-100 bg-white hover:border-green-400 hover:shadow-sm active:scale-95'
                    }`}
                  >
                    {isLow && !isOut && (
                      <span className="absolute top-1.5 right-1.5">
                        <AlertTriangle size={11} className="text-amber-500" />
                      </span>
                    )}
                    <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">
                      {drug.genericName}
                      {drug.requiresPrescription && <span className="ml-1 text-[9px] bg-purple-100 text-purple-700 px-1 rounded font-bold">Rx</span>}
                    </p>
                    {drug.brandName && <p className="text-[10px] text-gray-400 mt-0.5">{drug.brandName}</p>}
                    {drug.strength && <p className="text-[10px] text-blue-400">{drug.strength}</p>}
                    {drug.unit && <p className="text-[10px] text-blue-500">{drug.unit}</p>}
                    <p className="text-sm font-bold text-green-700 mt-1">KES {drug.sellingPrice.toLocaleString()}</p>
                    <p className={`text-[10px] mt-0.5 ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-gray-400'}`}>
                      {isOut ? 'Out of stock' : `${drug.stock} in stock`}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart ──────────────────────────────────────────────────── */}
      <div className={`flex flex-col lg:w-[45%] bg-white ${mobileTab === 'products' ? 'hidden lg:flex' : 'flex'} flex-1 lg:flex-none`}>
        {/* Cart header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-green-600" />
            <span className="font-semibold text-gray-900 text-sm">Cart ({cart.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {heldSales.length > 0 && (
              <button onClick={() => setShowHeld(true)} className="relative text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Pause size={13} /> Held ({heldSales.length})
              </button>
            )}
            <button onClick={holdSale} disabled={cart.length === 0} className="text-xs text-gray-500 hover:text-amber-600 flex items-center gap-1 disabled:opacity-30">
              <Pause size={13} /> Hold
            </button>
            <button onClick={clearCart} disabled={cart.length === 0} className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 disabled:opacity-30">
              <Trash2 size={13} /> Clear
            </button>
          </div>
        </div>

        {/* Customer */}
        <div className="px-4 py-2 border-b border-gray-50">
          {customer ? (
            <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-1.5">
              <div>
                <p className="text-xs font-semibold text-green-800">{customer.name}</p>
                {customer.creditBalance > 0 && <p className="text-[10px] text-red-500">Owes KES {customer.creditBalance.toLocaleString()}</p>}
              </div>
              <button onClick={() => setCustomer(null)}><X size={13} className="text-gray-400 hover:text-red-500" /></button>
            </div>
          ) : (
            <button onClick={() => setShowCustomerSearch(true)} className="w-full text-xs text-gray-400 hover:text-green-600 flex items-center gap-1.5 py-1">
              <UserPlus size={13} /> Add customer (optional)
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCart size={40} />
              <p className="text-sm mt-2">Cart is empty</p>
              <p className="text-xs">Scan or click a product</p>
            </div>
          ) : cart.map(item => (
            <div key={item.productId} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{item.productName}</p>
                  {item.brand && <p className="text-[10px] text-gray-400">{item.brand}</p>}
                  {item.unit && <p className="text-[10px] text-blue-500">{item.unit}</p>}
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="text-gray-300 hover:text-red-500 shrink-0">
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                {/* Qty controls */}
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                    <Minus size={11} />
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateQty(item.productId, parseInt(e.target.value) || 1)}
                    className="w-10 text-center text-sm font-bold border border-gray-200 rounded"
                  />
                  <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                    <Plus size={11} />
                  </button>
                </div>
                {/* Price + override */}
                <div className="text-right">
                  {overrideItem === item.productId ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={overridePrice}
                        onChange={e => setOverridePrice(e.target.value)}
                        className="w-20 text-xs border border-green-400 rounded px-1 py-0.5"
                        placeholder="New price"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') applyPriceOverride(item.productId); if (e.key === 'Escape') setOverrideItem(null) }}
                      />
                      <button onClick={() => applyPriceOverride(item.productId)} className="text-xs text-green-600 font-semibold">OK</button>
                    </div>
                  ) : (
                    <button onClick={() => { setOverrideItem(item.productId); setOverridePrice(String(item.sellingPrice)) }} className="text-sm font-bold text-gray-900 hover:text-green-600">
                      KES {(item.sellingPrice * item.quantity - item.discount).toLocaleString()}
                    </button>
                  )}
                  {item.sellingPrice !== item.originalPrice && (
                    <p className="text-[10px] text-amber-500">Override</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals + checkout */}
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 pb-20 lg:pb-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>KES {subtotal.toLocaleString()}</span>
          </div>
          {vatRate > 0 && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>VAT ({(vatRate * 100).toFixed(0)}%)</span><span>KES {vatAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Discount</span>
            <input
              type="number"
              value={cartDiscount || ''}
              onChange={e => setCartDiscount(parseFloat(e.target.value) || 0)}
              className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-0.5"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span>Total</span><span>KES {Math.max(0, total).toLocaleString()}</span>
          </div>
          <button
            onClick={openPayment}
            disabled={cart.length === 0 || processing}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Zap size={16} /> Checkout — KES {Math.max(0, total).toLocaleString()}
          </button>
        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
        <button
          onClick={() => setMobileTab('products')}
          className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${mobileTab === 'products' ? 'text-green-600' : 'text-gray-400'}`}
        >
          <Search size={20} />
          <span className="mt-0.5">Products</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors relative ${mobileTab === 'cart' ? 'text-green-600' : 'text-gray-400'}`}
        >
          <ShoppingCart size={20} />
          {cart.length > 0 && (
            <span className="absolute top-2 right-[calc(50%-18px)] w-4 h-4 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cart.length}
            </span>
          )}
          <span className="mt-0.5">Cart {cart.length > 0 ? `(${cart.length})` : ''}</span>
        </button>
      </div>

      {/* ── PAYMENT DIALOG ───────────────────────────────────────────────── */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Payment — KES {Math.max(0, total).toLocaleString()}</DialogTitle>
          <DialogDescription className="sr-only">Select payment method</DialogDescription>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">M-Pesa</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit (Pay Later)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'mobile_money' && (
              <>
                <Input placeholder="Phone (07xx...)" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => setMpesaMode('stk')} className={`flex-1 text-xs py-1.5 rounded border ${mpesaMode === 'stk' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200'}`}>STK Push</button>
                  <button onClick={() => setMpesaMode('manual')} className={`flex-1 text-xs py-1.5 rounded border ${mpesaMode === 'manual' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200'}`}>Manual</button>
                </div>
                {mpesaMode === 'manual' && (
                  <Input placeholder="M-Pesa code (e.g. QGH7XYZ)" value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} className="uppercase" />
                )}
              </>
            )}

            {paymentMethod === 'credit' && !customer && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">Select a customer first for credit sale</p>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {paymentMethod === 'cash' ? 'Cash Received' : paymentMethod === 'credit' ? 'Amount Paid Now' : 'Amount'}
              </label>
              <Input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} autoFocus />
              {paymentMethod === 'cash' && parseFloat(amountPaid) > 0 && (
                <div className={`mt-1.5 flex justify-between px-3 py-1.5 rounded text-sm font-semibold ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>Change</span><span>KES {Math.max(0, change).toFixed(2)}</span>
                </div>
              )}
              {paymentMethod === 'credit' && customer && parseFloat(amountPaid) < total && (
                <p className="text-xs text-amber-600 mt-1">KES {(total - parseFloat(amountPaid || '0')).toFixed(2)} added to {customer.name}'s credit</p>
              )}
            </div>

            <button
              onClick={processPayment}
              disabled={processing || (paymentMethod === 'credit' && !customer)}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm disabled:opacity-40"
            >
              {processing ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CUSTOMER SEARCH DIALOG ────────────────────────────────────────── */}
      <Dialog open={showCustomerSearch} onOpenChange={setShowCustomerSearch}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Select Customer</DialogTitle>
          <DialogDescription className="sr-only">Search customers</DialogDescription>
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input className="pl-8" placeholder="Name or phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} autoFocus />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {customers.map(c => (
                <button key={c._id} onClick={() => { setCustomer(c); setShowCustomerSearch(false); setCustomerSearch('') }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.phone}{c.creditBalance > 0 && <span className="text-red-500 ml-2">Owes KES {c.creditBalance.toLocaleString()}</span>}</p>
                </button>
              ))}
            </div>
            {!showAddCustomer ? (
              <button onClick={() => setShowAddCustomer(true)} className="text-xs text-green-600 flex items-center gap-1"><UserPlus size={13} /> Add new customer</button>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <Input placeholder="Name *" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
                <Input placeholder="Phone" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={addNewCustomer} className="flex-1 py-1.5 bg-green-600 text-white text-xs rounded-lg font-semibold">Save</button>
                  <button onClick={() => setShowAddCustomer(false)} className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── HELD SALES DIALOG ────────────────────────────────────────────── */}
      <Dialog open={showHeld} onOpenChange={setShowHeld}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Held Sales</DialogTitle>
          <DialogDescription className="sr-only">Recall a held sale</DialogDescription>
          <div className="space-y-2 mt-2">
            {heldSales.map(h => (
              <button key={h.id} onClick={() => recallSale(h)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors">
                <p className="text-sm font-semibold">{h.cart.length} item{h.cart.length !== 1 ? 's' : ''} — KES {h.cart.reduce((s, i) => s + i.sellingPrice * i.quantity, 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400">{h.customer?.name || 'No customer'} · {new Date(h.heldAt).toLocaleTimeString()}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── COMPLETION DIALOG ────────────────────────────────────────────── */}
      {lastSale && (
        <OrderCompletionDialog
          open={showCompletion}
          onOpenChange={(open) => {
            setShowCompletion(open)
            if (!open) searchRef.current?.focus()
          }}
          orderNumber={lastSale.receiptNumber}
          totalAmount={lastSale.total}
          itemCount={lastSale.items.length}
          shopName={userInfo?.shopName}
          cashierName={userInfo?.name}
          items={lastSale.items}
          subtotal={lastSale.subtotal}
          discount={lastSale.discount}
          onPrintReceipt={() => receiptRef.current?.print()}
          onMakeNewSale={() => { setShowCompletion(false); searchRef.current?.focus() }}
        />
      )}

      {/* ── HIDDEN RECEIPT ───────────────────────────────────────────────── */}
      {lastSale && userInfo && (
        <Receipt
          ref={receiptRef}
          shopName={userInfo.shopName}
          shopLogo={shopSettings?.general?.logo}
          cashierName={userInfo.name}
          customerName={lastSale.customerName}
          items={lastSale.items}
          subtotal={lastSale.subtotal}
          discount={lastSale.discount}
          total={lastSale.total}
          paymentMethod={lastSale.paymentMethod}
          date={lastSale.date}
          receiptNumber={lastSale.receiptNumber}
          shopPhone={shopSettings?.general?.phone}
          shopEmail={shopSettings?.general?.email}
          shopAddress={shopSettings?.general?.address}
          mpesaPaybill={shopSettings?.payment?.mpesaPaybill}
          mpesaAccountNumber={shopSettings?.payment?.mpesaAccountNumber}
          paperSize={shopSettings?.receipt?.paperSize || '58mm'}
        />
      )}
    </div>
  )
}
