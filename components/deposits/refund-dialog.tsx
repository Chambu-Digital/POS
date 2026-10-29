'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

// ── Refund a customer deposit ─────────────────────────────────────────────────
// Returns prepayment money to the customer (real cash OUTFLOW by method).
// Defaults to the deposit's original method (no approval needed). Refunding via
// a DIFFERENT method requires approval + a reason — the API enforces this and
// the UI surfaces an "approval required" notice.

export interface RefundDeposit {
  _id: string
  receiptNo: string
  balance: number
  method: string // original method: cash | card | mobile_money | bank | custom
  bankProviderName?: string
  customMethodName?: string
  customerName: string
  customerPhone?: string
}

// Human-readable label for a deposit's original method
function methodLabel(d: RefundDeposit): string {
  if (d.method === 'cash') return 'Cash'
  if (d.method === 'mobile_money') return 'M-Pesa / Mobile Money'
  if (d.method === 'card') return 'Card'
  if (d.method === 'bank') return d.bankProviderName || 'Bank Transfer'
  if (d.method === 'custom') return d.customMethodName || 'Custom Method'
  return d.method
}

export function RefundDialog({
  deposit,
  open,
  onOpenChange,
  bankProviders,
  customMethods,
  onRefunded,
}: {
  deposit: RefundDeposit | null
  open: boolean
  onOpenChange: (v: boolean) => void
  bankProviders: Array<{ _id: string; name: string }>
  customMethods: Array<{ _id: string; name: string }>
  onRefunded?: () => void  // refresh caller's deposit list
}) {
  const [amount, setAmount] = useState('')
  const [useOverride, setUseOverride] = useState(false)
  const [method, setMethod] = useState<string>('') // refund method; '' = original
  const [selectedBankId, setSelectedBankId] = useState('')
  const [selectedCustomMethodId, setSelectedCustomMethodId] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [reason, setReason] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(deposit ? String(deposit.balance) : '')
      setUseOverride(false)
      setMethod('')
      setSelectedBankId('')
      setSelectedCustomMethodId('')
      setPaymentReference('')
      setReason('')
      setApprovedBy('')
    }
  }, [open, deposit?._id])

  if (!deposit) return null

  // The effective refund method: original by default, override when toggled
  const refundMethod = useOverride ? method : deposit.method
  const isCustomOverride = useOverride && method.startsWith('custom:')
  const actualMethod = isCustomOverride ? 'custom' : refundMethod
  const requiresApproval = useOverride && method !== deposit.method

  function resolveRefundMethodLabel(): string {
    if (!useOverride) return `${methodLabel(deposit!)} (original)`
    if (method === 'cash') return 'Cash'
    if (method === 'mobile_money') return 'M-Pesa / Mobile Money'
    if (method === 'card') return 'Card'
    if (method === 'bank') {
      const bp = bankProviders.find((b) => b._id === selectedBankId)
      return bp ? bp.name : 'Bank Transfer'
    }
    if (isCustomOverride) {
      const cm = customMethods.find((m) => m._id === selectedCustomMethodId)
      return cm ? cm.name : 'Custom Method'
    }
    return method
  }

  async function processRefund() {
    if (!deposit) return
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid refund amount')
      return
    }
    if (amt > deposit.balance) {
      toast.error(`Refund cannot exceed remaining balance (KSh ${deposit.balance.toLocaleString()})`)
      return
    }
    if (!reason.trim()) {
      toast.error('A reason is required for refunds')
      return
    }
    if (requiresApproval && !approvedBy.trim()) {
      toast.error('Approver name/ID is required when refunding via a different method')
      return
    }
    if (useOverride && actualMethod === 'bank' && !selectedBankId) {
      toast.error('Select a bank for the override refund')
      return
    }
    if (isCustomOverride && !selectedCustomMethodId) {
      toast.error('Select a custom payment method')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        amount: amt,
        reason: reason.trim(),
      }
      // Send the override method only when toggled; otherwise the API defaults
      // to the deposit's original method.
      if (useOverride) {
        payload.method = actualMethod
        if (actualMethod === 'bank' && selectedBankId) {
          payload.bankProviderId = selectedBankId
          const bp = bankProviders.find((b) => b._id === selectedBankId)
          if (bp) payload.bankProviderName = bp.name
        }
        if (actualMethod === 'custom' && selectedCustomMethodId) {
          payload.customMethodId = selectedCustomMethodId
          const cm = customMethods.find((m) => m._id === selectedCustomMethodId)
          if (cm) payload.customMethodName = cm.name
        }
        payload.paymentReference = paymentReference
        // Approval audit (the API requires approvedBy for an override)
        payload.approvedBy = approvedBy.trim() || undefined
      } else {
        payload.paymentReference = paymentReference
      }

      const res = await fetch(`/api/deposits/${deposit._id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to process refund')
        setSaving(false)
        return
      }

      toast.success(`Refunded KSh ${amt.toLocaleString()} from ${deposit.receiptNo}`)
      onRefunded?.()
      onOpenChange(false)
    } catch {
      toast.error('Failed to process refund')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Refund Deposit — {deposit.receiptNo}</DialogTitle>
        <div className="space-y-3 mt-2">
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm">
            <p className="font-semibold text-teal-800">{deposit.customerName}</p>
            <p className="text-teal-700 mt-0.5">
              Remaining balance: KSh {deposit.balance.toLocaleString()}
            </p>
            <p className="text-xs text-teal-600 mt-0.5">
              Original method: {methodLabel(deposit)}
            </p>
          </div>

          {/* Refund method: original vs override */}
          <div>
            <label className="text-sm font-medium text-gray-700">Refund Method</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => { setUseOverride(false); setMethod(''); setSelectedBankId(''); setSelectedCustomMethodId('') }}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                  !useOverride ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {methodLabel(deposit)} (original)
              </button>
              <button
                type="button"
                onClick={() => setUseOverride(true)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                  useOverride ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                Different method
              </button>
            </div>
          </div>

          {/* Override method picker */}
          {useOverride && (
            <>
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
                ⚠️ Refunding via a different method shifts the cash outflow to a
                different bank/cash total. Approval is required.
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Override Method *</label>
                <select
                  value={method}
                  onChange={(e) => {
                    const v = e.target.value
                    setMethod(v)
                    setSelectedBankId('')
                    setSelectedCustomMethodId('')
                    if (v.startsWith('custom:')) setSelectedCustomMethodId(v.split(':')[1])
                  }}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="mobile_money">M-Pesa / Mobile Money</option>
                  <option value="card">Card</option>
                  {bankProviders.length > 0 && <option value="bank">Bank Transfer</option>}
                  {customMethods.map((m) => (
                    <option key={m._id} value={`custom:${m._id}`}>{m.name}</option>
                  ))}
                </select>
              </div>

              {method === 'bank' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank *</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select bank</option>
                    {bankProviders.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {isCustomOverride && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Custom Method</label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {customMethods.find((m) => m._id === selectedCustomMethodId)?.name || 'Select above'}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Approver (name/ID) *</label>
                <Input
                  className="mt-1"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  placeholder="Who authorised this override"
                />
              </div>
            </>
          )}

          {/* Reference (mpesa code / cheque no) — optional for either path */}
          <div>
            <label className="text-sm font-medium text-gray-700">Reference (optional)</label>
            <Input
              className="mt-1"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="mpesa code, cheque no, etc."
            />
          </div>

          {/* Refund amount — defaults to full remaining balance */}
          <div>
            <label className="text-sm font-medium text-gray-700">Amount to Refund *</label>
            <Input
              className="mt-1"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to KSh ${deposit.balance.toLocaleString()}`}
              autoFocus
            />
            {parseFloat(amount) > 0 && parseFloat(amount) < deposit.balance && (
              <p className="text-xs text-gray-500 mt-1">
                Partial refund — remaining store credit: KSh {(deposit.balance - (parseFloat(amount) || 0)).toLocaleString()}
              </p>
            )}
          </div>

          {/* Reason — required */}
          <div>
            <label className="text-sm font-medium text-gray-700">Reason *</label>
            <Input
              className="mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested balance back"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={processRefund}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Processing...' : `Refund ${resolveRefundMethodLabel()}`}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
