'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Receipt, ReceiptRef } from '@/components/sales/receipt'
import { OrderCompletionDialog } from '@/components/sales/order-completion-dialog'
import { isOnline, addPendingSale, addCachedSale } from '@/lib/indexeddb'
import { createBackupSnapshot, isBackupEnabled } from '@/lib/backup'

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

interface Customer {
  _id: string
  name: string
  phone: string
  creditBalance: number
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentPageContent />
    </Suspense>
  )
}

function PaymentPageContent() {
  const router = useRouter()
  const receiptRef = useRef<ReceiptRef>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartDiscount, setCartDiscount] = useState(0)
  const [selectedPayment, setSelectedPayment] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [mpesaCode, setMpesaCode] = useState<string>('')
  const [mpesaPhone, setMpesaPhone] = useState<string>('')
  const [showMpesaFields, setShowMpesaFields] = useState(false)
  const [mpesaMethod, setMpesaMethod] = useState<'stk' | 'manual'>('stk')
  const [stkPushInitiated, setStkPushInitiated] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSale, setLastSale] = useState<any>(null)
  const [userInfo, setUserInfo] = useState<{ shopName: string; name: string } | null>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  useEffect(() => {
    const cartData = sessionStorage.getItem('pendingSale')
    if (cartData) {
      try {
        const data = JSON.parse(cartData)
        setCart(data.cart || [])
        setCartDiscount(data.cartDiscount || 0)
        const subtotal = (data.cart || []).reduce(
          (sum: number, item: CartItem) => sum + item.sellingPrice * item.quantity - item.discount, 0
        )
        const total = subtotal - (data.cartDiscount || 0)
        setPaymentAmount(Math.max(0, total).toFixed(2))
        setLoading(false)
      } catch {
        router.push('/dashboard/sales')
      }
    } else {
      router.push('/dashboard/sales')
    }
    fetchUserInfo()
  }, [router])

  async function fetchUserInfo() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUserInfo({ shopName: data.user.shopName || 'Shop', name: data.user.name || 'Cashier' })
      }
    } catch { setUserInfo({ shopName: 'Shop', name: 'Cashier' }) }
    try {
      const res = await fetch('/api/settings')
      if (res.ok) { const data = await res.json(); setShopSettings(data.settings) }
    } catch {}
  }

  async function searchCustomers(q: string) {
    setCustomerSearchLoading(true)
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}`)
      if (res.ok) { const data = await res.json(); setCustomers(data.customers || []) }
    } catch {}
    setCustomerSearchLoading(false)
  }

  useEffect(() => {
    if (showCustomerSearch) searchCustomers(customerSearch)
  }, [customerSearch, showCustomerSearch])

  async function addNewCustomer() {
    if (!newCustomerName.trim()) return
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone }),
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedCustomer(data.customer)
        setShowAddCustomer(false)
        setShowCustomerSearch(false)
        setNewCustomerName('')
        setNewCustomerPhone('')
        toast.success('Customer added')
      }
    } catch { toast.error('Failed to add customer') }
  }

  async function processPayment() {
    if (!selectedPayment) { toast.error('Please select a payment method'); return }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) { toast.error('Please enter a valid payment amount'); return }
    if (selectedPayment === 'credit' && !selectedCustomer) { toast.error('Please select a customer for credit payment'); return }
    if (selectedPayment === 'mobile_money' && mpesaMethod === 'manual' && !mpesaCode.trim()) {
      toast.error('Please enter M-Pesa transaction code'); return
    }
    if (selectedPayment === 'mobile_money' && !mpesaPhone.trim()) {
      toast.error('Please enter M-Pesa phone number'); return
    }

    setProcessing(true)
    setShowPaymentDialog(false)

    try {
      const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity - item.discount, 0)
      const total = subtotal - cartDiscount

      const saleData: any = {
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.sellingPrice,
          discount: item.discount,
        })),
        subtotal,
        discount: cartDiscount,
        total: Math.max(0, total),
        amountPaid: parseFloat(paymentAmount),
        paymentMethod: selectedPayment,
        customerName: selectedCustomer?.name || '',
        customerId: selectedCustomer?._id || null,
        mpesaCode: selectedPayment === 'mobile_money' ? mpesaCode : undefined,
        mpesaPhone: selectedPayment === 'mobile_money' ? mpesaPhone : undefined,
      }

      if (isOnline()) {
        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to complete sale')
        }

        const result = await response.json()
        const orderNumber = result.sale?.orderNumber || `ORD-${result.sale?._id?.slice(-5).toUpperCase()}`

        setLastSale({
          items: cart.map(item => ({
            productName: item.productName,
            brand: item.brand,
            model: item.model,
            variant: item.variant,
            quantity: item.quantity,
            price: item.sellingPrice,
            discount: item.discount,
            total: item.sellingPrice * item.quantity - item.discount,
          })),
          subtotal,
          discount: cartDiscount,
          total: Math.max(0, total),
          amountPaid: parseFloat(paymentAmount),
          paymentMethod: selectedPayment,
          customerName: selectedCustomer?.name || 'Cash Sale',
          date: new Date(),
          receiptNumber: orderNumber,
          creditBalance: selectedCustomer?.creditBalance,
        })

        toast.success('Payment completed successfully')
        setShowCompletionDialog(true)

        await addCachedSale({
          _id: result.sale._id,
          userId: userInfo?.shopName || 'unknown',
          items: saleData.items,
          subtotal: saleData.subtotal,
          discount: saleData.discount,
          total: saleData.total,
          paymentMethod: saleData.paymentMethod,
          createdAt: new Date().toISOString(),
          synced: true,
        })
      } else {
        await addPendingSale(saleData)
        setLastSale({
          items: cart.map(item => ({
            productName: item.productName, brand: item.brand, model: item.model,
            variant: item.variant, quantity: item.quantity, price: item.sellingPrice,
            discount: item.discount, total: item.sellingPrice * item.quantity - item.discount,
          })),
          subtotal, discount: cartDiscount, total: Math.max(0, total),
          paymentMethod: selectedPayment, customerName: selectedCustomer?.name || 'Cash Sale',
          date: new Date(), receiptNumber: `OFFLINE-${Date.now()}`,
        })
        toast.success('Sale saved offline - will sync when online')
        setShowCompletionDialog(true)
      }

      if (isBackupEnabled() && userInfo) {
        try { await createBackupSnapshot(userInfo.shopName, userInfo.shopName, []) } catch {}
      }

      sessionStorage.removeItem('pendingSale')
    } catch (error: any) {
      toast.error(error.message || 'Error processing payment')
    } finally {
      setProcessing(false) }
  }

  function cancelOrder() { sessionStorage.removeItem('pendingSale'); router.push('/dashboard/sales') }

  function holdOrder() {
    if (cart.length === 0) return
    const held = JSON.parse(localStorage.getItem('heldOrders') || '[]')
    held.push({ id: `hold-${Date.now()}`, cart, cartDiscount, heldAt: new Date().toISOString() })
    localStorage.setItem('heldOrders', JSON.stringify(held))
    sessionStorage.removeItem('pendingSale')
    router.push('/dashboard/sales')
  }

  function handlePaymentMethodChange(value: string) {
    setSelectedPayment(value)
    setShowMpesaFields(value === 'mobile_money')
    if (value !== 'mobile_money') { setMpesaCode(''); setMpesaPhone(''); setMpesaMethod('stk'); setStkPushInitiated(false) }
  }

  async function initiateSTKPush() {
    if (!mpesaPhone.trim()) { toast.error('Please enter M-Pesa phone number'); return }
    setProcessing(true)
    try {
      const res = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: mpesaPhone, amount: parseFloat(paymentAmount), orderReference: `ORDER-${Date.now()}` }),
      })
      const data = await res.json()
      if (data.ResponseCode === '0') {
        toast.success('STK Push sent! Enter your M-Pesa PIN')
        setStkPushInitiated(true)
      } else {
        toast.error(data.ResponseDescription || 'Failed to initiate STK Push')
        setMpesaMethod('manual')
      }
    } catch { toast.error('Failed to initiate STK Push'); setMpesaMethod('manual') }
    finally { setProcessing(false) }
  }

  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity - item.discount, 0)
  const total = subtotal - cartDiscount
  const change = parseFloat(paymentAmount) - Math.max(0, total)

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">Loading...</div></div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Select Payment Method</h1>

          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium">Pay</span>
            <span className="text-2xl font-bold">KES {Math.max(0, total).toFixed(2)}</span>
          </div>

          {/* Customer Selection */}
          <div className="mb-4">
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-green-800">{selectedCustomer.name}</p>
                  <p className="text-xs text-green-600">
                    {selectedCustomer.phone}
                    {selectedCustomer.creditBalance > 0 && ` · Owes KES ${selectedCustomer.creditBalance.toLocaleString()}`}
                  </p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-green-600 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerSearch(true)}
                className="w-full flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
              >
                <Search size={14} /> Select Customer (optional — defaults to "Cash Sale")
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <Button variant="outline" onClick={cancelOrder} disabled={processing}>Cancel Order</Button>
            <Button variant="secondary" disabled={processing} onClick={holdOrder}>Hold Order</Button>
            <Button onClick={() => setShowPaymentDialog(true)} disabled={processing} className="bg-green-600 hover:bg-green-700 text-white">
              Process Payment
            </Button>
          </div>

          <Separator className="mb-6" />

          {/* Order Summary */}
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium">Item</th>
                <th className="text-center py-3 font-medium">Qty</th>
                <th className="text-right py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3">
                    <div className="font-medium">{item.productName}</div>
                    {(item.brand || item.model || item.variant) && (
                      <div className="text-xs text-muted-foreground">{[item.brand, item.model, item.variant].filter(Boolean).join(' - ')}</div>
                    )}
                  </td>
                  <td className="text-center py-3">{item.quantity}</td>
                  <td className="text-right py-3">{(item.sellingPrice * item.quantity - item.discount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm"><span>Sub total</span><span className="font-medium">KES {subtotal.toFixed(2)}</span></div>
            {cartDiscount > 0 && <div className="flex justify-between text-sm text-orange-600"><span>Discount</span><span>- KES {cartDiscount.toFixed(2)}</span></div>}
            <Separator />
            <div className="flex justify-between text-lg font-bold"><span>Grand Total</span><span>KES {Math.max(0, total).toFixed(2)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Search Dialog */}
      <Dialog open={showCustomerSearch} onOpenChange={setShowCustomerSearch}>
        <DialogContent className="max-w-md">
          <DialogTitle>Select Customer</DialogTitle>
          <DialogDescription className="sr-only">Search and select a customer</DialogDescription>
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-8"
                placeholder="Search by name or phone..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {customerSearchLoading && <p className="text-sm text-gray-400 text-center py-4">Searching...</p>}
              {!customerSearchLoading && customers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No customers found</p>
              )}
              {customers.map(c => (
                <button
                  key={c._id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); setCustomerSearch('') }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.phone}
                    {c.creditBalance > 0 && <span className="text-red-500 ml-2">Owes KES {c.creditBalance.toLocaleString()}</span>}
                  </p>
                </button>
              ))}
            </div>

            {!showAddCustomer ? (
              <button onClick={() => setShowAddCustomer(true)} className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700">
                <UserPlus size={14} /> Add new customer
              </button>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">New Customer</p>
                <Input placeholder="Name *" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
                <Input placeholder="Phone" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={addNewCustomer} className="bg-green-600 hover:bg-green-700 text-white">Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Balance - KES {Math.max(0, total).toFixed(2)}</DialogTitle>
            <DialogDescription className="sr-only">Select a payment method to complete the sale.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Payment Method</Label>
              <Select value={selectedPayment} onValueChange={handlePaymentMethodChange}>
                <SelectTrigger><SelectValue placeholder="--Select Payment--" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">M-Pesa</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit (Pay Later)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credit warning */}
            {selectedPayment === 'credit' && !selectedCustomer && (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Please select a customer first to use credit payment.
              </div>
            )}
            {selectedPayment === 'credit' && selectedCustomer && (
              <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <p className="font-medium text-blue-800">{selectedCustomer.name}</p>
                {selectedCustomer.creditBalance > 0 && (
                  <p className="text-blue-600">Current balance: KES {selectedCustomer.creditBalance.toLocaleString()}</p>
                )}
              </div>
            )}

            {/* M-Pesa Fields */}
            {showMpesaFields && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">M-Pesa Phone Number</Label>
                  <Input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} placeholder="e.g., 0712345678" disabled={stkPushInitiated} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant={mpesaMethod === 'stk' ? 'default' : 'outline'} className="flex-1" onClick={() => setMpesaMethod('stk')} disabled={stkPushInitiated}>STK Push</Button>
                  <Button type="button" variant={mpesaMethod === 'manual' ? 'default' : 'outline'} className="flex-1" onClick={() => { setMpesaMethod('manual'); setStkPushInitiated(false) }}>Manual Entry</Button>
                </div>
                {mpesaMethod === 'stk' && !stkPushInitiated && (
                  <Button type="button" onClick={initiateSTKPush} disabled={!mpesaPhone || processing} className="w-full bg-green-600 hover:bg-green-700">Send STK Push</Button>
                )}
                {stkPushInitiated && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    STK Push sent to {mpesaPhone}. Enter your PIN.
                    <button className="block text-xs text-green-600 mt-1 underline" onClick={() => { setMpesaMethod('manual'); setStkPushInitiated(false) }}>Enter code manually</button>
                  </div>
                )}
                {mpesaMethod === 'manual' && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">M-Pesa Transaction Code</Label>
                    <Input type="text" value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g., QGH7XYZ123" className="uppercase" />
                  </div>
                )}
              </>
            )}

            <div>
              <Label className="text-sm font-medium mb-2 block">
                {selectedPayment === 'cash' ? 'Cash Received' : selectedPayment === 'credit' ? 'Amount Paid Now (0 if full credit)' : 'Amount'}
              </Label>
              <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter amount" step="0.01" />
              {selectedPayment === 'cash' && parseFloat(paymentAmount) > 0 && (
                <div className={`mt-2 flex justify-between px-3 py-2 rounded-lg text-sm font-semibold ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>Change</span>
                  <span>KES {Math.max(0, change).toFixed(2)}</span>
                </div>
              )}
              {selectedPayment === 'credit' && selectedCustomer && parseFloat(paymentAmount) < total && (
                <p className="text-xs text-amber-600 mt-1">
                  KES {(total - parseFloat(paymentAmount || '0')).toFixed(2)} will be added to {selectedCustomer.name}'s credit balance
                </p>
              )}
            </div>

            <Button onClick={processPayment} disabled={!selectedPayment || processing || (selectedPayment === 'credit' && !selectedCustomer)} className="w-full bg-green-600 hover:bg-green-700 text-white">
              {processing ? 'Processing...' : 'Process Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Completion Dialog */}
      {lastSale && (
        <OrderCompletionDialog
          open={showCompletionDialog}
          onOpenChange={(open) => {
            setShowCompletionDialog(open)
            if (!open) { sessionStorage.removeItem('pendingSale'); router.push('/dashboard/sales') }
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
          onMakeNewSale={() => { sessionStorage.removeItem('pendingSale'); router.push('/dashboard/sales') }}
        />
      )}

      {/* Hidden Receipt */}
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
