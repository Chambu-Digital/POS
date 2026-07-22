'use client'

// ─── POSPaymentDialog ──────────────────────────────────────────────────────────
// Generic payment dialog shared by all POS modules.
// Handles method selection, M-Pesa STK / manual, cash change, credit customer.
// Caller wires in the usePOSPayment hook and passes total/subtotal down.

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Search, UserPlus, X } from 'lucide-react'
import { type UsePOSPayment, type PaymentMethod } from '@/hooks/pos/use-pos-payment'
import type { CustomerRef } from '@/hooks/pos/use-pos-payment'

interface POSPaymentDialogProps {
  open:        boolean
  onClose:     () => void
  total:       number
  subtotal:    number
  discount:    number
  pos:         UsePOSPayment    // result of usePOSPayment()
  /** Label for the confirm button */
  confirmLabel?: string
}

export function POSPaymentDialog({
  open,
  onClose,
  total,
  subtotal,
  discount,
  pos,
  confirmLabel = 'Process Payment',
}: POSPaymentDialogProps) {
  const { payment, setMethod, setAmountGiven, setMpesaPhone, setMpesaCode, setMpesaMode, initiateSTKPush, processPayment, setSelectedCustomer } = pos

  // ── Customer search state ─────────────────────────────────────────────────
  const [showCustomer, setShowCustomer]   = useState(false)
  const [custSearch,   setCustSearch]     = useState('')
  const [customers,    setCustomers]      = useState<CustomerRef[]>([])
  const [custLoading,  setCustLoading]    = useState(false)
  const [addingNew,    setAddingNew]      = useState(false)
  const [newName,      setNewName]        = useState('')
  const [newPhone,     setNewPhone]       = useState('')

  useEffect(() => {
    if (!showCustomer) return
    setCustLoading(true)
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/customers?search=${encodeURIComponent(custSearch)}`)
        const data = await res.json()
        setCustomers(data.customers ?? [])
      } catch {}
      setCustLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [custSearch, showCustomer])

  async function createCustomer() {
    if (!newName.trim()) return
    try {
      const res  = await fetch('/api/customers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName, phone: newPhone }),
      })
      const data = await res.json()
      if (res.ok) {
        setSelectedCustomer(data.customer)
        setShowCustomer(false)
        setAddingNew(false)
        setNewName('')
        setNewPhone('')
      }
    } catch {}
  }

  const change = payment.method === 'cash'
    ? Math.max(0, parseFloat(payment.amountGiven || '0') - total)
    : 0

  const creditDiff = payment.method === 'credit'
    ? total - parseFloat(payment.amountGiven || String(total))
    : 0

  const methods: { value: PaymentMethod; label: string }[] = [
    { value: 'cash',         label: 'Cash'   },
    { value: 'mobile_money', label: 'M-Pesa' },
    { value: 'card',         label: 'Card'   },
    { value: 'credit',       label: 'Credit' },
  ]

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payment — KES {total.toLocaleString()}</DialogTitle>
          <DialogDescription className="sr-only">Select a payment method to complete the sale</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {/* ── Order summary ──────────────────────────────────────────────── */}
          <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>KES {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Discount</span>
                <span>− KES {discount.toLocaleString()}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>KES {total.toLocaleString()}</span>
            </div>
          </div>

          {/* ── Customer selector ──────────────────────────────────────────── */}
          {payment.selectedCustomer ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-emerald-800">{payment.selectedCustomer.name}</p>
                <p className="text-xs text-emerald-600">
                  {payment.selectedCustomer.phone}
                  {payment.selectedCustomer.creditBalance > 0 &&
                    ` · Owes KES ${payment.selectedCustomer.creditBalance.toLocaleString()}`}
                </p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-emerald-500 hover:text-red-500">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomer(true)}
              className="w-full flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Search size={14} /> Select customer (optional)
            </button>
          )}

          {/* ── Method tabs ────────────────────────────────────────────────── */}
          <div>
            <Label className="text-sm mb-2 block">Payment Method</Label>
            <div className="grid grid-cols-4 gap-1 bg-muted p-1 rounded-lg">
              {methods.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                    payment.method === m.value
                      ? 'bg-background shadow text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Credit warning ──────────────────────────────────────────────── */}
          {payment.method === 'credit' && !payment.selectedCustomer && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Select a customer first to use credit payment.
            </p>
          )}
          {payment.method === 'credit' && payment.selectedCustomer && (
            <p className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-800">
              {payment.selectedCustomer.name} · current balance:{' '}
              KES {payment.selectedCustomer.creditBalance.toLocaleString()}
            </p>
          )}

          {/* ── M-Pesa fields ──────────────────────────────────────────────── */}
          {payment.method === 'mobile_money' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Phone Number</Label>
                <Input
                  type="tel"
                  value={payment.mpesaPhone}
                  onChange={e => setMpesaPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  disabled={payment.stkInitiated}
                />
              </div>
              <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg">
                <button
                  onClick={() => setMpesaMode('stk')}
                  className={`py-1.5 rounded-md text-xs font-medium transition-colors ${payment.mpesaMode === 'stk' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                >
                  STK Push
                </button>
                <button
                  onClick={() => setMpesaMode('manual')}
                  className={`py-1.5 rounded-md text-xs font-medium transition-colors ${payment.mpesaMode === 'manual' ? 'bg-background shadow' : 'text-muted-foreground'}`}
                >
                  Manual
                </button>
              </div>
              {payment.mpesaMode === 'stk' && !payment.stkInitiated && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!payment.mpesaPhone || payment.stkLoading}
                  onClick={() => initiateSTKPush(total)}
                >
                  {payment.stkLoading ? 'Sending…' : 'Send STK Push'}
                </Button>
              )}
              {payment.stkInitiated && (
                <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800">
                  Prompt sent to {payment.mpesaPhone}. Enter PIN on phone.
                  <button
                    className="block text-xs text-emerald-600 underline mt-1"
                    onClick={() => setMpesaMode('manual')}
                  >
                    Enter code manually instead
                  </button>
                </div>
              )}
              {payment.mpesaMode === 'manual' && (
                <div>
                  <Label className="text-xs mb-1 block">M-Pesa Code</Label>
                  <Input
                    value={payment.mpesaCode}
                    onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QGH7XYZ123"
                    className="uppercase"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Amount given (cash) / amount (card/credit) ──────────────────── */}
          {payment.method && payment.method !== 'mobile_money' && (
            <div>
              <Label className="text-xs mb-1 block">
                {payment.method === 'cash' ? 'Cash Received' :
                 payment.method === 'credit' ? 'Amount Paid Now (0 = full credit)' : 'Amount'}
              </Label>
              <Input
                type="number"
                min={0}
                value={payment.amountGiven}
                onChange={e => setAmountGiven(e.target.value)}
                placeholder={String(total)}
                step="0.01"
              />
              {payment.method === 'cash' && parseFloat(payment.amountGiven || '0') > 0 && (
                <div className={`mt-2 flex justify-between px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                }`}>
                  <span>Change</span>
                  <span>KES {change.toLocaleString()}</span>
                </div>
              )}
              {payment.method === 'credit' && creditDiff > 0 && payment.selectedCustomer && (
                <p className="text-xs text-amber-700 mt-1">
                  KES {creditDiff.toLocaleString()} added to {payment.selectedCustomer.name}'s credit balance
                </p>
              )}
            </div>
          )}

          {/* ── Confirm ────────────────────────────────────────────────────── */}
          <Button
            className="w-full"
            size="lg"
            disabled={
              !payment.method ||
              payment.processing ||
              (payment.method === 'credit' && !payment.selectedCustomer)
            }
            onClick={() => processPayment(total, subtotal)}
          >
            {payment.processing ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      </DialogContent>

      {/* ── Customer search dialog ──────────────────────────────────────────── */}
      <Dialog open={showCustomer} onOpenChange={setShowCustomer}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Select Customer</DialogTitle>
          <DialogDescription className="sr-only">Search or create a customer</DialogDescription>
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or phone…"
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {custLoading && <p className="text-sm text-center text-muted-foreground py-4">Searching…</p>}
              {!custLoading && customers.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-4">No customers found</p>
              )}
              {customers.map(c => (
                <button
                  key={c._id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomer(false); setCustSearch('') }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone}
                    {c.creditBalance > 0 &&
                      <span className="text-red-500 ml-2">Owes KES {c.creditBalance.toLocaleString()}</span>}
                  </p>
                </button>
              ))}
            </div>
            {!addingNew ? (
              <button
                onClick={() => setAddingNew(true)}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <UserPlus size={14} /> Add new customer
              </button>
            ) : (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">New Customer</p>
                <Input placeholder="Name *" value={newName} onChange={e => setNewName(e.target.value)} />
                <Input placeholder="Phone"  value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={createCustomer}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingNew(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
