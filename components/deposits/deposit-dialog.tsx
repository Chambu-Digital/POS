'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { DepositReceipt } from './deposit-receipt'

// ── Take Customer Deposit dialog ─────────────────────────────────────────────
// Collects a customer prepayment (real cash by method) and prints a deposit
// receipt. POSTs to /api/deposits which creates the Deposit doc, pushes a
// 'deposit' ledger entry, and increments the customer's depositBalance.

export interface DepositCustomer {
  _id: string
  name: string
  phone?: string
}

interface CreatedDeposit {
  _id: string
  receiptNo: string
  amount: number
  balance: number
  method: string
  methodLabel: string
  customerName: string
  customerPhone: string
  paymentReference?: string
  mpesaCode?: string
  note?: string
  createdAt: string
  // Shop info — passed through to the printable receipt header
  shopName?: string
  shopLogo?: string
  shopPhone?: string
  shopEmail?: string
  shopAddress?: string
}

export function DepositDialog({
  customer,
  open,
  onOpenChange,
  bankProviders,
  customMethods,
  onTaken,
  shopName,
  shopLogo,
  shopPhone,
  shopEmail,
  shopAddress,
}: {
  customer: DepositCustomer | null
  open: boolean
  onOpenChange: (v: boolean) => void
  bankProviders: Array<{ _id: string; name: string }>
  customMethods: Array<{ _id: string; name: string }>
  onTaken?: () => void  // refresh caller's customer list
  shopName?: string
  shopLogo?: string
  shopPhone?: string
  shopEmail?: string
  shopAddress?: string
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>('cash')
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [selectedBankId, setSelectedBankId] = useState('')
  const [selectedCustomMethodId, setSelectedCustomMethodId] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // The deposit that was just created — drives the receipt view/print step
  const [created, setCreated] = useState<CreatedDeposit | null>(null)

  useEffect(() => {
    if (open) {
      // Reset form for a fresh open
      setAmount('')
      setMethod('cash')
      setMpesaCode('')
      setMpesaPhone('')
      setSelectedBankId('')
      setSelectedCustomMethodId('')
      setPaymentReference('')
      setNote('')
      setCreated(null)
    }
  }, [open, customer?._id])

  const isCustomMethod = method.startsWith('custom:')
  const actualMethod = isCustomMethod ? 'custom' : method

  function resolveMethodLabel(): string {
    if (method === 'cash') return 'Cash'
    if (method === 'mobile_money') return 'M-Pesa / Mobile Money'
    if (method === 'card') return 'Card'
    if (method === 'bank') {
      const bp = bankProviders.find((b) => b._id === selectedBankId)
      return bp ? bp.name : 'Bank Transfer'
    }
    if (isCustomMethod) {
      const cm = customMethods.find((m) => m._id === selectedCustomMethodId)
      return cm ? cm.name : 'Custom Method'
    }
    return method
  }

  async function takeDeposit() {
    if (!customer) return
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!method) {
      toast.error('Select a payment method')
      return
    }
    if (method === 'bank' && !selectedBankId) {
      toast.error('Select a bank provider')
      return
    }
    if (isCustomMethod && !selectedCustomMethodId) {
      toast.error('Select a payment method')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        customerId: customer._id,
        amount: amt,
        method: actualMethod,
        note,
      }
      if (actualMethod === 'mobile_money') {
        payload.mpesaCode = mpesaCode
        payload.mpesaPhone = mpesaPhone || customer.phone || ''
        payload.paymentReference = mpesaCode
      }
      if (actualMethod === 'bank' && selectedBankId) {
        payload.bankProviderId = selectedBankId
        const bp = bankProviders.find((b) => b._id === selectedBankId)
        if (bp) payload.bankProviderName = bp.name
        payload.paymentReference = paymentReference
      }
      if (actualMethod === 'custom' && selectedCustomMethodId) {
        payload.customMethodId = selectedCustomMethodId
        const cm = customMethods.find((m) => m._id === selectedCustomMethodId)
        if (cm) payload.customMethodName = cm.name
        payload.paymentReference = paymentReference
      }
      if (actualMethod === 'card') {
        payload.paymentReference = paymentReference
      }

      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to take deposit')
        setSaving(false)
        return
      }

      const d = data.deposit
      setCreated({
        _id: d._id,
        receiptNo: d.receiptNo,
        amount: d.amount,
        balance: d.balance,
        method: actualMethod,
        methodLabel: resolveMethodLabel(),
        customerName: d.customerName || customer.name,
        customerPhone: d.customerPhone || customer.phone || '',
        paymentReference: payload.paymentReference || '',
        mpesaCode: d.mpesaCode || '',
        note: d.note || '',
        createdAt: d.createdAt,
        shopName,
        shopLogo,
        shopPhone,
        shopEmail,
        shopAddress,
      })
      toast.success(`Deposit ${d.receiptNo} recorded`)
      onTaken?.()
    } catch {
      toast.error('Failed to take deposit')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>
          {created ? 'Deposit Recorded' : `Take Deposit — ${customer?.name ?? ''}`}
        </DialogTitle>

        {created ? (
          // ── Confirmation + print receipt ─────────────────────────────────
          <div className="space-y-3 mt-2">
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm">
              <p className="font-semibold text-teal-800">
                {created.receiptNo} · {created.methodLabel}
              </p>
              <p className="text-teal-700 mt-0.5">
                KES {created.amount.toLocaleString()} received as store credit
              </p>
              <p className="text-xs text-teal-600 mt-0.5">
                Remaining deposit balance: KES {created.balance.toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold"
              >
                Print Receipt
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Done
              </button>
            </div>
            {/* Printable receipt (hidden on screen, shown only for print) */}
            <DepositReceipt deposit={created} />
          </div>
        ) : (
          // ── Take deposit form ──────────────────────────────────────────────
          <div className="space-y-3 mt-2">
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm">
              <p className="text-teal-700">
                Recording a prepayment for <span className="font-semibold">{customer?.name}</span>.
                The customer can shop against this balance later — partial or in full.
              </p>
            </div>

            {/* Payment method — mirrors the customer payment picker */}
            <div>
              <label className="text-sm font-medium text-gray-700">Payment Method *</label>
              <select
                value={method}
                onChange={(e) => {
                  const value = e.target.value
                  setMethod(value)
                  setMpesaCode('')
                  setMpesaPhone('')
                  setSelectedBankId('')
                  setSelectedCustomMethodId('')
                  setPaymentReference('')
                  if (value.startsWith('custom:')) {
                    setSelectedCustomMethodId(value.split(':')[1])
                  }
                }}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <optgroup label="Standard Methods">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">M-Pesa / Mobile Money</option>
                  <option value="card">Card</option>
                  {bankProviders.length > 0 && <option value="bank">Bank Transfer</option>}
                </optgroup>
                {customMethods.length > 0 && (
                  <optgroup label="Custom Methods">
                    {customMethods.map((m) => (
                      <option key={m._id} value={`custom:${m._id}`}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {method === 'mobile_money' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700">M-Pesa Code</label>
                  <Input
                    className="mt-1"
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value)}
                    placeholder="e.g. SG7XK3M9"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">M-Pesa Phone</label>
                  <Input
                    className="mt-1"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    placeholder={customer?.phone || 'e.g. 0712345678'}
                  />
                </div>
              </>
            )}

            {method === 'bank' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank *</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select bank</option>
                    {bankProviders.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Reference (cheque/deposit no.)</label>
                  <Input
                    className="mt-1"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="optional"
                  />
                </div>
              </>
            )}

            {method === 'card' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Card Reference</label>
                <Input
                  className="mt-1"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="optional"
                />
              </div>
            )}

            {isCustomMethod && (
              <div>
                <label className="text-sm font-medium text-gray-700">Reference</label>
                <Input
                  className="mt-1"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="optional"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">Amount *</label>
              <Input
                className="mt-1"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter prepayment amount"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Note (optional)</label>
              <Input
                className="mt-1"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Customer prepayment"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={takeDeposit}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Record Deposit'}
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
