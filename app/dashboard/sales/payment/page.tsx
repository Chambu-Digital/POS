'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search, UserPlus, X, Plus, Trash2, CreditCard, Smartphone, Banknote, Building2, Wallet } from 'lucide-react'
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
  lotBreakdown?: Array<{ batchId: string; lotLabel: string; quantity: number }>
}

interface Customer {
  _id: string
  name: string
  phone: string
  creditBalance: number
}

interface PaymentEntry {
  id: string
  method: string // 'cash' | 'mpesa_stk' | 'mpesa_manual' | 'card' | 'bank' | 'credit' | 'custom'
  amount: string
  mpesaPhone?: string
  mpesaCode?: string
  bankProviderId?: string
  bankProviderName?: string
  customMethodId?: string
  customMethodName?: string
  status?: 'pending' | 'completed' | 'failed'
}

interface BankProvider {
  _id: string
  name: string
}

interface PaymentMethod {
  _id: string
  name: string
  type: string
}

export default function PaymentPageNew() {
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
  
  // Payment entries state
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([])
  const [nextPaymentId, setNextPaymentId] = useState(1)
  
  // Current payment being added
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState('')
  
  // M-Pesa specific
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [stkProcessing, setStkProcessing] = useState(false)
  
  // Bank specific
  const [selectedBankId, setSelectedBankId] = useState('')
  const [showBankSelect, setShowBankSelect] = useState(false)
  
  // Custom method specific
  const [selectedCustomMethodId, setSelectedCustomMethodId] = useState('')
  
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSale, setLastSale] = useState<any>(null)
  const [userInfo, setUserInfo] = useState<{ shopName: string; name: string } | null>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)
  const [activeBranch, setActiveBranch] = useState<{ name: string; phone?: string; address?: string } | null>(null)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  // Bank providers and custom methods
  const [bankProviders, setBankProviders] = useState<BankProvider[]>([])
  const [customMethods, setCustomMethods] = useState<PaymentMethod[]>([])
  
  // Add payment method dialog
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false)
  const [newMethodName, setNewMethodName] = useState('')
  const [newMethodType, setNewMethodType] = useState('other')

  useEffect(() => {
    const cartData = sessionStorage.getItem('pendingSale')
    if (cartData) {
      try {
        const data = JSON.parse(cartData)
        setCart(data.cart || [])
        setCartDiscount(data.cartDiscount || 0)
        if (data.saleEndpoint) setSaleEndpoint(data.saleEndpoint)
        if (data.returnUrl) setReturnUrl(data.returnUrl)
        setLoading(false)
      } catch {
        router.push('/dashboard/sales')
      }
    } else {
      router.push('/dashboard/sales')
    }
    fetchUserInfo()
    fetchBankProviders()
    fetchCustomMethods()
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
    // Fetch active branch for receipt contact info
    try {
      const branchId = document.cookie
        .split('; ')
        .find(row => row.startsWith('selected_branch='))
        ?.split('=')[1]
      if (branchId) {
        const res = await fetch(`/api/branches/${branchId}`)
        if (res.ok) {
          const data = await res.json()
          const phones = (data.branch.phones || []).filter((p: string) => p.trim())
          setActiveBranch({
            name: data.branch.name,
            phone: phones.length > 0 ? phones.join(' / ') : (data.branch.phone || ''),
            address: data.branch.address || '',
          })
        }
      }
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

  async function fetchCustomMethods() {
    try {
      const res = await fetch('/api/payment-methods')
      if (res.ok) {
        const data = await res.json()
        setCustomMethods(data.methods || [])
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error)
    }
  }

  async function addCustomPaymentMethod() {
    if (!newMethodName.trim()) {
      toast.error('Please enter payment method name')
      return
    }
    
    try {
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newMethodName.trim(),
          type: newMethodType 
        }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setCustomMethods([...customMethods, data.method])
        setNewMethodName('')
        setNewMethodType('other')
        setShowAddPaymentMethod(false)
        toast.success('Payment method added')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to add payment method')
      }
    } catch {
      toast.error('Failed to add payment method')
    }
  }

  async function deleteCustomPaymentMethod(methodId: string) {
    if (!confirm('Delete this payment method?')) return
    
    try {
      const res = await fetch(`/api/payment-methods?id=${methodId}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        setCustomMethods(customMethods.filter(m => m._id !== methodId))
        // Clear selection if deleted method was selected
        if (selectedCustomMethodId === methodId) {
          setSelectedCustomMethodId('')
          setSelectedMethod('')
        }
        toast.success('Payment method deleted')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to delete payment method')
      }
    } catch {
      toast.error('Failed to delete payment method')
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

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity - item.discount, 0)
  const total = subtotal - cartDiscount
  const totalPaid = paymentEntries.reduce((sum, p) => {
    const amt = parseFloat(p.amount) || 0
    return sum + (p.status !== 'failed' ? amt : 0)
  }, 0)
  const remaining = Math.max(0, total - totalPaid)
  
  // Change is the overpayment (when total paid exceeds total)
  const changeDue = Math.max(0, totalPaid - total)

  // Select payment method
  function selectPaymentMethod(method: string) {
    setSelectedMethod(method)
    setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : '')
    
    // Reset method-specific fields
    setMpesaPhone('')
    setMpesaCode('')
    setSelectedBankId('')
    setShowBankSelect(false)
    
    // Show additional inputs for specific methods
    if (method === 'bank') {
      setShowBankSelect(true)
    }
  }

  // Initiate STK Push for M-Pesa
  async function initiateSTKPush() {
    if (!mpesaPhone.trim()) {
      toast.error('Enter M-Pesa phone number')
      return
    }
    
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter payment amount')
      return
    }
    
    setStkProcessing(true)
    try {
      const res = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: amount,
          orderReference: `ORD-${Date.now()}`,
        }),
      })
      const data = await res.json()
      
      if (data.ResponseCode === '0') {
        toast.success('STK Push sent - Customer should enter PIN')
        // Add as pending payment
        addPaymentEntry('mpesa_stk', 'pending')
      } else {
        toast.error(data.ResponseDescription || 'STK Push failed')
      }
    } catch {
      toast.error('STK Push failed')
    } finally {
      setStkProcessing(false)
    }
  }

  // Add payment entry to list
  function addPaymentEntry(methodOverride?: string, statusOverride?: string) {
    const method = methodOverride || selectedMethod
    const amount = parseFloat(paymentAmount) || 0
    
    if (!method) {
      toast.error('Select a payment method')
      return
    }
    
    // Validation: Amount required for all methods EXCEPT credit (credit can be 0 = full credit)
    if (method !== 'credit' && (!paymentAmount || amount <= 0)) {
      toast.error('Enter payment amount')
      return
    }
    
    // Amount must be non-negative for credit
    if (method === 'credit' && amount < 0) {
      toast.error('Amount cannot be negative')
      return
    }
    
    // Credit requires customer selection
    if (method === 'credit' && !selectedCustomer) {
      toast.error('Select a customer for credit payment')
      return
    }
    
    // Bank requires provider selection
    if (method === 'bank' && !selectedBankId) {
      toast.error('Select a bank provider')
      return
    }
    
    // Custom method requires selection
    if (method === 'custom' && !selectedCustomMethodId) {
      toast.error('Select a payment method')
      return
    }
    
    const entry: PaymentEntry = {
      id: String(nextPaymentId),
      method,
      amount: amount.toFixed(2),
      status: (statusOverride as any) || 'completed',
    }
    
    // Add method-specific fields
    if (method === 'mpesa_stk' || method === 'mpesa_manual') {
      if (mpesaPhone) entry.mpesaPhone = mpesaPhone
      if (mpesaCode) entry.mpesaCode = mpesaCode
    }
    
    if (method === 'bank' && selectedBankId) {
      entry.bankProviderId = selectedBankId
      const provider = bankProviders.find(p => p._id === selectedBankId)
      if (provider) entry.bankProviderName = provider.name
    }
    
    if (method === 'custom' && selectedCustomMethodId) {
      entry.customMethodId = selectedCustomMethodId
      const customMethod = customMethods.find(m => m._id === selectedCustomMethodId)
      if (customMethod) entry.customMethodName = customMethod.name
    }
    
    setPaymentEntries([...paymentEntries, entry])
    setNextPaymentId(nextPaymentId + 1)
    
    // Reset form
    setSelectedMethod('')
    setPaymentAmount('')
    setMpesaPhone('')
    setMpesaCode('')
    setSelectedBankId('')
    setSelectedCustomMethodId('')
    setShowBankSelect(false)
    
    toast.success('Payment added')
  }

  // Remove payment entry
  function removePaymentEntry(id: string) {
    setPaymentEntries(paymentEntries.filter(p => p.id !== id))
  }

  // Update payment entry amount
  function updatePaymentAmount(id: string, newAmount: string) {
    setPaymentEntries(paymentEntries.map(p => 
      p.id === id ? { ...p, amount: newAmount } : p
    ))
  }

  // Get payment method display name
  function getPaymentMethodDisplay(entry: PaymentEntry): string {
    switch (entry.method) {
      case 'cash': return 'Cash'
      case 'mpesa_stk': return 'M-Pesa STK Push'
      case 'mpesa_manual': return 'M-Pesa Manual'
      case 'card': return 'Card'
      case 'credit': return 'Credit'
      case 'bank': return entry.bankProviderName || 'Bank'
      case 'custom': return entry.customMethodName || 'Custom'
      default: return entry.method
    }
  }

  async function completeSale() {
    // Validation
    if (paymentEntries.length === 0) {
      toast.error('Add at least one payment method')
      return
    }

    const completedPayments = paymentEntries.filter(p => p.status !== 'failed')
    if (completedPayments.length === 0) {
      toast.error('No valid payments recorded')
      return
    }

    const debt = remaining
    if (debt > 0 && !selectedCustomer) {
      toast.error('Select a customer for partial payments')
      return
    }

    setProcessing(true)

    try {
      const saleData: any = {
        items: cart.map(item => ({
          productId:    item.productId,
          productName:  item.productName,
          brand:        item.brand,
          model:        item.model,
          variant:      item.variant,
          quantity:     item.quantity,
          price:        item.sellingPrice,
          discount:     item.discount,
          // lot breakdown — API uses this to decrement individual batches
          ...(item.lotBreakdown && { lotBreakdown: item.lotBreakdown }),
        })),
        subtotal,
        discount: cartDiscount,
        total: Math.max(0, total),
        customerName: selectedCustomer?.name || '',
        customerId: selectedCustomer?._id || null,
        payments: completedPayments.map(p => ({
          method: p.method === 'mpesa_stk' || p.method === 'mpesa_manual' ? 'mobile_money' : 
                  p.method === 'custom' ? 'custom' : 
                  p.method === 'credit' ? 'credit' : p.method,
          amount: parseFloat(p.amount),
          mpesaType: p.method === 'mpesa_stk' ? 'stk_push' : p.method === 'mpesa_manual' ? 'manual' : undefined,
          mpesaPhone: p.mpesaPhone || '',
          mpesaCode: p.mpesaCode || '',
          bankProviderId: p.bankProviderId || null,
          bankProviderName: p.bankProviderName || '',
          customMethodId: p.customMethodId || null,
          customMethodName: p.customMethodName || '',
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
          paymentMethod: completedPayments.length === 1 ? completedPayments[0].method : 'multiple',
          customerName: selectedCustomer?.name || 'Cash Sale',
          customerPhone: selectedCustomer?.phone || '',
          date: new Date(),
          receiptNumber: orderNumber,
          creditBalance: selectedCustomer?.creditBalance,
          payments: completedPayments.map(p => ({
            method: p.method === 'mpesa_stk' || p.method === 'mpesa_manual' ? 'mobile_money' : 
                    p.method === 'custom' ? 'custom' : 
                    p.method === 'credit' ? 'credit' : p.method,
            amount: parseFloat(p.amount),
            mpesaType: p.method === 'mpesa_stk' ? 'stk_push' : p.method === 'mpesa_manual' ? 'manual' : undefined,
            mpesaPhone: p.mpesaPhone || '',
            mpesaCode: p.mpesaCode || '',
            customMethodName: p.customMethodName || '',
            timestamp: new Date(),
          })),
          cashPaid: totalPaid < total ? totalPaid : undefined,
          debtCreated: debt > 0 ? debt : undefined,
        })

        console.log('LastSale created:', {
          hasPayments: !!completedPayments.length,
          paymentsCount: completedPayments.length,
          totalPaid,
          total,
          debt,
          payments: completedPayments
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
          paymentMethod: saleData.payments[0].method,
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
          paymentMethod: 'offline',
          customerName: selectedCustomer?.name || 'Cash Sale',
          customerPhone: selectedCustomer?.phone || '',
          date: new Date(), receiptNumber: `OFFLINE-${Date.now()}`,
          payments: completedPayments.map(p => ({
            method: p.method === 'mpesa_stk' || p.method === 'mpesa_manual' ? 'mobile_money' : 
                    p.method === 'custom' ? 'custom' : 
                    p.method === 'credit' ? 'credit' : p.method,
            amount: parseFloat(p.amount),
            mpesaPhone: p.mpesaPhone || '',
            mpesaCode: p.mpesaCode || '',
            customMethodName: p.customMethodName || '',
            timestamp: new Date(),
          })),
          cashPaid: totalPaid < total ? totalPaid : undefined,
          debtCreated: debt > 0 ? debt : undefined,
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

  function cancelOrder() { 
    sessionStorage.removeItem('pendingSale')
    if (isOnline()) {
      router.push(returnUrl)
    } else {
      // Offline: just reset to allow new sale
      setCart([])
      setCartDiscount(0)
      setSelectedCustomer(null)
      setPaymentEntries([])
      toast.info('Order cancelled. Working offline.')
    }
  }

  function holdOrder() {
    if (cart.length === 0) return
    const heldKey = returnUrl.includes('bar') ? 'barHeldOrders' : 'heldOrders'
    const held = JSON.parse(localStorage.getItem(heldKey) || '[]')
    held.push({ id: `hold-${Date.now()}`, cart, cartDiscount, heldAt: new Date().toISOString() })
    localStorage.setItem(heldKey, JSON.stringify(held))
    sessionStorage.removeItem('pendingSale')
    if (isOnline()) {
      router.push(returnUrl)
    } else {
      // Offline: reset state
      setCart([])
      setCartDiscount(0)
      setSelectedCustomer(null)
      setPaymentEntries([])
      toast.success('Order held. Working offline.')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      <div className="max-w-5xl mx-auto">
        <Card className="shadow-lg">
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <h1 className="text-xl font-bold">Payment</h1>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-2xl font-bold text-green-600">KSh {Math.max(0, total).toLocaleString()}</p>
              </div>
            </div>

            <Separator className="my-3" />

            {/* Customer Selection */}
            <div className="mb-3">
              <Label className="text-xs font-medium mb-1 block">Customer (optional for partial payment)</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-green-800">{selectedCustomer.name}</p>
                    <p className="text-xs text-green-600">
                      {selectedCustomer.phone}
                      {selectedCustomer.creditBalance > 0 && ` · Owes KSh ${selectedCustomer.creditBalance.toLocaleString()}`}
                    </p>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-green-600 hover:text-red-500">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomerSearch(true)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 hover:border-blue-400 rounded px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Search size={14} /> Select Customer
                </button>
              )}
            </div>

            <Separator className="my-3" />

            {/* Payment Methods Grid */}
            <div className="mb-3">
              <h2 className="text-sm font-semibold mb-2">Payment Methods</h2>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {/* Cash */}
                <button
                  onClick={() => selectPaymentMethod('cash')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                    selectedMethod === 'cash' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <Banknote className={`w-6 h-6 mb-1 ${selectedMethod === 'cash' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className="text-xs font-medium">Cash</span>
                </button>

                {/* M-Pesa STK Push */}
                <button
                  onClick={() => selectPaymentMethod('mpesa_stk')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                    selectedMethod === 'mpesa_stk' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <Smartphone className={`w-6 h-6 mb-1 ${selectedMethod === 'mpesa_stk' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className="text-xs font-medium">M-Pesa STK</span>
                </button>

                {/* M-Pesa Manual */}
                <button
                  onClick={() => selectPaymentMethod('mpesa_manual')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                    selectedMethod === 'mpesa_manual' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <Smartphone className={`w-6 h-6 mb-1 ${selectedMethod === 'mpesa_manual' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className="text-xs font-medium">M-Pesa Code</span>
                </button>

                {/* Card */}
                <button
                  onClick={() => selectPaymentMethod('card')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                    selectedMethod === 'card' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className={`w-6 h-6 mb-1 ${selectedMethod === 'card' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className="text-xs font-medium">Card</span>
                </button>

                {/* Bank */}
                <button
                  onClick={() => selectPaymentMethod('bank')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                    selectedMethod === 'bank' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className={`w-6 h-6 mb-1 ${selectedMethod === 'bank' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className="text-xs font-medium">Bank</span>
                </button>

                {/* Credit */}
                <button
                  onClick={() => selectPaymentMethod('credit')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                    selectedMethod === 'credit' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <Wallet className={`w-6 h-6 mb-1 ${selectedMethod === 'credit' ? 'text-green-600' : 'text-gray-600'}`} />
                  <span className="text-xs font-medium">Credit</span>
                </button>

                {/* Custom Payment Methods */}
                {customMethods.map(method => (
                  <button
                    key={method._id}
                    onClick={() => {
                      selectPaymentMethod('custom')
                      setSelectedCustomMethodId(method._id)
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      selectedMethod === 'custom' && selectedCustomMethodId === method._id
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                    }`}
                  >
                    <Wallet className={`w-6 h-6 mb-1 ${selectedMethod === 'custom' && selectedCustomMethodId === method._id ? 'text-green-600' : 'text-gray-600'}`} />
                    <span className="text-xs font-medium text-center truncate w-full">{method.name}</span>
                  </button>
                ))}

                {/* Add Payment Method */}
                <button
                  onClick={() => setShowAddPaymentMethod(true)}
                  className="flex flex-col items-center justify-center p-2 rounded-lg border border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 transition-all"
                >
                  <Plus className="w-6 h-6 mb-1 text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">Add</span>
                </button>
              </div>
            </div>

            {/* Payment Input Section */}
            {selectedMethod && (
              <div className="mb-3 p-3 border border-green-200 rounded-lg bg-green-50">
                <h3 className="text-sm font-semibold mb-2">Enter Details</h3>
                
                <div className="space-y-2">
                  {/* Credit Payment Info */}
                  {selectedMethod === 'credit' && !selectedCustomer && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
                      ⚠️ Select a customer first to use credit payment
                    </div>
                  )}
                  
                  {selectedMethod === 'credit' && selectedCustomer && (
                    <div className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                      <p className="font-medium text-blue-800">{selectedCustomer.name}</p>
                      {selectedCustomer.creditBalance > 0 && (
                        <p className="text-blue-600">Current debt: KSh {selectedCustomer.creditBalance.toLocaleString()}</p>
                      )}
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <Label className="text-xs font-medium mb-1 block">
                      {selectedMethod === 'cash' ? 'Cash Received *' : 
                       selectedMethod === 'credit' ? 'Amount Paid Now (optional - leave blank for full credit)' : 
                       'Amount *'}
                    </Label>
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      placeholder={selectedMethod === 'credit' ? '0 for full credit' : 'Enter amount'}
                      step="0.01"
                      className="h-9 text-base font-semibold"
                      autoFocus
                    />
                    {selectedMethod === 'cash' && parseFloat(paymentAmount) > 0 && (
                      <div className={`mt-1 flex justify-between px-2 py-1 rounded text-xs font-semibold ${
                        (totalPaid + parseFloat(paymentAmount)) > total ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
                      }`}>
                        <span>Preview Change:</span>
                        <span>KSh {Math.max(0, (totalPaid + parseFloat(paymentAmount)) - total).toFixed(2)}</span>
                      </div>
                    )}
                    {selectedMethod === 'credit' && selectedCustomer && (
                      <p className="text-xs text-blue-600 mt-1">
                        {paymentAmount && parseFloat(paymentAmount) > 0
                          ? `KSh ${(remaining - parseFloat(paymentAmount)).toFixed(2)} will be added to credit balance`
                          : `Full amount (KSh ${remaining.toFixed(2)}) will be added to credit balance`}
                      </p>
                    )}
                  </div>

                  {/* M-Pesa Phone (for both STK and Manual) */}
                  {(selectedMethod === 'mpesa_stk' || selectedMethod === 'mpesa_manual') && (
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Phone (optional)</Label>
                      <Input
                        type="tel"
                        value={mpesaPhone}
                        onChange={e => setMpesaPhone(e.target.value)}
                        placeholder="0712345678"
                        className="h-9"
                      />
                    </div>
                  )}

                  {/* M-Pesa Manual Code */}
                  {selectedMethod === 'mpesa_manual' && (
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Transaction Code (optional)</Label>
                      <Input
                        type="text"
                        value={mpesaCode}
                        onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                        placeholder="QGH7XYZ"
                        className="uppercase h-9"
                      />
                    </div>
                  )}

                  {/* Bank Provider Selection */}
                  {showBankSelect && (
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Bank *</Label>
                      <select
                        value={selectedBankId}
                        onChange={e => setSelectedBankId(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                      >
                        <option value="">Select Bank</option>
                        {bankProviders.map(bank => (
                          <option key={bank._id} value={bank._id}>{bank.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {selectedMethod === 'mpesa_stk' ? (
                      <Button
                        onClick={initiateSTKPush}
                        disabled={stkProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700 h-9 text-sm"
                      >
                        {stkProcessing ? 'Sending...' : 'Send STK'}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => addPaymentEntry()}
                        disabled={selectedMethod === 'credit' && !selectedCustomer}
                        className="flex-1 bg-green-600 hover:bg-green-700 h-9 text-sm"
                      >
                        Add Payment
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setSelectedMethod('')
                        setPaymentAmount('')
                        setMpesaPhone('')
                        setMpesaCode('')
                        setSelectedBankId('')
                        setShowBankSelect(false)
                        setSelectedCustomMethodId('')
                      }}
                      variant="outline"
                      className="h-9 text-sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Breakdown */}
            {paymentEntries.length > 0 && (
              <div className="mb-3">
                <h2 className="text-sm font-semibold mb-2">Payment Breakdown</h2>
                <div className="space-y-1.5">
                  {paymentEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getPaymentMethodDisplay(entry)}</p>
                        {entry.mpesaCode && (
                          <p className="text-xs text-gray-500">Code: {entry.mpesaCode}</p>
                        )}
                      </div>
                      <Input
                        type="number"
                        value={entry.amount}
                        onChange={e => updatePaymentAmount(entry.id, e.target.value)}
                        className="w-24 text-right font-semibold h-8 text-sm"
                        step="0.01"
                      />
                      <button
                        onClick={() => removePaymentEntry(entry.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-3" />

            {/* Payment Summary */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg mb-3">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-gray-600">Sale Total</p>
                  <p className="text-lg font-bold">KSh {total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Paid</p>
                  <p className="text-lg font-bold text-green-600">KSh {totalPaid.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Balance</p>
                  <p className={`text-lg font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    KSh {remaining.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Change</p>
                  <p className="text-lg font-bold text-blue-600">KSh {changeDue.toFixed(2)}</p>
                </div>
              </div>

              {remaining > 0 && !selectedCustomer && (
                <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800">
                  ⚠️ Select a customer for partial payments
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={cancelOrder} 
                disabled={processing}
                className="flex-1 h-10 text-sm"
              >
                Cancel
              </Button>
              <Button 
                variant="secondary" 
                disabled={processing} 
                onClick={holdOrder}
                className="flex-1 h-10 text-sm"
              >
                Hold
              </Button>
              <Button 
                onClick={completeSale} 
                disabled={processing || paymentEntries.length === 0 || (remaining > 0 && !selectedCustomer)} 
                className="flex-[2] bg-green-600 hover:bg-green-700 text-white h-10 text-sm font-semibold"
              >
                {processing ? 'Processing...' : 'Complete Sale'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Search Dialog */}
      <Dialog open={showCustomerSearch} onOpenChange={setShowCustomerSearch}>
        <DialogContent className="max-w-md">
          <DialogTitle>Select Customer</DialogTitle>
          <DialogDescription className="sr-only">Search for a customer</DialogDescription>
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
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200"
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.phone}
                    {c.creditBalance > 0 && <span className="text-red-500 ml-2">Owes KSh {c.creditBalance.toLocaleString()}</span>}
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
                  <Button size="sm" onClick={addNewCustomer} className="bg-green-600 hover:bg-green-700">Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddPaymentMethod} onOpenChange={setShowAddPaymentMethod}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>Create a custom payment method for your business</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Method Name *</Label>
              <Input
                placeholder="e.g., Airtel Money, Voucher"
                value={newMethodName}
                onChange={e => setNewMethodName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Category</Label>
              <select
                value={newMethodType}
                onChange={e => setNewMethodType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="other">Other</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="bank">Bank</option>
                <option value="voucher">Voucher</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={addCustomPaymentMethod} className="flex-1 bg-green-600 hover:bg-green-700">
                Add Method
              </Button>
              <Button variant="outline" onClick={() => { setShowAddPaymentMethod(false); setNewMethodName(''); setNewMethodType('other') }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Completion Dialog */}
      {lastSale && (
        <OrderCompletionDialog
          open={showCompletionDialog}
          onOpenChange={(open) => {
            setShowCompletionDialog(open)
            if (!open) { 
              sessionStorage.removeItem('pendingSale')
              sessionStorage.removeItem('activeCart')
              sessionStorage.removeItem('activeCartDiscount')
              // Only navigate if online
              if (isOnline()) {
                router.push(returnUrl)
              } else {
                // Reset state to allow new sale without navigation
                setCart([])
                setCartDiscount(0)
                setSelectedCustomer(null)
                setPaymentEntries([])
                setLastSale(null)
              }
            }
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
          customerPhone={lastSale.customerPhone}
          onMakeNewSale={() => { 
            sessionStorage.removeItem('pendingSale')
            sessionStorage.removeItem('activeCart')
            sessionStorage.removeItem('activeCartDiscount')
            // Only navigate if online
            if (isOnline()) {
              router.push(returnUrl)
            } else {
              // Reset state to allow new sale without navigation
              setShowCompletionDialog(false)
              setCart([])
              setCartDiscount(0)
              setSelectedCustomer(null)
              setPaymentEntries([])
              setLastSale(null)
            }
          }}
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
          branchName={activeBranch?.name}
          shopPhone={activeBranch?.phone || shopSettings?.general?.phone}
          shopEmail={shopSettings?.general?.email}
          shopAddress={activeBranch?.address || shopSettings?.general?.address}
          mpesaPaybill={shopSettings?.payment?.mpesaPaybill}
          mpesaAccountNumber={shopSettings?.payment?.mpesaAccountNumber}
          paperSize={shopSettings?.receipt?.paperSize || '58mm'}
          termsEnabled={shopSettings?.features?.termsEnabled}
          termsText={shopSettings?.features?.termsText}
          payments={lastSale.payments}
          cashPaid={lastSale.cashPaid}
          debtCreated={lastSale.debtCreated}
        />
      )}
    </div>
  )
}
