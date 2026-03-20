'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Printer, Send, ShoppingCart, MessageSquare, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface OrderCompletionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  totalAmount: number
  itemCount: number
  shopName?: string
  cashierName?: string
  items?: Array<{
    productName: string
    quantity: number
    price: number
    discount: number
    total: number
  }>
  subtotal?: number
  discount?: number
  onPrintReceipt: () => void
  onMakeNewSale: () => void
}

export function OrderCompletionDialog({
  open,
  onOpenChange,
  orderNumber,
  totalAmount,
  itemCount,
  shopName = 'Chambu Digital',
  cashierName = 'Cashier',
  items = [],
  subtotal = 0,
  discount = 0,
  onPrintReceipt,
  onMakeNewSale,
}: OrderCompletionDialogProps) {
  const router = useRouter()
  const [showSendOptions, setShowSendOptions] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')

  function handlePrintReceipt() {
    onPrintReceipt()
  }

  function handleMakeNewSale() {
    onOpenChange(false)
    onMakeNewSale()
  }

  function handleSendViaSMS() {
    if (!phoneNumber) {
      alert('Please enter a phone number')
      return
    }
    // Placeholder for SMS functionality
    alert(`Receipt will be sent via SMS to ${phoneNumber}`)
    setShowSendOptions(false)
  }

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '')
    // Convert 07xx or 01xx → 2547xx / 2541xx
    if (digits.startsWith('0') && digits.length === 10) {
      return '254' + digits.slice(1)
    }
    return digits
  }

  function handleSendViaWhatsApp() {
    if (!phoneNumber) {
      alert('Please enter a phone number')
      return
    }
    
    // Build detailed receipt message
    let message = `*${shopName.toUpperCase()} RECEIPT*\n\n`
    message += `Order: ${orderNumber}\n`
    message += `Items: ${itemCount}\n`
    message += `Cashier: ${cashierName}\n\n`
    
    message += `*Items:*\n`
    if (items.length > 0) {
      items.forEach((item) => {
        message += `• ${item.productName}\n`
        message += `  Qty: ${item.quantity} × KES ${item.price.toFixed(2)}\n`
        if (item.discount > 0) {
          message += `  Discount: -KES ${item.discount.toFixed(2)}\n`
        }
        message += `  Total: KES ${item.total.toFixed(2)}\n\n`
      })
    }
    
    message += `*Summary:*\n`
    if (subtotal > 0) {
      message += `Subtotal: KES ${subtotal.toFixed(2)}\n`
    }
    if (discount > 0) {
      message += `Discount: -KES ${discount.toFixed(2)}\n`
    }
    message += `*Total: KES ${totalAmount.toFixed(2)}*\n\n`
    message += `Thank you for shopping with us!\n`
    message += `Powered by Chambu Digital`
    
    const whatsappUrl = `https://wa.me/${formatPhone(phoneNumber)}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
    setShowSendOptions(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full">
        <DialogTitle className="sr-only">Order Completed</DialogTitle>
        <div className="flex flex-col items-center justify-center py-6 space-y-5">

          {/* Order Completed Text */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-gray-700">Order Completed</h2>
            <p className="text-3xl font-bold">Paid KES {totalAmount.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">{itemCount} items</p>
          </div>

          {/* Order ID */}
          <p className="text-orange-600 font-medium text-sm text-center break-all">
            Order Id: {orderNumber}
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 w-full">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white text-xs px-2"
              onClick={handleMakeNewSale}
            >
              <ShoppingCart className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">New Sale</span>
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2"
              onClick={handlePrintReceipt}
            >
              <Printer className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Print</span>
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white text-xs px-2"
              onClick={() => setShowSendOptions(!showSendOptions)}
            >
              <Send className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">Send</span>
            </Button>
          </div>

          {/* Send Receipt Options */}
          {showSendOptions && (
            <div className="w-full space-y-3 pt-4 border-t">
              <div>
                <Label htmlFor="phone-number" className="text-sm font-medium mb-2 block">
                  Phone Number
                </Label>
                <Input
                  id="phone-number"
                  type="tel"
                  placeholder="+254712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handleSendViaSMS}
                  className="w-full text-xs"
                >
                  <MessageSquare className="w-3 h-3 mr-1 shrink-0" />
                  SMS
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendViaWhatsApp}
                  className="w-full text-xs border-green-600 text-green-600 hover:bg-green-50"
                >
                  <Phone className="w-3 h-3 mr-1 shrink-0" />
                  WhatsApp
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
