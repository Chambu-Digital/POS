'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Plus, Minus, X, ShoppingBag } from 'lucide-react'

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

interface CartModalProps {
  isOpen: boolean
  onClose: () => void
  cart: CartItem[]
  cartDiscount: number
  onUpdateQuantity: (productId: string, quantity: number) => void
  onUpdateDiscount: (productId: string, discount: number) => void
  onRemoveFromCart: (productId: string) => void
  onUpdateCartDiscount: (discount: number) => void
  onCompleteSale: () => void
  onEnterEditing?: () => void
  onExitEditing?: () => void
}

export function CartModal({
  isOpen,
  onClose,
  cart,
  cartDiscount,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveFromCart,
  onUpdateCartDiscount,
  onCompleteSale,
  onEnterEditing,
  onExitEditing,
}: CartModalProps) {
  if (!isOpen) return null

  function formatProductName(item: { productName: string; brand?: string; variant?: string }) {
    return [item.variant, item.brand, item.productName].filter(Boolean).join(' ')
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity - item.discount,
    0
  )
  const total = subtotal - cartDiscount

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 md:hidden"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100">
              <ShoppingBag size={18} className="text-emerald-600" />
            </span>
            <div>
              <h2 className="font-semibold text-lg">Cart</h2>
              <p className="text-xs text-muted-foreground">{cart.length} {cart.length === 1 ? 'item' : 'items'}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
                <ShoppingBag size={36} className="text-gray-300" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Cart is empty</p>
                <p className="text-sm text-muted-foreground">Add products to get started</p>
              </div>
              <Button onClick={onClose} variant="outline">
                Browse Products
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-semibold text-sm leading-tight">
                        {formatProductName(item)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        KSh {item.sellingPrice.toLocaleString()} each
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onRemoveFromCart(item.productId)}
                    >
                      <X size={16} />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus size={14} />
                      </Button>
                      <Input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => onUpdateQuantity(item.productId, parseInt(e.target.value) || 0)}
                        onFocus={(e) => {
                          e.target.select()
                          onEnterEditing?.()
                        }}
                        onBlur={onExitEditing}
                        className="w-12 h-8 text-center text-sm p-0 font-medium"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>

                    {/* Discount */}
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="Discount"
                        value={item.discount || ''}
                        onChange={(e) => onUpdateDiscount(item.productId, parseFloat(e.target.value) || 0)}
                        onFocus={(e) => {
                          e.target.select()
                          onEnterEditing?.()
                        }}
                        onBlur={onExitEditing}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <p className="text-sm font-bold whitespace-nowrap text-primary">
                        KSh {(item.sellingPrice * item.quantity - item.discount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary and Actions */}
        {cart.length > 0 && (
          <div className="border-t bg-white px-4 py-4 space-y-4">
            {/* Summary */}
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">KSh {subtotal.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="cart-discount" className="text-sm text-muted-foreground">
                  Cart Discount:
                </Label>
                <Input
                  id="cart-discount"
                  type="number"
                  placeholder="0.00"
                  value={cartDiscount || ''}
                  onChange={(e) => onUpdateCartDiscount(parseFloat(e.target.value) || 0)}
                  onFocus={(e) => {
                    e.target.select()
                    onEnterEditing?.()
                  }}
                  onBlur={onExitEditing}
                  className="h-9 w-28 text-right"
                />
              </div>
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">KSh {Math.max(0, total).toLocaleString()}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={onCompleteSale}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                Proceed to Payment
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="w-full"
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
