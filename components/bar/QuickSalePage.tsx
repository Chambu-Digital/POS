'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBarStore } from '@/store/bar-store'
import { BottleOpenPrompt } from './bottles/BottleOpenPrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowLeft,
  Search,
  Minus,
  Plus,
  X,
  ShoppingCart,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Serving {
  _id: string
  name: string
  unitsProduced: number
  sellingPrice: number
}

interface BarProduct {
  _id: string
  size: string
  brandName: string
  brandCategory: string
  bottleSellingPrice: number
  stock: number
  lowStockThreshold: number
  hasOpenBottle: boolean
  servings: Serving[]
}

interface CartLine {
  // key is `${inventoryItemId}__${servingId ?? 'bottle'}`
  key: string
  inventoryItemId: string
  servingId: string | null
  itemName: string       // e.g. "Jameson 750ml"
  servingName: string    // e.g. "Tot" or "Full Bottle"
  unitPrice: number
  quantity: number
}

type PayMethod = 'cash' | 'card' | 'mobile_money'

// ── Component ──────────────────────────────────────────────────────────────────

export function QuickSalePage() {
  const router = useRouter()
  const {
    searchResults,
    categories,
    searchQuery,
    categoryFilter,
    setSearchQuery,
    setCategoryFilter,
    executeSearch,
    openTab,
    addLine,
    setTabStatus,
    recordPayment,
    closeTab,
    pendingBottleOpen,
  } = useBarStore()

  // ── Product pane state ─────────────────────────────────────────────────────
  const [localSearch, setLocalSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── Cart state ─────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([])

  // ── Payment state ──────────────────────────────────────────────────────────
  const [method, setMethod] = useState<PayMethod>('cash')
  const [amountGiven, setAmountGiven] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [paying, setPaying] = useState(false)

  // ── Mobile pane toggle ─────────────────────────────────────────────────────
  const [showCart, setShowCart] = useState(false)

  // ── Load products on mount ─────────────────────────────────────────────────
  useEffect(() => {
    executeSearch({ force: true })
  }, [])

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearchQuery(localSearch)
      executeSearch()
    }, 200)
    return () => clearTimeout(searchTimer.current)
  }, [localSearch])

  // Re-filter when category changes
  useEffect(() => {
    executeSearch()
  }, [categoryFilter])

  // ── Cart helpers ───────────────────────────────────────────────────────────

  function cartKey(inventoryItemId: string, servingId: string | null) {
    return `${inventoryItemId}__${servingId ?? 'bottle'}`
  }

  function addToCart(product: BarProduct, serving: Serving | null) {
    const isBottle = serving === null
    const price  = isBottle ? product.bottleSellingPrice : serving!.sellingPrice
    const sName  = isBottle ? 'Full Bottle' : serving!.name
    const sId    = isBottle ? null : serving!._id
    const label  = `${product.brandName} ${product.size}`
    const key    = cartKey(product._id, sId)

    // Stock guard for bottle sales only (serving deduction is handled server-side)
    if (isBottle && product.stock <= 0) {
      toast.error('Out of stock')
      return
    }

    setCart(prev => {
      const existing = prev.find(l => l.key === key)
      if (existing) {
        return prev.map(l =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [
        ...prev,
        {
          key,
          inventoryItemId: product._id,
          servingId:       sId,
          itemName:        label,
          servingName:     sName,
          unitPrice:       price,
          quantity:        1,
        },
      ]
    })
  }

  function updateQty(key: string, delta: number) {
    setCart(prev =>
      prev
        .map(l => l.key === key ? { ...l, quantity: l.quantity + delta } : l)
        .filter(l => l.quantity > 0)
    )
  }

  function removeLine(key: string) {
    setCart(prev => prev.filter(l => l.key !== key))
  }

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const change   = method === 'cash' ? Math.max(0, Number(amountGiven) - subtotal) : 0

  // ── Payment ────────────────────────────────────────────────────────────────

  async function handlePay() {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (method === 'cash' && Number(amountGiven) < subtotal) {
      toast.error('Amount given is less than the total')
      return
    }
    setPaying(true)
    try {
      // 1. Open an ephemeral tab
      const tabId = await openTab({ customerName: 'Quick Sale' })

      // 2. Add every line (BottleOpenPrompt handles NO_OPEN_BOTTLE via the store)
      for (const line of cart) {
        await addLine(tabId, {
          inventoryItemId: line.inventoryItemId,
          servingId:       line.servingId,
          quantity:        line.quantity,
          unitPrice:       line.unitPrice,
          itemName:        line.itemName,
          servingName:     line.servingName,
        })
      }

      // 3. Move to billing
      await setTabStatus(tabId, 'billing')

      // 4. Record payment
      await recordPayment(tabId, {
        amount:      subtotal,
        method,
        amountGiven: method === 'cash' ? Number(amountGiven) : undefined,
        mpesaCode:   method === 'mobile_money' ? mpesaCode   : undefined,
        mpesaPhone:  method === 'mobile_money' ? mpesaPhone  : undefined,
      })

      // 5. Close tab → creates Sale record
      await closeTab(tabId)

      toast.success('Sale completed')
      setCart([])
      setAmountGiven('')
      setMpesaCode('')
      setMpesaPhone('')
      setShowCart(false)
      // Refresh product list so stock counts are accurate
      executeSearch({ force: true })
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale')
    } finally {
      setPaying(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const products = searchResults as BarProduct[]

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-4rem)]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-background">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/bar')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold leading-tight">Quick Sale</h1>
              <p className="text-xs text-muted-foreground">Bar — instant checkout</p>
            </div>
          </div>
          {/* Mobile cart toggle */}
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden relative"
            onClick={() => setShowCart(s => !s)}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Cart
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cart.reduce((s, l) => s + l.quantity, 0)}
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Product grid ───────────────────────────────────────── */}
          <div className={cn(
            'flex flex-col flex-1 min-w-0',
            showCart ? 'hidden lg:flex' : 'flex'
          )}>

            {/* Search + category filters */}
            <div className="px-4 pt-3 pb-2 space-y-2 border-b bg-background shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brand or size…"
                  value={localSearch}
                  onChange={e => setLocalSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => { setCategoryFilter(''); executeSearch() }}
                    className={cn(
                      'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      categoryFilter === ''
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); executeSearch() }}
                      className={cn(
                        'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        categoryFilter === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product cards */}
            <div className="flex-1 overflow-y-auto p-4">
              {products.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No products found
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {products.map(product => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      onAdd={addToCart}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart + payment ────────────────────────────────────── */}
          <div className={cn(
            'w-full lg:w-[380px] shrink-0 flex flex-col border-l bg-background',
            showCart ? 'flex' : 'hidden lg:flex'
          )}>
            <div className="px-4 py-3 border-b font-semibold text-sm flex justify-between items-center bg-muted/30">
              <span>Cart</span>
              <span className="text-muted-foreground font-normal">
                {cart.reduce((s, l) => s + l.quantity, 0)} item(s)
              </span>
            </div>

            {/* Cart lines */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-10">
                  Tap a product or serving to add it
                </p>
              ) : (
                cart.map(line => (
                  <div key={line.key} className="flex items-center gap-2 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">{line.itemName}</p>
                      <p className="text-xs text-muted-foreground">{line.servingName} · KES {line.unitPrice.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="icon" className="h-6 w-6"
                        onClick={() => updateQty(line.key, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-medium">{line.quantity}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6"
                        onClick={() => updateQty(line.key, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold w-20 text-right shrink-0">
                      KES {(line.unitPrice * line.quantity).toLocaleString()}
                    </p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                      onClick={() => removeLine(line.key)}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Payment section */}
            <div className="px-4 py-4 border-t space-y-4 bg-background">
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-primary">KES {subtotal.toLocaleString()}</span>
              </div>

              <Separator />

              {/* Method tabs */}
              <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-lg">
                {(['cash', 'mobile_money', 'card'] as PayMethod[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      'py-1.5 rounded-md text-xs font-medium transition-colors',
                      method === m
                        ? 'bg-background shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m === 'mobile_money' ? 'M-Pesa' : m === 'cash' ? 'Cash' : 'Card'}
                  </button>
                ))}
              </div>

              {/* Method-specific fields */}
              {method === 'cash' && (
                <div className="space-y-1">
                  <Label className="text-xs">Amount Given (KES)</Label>
                  <Input
                    type="number"
                    placeholder={subtotal.toString()}
                    value={amountGiven}
                    onChange={e => setAmountGiven(e.target.value)}
                  />
                  {change > 0 && (
                    <p className="text-sm text-emerald-600 font-medium pt-1">
                      Change: KES {change.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {method === 'mobile_money' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">M-Pesa Code</Label>
                    <Input
                      value={mpesaCode}
                      onChange={e => setMpesaCode(e.target.value)}
                      placeholder="e.g. QWE123RTY"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      value={mpesaPhone}
                      onChange={e => setMpesaPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handlePay}
                disabled={paying || cart.length === 0 || subtotal === 0}
              >
                {paying ? 'Processing…' : `Pay KES ${subtotal.toLocaleString()}`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottle open prompt — managed by the bar store */}
      <BottleOpenPrompt />
    </>
  )
}

// ── ProductCard ────────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onAdd,
}: {
  product: BarProduct
  onAdd: (product: BarProduct, serving: Serving | null) => void
}) {
  const outOfStock = product.stock <= 0
  const lowStock   = !outOfStock && product.stock <= product.lowStockThreshold

  return (
    <Card className={cn(
      'transition-shadow hover:shadow-md',
      outOfStock && 'opacity-60'
    )}>
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {product.brandName}
            </p>
            <p className="text-xs text-muted-foreground">{product.size}</p>
          </div>
          <Badge
            variant={outOfStock ? 'destructive' : lowStock ? 'outline' : 'secondary'}
            className="text-[10px] shrink-0 ml-1"
          >
            {outOfStock ? 'Out' : `${product.stock} left`}
          </Badge>
        </div>

        {/* Whole-bottle button — only show if price is set */}
        {product.bottleSellingPrice > 0 && (
          <button
            disabled={outOfStock}
            onClick={() => onAdd(product, null)}
            className={cn(
              'w-full flex justify-between items-center px-3 py-2 rounded-md text-sm',
              'bg-muted hover:bg-primary/10 hover:ring-1 hover:ring-primary transition-colors',
              outOfStock && 'pointer-events-none'
            )}
          >
            <span className="font-medium">Full Bottle</span>
            <span className="text-primary font-semibold">
              KES {product.bottleSellingPrice.toLocaleString()}
            </span>
          </button>
        )}

        {/* Serving buttons */}
        {product.servings.length > 0 && (
          <div className="space-y-1">
            {product.bottleSellingPrice > 0 && (
              <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide pt-1">
                Servings
              </p>
            )}
            {product.servings.map(serving => (
              <button
                key={serving._id}
                onClick={() => onAdd(product, serving)}
                className="w-full flex justify-between items-center px-3 py-2 rounded-md text-sm
                           bg-muted hover:bg-primary/10 hover:ring-1 hover:ring-primary transition-colors"
              >
                <span className="font-medium">
                  {serving.name}
                  <span className="text-muted-foreground font-normal ml-1 text-xs">
                    ×{serving.unitsProduced}/btl
                  </span>
                </span>
                <span className="text-primary font-semibold">
                  KES {serving.sellingPrice.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* If neither bottle price nor servings */}
        {product.bottleSellingPrice === 0 && product.servings.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-2">No prices configured</p>
        )}
      </CardContent>
    </Card>
  )
}
