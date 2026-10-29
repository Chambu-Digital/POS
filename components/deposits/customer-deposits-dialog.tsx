'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { RefundDialog, RefundDeposit } from './refund-dialog'

// ── Customer Deposits management dialog ──────────────────────────────────────
// Lists a customer's deposits (all statuses) with their consumption + refund
// history, and exposes a Refund action on active/partial deposits. Opened from
// the customers page when the cashier clicks the "Store Credit" balance row.

interface DepositConsumption {
  _id: string
  saleId: string
  orderNumber: string
  amount: number
  date: string
}
interface DepositRefund {
  _id: string
  amount: number
  method: string
  reason: string
  refundedAt: string
}
interface Deposit {
  _id: string
  receiptNo: string
  amount: number
  balance: number
  status: 'active' | 'partial' | 'used' | 'refunded' | 'void'
  method: string
  bankProviderName?: string
  customMethodName?: string
  mpesaCode?: string
  createdAt: string
  consumptions?: DepositConsumption[]
  refunds?: DepositRefund[]
}

export function CustomerDepositsDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
  bankProviders,
  customMethods,
  onCustomerChanged,
  canRefund = true,
}: {
  customerId: string | null
  customerName: string
  open: boolean
  onOpenChange: (v: boolean) => void
  bankProviders: Array<{ _id: string; name: string }>
  customMethods: Array<{ _id: string; name: string }>
  onCustomerChanged?: () => void  // parent refresh (so depositBalance updates after a refund)
  canRefund?: boolean              // gate the Refund action (pos.deposits.refund)
}) {
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(false)
  const [refundTarget, setRefundTarget] = useState<RefundDeposit | null>(null)
  const [showRefund, setShowRefund] = useState(false)

  const load = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    try {
      // all=true so we show history (used/refunded/void) too, not just active
      const res = await fetch(`/api/customers/${customerId}/deposits?all=true`)
      if (res.ok) {
        const data = await res.json()
        // Oldest first so the most recent activity is at the bottom of the eye
        setDeposits((data.deposits || []).sort((a: Deposit, b: Deposit) => +new Date(a.createdAt) - +new Date(b.createdAt)))
      }
    } catch {
      toast.error('Failed to load deposits')
    }
    setLoading(false)
  }, [customerId])

  useEffect(() => {
    if (open && customerId) load()
  }, [open, customerId, load])

  function openRefund(d: Deposit) {
    setRefundTarget({
      _id: d._id,
      receiptNo: d.receiptNo,
      balance: d.balance,
      method: d.method,
      bankProviderName: d.bankProviderName,
      customMethodName: d.customMethodName,
      customerName,
    })
    setShowRefund(true)
  }

  const totalHeld = deposits
    .filter((d) => ['active', 'partial'].includes(d.status))
    .reduce((s, d) => s + d.balance, 0)

  const fmt = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const statusStyles: Record<Deposit['status'], string> = {
    active: 'bg-teal-100 text-teal-800',
    partial: 'bg-cyan-100 text-cyan-800',
    used: 'bg-gray-100 text-gray-600',
    refunded: 'bg-orange-100 text-orange-700',
    void: 'bg-red-100 text-red-700',
  }

  const methodLabel = (d: Deposit) => {
    if (d.method === 'cash') return 'Cash'
    if (d.method === 'mobile_money') return `M-Pesa${d.mpesaCode ? ` (${d.mpesaCode})` : ''}`
    if (d.method === 'card') return 'Card'
    if (d.method === 'bank') return d.bankProviderName || 'Bank'
    if (d.method === 'custom') return d.customMethodName || 'Custom'
    return d.method
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogTitle>
            <div className="flex items-center justify-between pr-6">
              <span>Deposits — {customerName}</span>
              <button onClick={load} disabled={loading} title="Refresh" className="text-gray-400 hover:text-gray-600">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </DialogTitle>

          <div className="space-y-3 mt-2 max-h-[70vh] overflow-y-auto">
            {totalHeld > 0 && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm">
                <span className="text-teal-700 font-medium">Currently held as store credit: </span>
                <span className="text-teal-800 font-bold">{fmt(totalHeld)}</span>
              </div>
            )}

            {deposits.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                No deposits for this customer yet.
              </div>
            ) : (
              [...deposits].reverse().map((d) => (
                <div key={d._id} className="border border-gray-200 rounded-lg p-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">{d.receiptNo}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusStyles[d.status]}`}>
                          {d.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{fmtDate(d.createdAt)} · {methodLabel(d)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{fmt(d.amount)}</p>
                      <p className="text-xs text-gray-500">balance {fmt(d.balance)}</p>
                    </div>
                  </div>

                  {/* Consumption history */}
                  {d.consumptions && d.consumptions.length > 0 && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <p className="text-[11px] font-medium text-gray-500 mb-1">Used by sales</p>
                      <div className="space-y-0.5">
                        {d.consumptions.map((c) => (
                          <div key={c._id} className="flex items-center justify-between text-xs text-gray-600">
                            <span>Order {c.orderNumber || c.saleId}</span>
                            <span className="text-cyan-700">− {fmt(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Refund history */}
                  {d.refunds && d.refunds.length > 0 && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <p className="text-[11px] font-medium text-gray-500 mb-1">Refunds paid out</p>
                      <div className="space-y-0.5">
                        {d.refunds.map((r) => (
                          <div key={r._id} className="flex items-center justify-between text-xs text-gray-600">
                            <span className="truncate mr-2" title={r.reason}>{r.reason}</span>
                            <span className="text-orange-600 whitespace-nowrap">− {fmt(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Refund action — only for active/partial deposits with a balance, and only if the user may refund */}
                  {canRefund && ['active', 'partial'].includes(d.status) && d.balance > 0 && (
                    <button
                      onClick={() => openRefund(d)}
                      className="w-full mt-2 py-1.5 rounded-lg border border-orange-300 text-orange-700 text-xs font-medium hover:bg-orange-50 transition-colors"
                    >
                      Refund {fmt(d.balance)}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Refund sub-dialog */}
      <RefundDialog
        deposit={refundTarget}
        open={showRefund}
        onOpenChange={setShowRefund}
        bankProviders={bankProviders}
        customMethods={customMethods}
        onRefunded={() => { load(); onCustomerChanged?.() }}
      />
    </>
  )
}
