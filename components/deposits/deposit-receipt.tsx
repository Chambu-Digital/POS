'use client'

import { useEffect } from 'react'
import { resolveMediaUrl } from '@/lib/media-url'

// ── Printable deposit receipt ────────────────────────────────────────────────
// Distinct from a sale receipt so a prepayment can never be confused for goods
// sold. On screen it's hidden; window.print() + the injected print CSS makes
// only this element visible (same pattern as the end-of-day report page).

export interface DepositReceiptData {
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
  // Shop info — mirrors the sales receipt header (shopName + contact details)
  shopName?: string
  shopLogo?: string
  shopPhone?: string
  shopEmail?: string
  shopAddress?: string
}

const formatCurrency = (n: number) =>
  `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export function DepositReceipt({ deposit }: { deposit: DepositReceiptData }) {
  // Inject print styles once. The scoped id `#printable-deposit-receipt` means
  // only this receipt is visible when printing, regardless of what else is on
  // the page (the dialog, the customer list, etc.).
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-deposit-receipt-print', '')
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #printable-deposit-receipt, #printable-deposit-receipt * { visibility: visible !important; }
        #printable-deposit-receipt {
          // 'fixed' (not 'absolute') anchors to the page regardless of any
          // positioned ancestor — important because this receipt renders inside
          // a fixed-position Dialog overlay.
          position: fixed;
          left: 0;
          top: 0;
          width: 100%;
          padding: 8mm;
        }
        .deposit-receipt-hide-on-print { display: none !important; }
        @page { margin: 6mm; }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div
      id="printable-deposit-receipt"
      // Off-screen on display (NOT display:none — that would remove the node
      // from the render tree and the print CSS couldn't revive it, yielding a
      // blank page). Absolute positioning far off the left edge keeps the node
      // in the DOM and printable; the print CSS below repositions it to 0,0.
      className="absolute left-[-9999px] top-0 w-[80mm] text-[11px] text-gray-900"
      aria-hidden
    >
      {/* Header — shop info + doc type, like the sales receipt */}
      <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
        {deposit.shopLogo && (
          <img src={resolveMediaUrl(deposit.shopLogo)} alt={deposit.shopName || 'Shop'} className="w-12 h-12 rounded-full object-cover mx-auto mb-1" />
        )}
        {deposit.shopName && <p className="font-bold text-[13px]">{deposit.shopName}</p>}
        <div className="text-[10px] text-gray-500 leading-tight">
          {deposit.shopPhone && <p>{deposit.shopPhone}</p>}
          {deposit.shopEmail && <p>{deposit.shopEmail}</p>}
          {deposit.shopAddress && <p>{deposit.shopAddress}</p>}
        </div>
        <p className="font-bold text-sm tracking-wide mt-1.5">DEPOSIT RECEIPT</p>
        <p className="text-[10px] text-gray-500 mt-0.5">Customer Prepayment — Store Credit</p>
      </div>

      {/* Receipt meta */}
      <div className="space-y-0.5 mb-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Receipt No.</span>
          <span className="font-semibold">{deposit.receiptNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Date</span>
          <span>{formatDate(deposit.createdAt)} {formatTime(deposit.createdAt)}</span>
        </div>
      </div>

      {/* Customer */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2 space-y-0.5">
        <div className="flex justify-between">
          <span className="text-gray-500">Customer</span>
          <span className="font-semibold text-right">{deposit.customerName}</span>
        </div>
        {deposit.customerPhone && (
          <div className="flex justify-between">
            <span className="text-gray-500">Phone</span>
            <span>{deposit.customerPhone}</span>
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2 space-y-0.5">
        <div className="flex justify-between">
          <span className="text-gray-500">Payment Method</span>
          <span className="font-semibold">{deposit.methodLabel}</span>
        </div>
        {deposit.paymentReference && (
          <div className="flex justify-between">
            <span className="text-gray-500">Reference</span>
            <span>{deposit.paymentReference}</span>
          </div>
        )}
        {deposit.mpesaCode && (
          <div className="flex justify-between">
            <span className="text-gray-500">M-Pesa Code</span>
            <span>{deposit.mpesaCode}</span>
          </div>
        )}
      </div>

      {/* Total — bold, like a sale receipt total */}
      <div className="border-t-2 border-gray-700 pt-2 mb-2">
        <div className="flex justify-between items-baseline">
          <span className="font-bold">Amount Received</span>
          <span className="font-bold text-base">{formatCurrency(deposit.amount)}</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-gray-500">Store Credit Balance</span>
          <span className="font-semibold text-teal-700">{formatCurrency(deposit.balance)}</span>
        </div>
      </div>

      {/* Note */}
      {deposit.note && (
        <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
          <span className="text-gray-500">Note: </span>
          <span>{deposit.note}</span>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-dashed border-gray-400 pt-2 text-center text-[9px] text-gray-500">
        <p>This is a prepayment. Goods have NOT been issued.</p>
        <p>Customer may shop against this balance at a later date, in part or in full.</p>
        <p className="mt-1">Refunds of unused balance available on request.</p>
      </div>
    </div>
  )
}
