'use client'

// ─── usePOSCart ────────────────────────────────────────────────────────────────
// Generic cart engine shared by Retail POS, Bar POS, and any future POS module.
// No module-specific logic lives here — the caller decides what goes in a cart line.

import { useState, useCallback, useEffect } from 'react'

export interface CartLine {
  /** Unique stable key — caller constructs it (e.g. productId, or `itemId__servingId`) */
  key: string
  /** Display name for the line (e.g. "Jameson 750ml — Tot") */
  label: string
  /** Optional sub-label (e.g. brand, variant, serving units) */
  sublabel?: string
  unitPrice: number
  quantity: number
  /** Per-line discount in KES */
  discount: number
}

export interface UsePOSCart {
  cart: CartLine[]
  cartDiscount: number
  subtotal: number
  total: number
  addLine: (line: Omit<CartLine, 'quantity' | 'discount'> & { quantity?: number; discount?: number; maxQty?: number }) => void
  updateQty: (key: string, quantity: number) => void
  updateDiscount: (key: string, discount: number) => void
  removeLine: (key: string) => void
  setCartDiscount: (amount: number) => void
  clearCart: () => void
  /** Replace the entire cart (used when recalling a held order) */
  recallCart: (cart: CartLine[], cartDiscount: number) => void
}

interface Options {
  /** sessionStorage key to persist cart between page navigations within the same session */
  storageKey?: string
  /** sessionStorage key for cart-level discount */
  discountStorageKey?: string
}

export function usePOSCart(options: Options = {}): UsePOSCart {
  const { storageKey, discountStorageKey } = options

  const [cart, setCart] = useState<CartLine[]>(() => {
    if (!storageKey || typeof window === 'undefined') return []
    try {
      const saved = sessionStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  const [cartDiscount, setCartDiscountState] = useState<number>(() => {
    if (!discountStorageKey || typeof window === 'undefined') return 0
    try {
      const saved = sessionStorage.getItem(discountStorageKey)
      return saved ? parseFloat(saved) : 0
    } catch { return 0 }
  })

  // Persist to sessionStorage whenever cart changes
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try { sessionStorage.setItem(storageKey, JSON.stringify(cart)) } catch {}
  }, [cart, storageKey])

  useEffect(() => {
    if (!discountStorageKey || typeof window === 'undefined') return
    try { sessionStorage.setItem(discountStorageKey, String(cartDiscount)) } catch {}
  }, [cartDiscount, discountStorageKey])

  const addLine = useCallback((
    line: Omit<CartLine, 'quantity' | 'discount'> & { quantity?: number; discount?: number; maxQty?: number }
  ) => {
    const { maxQty, quantity: addQty = 1, discount = 0, ...rest } = line
    setCart(prev => {
      const existing = prev.find(l => l.key === rest.key)
      if (existing) {
        const newQty = existing.quantity + addQty
        if (maxQty !== undefined && newQty > maxQty) return prev
        return prev.map(l => l.key === rest.key ? { ...l, quantity: newQty } : l)
      }
      return [...prev, { ...rest, quantity: addQty, discount }]
    })
  }, [])

  const updateQty = useCallback((key: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(l => l.key !== key))
      return
    }
    setCart(prev => prev.map(l => l.key === key ? { ...l, quantity } : l))
  }, [])

  const updateDiscount = useCallback((key: string, discount: number) => {
    setCart(prev => prev.map(l => l.key === key ? { ...l, discount: Math.max(0, discount) } : l))
  }, [])

  const removeLine = useCallback((key: string) => {
    setCart(prev => prev.filter(l => l.key !== key))
  }, [])

  const setCartDiscount = useCallback((amount: number) => {
    setCartDiscountState(Math.max(0, amount))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setCartDiscountState(0)
    if (storageKey)         try { sessionStorage.removeItem(storageKey) }         catch {}
    if (discountStorageKey) try { sessionStorage.removeItem(discountStorageKey) } catch {}
  }, [storageKey, discountStorageKey])

  const recallCart = useCallback((recalled: CartLine[], discount: number) => {
    setCart(recalled)
    setCartDiscountState(discount)
  }, [])

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity - l.discount, 0)
  const total    = Math.max(0, subtotal - cartDiscount)

  return { cart, cartDiscount, subtotal, total, addLine, updateQty, updateDiscount, removeLine, setCartDiscount, clearCart, recallCart }
}
