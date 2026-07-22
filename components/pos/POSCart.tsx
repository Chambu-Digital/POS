'use client'

// ─── POSCart ───────────────────────────────────────────────────────────────────
// Generic cart panel shared by all POS modules.
// Displays cart lines with qty controls and per-line discounts, a cart-level
// discount field, totals, and a checkout button.

import { Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { type CartLine } from '@/hooks/pos/use-pos-cart'
import { cn } from '@/lib/utils'

interface POSCartProps {
  cart: CartLine[]
  cartDiscount: number
  subtotal: number
  total: number
  onUpdateQty:      (key: string, qty: number) => void
  onUpdateDiscount: (key: string, discount: number) => void
  onRemoveLine:     (key: string) => void
  onSetCartDiscount:(amount: number) => void
  onCheckout:       () => void
  /** Called on mobile to scroll back to the product grid */
  onAddMore?:       () => void
  checkoutLabel?:   string
  checkoutDisabled?: boolean
  /** Extra content below the checkout button (e.g. held-orders recall) */
  footerSlot?: React.ReactNode
  enterEditing?: () => void
  exitEditing?:  () => void
}

export function POSCart({
  cart,
  cartDiscount,
  subtotal,
  total,
  onUpdateQty,
  onUpdateDiscount,
  onRemoveLine,
  onSetCartDiscount,
  onCheckout,
  onAddMore,
  checkoutLabel = 'Checkout',
  checkoutDisabled = false,
  footerSlot,
  enterEditing,
  exitEditing,
}: POSCartProps) {
  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          {/* Cart icon */}
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10h14l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 10z" fill="#d1fae5" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="font-bold text-base">
            Cart <span className="text-muted-foreground font-normal text-sm">({cart.length})</span>
          </h2>
        </div>
        {onAddMore && cart.length > 0 && (
          <Button size="sm" variant="outline" className="md:hidden text-xs" onClick={onAddMore}>
            + Add Items
          </Button>
        )}
      </div>

      {/* ── Lines ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="opacity-30">
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10h14l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span>Cart is empty</span>
          </div>
        ) : (
          cart.map(line => (
            <CartLineRow
              key={line.key}
              line={line}
              onUpdateQty={onUpdateQty}
              onUpdateDiscount={onUpdateDiscount}
              onRemove={onRemoveLine}
              enterEditing={enterEditing}
              exitEditing={exitEditing}
            />
          ))
        )}
      </div>

      {/* ── Summary + checkout ──────────────────────────────────────────────── */}
      <div className="px-4 pb-4 pt-2 shrink-0 border-t space-y-3">
        {/* Subtotal */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">KES {subtotal.toLocaleString()}</span>
        </div>

        {/* Cart discount */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Cart Discount</span>
          <Input
            type="number"
            min={0}
            value={cartDiscount || ''}
            placeholder="0"
            onChange={e => onSetCartDiscount(parseFloat(e.target.value) || 0)}
            onFocus={enterEditing}
            onBlur={exitEditing}
            className="h-7 text-sm w-24 ml-auto"
          />
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">KES {total.toLocaleString()}</span>
        </div>

        {/* Checkout */}
        <Button
          className="w-full"
          size="lg"
          disabled={cart.length === 0 || checkoutDisabled}
          onClick={onCheckout}
        >
          {checkoutLabel}
        </Button>

        {footerSlot}
      </div>
    </div>
  )
}

// ── Individual cart line ───────────────────────────────────────────────────────

interface CartLineRowProps {
  line: CartLine
  onUpdateQty:      (key: string, qty: number) => void
  onUpdateDiscount: (key: string, discount: number) => void
  onRemove:         (key: string) => void
  enterEditing?:    () => void
  exitEditing?:     () => void
}

function CartLineRow({ line, onUpdateQty, onUpdateDiscount, onRemove, enterEditing, exitEditing }: CartLineRowProps) {
  const lineTotal = line.unitPrice * line.quantity - line.discount
  return (
    <div className="border rounded-lg p-2.5 space-y-1.5">
      {/* Name row */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="font-medium text-sm leading-tight truncate">{line.label}</p>
          {line.sublabel && (
            <p className="text-xs text-muted-foreground truncate">{line.sublabel}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(line.key)}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5"
          aria-label="Remove"
        >
          <X size={14} />
        </button>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1.5">
        {/* Qty stepper */}
        <button
          onClick={() => onUpdateQty(line.key, line.quantity - 1)}
          className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          aria-label="Decrease"
        >
          <Minus size={11} />
        </button>
        <Input
          type="number"
          min={1}
          value={line.quantity}
          onChange={e => onUpdateQty(line.key, parseInt(e.target.value) || 1)}
          onFocus={enterEditing}
          onBlur={exitEditing}
          className="w-10 h-6 text-center text-xs p-0"
          aria-label="Quantity"
        />
        <button
          onClick={() => onUpdateQty(line.key, line.quantity + 1)}
          className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          aria-label="Increase"
        >
          <Plus size={11} />
        </button>

        {/* Per-line discount */}
        <Input
          type="number"
          min={0}
          value={line.discount || ''}
          placeholder="Disc"
          onChange={e => onUpdateDiscount(line.key, parseFloat(e.target.value) || 0)}
          onFocus={enterEditing}
          onBlur={exitEditing}
          className="w-16 h-6 text-xs"
          aria-label="Line discount"
        />

        {/* Line total */}
        <p className="ml-auto text-xs font-semibold whitespace-nowrap">
          KES {lineTotal.toLocaleString()}
        </p>
      </div>
    </div>
  )
}
