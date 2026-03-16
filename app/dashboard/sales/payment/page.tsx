'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'
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

export default function PaymentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentPageContent />
    </Suspense>
  )
}

function PaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [checkoutRequestID, setCheckoutRequestID] = useState<string>('')
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSale, setLastSale] = useState<any>(null)
  const [userInfo, setUserInfo] = useState<{ shopName: string; name: string } | null>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)

  useEffect(() => {
    // Get cart data from sessionStorage
    const cartData = sessionStorage.getItem('pendingSale')
    if (cartData) {
      try {
        const data = JSON.parse(cartData)
        setCart(data.cart || [])
        setCartDiscount(data.cartDiscount || 0)
        
        // Calculate total and set default payment amount
        const subtotal = (data.cart || []).reduce(
          (sum: number, item: CartItem) => sum + item.sellingPrice * item.quantity - item.discount,
          0
        )
        const total = subtotal - (data.cartDiscount || 0)
        setPaymentAmount(Math.max(0, total).toFixed(2))
        setLoading(false)
      } catch (error) {
        console.error('Error parsing cart data:', error)
        router.push('/dashboard/sales')
      }
    } else {
      // No pending sale, redirect back
      router.push('/dashboard/sales')
    }

    fetchUserInfo()
  }, [router])

  async function fetchUserInfo() {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUserInfo({
          shopName: data.user.shopName || 'Shop',
          name: data.user.name || 'Cashier',
        })
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      setUserInfo({ shopName: 'Shop', name: 'Cashier' })
    }

    // Fetch shop settings
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setShopSettings(data.settings)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
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

    // Validate M-Pesa fields if M-Pesa is selected
    if (selectedPayment === 'mobile_money') {
      if (mpesaMethod === 'manual') {
        if (!mpesaCode || mpesaCode.trim().length === 0) {
          toast.error('Please enter M-Pesa transaction code')
          return
        }
      }
      if (!mpesaPhone || mpesaPhone.trim().length === 0) {
        toast.error('Please enter M-Pesa phone number')
        return
      }
    }

    setProcessing(true)
    setShowPaymentDialog(false)

    try {
      const subtotal = cart.reduce(
        (sum, item) => sum + item.sellingPrice * item.quantity - item.discount,
        0
      )
      const total = subtotal - cartDiscount

      const saleData = {
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.sellingPrice,
          discount: item.discount,
        })),
        subtotal,
        discount: cartDiscount,
        total: Math.max(0, total),
        paymentMethod: selectedPayment,
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
          const errorData = await response.json()
          console.error('Sales API error:', errorData)
          throw new Error(errorData.error || 'Failed to complete sale')
        }

        const result = await response.json()

        setLastSale({
          items: cart.map((item) => ({
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
          paymentMethod: selectedPayment,
          date: new Date(),
          receiptNumber: result.sale?._id || `SALE-${Date.now()}`,
        })

        toast.success('Payment completed successfully')
        setShowCompletionDialog(true)

        // Cache the sale
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
          items: cart.map((item) => ({
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
          paymentMethod: selectedPayment,
          date: new Date(),
          receiptNumber: `OFFLINE-${Date.now()}`,
        })

        toast.success('Sale saved offline - will sync when online')
        setShowCompletionDialog(true)
      }

      // Trigger backup
      if (isBackupEnabled() && userInfo) {
        try {
          await createBackupSnapshot(userInfo.shopName, userInfo.shopName, [])
        } catch (error) {
          console.error('[Backup] Failed to create snapshot:', error)
        }
      }

      // Clear session storage
      sessionStorage.removeItem('pendingSale')
    } catch (error) {
      toast.error('Error processing payment')
      console.error(error)
    } finally {
      setProcessing(false)
    }
  }

  function cancelOrder() {
    sessionStorage.removeItem('pendingSale')
    router.push('/dashboard/sales')
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity - item.discount,
    0
  )
  const total = subtotal - cartDiscount

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: '💵' },
    { id: 'card', label: 'Card', icon: '💳' },
    { id: 'mobile_money', label: 'M-Pesa', icon: '📱' },
  ]

  function openPaymentDialog() {
    setShowPaymentDialog(true)
  }

  function handlePaymentMethodChange(value: string) {
    setSelectedPayment(value)
    setShowMpesaFields(value === 'mobile_money')
    // Reset M-Pesa fields when switching payment methods
    if (value !== 'mobile_money') {
      setMpesaCode('')
      setMpesaPhone('')
      setMpesaMethod('stk')
      setStkPushInitiated(false)
      setCheckoutRequestID('')
    }
  }

  async function initiateSTKPush() {
    if (!mpesaPhone || mpesaPhone.trim().length === 0) {
      toast.error('Please enter M-Pesa phone number')
      return
    }

    setProcessing(true)

    try {
      const response = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: parseFloat(paymentAmount),
          orderReference: `ORDER-${Date.now()}`,
        }),
      })

      const data = await response.json()

      if (data.ResponseCode === '0') {
        toast.success('STK Push sent! Please enter your M-Pesa PIN on your phone')
        setStkPushInitiated(true)
        setCheckoutRequestID(data.CheckoutRequestID)
        
        // Start polling for payment status
        pollPaymentStatus(data.CheckoutRequestID)
      } else {
        toast.error(data.ResponseDescription || 'Failed to initiate STK Push')
        // Fallback to manual entry
        setMpesaMethod('manual')
      }
    } catch (error) {
      console.error('STK Push error:', error)
      toast.error('Failed to initiate STK Push. Please use manual entry.')
      setMpesaMethod('manual')
    } finally {
      setProcessing(false)
    }
  }

  async function pollPaymentStatus(checkoutRequestID: string) {
    // Poll every 3 seconds for up to 60 seconds
    let attempts = 0
    const maxAttempts = 20

    const interval = setInterval(async () => {
      attempts++

      try {
        // In production, you'd query the STK status
        // For now, we'll just wait for manual confirmation
        
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          toast.info('Payment timeout. Please enter transaction code manually.')
          setMpesaMethod('manual')
        }
      } catch (error) {
        console.error('Payment status check error:', error)
      }
    }, 3000)
  }

  function handlePrintReceipt() {
    if (receiptRef.current) {
      receiptRef.current.print()
    }
  }

  function handleMakeNewSale() {
    sessionStorage.removeItem('pendingSale')
    router.push('/dashboard/sales')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading payment page...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Select Payment Method</h1>

          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-medium">Pay</span>
            <span className="text-2xl font-bold">KES {Math.max(0, total).toFixed(2)}</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Button
              variant="outline"
              onClick={cancelOrder}
              disabled={processing}
              className="w-full"
            >
              Cancel Order
            </Button>
            <Button
              variant="secondary"
              disabled={processing}
              className="w-full"
            >
              Hold Order
            </Button>
            <Button
              onClick={openPaymentDialog}
              disabled={processing}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Process Payments
            </Button>
          </div>

          <p className="text-xs text-green-600 text-center mb-6">
            You can enable payments methods in settings
          </p>

          <Separator className="mb-6" />

          {/* Order Summary */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Item</th>
                  <th className="text-center py-3 font-medium">Qty</th>
                  <th className="text-right py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3">
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        {(item.brand || item.model || item.variant) && (
                          <div className="text-xs text-muted-foreground">
                            {[item.brand, item.model, item.variant].filter(Boolean).join(' - ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-3">{item.quantity}</td>
                    <td className="text-right py-3">
                      {(item.sellingPrice * item.quantity - item.discount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Sub total</span>
                <span className="font-medium">KES {subtotal.toFixed(2)}</span>
              </div>

              {cartDiscount > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>Discount</span>
                  <span className="font-medium">- KES {cartDiscount.toFixed(2)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total</span>
                <span>KES {Math.max(0, total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Completion Dialog */}
      {lastSale && (
        <OrderCompletionDialog
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          orderNumber={lastSale.receiptNumber}
          totalAmount={lastSale.total}
          itemCount={lastSale.items.length}
          shopName={userInfo?.shopName}
          cashierName={userInfo?.name}
          items={lastSale.items}
          subtotal={lastSale.subtotal}
          discount={lastSale.discount}
          onPrintReceipt={handlePrintReceipt}
          onMakeNewSale={handleMakeNewSale}
        />
      )}

      {/* Receipt Component (Hidden) */}
      {lastSale && userInfo && (
        <Receipt
          ref={receiptRef}
          shopName={userInfo.shopName}
          cashierName={userInfo.name}
          items={lastSale.items}
          subtotal={lastSale.subtotal}
          discount={lastSale.discount}
          total={lastSale.total}
          paymentMethod={lastSale.paymentMethod}
          date={lastSale.date}
          receiptNumber={lastSale.receiptNumber}
          shopPhone={shopSettings?.shop?.phone}
          shopEmail={shopSettings?.shop?.email}
          shopAddress={shopSettings?.shop?.address}
          mpesaPaybill={shopSettings?.payment?.mpesaPaybill}
          mpesaAccountNumber={shopSettings?.payment?.mpesaAccountNumber}
          paperSize={shopSettings?.receipt?.paperSize || '58mm'}
        />
      )}

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold">
                Balance - KES {Math.max(0, total).toFixed(2)}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="payment-method" className="text-sm font-medium mb-2 block">
                Select Payment Method
              </Label>
              <Select value={selectedPayment} onValueChange={handlePaymentMethodChange}>
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="--Select Payment--" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* M-Pesa Fields */}
            {showMpesaFields && (
              <>
                <div>
                  <Label htmlFor="mpesa-phone" className="text-sm font-medium mb-2 block">
                    M-Pesa Phone Number
                  </Label>
                  <Input
                    id="mpesa-phone"
                    type="tel"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    placeholder="e.g., 0712345678"
                    disabled={stkPushInitiated}
                  />
                </div>

                {/* STK Push or Manual Selection */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={mpesaMethod === 'stk' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setMpesaMethod('stk')}
                      disabled={stkPushInitiated}
                    >
                      STK Push
                    </Button>
                    <Button
                      type="button"
                      variant={mpesaMethod === 'manual' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => {
                        setMpesaMethod('manual')
                        setStkPushInitiated(false)
                      }}
                    >
                      Manual Entry
                    </Button>
                  </div>

                  {mpesaMethod === 'stk' && !stkPushInitiated && (
                    <Button
                      type="button"
                      onClick={initiateSTKPush}
                      disabled={!mpesaPhone || processing}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      Send STK Push
                    </Button>
                  )}

                  {stkPushInitiated && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 font-medium">
                        STK Push sent to {mpesaPhone}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Please check your phone and enter your M-Pesa PIN
                      </p>
                      <Button
                        type="button"
                        variant="link"
                        className="text-xs p-0 h-auto mt-2"
                        onClick={() => {
                          setMpesaMethod('manual')
                          setStkPushInitiated(false)
                        }}
                      >
                        Didn't receive? Enter code manually
                      </Button>
                    </div>
                  )}

                  {mpesaMethod === 'manual' && (
                    <div>
                      <Label htmlFor="mpesa-code" className="text-sm font-medium mb-2 block">
                        M-Pesa Transaction Code
                      </Label>
                      <Input
                        id="mpesa-code"
                        type="text"
                        value={mpesaCode}
                        onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                        placeholder="e.g., QGH7XYZ123"
                        className="uppercase"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Pay via Paybill 522522, A/C: 7716828, then enter the M-Pesa code
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <Label htmlFor="payment-amount" className="text-sm font-medium mb-2 block">
                {selectedPayment === 'cash' ? 'Cash Received' : 'Amount'}
              </Label>
              <Input
                id="payment-amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                step="0.01"
              />
              {selectedPayment === 'cash' && parseFloat(paymentAmount) > 0 && (
                <div className={`mt-2 flex justify-between items-center px-3 py-2 rounded-lg text-sm font-semibold ${parseFloat(paymentAmount) >= Math.max(0, total) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>Change</span>
                  <span>KES {Math.max(0, parseFloat(paymentAmount) - Math.max(0, total)).toFixed(2)}</span>
                </div>
              )}
              {selectedPayment !== 'cash' && (
                <p className="text-xs text-muted-foreground mt-1">
                  To split Payment you can change amount (Applies to deposits)
                </p>
              )}
            </div>

            <Button
              onClick={processPayment}
              disabled={!selectedPayment || !paymentAmount || processing}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {processing ? 'Processing...' : 'Process Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
