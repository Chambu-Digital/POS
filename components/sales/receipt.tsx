'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'
import { resolveMediaUrl } from '@/lib/media-url'

interface ReceiptItem {
  productName: string
  brand?: string
  model?: string
  variant?: string
  quantity: number
  price: number        // unit selling price (sales) OR rental rate (rentals)
  discount: number     // 0 for rentals
  total: number
  rateType?: string    // e.g. 'hourly', 'daily' — rentals only
  // Return tracking
  quantityReturned?: number
  returnCondition?: 'resellable' | 'damaged'
}

interface ReturnEntry {
  productName: string
  quantity: number
  price: number
  condition: 'resellable' | 'damaged'
  reason: string
  returnedAt: string
}

interface PaymentEntry {
  method: string
  amount: number
  mpesaPhone?: string
  mpesaCode?: string
  customMethodName?: string
  mpesaType?: string
  timestamp?: Date
}

interface ReceiptProps {
  shopName: string
  shopLogo?: string
  cashierName: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  date: Date
  receiptNumber: string
  // Contact / payment details
  branchName?: string
  shopPhone?: string
  shopEmail?: string
  shopAddress?: string
  mpesaPaybill?: string
  mpesaAccountNumber?: string
  // Rental-specific
  receiptType?: 'sale' | 'rental_slip' | 'rental_return'
  customerName?: string
  customerPhone?: string
  customerIdNo?: string
  rentalDuration?: string
  deposit?: number
  depositPaymentMethod?: string
  paperSize?: '58mm' | '80mm'
  onPrintComplete?: () => void
  // Return tracking
  returns?: ReturnEntry[]
  totalReturned?: number
  isPartiallyReturned?: boolean
  isFullyReturned?: boolean
  // Customer credit/debt balance
  customerBalance?: number  // remaining balance (positive=owed, negative=credit)
  creditCleared?: boolean   // whether previous debt was paid off
  // Payment breakdown
  cashPaid?: number         // actual cash received
  debtCreated?: number      // amount added to customer account
  depositBalance?: number   // remaining store credit AFTER this sale
  depositDrawn?: number     // store credit used by this sale (internal transfer)
  // Multi-payment support
  payments?: PaymentEntry[] // array of payment methods used
  // Terms / after-sale message
  termsEnabled?: boolean
  termsText?: string
}
export interface ReceiptRef {
  print: () => void
}

export const Receipt = forwardRef<ReceiptRef, ReceiptProps>(({
  shopName,
  shopLogo,
  cashierName,
  items,
  subtotal,
  discount,
  total,
  paymentMethod,
  date,
  receiptNumber,
  shopPhone,
  shopEmail,
  shopAddress,
  mpesaPaybill,
  mpesaAccountNumber,
  receiptType = 'sale',
  customerName,
  customerPhone,
  customerIdNo,
  rentalDuration,
  deposit,
  depositPaymentMethod,
  paperSize = '58mm',
  onPrintComplete,
  totalReturned,
  isPartiallyReturned,
  isFullyReturned,
  customerBalance,
  creditCleared,
  cashPaid,
  debtCreated,
  depositBalance,
  depositDrawn,
  payments,
  termsEnabled,
  termsText,
  branchName,
}, ref) => {
  const receiptRef = useRef<HTMLDivElement>(null)

  const isRental = receiptType === 'rental_slip' || receiptType === 'rental_return'
  const isSlip = receiptType === 'rental_slip'

  // Paper sizing — narrower paper gets a slightly smaller base font.
  const pageCSS = paperSize === '80mm'
    ? `@page { size: 80mm auto; margin: 4mm; }`
    : `@page { size: 58mm auto; margin: 3mm; }`
  const bodyWidth  = paperSize === '80mm' ? '72mm' : '52mm'
  const baseFont = paperSize === '80mm' ? '11px' : '10px'

  // ── Print styles: deposit-receipt design language ───────────────────────────
  // Key|value rows (label left / value right), dashed dividers between sections,
  // small type, no background boxes, bold TOTAL under a heavier divider.
  const styles = `
    @media print { ${pageCSS} body { margin: 0; padding: 0; } }
    body { font-family: Arial, Helvetica, sans-serif; max-width: ${bodyWidth}; margin: 0 auto; padding: 4px; font-size: ${baseFont}; line-height: 1.4; color: #111; }
    .header { text-align: center; border-bottom: 1px dashed #999; padding-bottom: 6px; margin-bottom: 6px; }
    .logo { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; margin: 0 auto 4px; display: block; }
    .company-name { font-size: 13px; font-weight: bold; }
    .branch { font-size: 11px; font-weight: normal; margin: 1px 0; }
    .company-details { font-size: 10px; color: #555; line-height: 1.3; }
    .doc-type { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-top: 5px; }
    .section { border-top: 1px dashed #bbb; padding-top: 5px; margin-top: 6px; }
    .kv { display: flex; justify-content: space-between; margin: 1px 0; }
    .kv .lbl { color: #666; }
    .kv .val { font-weight: 600; }
    .meta { font-size: 10px; color: #555; }
    .item { margin: 4px 0; }
    .item-name { font-weight: 600; }
    .item-total-row { text-align: right; font-weight: 600; margin-top: 2px; }
    .item-meta { font-size: 9px; color: #777; margin-top: 1px; }
    .item-sub { font-size: 9px; color: #777; }
    .returned-item { text-decoration: line-through; color: #999; }
    .returned-badge { display: inline-block; background: #fee; color: #c00; padding: 1px 4px; border-radius: 2px; font-size: 8px; font-weight: bold; margin-left: 4px; }
    .return-note { font-size: 8px; color: #c00; margin-top: 1px; }
    .totals .total-final { border-top: 2px solid #333; padding-top: 3px; margin-top: 4px; font-size: 12px; }
    .totals .total-final .val { font-size: 12px; }
    .notice { margin: 6px 0; padding: 5px 6px; text-align: center; font-size: 9px; font-weight: bold; border-radius: 3px; }
    .notice-warn { background: #fff8e1; border: 1px dashed #f0c040; color: #78350f; }
    .notice-return { background: #fee; border: 1px dashed #faa; color: #c00; }
    .notice-credit { background: #dcfce7; border: 1px dashed #86efac; color: #166534; }
    .notice-debt { background: #fef08a; border: 1px dashed #facc15; color: #78350f; }
    .mpesa { font-size: 10px; margin: 6px 0; }
    .mpesa .lbl { color: #666; }
    .footer { border-top: 1px dashed #999; padding-top: 6px; margin-top: 8px; text-align: center; }
    .thank-you { font-weight: bold; font-size: 10px; margin-bottom: 3px; }
    .served-by { font-style: italic; font-size: 10px; margin: 3px 0; }
    .terms { font-size: 9px; color: #444; text-align: left; white-space: pre-wrap; border-top: 1px dashed #ccc; padding-top: 4px; margin-top: 4px; }
    .powered { font-size: 9px; color: #888; margin-top: 6px; }
    .balance-line { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ddd; font-weight: bold; }
  `

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${isSlip ? 'Rental Slip' : 'Receipt'} - ${receiptNumber}</title>
              <style>${styles}</style>
            </head>
            <body>${receiptRef.current.innerHTML}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        printWindow.onafterprint = () => printWindow.close()
        setTimeout(() => { printWindow.print() }, 250)
        if (onPrintComplete) onPrintComplete()
      }
    }
  }

  useImperativeHandle(ref, () => ({ print: handlePrint }))

  const rateLabel = (rateType?: string) => {
    if (!rateType) return ''
    return { per_minute: '/min', hourly: '/hr', daily: '/day', weekly: '/wk' }[rateType] || `/${rateType}`
  }

  const getPaymentMethodName = (payment: PaymentEntry): string => {
    if (payment.method === 'custom' && payment.customMethodName) return payment.customMethodName
    if (payment.method === 'mpesa_stk') return 'M-Pesa STK'
    if (payment.method === 'mpesa_manual') return 'M-Pesa Manual'
    const names: Record<string, string> = {
      'cash': 'Cash',
      'mobile_money': 'M-Pesa',
      'card': 'Card',
      'credit': 'Credit',
      'bank': 'Bank Transfer',
      'deposit': 'Store Credit',
    }
    return names[payment.method] || payment.method.charAt(0).toUpperCase() + payment.method.slice(1)
  }

  const consolidatePayments = (paymentList: PaymentEntry[] | undefined) => {
    if (!paymentList || paymentList.length === 0) return {}
    const consolidated: Record<string, PaymentEntry> = {}
    paymentList.forEach(payment => {
      const key = payment.method === 'custom' && payment.customMethodName
        ? payment.customMethodName
        : payment.method
      if (consolidated[key]) {
        consolidated[key].amount += payment.amount
      } else {
        consolidated[key] = { ...payment }
      }
    })
    return consolidated
  }

  const money = (n: number) => n.toFixed(2)

  return (
    <div ref={receiptRef} style={{ display: 'none' }}>
      {/* Header — centered, dashed bottom divider */}
      <div className="header">
        {shopLogo && (
          <img src={resolveMediaUrl(shopLogo)} alt={shopName} className="logo" />
        )}
        <div className="company-name">{shopName}</div>
        {branchName && <div className="branch">{branchName}</div>}
        <div className="company-details">
          {shopPhone && <div>{shopPhone}</div>}
          {shopEmail && <div>{shopEmail}</div>}
          {shopAddress && <div>{shopAddress}</div>}
        </div>
        <div className="doc-type">
          {isSlip ? 'Rental Slip' : isRental ? 'Rental Receipt' : 'Sales Receipt'}
        </div>
      </div>

      {/* Order / Rental info — key|value rows */}
      <div className="section">
        <div className="kv"><span className="lbl">{isRental ? 'Rental ID' : 'Order No.'}</span><span className="val">{receiptNumber}</span></div>
        <div className="kv"><span className="lbl">Date</span><span className="val">{date.toLocaleDateString('en-GB')}</span></div>
        <div className="kv"><span className="lbl">Time</span><span className="val">{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>
        {rentalDuration && <div className="kv"><span className="lbl">Duration</span><span className="val">{rentalDuration}</span></div>}
      </div>

      {/* Customer info — key|value rows */}
      {customerName ? (
        <div className="section">
          <div className="kv"><span className="lbl">Customer</span><span className="val">{customerName}</span></div>
          {customerPhone && <div className="kv"><span className="lbl">Phone</span><span className="val">{customerPhone}</span></div>}
          {customerIdNo && <div className="kv"><span className="lbl">ID</span><span className="val">{customerIdNo}</span></div>}
          {customerBalance != null && customerBalance > 0 && !creditCleared && (
            <div className="balance-line" style={{ color: '#92400e' }}>
              Outstanding: KES {money(customerBalance)}
            </div>
          )}
          {customerBalance != null && customerBalance < 0 && (
            <div className="balance-line" style={{ color: '#0c2d6b' }}>
              Credit Available: KES {money(Math.abs(customerBalance))}
            </div>
          )}
        </div>
      ) : !isRental && (
        <div className="section">
          <div className="kv"><span className="lbl">Customer</span><span className="val">Cash Sale</span></div>
        </div>
      )}

      {/* Items — stacked rows: name + total, qty×price meta below */}
      <div className="section">
        {items.map((item, index) => {
          const hasReturns = item.quantityReturned && item.quantityReturned > 0
          const allReturned = item.quantityReturned === item.quantity
          return (
            <div key={index} className="item">
              {/* Product name (full width, may wrap) */}
              <div className={`item-name ${allReturned ? 'returned-item' : ''}`}>
                {item.productName}
                {hasReturns && <span className="returned-badge">-{item.quantityReturned} RTN</span>}
              </div>
              {/* brand / model / variant sub-line — part of the description, sits under the name */}
              {(item.brand || item.model || item.variant) && (
                <div className="item-sub">{[item.brand, item.model, item.variant].filter(Boolean).join(' - ')}</div>
              )}
              {/* qty × unit price / rate */}
              <div className="item-meta">
                {item.quantity} × {money(item.price)}{isRental ? rateLabel(item.rateType) : ''}
              </div>
              {/* return condition note */}
              {hasReturns && (
                <div className="return-note">{item.returnCondition === 'damaged' ? '⚠ Damaged' : '✓ Restocked'}</div>
              )}
              {/* Line total — printed LAST, after every detail, right-aligned */}
              {!isSlip && (
                <div className={`item-total-row ${allReturned ? 'returned-item' : ''}`}>{money(item.total)}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Return notice */}
      {(isPartiallyReturned || isFullyReturned) && (
        <div className={`notice notice-return`}>
          {isFullyReturned ? 'FULLY REFUNDED' : 'PARTIALLY REFUNDED'}
        </div>
      )}

      {/* Totals — key|value rows, bold TOTAL under heavier divider (non-slip) */}
      {!isSlip && (
        <div className="section totals">
          <div className="kv"><span className="lbl">Sub Total</span><span className="val">{money(subtotal)}</span></div>
          {discount > 0 && (
            <div className="kv"><span className="lbl">Discount</span><span className="val" style={{ color: '#c00' }}>- {money(discount)}</span></div>
          )}
          {totalReturned != null && totalReturned > 0 && (
            <div className="kv"><span className="lbl">Amount Refunded</span><span className="val" style={{ color: '#c00' }}>- {money(totalReturned)}</span></div>
          )}
          {deposit != null && deposit > 0 && (
            <div className="kv"><span className="lbl">Deposit Paid</span><span className="val">- {money(deposit)}</span></div>
          )}
          <div className="kv total-final"><span className="lbl">TOTAL</span><span className="val">{money(total)}</span></div>
        </div>
      )}

      {/* Deposit info on slip */}
      {isSlip && deposit != null && deposit > 0 && (
        <div className="section">
          <div className="kv"><span className="lbl">Deposit Paid</span><span className="val">KES {money(deposit)}</span></div>
          {depositPaymentMethod && (
            <div className="kv"><span className="lbl">Method</span><span className="val">{depositPaymentMethod === 'mobile_money' ? 'M-Pesa' : depositPaymentMethod}</span></div>
          )}
        </div>
      )}

      {/* Pending notice on slip */}
      {isSlip && (
        <div className="notice notice-warn">Amount due on return — based on actual duration</div>
      )}

      {/* Payment — key|value rows (non-slip) */}
      {!isSlip && (
        <div className="section payment">
          {payments && payments.length > 0 ? (
            <>
              {Object.entries(consolidatePayments(payments)).map(([key, payment]) => (
                <div key={key} className="kv">
                  <span className="lbl">{getPaymentMethodName(payment)}</span>
                  <span className="val">{money(payment.amount)}</span>
                </div>
              ))}
              <div className="balance-line">
                <div className="kv"><span className="lbl">Total Paid</span><span className="val">{money(payments.reduce((s, p) => s + p.amount, 0))}</span></div>
                {payments.reduce((s, p) => s + p.amount, 0) > total && (
                  <div className="kv"><span className="lbl">Change</span><span className="val" style={{ color: '#16a34a' }}>{money(payments.reduce((s, p) => s + p.amount, 0) - total)}</span></div>
                )}
                <div className="kv"><span className="lbl">Sale Total</span><span className="val">{money(total)}</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="kv"><span className="lbl">Method</span><span className="val">{paymentMethod === 'mobile_money' ? 'M-Pesa' : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</span></div>
              {debtCreated && debtCreated > 0 ? (
                <>
                  <div className="kv"><span className="lbl">Cash Received</span><span className="val">{cashPaid != null ? money(cashPaid) : '0.00'}</span></div>
                  <div className="kv"><span className="lbl">On Account</span><span className="val">{money(debtCreated)}</span></div>
                  <div className="balance-line kv"><span className="lbl">Total</span><span className="val">{money(total)}</span></div>
                </>
              ) : (
                <div className="kv"><span className="lbl">Amount</span><span className="val">{money(total)}</span></div>
              )}
            </>
          )}
        </div>
      )}

      {/* M-Pesa paybill (non-slip, mobile_money) */}
      {!isSlip && paymentMethod === 'mobile_money' && mpesaPaybill && (
        <div className="section mpesa">
          <div className="kv"><span className="lbl">M-PESA Paybill</span><span className="val">{mpesaPaybill}</span></div>
          {mpesaAccountNumber && <div className="kv"><span className="lbl">Account No.</span><span className="val">{mpesaAccountNumber}</span></div>}
        </div>
      )}

      {/* Balance position — before → change → after (only when a balance moved this sale) */}
      {!isSlip && depositDrawn != null && depositDrawn > 0 && depositBalance != null && (
        <div className="section">
          <div className="kv"><span className="lbl">Previous Store Credit</span><span className="val">{money(depositBalance + depositDrawn)}</span></div>
          <div className="kv"><span className="lbl">Store Credit Used</span><span className="val" style={{ color: '#c00' }}>- {money(depositDrawn)}</span></div>
          <div className="kv" style={{ fontWeight: 'bold' }}><span className="lbl">Store Credit Balance</span><span className="val" style={{ color: '#0c2d6b' }}>{money(depositBalance)}</span></div>
        </div>
      )}
      {!isSlip && debtCreated != null && debtCreated > 0 && customerBalance != null && customerBalance > 0 && (
        <div className="section">
          <div className="kv"><span className="lbl">Previous Balance</span><span className="val">{money(Math.max(0, customerBalance - debtCreated))}</span></div>
          <div className="kv"><span className="lbl">Added to Account</span><span className="val" style={{ color: '#92400e' }}>+ {money(debtCreated)}</span></div>
          <div className="kv" style={{ fontWeight: 'bold' }}><span className="lbl">Outstanding</span><span className="val" style={{ color: '#92400e' }}>{money(customerBalance)}</span></div>
        </div>
      )}

      {/* Footer — centered, dashed top divider */}
      <div className="footer">
        {creditCleared && (
          <div className="notice notice-credit" style={{ marginBottom: '6px' }}>✓ CREDIT CLEARED</div>
        )}
        {debtCreated && debtCreated > 0 && (
          <div className="notice notice-debt" style={{ marginBottom: '6px' }}>
            KES {money(debtCreated)} added to your account balance
          </div>
        )}
        <div className="thank-you">
          {receiptType === 'rental_slip' ? 'Thank you! Please keep this slip.' : 'Thank You For Shopping With Us!'}
        </div>
        {termsEnabled && termsText && <div className="terms">{termsText}</div>}
        <div className="served-by">Served By: {cashierName}</div>
        <div className="powered">Powered by Chambu Digital</div>
      </div>
    </div>
  )
})

Receipt.displayName = 'Receipt'
