'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
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

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  cartDiscount: number
  subtotal: number
  total: number
  onPaymentComplete: (saleData: any) => void
  userInfo: { shopName: string; name: string } | null
  saleEndpoint?: string
}

export function PaymentModal({
  open,
  onOpenChange,
  cart,
  cartDiscount,
  subtotal,
  total,
  onPaymentComplete,
  userInfo,
  saleEndpoint = '/api/sales',
}: PaymentModalProps) {
  const [selectedPayment, setSelectedPayment] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>(total.toFixed(2))
  const [mpesaCode, setMpesaCode] = useState<string>('')
  const [mpesaPhone, setMpesaPhone] = useState<string>('')
  
  // M-Pesa state machine
  type MpesaFlowState = 
    | 'idle'              // No M-Pesa selected
    | 'method-selection'  // Choose STK or Manual
    | 'stk-input'         // Enter phone for STK
    | 'stk-waiting'       // STK push sent, waiting
    | 'manual-input'      // Manual entry form
  const [mpesaFlowState, setMpesaFlowState] = useState<MpesaFlowState>('idle')
  const [processing, setProcessing] = useState(false)
  
  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [idRequiredError, setIdRequiredError] = useState<{ customerId: string; customerName: string } | null>(null)

  const paymentMethodRef = useRef<HTMLButtonElement>(null)
  const processButtonRef = useRef<HTMLButtonElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const mpesaPhoneInputRef = useRef<HTMLInputElement>(null)
  const mpesaCodeInputRef = useRef<HTMLInputElement>(null)

  // Reset payment amount when total changes
  useEffect(() => {
    setPaymentAmount(total.toFixed(2))
  }, [total])

  // Auto-focus payment method when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => paymentMethodRef.current?.focus(), 100)
    }
  }, [open])

  // Search customers when search term changes
  useEffect(() => {
    if (showCustomerSearch) searchCustomers(customerSearch)
  }, [customerSearch, showCustomerSearch])

  // Handle Enter key in payment amount field
  function handlePaymentAmountKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedPayment === 'mobile_money' && mpesaFlowState === 'manual-input') {
        // In M-Pesa manual: Amount → Phone
        mpesaPhoneInputRef.current?.focus()
      } else {
        // Other payments: submit
        processPayment()
      }
    }
  }

  // Handle Enter key in M-Pesa phone field
  function handleMpesaPhoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      mpesaCodeInputRef.current?.focus()
    }
  }

  // Handle Enter key in M-Pesa code field
  function handleMpesaCodeKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      processPayment()
    }
  }

  async function searchCustomers(q: string) {
    setCustomerSearchLoading(true)
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch {
      // Ignore errors
    }
    setCustomerSearchLoading(false)
  }

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
    } catch {
      toast.error('Failed to add customer')
    }
  }

  function handlePaymentMethodChange(value: string) {
    setSelectedPayment(value)
    
    // State machine transitions
    if (value === 'mobile_money') {
      setMpesaFlowState('method-selection')
    } else {
      // Reset M-Pesa state when switching away
      setMpesaFlowState('idle')
      setMpesaCode('')
      setMpesaPhone('')
    }
  }

  async function initiateSTKPush() {
    if (!mpesaPhone.trim()) {
      toast.error('Please enter M-Pesa phone number')
      return
    }
    setProcessing(true)
    try {
      const res = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: parseFloat(paymentAmount),
          orderReference: `ORDER-${Date.now()}`,
        }),
      })
      const data = await res.json()
      if (data.ResponseCode === '0') {
        toast.success('STK Push sent! Enter your M-Pesa PIN')
        setMpesaFlowState('stk-waiting')
      } else {
        toast.error(data.ResponseDescription || 'Failed to initiate STK Push')
        setMpesaFlowState('manual-input')
      }
    } catch {
      toast.error('Failed to initiate STK Push')
      setMpesaFlowState('manual-input')
    } finally {
      setProcessing(false)
    }
  }

  async function processPayment() {
    if (!selectedPayment) {
      toast.error('Please select a payment method')
      return
    }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }
    if (selectedPayment === 'credit' && !selectedCustomer) {
      toast.error('Please select a customer for credit payment')
      return
    }

    setProcessing(true)

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
        amountPaid: parseFloat(paymentAmount),
        paymentMethod: selectedPayment,
        customerName: selectedCustomer?.name || '',
        customerId: selectedCustomer?._id || null,
      }

      // Only include M-Pesa details if they're provided (optional)
      if (selectedPayment === 'mobile_money') {
        if (mpesaCode.trim()) saleData.mpesaCode = mpesaCode.trim()
        if (mpesaPhone.trim()) saleData.mpesaPhone = mpesaPhone.trim()
      }

      if (isOnline()) {
        const response = await fetch(saleEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        })

        if (!response.ok) {
          const err = await response.json()
          // Handle ID requirement error for credit sales
          if (err.requiresId) {
            setIdRequiredError({
              customerId: err.customerId,
              customerName: err.customerName,
            })
            throw new Error('ID required for credit')
          }
          throw new Error(err.error || 'Failed to complete sale')
        }

        const result = await response.json()

        const orderNumber =
          result.sale?.orderNumber ||
          result.tab?.tabNumber ||
          `ORD-${String(result.sale?._id ?? '').slice(-5).toUpperCase()}`

        const completedSale = {
          _id: result.sale._id,
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
        }

        toast.success('Payment completed successfully')
        onPaymentComplete(completedSale)

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
        const completedSale = {
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
          receiptNumber: `OFFLINE-${Date.now()}`,
        }
        toast.success('Sale saved offline - will sync when online')
        onPaymentComplete(completedSale)
      }

      if (isBackupEnabled() && userInfo) {
        try {
          await createBackupSnapshot(userInfo.shopName, userInfo.shopName, [])
        } catch {
          // Ignore backup errors
        }
      }

      // Reset form
      setSelectedPayment('')
      setSelectedCustomer(null)
      setMpesaCode('')
      setMpesaPhone('')
      setMpesaFlowState('idle')
    } catch (error: any) {
      toast.error(error.message || 'Error processing payment')
    } finally {
      setProcessing(false)
    }
  }

  const change = parseFloat(paymentAmount) - Math.max(0, total)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Sale - KSh {Math.max(0, total).toLocaleString()}</DialogTitle>
            <DialogDescription className="sr-only">
              Select payment method and complete the sale
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Customer (Optional)</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-green-50 border-2 border-green-300 rounded-lg px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-green-800">{selectedCustomer.name}</p>
                    <p className="text-xs text-green-600">
                      {selectedCustomer.phone}
                      {selectedCustomer.creditBalance > 0 &&
                        ` · Owes KSh ${selectedCustomer.creditBalance.toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-green-600 hover:text-red-500"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomerSearch(true)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 border-2 border-blue-200 hover:border-blue-400 rounded-lg px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-all shadow-sm"
                >
                  <Search size={16} /> Select Customer
                </button>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Payment Method *</Label>
              <Select value={selectedPayment} onValueChange={handlePaymentMethodChange}>
                <SelectTrigger ref={paymentMethodRef}>
                  <SelectValue placeholder="--Select Payment--" />
                </SelectTrigger>
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
                  <p className="text-blue-600">
                    Current balance: KSh {selectedCustomer.creditBalance.toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* M-Pesa Flow - State Machine Based */}
            {mpesaFlowState === 'method-selection' && (
              <div className="py-6">
                <p className="text-center text-sm text-muted-foreground mb-4">Choose your M-Pesa payment method</p>
                <div className="flex flex-col gap-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    className="h-14 text-base" 
                    onClick={() => setMpesaFlowState('stk-input')}
                  >
                    Send STK Push
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    className="h-14 text-base" 
                    onClick={() => setMpesaFlowState('manual-input')}
                  >
                    Manual Entry
                  </Button>
                </div>
              </div>
            )}

            {mpesaFlowState === 'stk-input' && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">M-Pesa Phone Number *</Label>
                  <Input
                    type="tel"
                    value={mpesaPhone}
                    onChange={e => setMpesaPhone(e.target.value)}
                    placeholder="e.g., 0712345678"
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  onClick={initiateSTKPush}
                  disabled={!mpesaPhone || processing}
                  className="w-full bg-green-600 hover:bg-green-700 h-11"
                >
                  {processing ? 'Sending...' : 'Send STK Push'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMpesaFlowState('method-selection')}
                  className="w-full"
                >
                  Back
                </Button>
              </>
            )}

            {mpesaFlowState === 'stk-waiting' && (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">STK Push sent to {mpesaPhone}</p>
                  <p className="text-xs text-green-600 mt-1">Customer should enter M-Pesa PIN on their phone</p>
                  <button
                    className="block text-xs text-green-700 mt-2 underline font-medium"
                    onClick={() => setMpesaFlowState('manual-input')}
                  >
                    Enter code manually instead
                  </button>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Amount</Label>
                  <Input
                    ref={amountInputRef}
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        processPayment()
                      }
                    }}
                    placeholder="Enter amount"
                    step="0.01"
                    onFocus={e => e.target.select()}
                  />
                </div>

                <Button
                  onClick={processPayment}
                  disabled={processing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white h-12"
                >
                  {processing ? 'Processing...' : 'Complete Sale'}
                </Button>
              </>
            )}

            {mpesaFlowState === 'manual-input' && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Amount</Label>
                  <Input
                    ref={amountInputRef}
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    onKeyDown={handlePaymentAmountKeyDown}
                    placeholder="Enter amount"
                    step="0.01"
                    onFocus={e => e.target.select()}
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Phone</Label>
                  <Input
                    ref={mpesaPhoneInputRef}
                    type="tel"
                    value={mpesaPhone}
                    onChange={e => setMpesaPhone(e.target.value)}
                    onKeyDown={handleMpesaPhoneKeyDown}
                    placeholder="0712345678"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Transaction Code</Label>
                  <Input
                    ref={mpesaCodeInputRef}
                    type="text"
                    value={mpesaCode}
                    onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                    onKeyDown={handleMpesaCodeKeyDown}
                    placeholder="QGH7XYZ123"
                    className="uppercase"
                  />
                </div>

                <Button
                  onClick={processPayment}
                  disabled={processing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white h-12"
                >
                  {processing ? 'Processing...' : 'Complete Sale'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMpesaFlowState('method-selection')}
                  className="w-full"
                >
                  Back
                </Button>
              </>
            )}

            {/* Payment Amount - Show for non-M-Pesa flows only */}
            {mpesaFlowState === 'idle' && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {selectedPayment === 'cash'
                    ? 'Cash Received *'
                    : selectedPayment === 'credit'
                    ? 'Amount Paid Now (0 if full credit) *'
                    : 'Amount *'}
                </Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  onKeyDown={handlePaymentAmountKeyDown}
                  placeholder="Enter amount"
                  step="0.01"
                  onFocus={e => e.target.select()}
                />
                {selectedPayment === 'cash' && parseFloat(paymentAmount) > 0 && (
                  <div
                    className={`mt-2 flex justify-between px-3 py-2 rounded-lg text-sm font-semibold ${
                      change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    <span>Change</span>
                    <span>KSh {Math.max(0, change).toFixed(2)}</span>
                  </div>
                )}
                {selectedPayment === 'credit' &&
                  selectedCustomer &&
                  parseFloat(paymentAmount) < total && (
                  <p className="text-xs text-amber-600 mt-1">
                    KSh {(total - parseFloat(paymentAmount || '0')).toFixed(2)} will be added to{' '}
                    {selectedCustomer.name}'s credit balance
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Process Button - Show for non-M-Pesa flows only */}
            {mpesaFlowState === 'idle' && (
              <Button
                ref={processButtonRef}
                onClick={processPayment}
                disabled={
                  !selectedPayment || processing || (selectedPayment === 'credit' && !selectedCustomer)
                }
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
              >
                {processing ? 'Processing...' : `Process Payment - KSh ${Math.max(0, total).toLocaleString()}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              {customerSearchLoading && (
                <p className="text-sm text-gray-400 text-center py-4">Searching...</p>
              )}
              {!customerSearchLoading && customers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No customers found</p>
              )}
              {customers.map(c => (
                <button
                  key={c._id}
                  onClick={() => {
                    setSelectedCustomer(c)
                    setShowCustomerSearch(false)
                    setCustomerSearch('')
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.phone}
                    {c.creditBalance > 0 && (
                      <span className="text-red-500 ml-2">
                        Owes KSh {c.creditBalance.toLocaleString()}
                      </span>
                    )}
                  </p>
                </button>
              ))}
            </div>

            {!showAddCustomer ? (
              <button
                onClick={() => setShowAddCustomer(true)}
                className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
              >
                <UserPlus size={14} /> Add new customer
              </button>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">New Customer</p>
                <Input
                  placeholder="Name *"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                />
                <Input
                  placeholder="Phone"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={addNewCustomer}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddCustomer(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ID Required Dialog */}
      <Dialog open={!!idRequiredError} onOpenChange={() => setIdRequiredError(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ID Number Required</DialogTitle>
            <DialogDescription>
              This customer needs an ID number on file before they can use credit payment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">{idRequiredError?.customerName}</span> does not have
                an ID number recorded.
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                ID number is required for all credit sales for security and tracking purposes.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  window.open('/dashboard/customers', '_blank')
                  setIdRequiredError(null)
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Add ID Number
              </Button>
              <Button variant="outline" onClick={() => setIdRequiredError(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
