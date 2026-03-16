'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Plus, Minus, X, CalendarClock, User, CheckCircle2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { FloatingCartButton } from '@/components/sales/floating-cart-button'
import { Receipt, ReceiptRef } from '@/components/sales/receipt'

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

interface RentalItem {
  productId: string
  productName: string
  brand?: string
  quantity: number
  rentalRate: number
  rateType: 'per_minute' | 'hourly' | 'daily' | 'weekly'
}

interface Rental {
  _id: string
  customer: { name: string; phone: string; idNo?: string }
  items: Array<{ productId: string; productName: string; quantity: number; rentalRate: number; rateType: string }>
  startTime: string
  endTime?: string
  duration?: number
  deposit: number
  depositPaymentMethod?: string
  totalAmount?: number
  paymentMethod?: string
  status: 'active' | 'returned' | 'overdue'
  createdAt: string
}

export default function RentalsPage() {
  return (
    <PermissionGuard requiredPermission="canManageRentals">
      <RentalsPageContent />
    </PermissionGuard>
  )
}

function RentalsPageContent() {
  const [activeTab, setActiveTab] = useState('new')
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [categories, setCategories] = useState<string[]>([])
  const [cart, setCart] = useState<RentalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Customer
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerIdNo, setCustomerIdNo] = useState('')

  // Deposit (optional)
  const [deposit, setDeposit] = useState<number | ''>('')
  const [depositPaymentMethod, setDepositPaymentMethod] = useState('')

  // Rentals list
  const [rentals, setRentals] = useState<Rental[]>([])
  const [rentalsLoading, setRentalsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  // Return flow
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [returnPaymentMethod, setReturnPaymentMethod] = useState('')
  const [returnMpesaCode, setReturnMpesaCode] = useState('')
  const [returnMpesaPhone, setReturnMpesaPhone] = useState('')
  const [calculatedTotal, setCalculatedTotal] = useState(0)
  const [manualOverride, setManualOverride] = useState<number | ''>('')
  const [cashReceived, setCashReceived] = useState<number | ''>('')

  // Rental slip dialog
  const [showSlipDialog, setShowSlipDialog] = useState(false)
  const [createdRental, setCreatedRental] = useState<Rental | null>(null)

  const cartRef = useRef<HTMLDivElement>(null)
  const productsRef = useRef<HTMLDivElement>(null)

  // Receipt refs
  const slipReceiptRef = useRef<ReceiptRef>(null)
  const returnReceiptRef = useRef<ReceiptRef>(null)

  // User / shop info for receipts
  const [userInfo, setUserInfo] = useState<{ shopName: string; name: string } | null>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)

  // Completed rental data for return receipt
  const [returnedRental, setReturnedRental] = useState<{ rental: Rental; finalTotal: number; paymentMethod: string; duration: string } | null>(null)

  useEffect(() => { fetchProducts() }, [])
  useEffect(() => { fetchRentals(); fetchUserInfo() }, [])
  useEffect(() => { if (activeTab === 'list') fetchRentals() }, [activeTab])

  useEffect(() => {
    let filtered = products
    if (categoryFilter !== 'all') filtered = filtered.filter(p => p.category === categoryFilter)
    if (search) filtered = filtered.filter(p =>
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.model?.toLowerCase().includes(search.toLowerCase())
    )
    setFilteredProducts(filtered)
  }, [search, categoryFilter, products])

  async function fetchProducts() {
    try {
      const cached = sessionStorage.getItem('sessionProducts')
      if (cached) {
        const prods = JSON.parse(cached)
        if (prods.length > 0) {
          setProducts(prods)
          setCategories(Array.from(new Set(prods.map((p: Product) => p.category))).sort() as string[])
          setLoading(false)
          return
        }
      }
      const res = await fetch('/api/products')
      if (res.ok) {
        const data = await res.json()
        const prods = data.products || []
        setProducts(prods)
        setCategories(Array.from(new Set(prods.map((p: Product) => p.category))).sort() as string[])
        if (prods.length > 0) sessionStorage.setItem('sessionProducts', JSON.stringify(prods))
      }
    } catch { toast.error('Failed to load products') }
    finally { setLoading(false) }
  }

  async function fetchRentals() {
    setRentalsLoading(true)
    try {
      const res = await fetch('/api/rentals')
      if (res.ok) { const data = await res.json(); setRentals(data.rentals || []) }
    } catch { toast.error('Failed to load rentals') }
    finally { setRentalsLoading(false) }
  }

  async function fetchUserInfo() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUserInfo({ shopName: data.user.shopName || 'Shop', name: data.user.name || 'Staff' })
      }
    } catch { /* silent */ }
    try {
      const res = await fetch('/api/settings')
      if (res.ok) { const data = await res.json(); setShopSettings(data.settings) }
    } catch { /* silent */ }
  }

  function addToCart(product: Product) {
    if (product.stock <= 0) { toast.error('Out of stock'); return }
    setCart(prev => {
      const existing = prev.find(i => i.productId === product._id)
      if (existing) {
        if (existing.quantity >= product.stock) { toast.error('Not enough stock'); return prev }
        return prev.map(i => i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { productId: product._id, productName: product.productName, brand: product.brand, quantity: 1, rentalRate: 0, rateType: 'hourly' as const }]
    })
  }

  function updateQuantity(productId: string, qty: number) {
    if (qty < 1) { removeFromCart(productId); return }
    const product = products.find(p => p._id === productId)
    if (product && qty > product.stock) { toast.error('Not enough stock'); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  function updateRate(productId: string, rentalRate: number) {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, rentalRate } : i))
  }

  function updateRateType(productId: string, rateType: RentalItem['rateType']) {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, rateType } : i))
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }

  function scrollToCart() { cartRef.current?.scrollIntoView({ behavior: 'auto' }) }
  function scrollToProducts() { productsRef.current?.scrollIntoView({ behavior: 'auto' }) }

  async function startRental() {
    if (cart.length === 0) { toast.error('Add items to cart'); return }
    if (!customerName.trim()) { toast.error('Customer name is required'); return }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return }
    if (cart.some(i => i.rentalRate <= 0)) { toast.error('Set a rental rate for all items'); return }

    setProcessing(true)
    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: customerName, phone: customerPhone, idNo: customerIdNo || undefined },
          items: cart,
          startTime: new Date().toISOString(),
          deposit: deposit || 0,
          depositPaymentMethod: depositPaymentMethod || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to start rental'); return }
      toast.success('Rental started')
      setCreatedRental(data.rental)
      setShowSlipDialog(true)
      // Reset form
      setCart([]); setCustomerName(''); setCustomerPhone(''); setCustomerIdNo('')
      setDeposit(''); setDepositPaymentMethod('')
      sessionStorage.removeItem('sessionProducts')
      fetchProducts()
      fetchRentals() // update counter immediately
    } catch { toast.error('Error starting rental') }
    finally { setProcessing(false) }
  }

  function openReturnDialog(rental: Rental) {
    setSelectedRental(rental)
    // Calculate duration and estimated total
    const now = new Date()
    const start = new Date(rental.startTime)
    const durationMins = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60))
    const estimated = rental.items.reduce((sum, item) => {
      let rate = item.rentalRate * item.quantity
      if (item.rateType === 'per_minute') return sum + rate * durationMins
      if (item.rateType === 'hourly') return sum + rate * (durationMins / 60)
      if (item.rateType === 'daily') return sum + rate * (durationMins / 1440)
      if (item.rateType === 'weekly') return sum + rate * (durationMins / 10080)
      return sum
    }, 0)
    setCalculatedTotal(Math.ceil(estimated))
    setManualOverride('')
    setReturnPaymentMethod('')
    setReturnMpesaCode('')
    setReturnMpesaPhone('')
    setCashReceived('')
    setShowReturnDialog(true)
  }

  async function processReturn() {
    if (!selectedRental) return
    if (!returnPaymentMethod) { toast.error('Select a payment method'); return }
    const finalTotal = manualOverride !== '' ? Number(manualOverride) : calculatedTotal
    const durationStr = formatDuration(Math.ceil((Date.now() - new Date(selectedRental.startTime).getTime()) / 60000))
    try {
      const res = await fetch(`/api/rentals/${selectedRental._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: finalTotal,
          paymentMethod: returnPaymentMethod,
          mpesaCode: returnPaymentMethod === 'mobile_money' ? returnMpesaCode : undefined,
          mpesaPhone: returnPaymentMethod === 'mobile_money' ? returnMpesaPhone : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to process return'); return }
      toast.success('Return processed successfully')
      setReturnedRental({ rental: selectedRental, finalTotal, paymentMethod: returnPaymentMethod, duration: durationStr })
      setShowReturnDialog(false)
      fetchRentals()
      sessionStorage.removeItem('sessionProducts')
      fetchProducts()
    } catch { toast.error('Error processing return') }
  }

  function formatDuration(mins: number) {
    if (mins < 60) return `${mins} min`
    if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`
    return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatDateTime(d: string) {
    return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function statusBadge(status: string) {
    if (status === 'active') return <Badge className="bg-green-100 text-green-700">Active</Badge>
    if (status === 'overdue') return <Badge className="bg-red-100 text-red-700">Overdue</Badge>
    return <Badge className="bg-gray-100 text-gray-700">Returned</Badge>
  }

  const filteredRentals = rentals.filter(r => statusFilter === 'all' || r.status === statusFilter)

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Rentals</h1>
          <TabsList>
            <TabsTrigger value="new">New Rental</TabsTrigger>
            <TabsTrigger value="list">
            <span className="relative">
              All Rentals
              {rentals.filter(r => r.status === 'active' || r.status === 'overdue').length > 0 && (
                <span className="absolute -top-3 -right-4 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {rentals.filter(r => r.status === 'active' || r.status === 'overdue').length}
                </span>
              )}
            </span>
          </TabsTrigger>
          </TabsList>
        </div>

        {/* NEW RENTAL TAB */}
        <TabsContent value="new">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products */}
            <div className="lg:col-span-2 flex flex-col space-y-4" ref={productsRef}>
              <div className="flex gap-2 sticky top-0 bg-white z-30 pb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground">Loading products...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map(product => (
                    <Card key={product._id} className="hover:shadow-lg hover:ring-2 hover:ring-green-500 transition-all cursor-pointer" onClick={() => addToCart(product)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{product.productName}</h3>
                            {product.brand && <p className="text-xs text-muted-foreground">Brand: {product.brand}</p>}
                          </div>
                          <Badge variant={product.stock > 0 ? 'default' : 'destructive'}>
                            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-primary">KSh {product.sellingPrice.toLocaleString()}</p>
                          <span className="text-2xl font-bold text-green-600">+</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Right Panel */}
            <div className="flex flex-col space-y-4 lg:pb-0 pb-32" ref={cartRef}>
              {/* Cart */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Cart ({cart.length})</CardTitle>
                    {cart.length > 0 && (
                      <Button size="sm" variant="outline" onClick={scrollToProducts} className="md:hidden">Add More Items</Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="max-h-[350px] overflow-y-auto space-y-3">
                  {cart.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No items added</p>
                  ) : cart.map(item => (
                    <div key={item.productId} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{item.productName}</p>
                          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(item.productId)}><X size={16} /></Button>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus size={14} /></Button>
                        <Input type="number" value={item.quantity} onChange={e => updateQuantity(item.productId, parseInt(e.target.value) || 1)} className="w-12 h-8 text-center" />
                        <Button size="sm" variant="outline" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus size={14} /></Button>
                      </div>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Rate (KSh)" value={item.rentalRate || ''} onChange={e => updateRate(item.productId, parseFloat(e.target.value) || 0)} className="h-8 flex-1" />
                        <Select value={item.rateType} onValueChange={v => updateRateType(item.productId, v as RentalItem['rateType'])}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_minute">/ min</SelectItem>
                            <SelectItem value="hourly">/ hour</SelectItem>
                            <SelectItem value="daily">/ day</SelectItem>
                            <SelectItem value="weekly">/ week</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Customer Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><User size={18} /> Customer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div><Label className="text-xs">Name *</Label><Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                  <div><Label className="text-xs">Phone *</Label><Input placeholder="Phone number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /></div>
                  <div><Label className="text-xs">ID Number (optional)</Label><Input placeholder="National ID / Passport" value={customerIdNo} onChange={e => setCustomerIdNo(e.target.value)} /></div>
                </CardContent>
              </Card>

              {/* Deposit (optional) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarClock size={18} /> Deposit (Optional)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div><Label className="text-xs">Deposit Amount (KSh)</Label><Input type="number" placeholder="Leave empty if no deposit" value={deposit} onChange={e => setDeposit(parseFloat(e.target.value) || '')} /></div>
                  {deposit ? (
                    <div>
                      <Label className="text-xs">Deposit Payment Method</Label>
                      <Select value={depositPaymentMethod} onValueChange={setDepositPaymentMethod}>
                        <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mobile_money">M-Pesa</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Button onClick={startRental} disabled={cart.length === 0 || processing} className="w-full" size="lg">
                {processing ? 'Processing...' : 'Start Rental & Print Slip'}
              </Button>
            </div>
          </div>

          <FloatingCartButton itemCount={cart.length} onClick={scrollToCart} />
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden py-2 px-4 text-center text-xs text-muted-foreground">
            Powered by <a href="https://www.chambudigital.co.ke/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Chambu Digital</a>
          </div>
        </TabsContent>

        {/* ALL RENTALS TAB */}
        <TabsContent value="list">
          <div className="space-y-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>

            {rentalsLoading ? (
              <div className="text-center py-10 text-muted-foreground">Loading rentals...</div>
            ) : filteredRentals.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No rentals found</div>
            ) : (
              <div className="space-y-3">
                {filteredRentals.map(rental => (
                  <Card key={rental._id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => rental.status !== 'returned' ? openReturnDialog(rental) : null}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{rental.customer.name}</p>
                            {statusBadge(rental.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">{rental.customer.phone}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {rental.items.length} item{rental.items.length > 1 ? 's' : ''} · Started: {formatDateTime(rental.startTime)}
                          </p>
                          {rental.status !== 'returned' && (
                            <p className="text-xs text-orange-600 mt-1 font-medium">Tap to process return</p>
                          )}
                        </div>
                        <div className="text-right">
                          {rental.totalAmount ? (
                            <p className="font-bold text-primary">KSh {rental.totalAmount.toLocaleString()}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Pending payment</p>
                          )}
                          {rental.deposit > 0 && (
                            <p className="text-xs text-muted-foreground">Deposit: KSh {rental.deposit.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* RENTAL SLIP DIALOG */}
      {createdRental && (
        <Dialog open={showSlipDialog} onOpenChange={setShowSlipDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Rental Slip</DialogTitle></DialogHeader>
            <div id="rental-slip" className="space-y-3 text-sm">
              <div className="text-center border-b pb-3">
                <p className="font-bold text-lg">RENTAL SLIP</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(createdRental.startTime)}</p>
              </div>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Customer:</span> <span className="font-semibold">{createdRental.customer.name}</span></p>
                <p><span className="text-muted-foreground">Phone:</span> {createdRental.customer.phone}</p>
                {createdRental.customer.idNo && <p><span className="text-muted-foreground">ID:</span> {createdRental.customer.idNo}</p>}
              </div>
              <Separator />
              <div className="space-y-2">
                {createdRental.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-xs text-right">KSh {item.rentalRate}/{item.rateType.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
              {createdRental.deposit > 0 && (
                <>
                  <Separator />
                  <p><span className="text-muted-foreground">Deposit Paid:</span> <span className="font-semibold">KSh {createdRental.deposit.toLocaleString()}</span></p>
                </>
              )}
              <Separator />
              <p className="text-center text-xs text-muted-foreground">Amount due on return based on duration</p>
            </div>
            <Button onClick={() => slipReceiptRef.current?.print()} className="w-full" variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Print Slip
            </Button>
            <Button onClick={() => setShowSlipDialog(false)} className="w-full">Done</Button>
          </DialogContent>
        </Dialog>
      )}

      {/* RETURN DIALOG */}
      {selectedRental && (
        <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Process Return</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
                <p className="font-semibold">{selectedRental.customer.name} · {selectedRental.customer.phone}</p>
                <p className="text-muted-foreground">Started: {formatDateTime(selectedRental.startTime)}</p>
                <p className="text-muted-foreground">Duration so far: <span className="font-medium text-foreground">{formatDuration(Math.ceil((Date.now() - new Date(selectedRental.startTime).getTime()) / 60000))}</span></p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Items</p>
                {selectedRental.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm border rounded p-2">
                    <span>{item.productName} × {item.quantity}</span>
                    <span className="text-muted-foreground">KSh {item.rentalRate}/{item.rateType.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Calculated Total (KSh)</Label>
                <Input type="number" value={manualOverride !== '' ? manualOverride : calculatedTotal} onChange={e => setManualOverride(parseFloat(e.target.value) || '')} />
                <p className="text-xs text-muted-foreground">Auto-calculated: KSh {calculatedTotal.toLocaleString()}. Edit if needed.</p>
              </div>

              {selectedRental.deposit > 0 && (
                <div className="flex justify-between text-sm bg-blue-50 rounded p-2">
                  <span>Deposit collected:</span>
                  <span className="font-semibold">KSh {selectedRental.deposit.toLocaleString()}</span>
                </div>
              )}

              <div>
                <Label>Payment Method</Label>
                <Select value={returnPaymentMethod} onValueChange={setReturnPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">M-Pesa</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {returnPaymentMethod === 'mobile_money' && (
                <>
                  <div><Label>M-Pesa Phone</Label><Input placeholder="0712345678" value={returnMpesaPhone} onChange={e => setReturnMpesaPhone(e.target.value)} /></div>
                  <div><Label>M-Pesa Code</Label><Input placeholder="Transaction code" value={returnMpesaCode} onChange={e => setReturnMpesaCode(e.target.value.toUpperCase())} className="uppercase" /></div>
                </>
              )}

              {returnPaymentMethod === 'cash' && (
                <div className="space-y-2">
                  <Label>Cash Received (KSh)</Label>
                  <Input
                    type="number"
                    placeholder="Amount given by customer"
                    value={cashReceived}
                    onChange={e => setCashReceived(parseFloat(e.target.value) || '')}
                  />
                  {cashReceived !== '' && (
                    <div className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm font-semibold ${Number(cashReceived) >= (manualOverride !== '' ? Number(manualOverride) : calculatedTotal) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      <span>Change</span>
                      <span>KSh {Math.max(0, Number(cashReceived) - (manualOverride !== '' ? Number(manualOverride) : calculatedTotal)).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={processReturn} disabled={!returnPaymentMethod} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Return & Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* RETURN RECEIPT DIALOG */}
      {returnedRental && (
        <Dialog open={!!returnedRental} onOpenChange={() => setReturnedRental(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Return Complete</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center space-y-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-xl font-bold">KSh {returnedRental.finalTotal.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{returnedRental.rental.customer.name} · {returnedRental.duration}</p>
            </div>
            <Button onClick={() => returnReceiptRef.current?.print()} className="w-full" variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Print Receipt
            </Button>
            <Button onClick={() => setReturnedRental(null)} className="w-full">Done</Button>
          </DialogContent>
        </Dialog>
      )}

      {/* HIDDEN RECEIPT — Rental Slip */}
      {createdRental && userInfo && (
        <Receipt
          ref={slipReceiptRef}
          receiptType="rental_slip"
          shopName={userInfo.shopName}
          cashierName={userInfo.name}
          receiptNumber={createdRental._id}
          date={new Date(createdRental.startTime)}
          customerName={createdRental.customer.name}
          customerPhone={createdRental.customer.phone}
          customerIdNo={createdRental.customer.idNo}
          items={createdRental.items.map(i => ({
            productName: i.productName,
            quantity: i.quantity,
            price: i.rentalRate,
            discount: 0,
            total: 0,
            rateType: i.rateType,
          }))}
          subtotal={0}
          discount={0}
          total={0}
          paymentMethod=""
          deposit={createdRental.deposit}
          depositPaymentMethod={createdRental.depositPaymentMethod}
          shopPhone={shopSettings?.shop?.phone}
          shopEmail={shopSettings?.shop?.email}
          shopAddress={shopSettings?.shop?.address}
          paperSize={shopSettings?.receipt?.paperSize || '58mm'}
        />
      )}

      {/* HIDDEN RECEIPT — Return Receipt */}
      {returnedRental && userInfo && (
        <Receipt
          ref={returnReceiptRef}
          receiptType="rental_return"
          shopName={userInfo.shopName}
          cashierName={userInfo.name}
          receiptNumber={returnedRental.rental._id}
          date={new Date()}
          customerName={returnedRental.rental.customer.name}
          customerPhone={returnedRental.rental.customer.phone}
          customerIdNo={returnedRental.rental.customer.idNo}
          rentalDuration={returnedRental.duration}
          items={returnedRental.rental.items.map(i => ({
            productName: i.productName,
            quantity: i.quantity,
            price: i.rentalRate,
            discount: 0,
            total: i.rentalRate * i.quantity,
            rateType: i.rateType,
          }))}
          subtotal={returnedRental.finalTotal + (returnedRental.rental.deposit || 0)}
          discount={0}
          total={returnedRental.finalTotal}
          paymentMethod={returnedRental.paymentMethod}
          deposit={returnedRental.rental.deposit}
          depositPaymentMethod={returnedRental.rental.depositPaymentMethod}
          shopPhone={shopSettings?.shop?.phone}
          shopEmail={shopSettings?.shop?.email}
          shopAddress={shopSettings?.shop?.address}
          mpesaPaybill={shopSettings?.payment?.mpesaPaybill}
          mpesaAccountNumber={shopSettings?.payment?.mpesaAccountNumber}
          paperSize={shopSettings?.receipt?.paperSize || '58mm'}
        />
      )}
    </>
  )
}
