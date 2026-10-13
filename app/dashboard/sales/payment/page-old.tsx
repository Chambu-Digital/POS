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
import { Search, UserPlus, X, Plus, Trash2 } from 'lucide-react'
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

interface Payment {
  id: string
  method: string
  amount: string
  bankProviderId?: string
  bankProviderName?: string
  mpesaCode?: string
  mpesaPhone?: string
}

interface BankProvider {
  _id: string
  name: string
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
  const [saleEndpoint, setSaleEndpoint] = useState('/api/sales')
  const [returnUrl, setReturnUrl] = useState('/dashboard/sales')
  
  // Multiple payments state
  const [payments, setPayments] = useState<Payment[]>([])
  const [nextPaymentId, setNextPaymentId] = useState(1)
  
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

  // Bank providers state
  const [bankProviders, setBankProviders] = useState<BankProvider[]>([])
  const [showAddBank, setShowAddBank] = useState(false)
  const [newBankName, setNewBankName] = useState('')

  useEffect(() => {
    const cartData = sessionStorage.getItem('pendingSale')
    if (cartData) {
      try {
        const data = JSON.parse(cartData)
        setCart(data.cart || [])
        setCartDiscount(data.cartDiscount || 0)
        if (data.saleEndpoint) setSaleEndpoint(data.saleEndpoint)
        if (data.returnUrl) setReturnUrl(data.returnUrl)
        
        // Initialize with one empty payment row
        const subtotal = (data.cart || []).reduce(
          (sum: number, item: CartItem) => sum + item.sellingPrice * item.quantity - item.discount, 0
        )
        const total = subtotal - (data.cartDiscount || 0)
        setPayments([{
          id: '1',
          method: '',
          amount: Math.max(0, total).toFixed(2),
        }])
        setNextPaymentId(2)
        setLoading(false)
      } catch {
        router.push('/dashboard/sales')
      }
    } else {
      router.push('/dashboard/sales')
    }
    fetchUserInfo()
    fetchBankProviders()
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

  async function fetchBankProviders() {
    try {
      const res = await fetch('/api/bank-providers')
      if (res.ok) {
        const data = await res.json()
        setBankProviders(data.providers || [])
      }
    } catch (error) {
      console.error('Failed to fetch bank providers:', error)
    }
  }

  async function addBankProvider() {
    if (!newBankName.trim()) {
      toast.error('Please enter bank name')
      return
    }
    
    try {
      const res = await fetch('/api/bank-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBankName.trim() }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setBankProviders([...bankProviders, data.provider])
        setNewBankName('')
        setShowAddBank(false)
        toast.success('Bank provider added')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to add bank provider')
      }
    } catch {
      toast.error('Failed to add bank provider')
    }
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

  function addPaymentRow() {
    setPayments([...payments, {
      id: String(nextPaymentId),
      method: '',
      amount: '0',
    }])
    setNextPaymentId(nextPaymentId + 1)
  }

  function removePaymentRow(id: string) {
    if (payments.length === 1) {
      toast.error('At least one payment method is required')
      return
    }
    setPayments(payments.filter(p => p.id !== id))
  }

  function updatePayment(id: string, field: keyof Payment, value: any) {
    setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity - item.discount, 0)
  const total = subtotal - cartDiscount
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const remaining = total - totalPaid
  const hasCashPayment = payments.some(p => p.method === 'cash')
  const overpaid = totalPaid > total && !hasCashPayment  // Only warn for non-cash overpayment

  async function processPayment() {
    // Validation
    const validPayments = payments.filter(p => p.method && parseFloat(p.amount) > 0)
    if (validPayments.length === 0) {
      toast.error('Please add at least one payment method with an amount')
      return
    }

    const totalPaid = validPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    
    // Allow overpayment for cash (change), but prevent for other methods
    const hasCashPayment = validPayments.some(p => p.method === 'cash')
    if (totalPaid > total && !hasCashPayment) {
      toast.error(`Total paid (${totalPaid.toFixed(2)}) exceeds sale total (${total.toFixed(2)}). Overpayment only allowed for cash.`)
      return
    }

    const debt = total - totalPaid
    if (debt > 0 && !selectedCustomer) {
      toast.error('Please select a customer for partial or unpaid sales')
      return
    }

    // Validate bank payments have provider selected
    for (const payment of validPayments) {
      if (payment.method === 'bank' && !payment.bankProviderId) {
        toast.error('Please select a bank provider for bank payments')
        return
      }
    }

    setProcessing(true)
    setShowPaymentDialog(false)

    try {
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
        customerName: selectedCustomer?.name || '',
        customerId: selectedCustomer?._id || null,
        payments: validPayments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount),
          bankProviderId: p.bankProviderId || null,
          bankProviderName: p.bankProviderName || '',
          mpesaCode: p.mpesaCode || '',
          mpesaPhone: p.mpesaPhone || '',
          timestamp: new Date(),
        })),
      }

      if (isOnline()) {
        const response = await fetch(saleEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to complete sale')
        }

        const result = await response.json()
        const orderNumber = result.sale?.orderNumber || `ORD-${String(result.sale?._id ?? '').slice(-5).toUpperCase()}`

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
          amountPaid: totalPaid,
          paymentMethod: validPayments[0].method,
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
          paymentMethod: validPayments[0].method,
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
          paymentMethod: validPayments[0].method,
          customerName: selectedCustomer?.name || 'Cash Sale',
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
      setProcessing(false)
    }
  }

  function cancelOrder() { sessionStorage.removeItem('pendingSale'); router.push(returnUrl) }

  function holdOrder() {
    if (cart.length === 0) return
    const heldKey = returnUrl.includes('bar') ? 'barHeldOrders' : 'heldOrders'
    const held = JSON.parse(localStorage.getItem(heldKey) || '[]')
    held.push({ id: `hold-${Date.now()}`, cart, cartDiscount, heldAt: new Date().toISOString() })
    localStorage.setItem(heldKey, JSON.stringify(held))
    sessionStorage.removeItem('pendingSale')
    router.push(returnUrl)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">Loading...</div></div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold text-center mb-6">
            Select Payment Method
          </h1>

          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-medium">Pay</span>
            <span className="text-2xl font-bold">KES {Math.max(0, total).toFixed(2)}</span>
          </div>

          {/* Customer Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer:
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-green-50 border-2 border-green-300 rounded-lg px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-green-800">{selectedCustomer.name}</p>
                  <p className="text-xs text-green-600">
                    {selectedCustomer.phone}
                    {selectedCustomer.creditBalance > 0 && ` · Owes KES ${selectedCustomer.creditBalance.toLocaleString()}`}
                  </p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-green-600 hover:text-red-500">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerSearch(true)}
                className="w-full flex items-center justify-center gap-2 bg-blue-50 border-2 border-blue-200 hover:border-blue-400 rounded-lg px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-all shadow-sm"
              >
                <Search size={16} /> Select Customer (optional)
              </button>
            )}
            {!selectedCustomer && (
              <p className="text-xs text-gray-500 mt-1 text-center">Required for partial payments</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            <Button 
              variant="outline" 
              onClick={cancelOrder} 
              disabled={processing}
              className="rounded-full"
            >
              Cancel Order
            </Button>
            <Button 
              variant="secondary" 
              disabled={processing} 
              onClick={holdOrder}
              className="rounded-full"
            >
              Hold Order
            </Button>
            <Button 
              onClick={() => setShowPaymentDialog(true)} 
              disabled={processing} 
              className="bg-green-600 hover:bg-green-700 text-white rounded-full col-span-2 sm:col-span-1"
            >
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

      {/* Multiple Payments Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Sale - KES {Math.max(0, total).toFixed(2)}</DialogTitle>
            <DialogDescription>Add one or more payment methods</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer Display */}
            {selectedCustomer && (
              <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <p className="font-medium text-blue-800">{selectedCustomer.name}</p>
                {selectedCustomer.creditBalance > 0 && (
                  <p className="text-blue-600">Current balance: KES {selectedCustomer.creditBalance.toLocaleString()}</p>
                )}
              </div>
            )}

            {/* Payment Rows */}
            <div className="space-y-3">
              {payments.map((payment, index) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  index={index}
                  onUpdate={updatePayment}
                  onRemove={removePaymentRow}
                  canRemove={payments.length > 1}
                  bankProviders={bankProviders}
                  showAddBank={showAddBank}
                  setShowAddBank={setShowAddBank}
                  newBankName={newBankName}
                  setNewBankName={setNewBankName}
                  addBankProvider={addBankProvider}
                />
              ))}
            </div>

            {/* Add Payment Button */}
            <Button
              type="button"
              variant="outline"
              onClick={addPaymentRow}
              className="w-full"
            >
              <Plus size={16} className="mr-2" />
              Add Another Payment Method
            </Button>

            {/* Payment Summary */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total:</span>
                <span className="font-semibold">KES {total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Paid:</span>
                <span className={`font-semibold ${overpaid ? 'text-red-600' : 'text-green-600'}`}>
                  KES {totalPaid.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>{remaining > 0 ? 'Remaining:' : remaining < 0 && hasCashPayment ? 'Change:' : remaining < 0 ? 'Overpayment:' : 'Balance:'}</span>
                <span className={remaining > 0 ? 'text-red-600' : remaining < 0 && hasCashPayment ? 'text-blue-600' : remaining < 0 ? 'text-red-600' : 'text-green-600'}>
                  KES {Math.abs(remaining).toFixed(2)}
                </span>
              </div>
              {remaining > 0 && !selectedCustomer && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  ⚠️ Customer required for partial payments
                </p>
              )}
              {remaining > 0 && selectedCustomer && (
                <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                  KES {remaining.toFixed(2)} will be added to {selectedCustomer.name}'s account
                </p>
              )}
              {overpaid && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  ⚠️ Overpayment not allowed for non-cash payments
                </p>
              )}
            </div>

            {/* Process Button */}
            <Button 
              onClick={processPayment} 
              disabled={processing || overpaid} 
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12"
            >
              {processing ? 'Processing...' : 'Complete Sale'}
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
            if (!open) { sessionStorage.removeItem('pendingSale'); router.push(returnUrl) }
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
          onMakeNewSale={() => { sessionStorage.removeItem('pendingSale'); router.push(returnUrl) }}
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

// Payment Row Component
function PaymentRow({
  payment,
  index,
  onUpdate,
  onRemove,
  canRemove,
  bankProviders,
  showAddBank,
  setShowAddBank,
  newBankName,
  setNewBankName,
  addBankProvider,
}: {
  payment: Payment
  index: number
  onUpdate: (id: string, field: keyof Payment, value: any) => void
  onRemove: (id: string) => void
  canRemove: boolean
  bankProviders: BankProvider[]
  showAddBank: boolean
  setShowAddBank: (show: boolean) => void
  newBankName: string
  setNewBankName: (name: string) => void
  addBankProvider: () => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Payment {index + 1}</span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(payment.id)}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Payment Method *</Label>
          <Select 
            value={payment.method} 
            onValueChange={(value) => onUpdate(payment.id, 'method', value)}
          >
            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="mobile_money">M-Pesa</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Amount *</Label>
          <Input
            type="number"
            step="0.01"
            value={payment.amount}
            onChange={(e) => onUpdate(payment.id, 'amount', e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Bank Provider Selection */}
      {payment.method === 'bank' && (
        <div className="space-y-2">
          <Label className="text-xs block">Bank Provider *</Label>
          <div className="flex gap-2">
            <Select
              value={payment.bankProviderId || ''}
              onValueChange={(value) => {
                const provider = bankProviders.find(b => b._id === value)
                onUpdate(payment.id, 'bankProviderId', value)
                onUpdate(payment.id, 'bankProviderName', provider?.name || '')
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                {bankProviders.map(bank => (
                  <SelectItem key={bank._id} value={bank._id}>{bank.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddBank(!showAddBank)}
              className="px-3"
            >
              <Plus size={16} />
            </Button>
          </div>
          
          {showAddBank && (
            <div className="flex gap-2">
              <Input
                placeholder="Bank name"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBankProvider()}
              />
              <Button size="sm" onClick={addBankProvider}>Add</Button>
            </div>
          )}
        </div>
      )}

      {/* M-Pesa Fields */}
      {payment.method === 'mobile_money' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">M-Pesa Phone (optional)</Label>
            <Input
              type="tel"
              value={payment.mpesaPhone || ''}
              onChange={(e) => onUpdate(payment.id, 'mpesaPhone', e.target.value)}
              placeholder="0712345678"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">M-Pesa Code (optional)</Label>
            <Input
              type="text"
              value={payment.mpesaCode || ''}
              onChange={(e) => onUpdate(payment.id, 'mpesaCode', e.target.value.toUpperCase())}
              placeholder="QGH7XYZ123"
              className="uppercase"
            />
          </div>
        </div>
      )}
    </div>
  )
}
