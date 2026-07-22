'use client'

// ─── usePOSPayment ─────────────────────────────────────────────────────────────
// Handles the payment flow for any POS module.
// Caller supplies a `submitSale` function that handles the module-specific API
// call (Retail → /api/sales, Bar → /api/bar/pos-sale, Pharmacy → /api/pharmacy/sale).

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'credit'
export type MpesaMode     = 'stk' | 'manual'

export interface CustomerRef {
  _id: string
  name: string
  phone: string
  creditBalance: number
}

export interface PaymentState {
  method:           PaymentMethod | ''
  amountGiven:      string        // raw input — what the customer hands over (cash) or total (mpesa/card)
  mpesaPhone:       string
  mpesaCode:        string
  mpesaMode:        MpesaMode
  stkInitiated:     boolean
  selectedCustomer: CustomerRef | null
  processing:       boolean
  stkLoading:       boolean
}

export interface UsePOSPayment {
  payment: PaymentState
  change: number
  setMethod:           (m: PaymentMethod) => void
  setAmountGiven:      (v: string) => void
  setMpesaPhone:       (v: string) => void
  setMpesaCode:        (v: string) => void
  setMpesaMode:        (m: MpesaMode) => void
  setStkInitiated:     (v: boolean) => void
  setSelectedCustomer: (c: CustomerRef | null) => void
  initiateSTKPush:     (total: number) => Promise<void>
  processPayment:      (total: number, subtotal: number) => Promise<void>
  reset:               () => void
}

interface Options {
  /** Module-specific sale submission. Receives full payload, returns { sale, receiptData } */
  submitSale: (payload: SalePayload) => Promise<SaleResult>
  onSuccess:  (result: SaleResult, payment: PaymentState) => void
  onError?:   (err: Error) => void
}

export interface SalePayload {
  total:          number
  subtotal:       number
  paymentMethod:  PaymentMethod | ''
  amountGiven:    number
  mpesaCode?:     string
  mpesaPhone?:    string
  customerId?:    string
  customerName?:  string
}

export interface SaleResult {
  sale:       any
  receiptData?: any
}

const INITIAL: PaymentState = {
  method:           '',
  amountGiven:      '',
  mpesaPhone:       '',
  mpesaCode:        '',
  mpesaMode:        'stk',
  stkInitiated:     false,
  selectedCustomer: null,
  processing:       false,
  stkLoading:       false,
}

export function usePOSPayment({ submitSale, onSuccess, onError }: Options): UsePOSPayment {
  const [payment, setPayment] = useState<PaymentState>(INITIAL)

  const patch = useCallback((update: Partial<PaymentState>) => {
    setPayment(prev => ({ ...prev, ...update }))
  }, [])

  const setMethod = useCallback((m: PaymentMethod) => {
    patch({ method: m, mpesaCode: '', mpesaPhone: '', mpesaMode: 'stk', stkInitiated: false, amountGiven: '' })
  }, [patch])

  const setAmountGiven      = useCallback((v: string) => patch({ amountGiven: v }), [patch])
  const setMpesaPhone       = useCallback((v: string) => patch({ mpesaPhone: v }),  [patch])
  const setMpesaCode        = useCallback((v: string) => patch({ mpesaCode: v }),   [patch])
  const setMpesaMode        = useCallback((m: MpesaMode) => patch({ mpesaMode: m, stkInitiated: false }), [patch])
  const setStkInitiated     = useCallback((v: boolean) => patch({ stkInitiated: v }), [patch])
  const setSelectedCustomer = useCallback((c: CustomerRef | null) => patch({ selectedCustomer: c }), [patch])

  const initiateSTKPush = useCallback(async (total: number) => {
    if (!payment.mpesaPhone.trim()) { toast.error('Enter M-Pesa phone number'); return }
    patch({ stkLoading: true })
    try {
      const res  = await fetch('/api/mpesa/stk-push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phoneNumber: payment.mpesaPhone, amount: total, orderReference: `BAR-${Date.now()}` }),
      })
      const data = await res.json()
      if (data.ResponseCode === '0') {
        toast.success('STK Push sent — enter M-Pesa PIN')
        patch({ stkInitiated: true })
      } else {
        toast.error(data.ResponseDescription || 'STK Push failed')
        patch({ mpesaMode: 'manual' })
      }
    } catch {
      toast.error('STK Push failed — enter code manually')
      patch({ mpesaMode: 'manual' })
    } finally {
      patch({ stkLoading: false })
    }
  }, [payment.mpesaPhone, patch])

  const processPayment = useCallback(async (total: number, subtotal: number) => {
    const { method, amountGiven, mpesaPhone, mpesaCode, mpesaMode, selectedCustomer } = payment

    // ── Validation ───────────────────────────────────────────────────────────
    if (!method) { toast.error('Select a payment method'); return }
    const given = parseFloat(amountGiven || String(total))
    if (isNaN(given) || given <= 0) { toast.error('Enter a valid amount'); return }
    if (method === 'cash' && given < total) { toast.error('Amount given is less than total'); return }
    if (method === 'credit' && !selectedCustomer) { toast.error('Select a customer for credit payment'); return }
    if (method === 'mobile_money' && mpesaMode === 'manual' && !mpesaCode.trim()) {
      toast.error('Enter M-Pesa transaction code'); return
    }
    if (method === 'mobile_money' && !mpesaPhone.trim()) { toast.error('Enter M-Pesa phone number'); return }

    patch({ processing: true })
    try {
      const result = await submitSale({
        total,
        subtotal,
        paymentMethod:  method,
        amountGiven:    given,
        mpesaCode:      method === 'mobile_money' ? mpesaCode  : undefined,
        mpesaPhone:     method === 'mobile_money' ? mpesaPhone : undefined,
        customerId:     selectedCustomer?._id,
        customerName:   selectedCustomer?.name,
      })
      onSuccess(result, payment)
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(err?.message || 'Payment failed')
      toast.error(error.message)
      onError?.(error)
    } finally {
      patch({ processing: false })
    }
  }, [payment, submitSale, onSuccess, onError, patch])

  const reset = useCallback(() => setPayment(INITIAL), [])

  const change = payment.method === 'cash'
    ? Math.max(0, parseFloat(payment.amountGiven || '0') - 0) // caller passes total to compute
    : 0

  return {
    payment,
    change,
    setMethod,
    setAmountGiven,
    setMpesaPhone,
    setMpesaCode,
    setMpesaMode,
    setStkInitiated,
    setSelectedCustomer,
    initiateSTKPush,
    processPayment,
    reset,
  }
}
