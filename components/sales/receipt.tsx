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
  returns,
  totalReturned,
  isPartiallyReturned,
  isFullyReturned,
  customerBalance,
  creditCleared,
  cashPaid,
  debtCreated,
  payments,
  termsEnabled,
  termsText,
  branchName,
}, ref) => {
  const receiptRef = useRef<HTMLDivElement>(null)

  const isRental = receiptType === 'rental_slip' || receiptType === 'rental_return'
  const isSlip = receiptType === 'rental_slip'

  // Build @page CSS based on paper size
  const pageCSS = paperSize === '80mm'
    ? `@page { size: 80mm auto; margin: 4mm; }`
    : `@page { size: 58mm auto; margin: 3mm; }`

  // Body width matches paper
  const bodyWidth  = paperSize === '80mm' ? '72mm' : '52mm'
  const baseFontSize = '10px'

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${isSlip ? 'Rental Slip' : 'Receipt'} - ${receiptNumber}</title>
              <style>
                @media print {
                  ${pageCSS}
                  body { margin: 0; padding: 0; }
                }
                body {
                  font-family: Arial, sans-serif;
                  max-width: ${bodyWidth};
                  margin: 0 auto;
                  padding: 4px;
                  font-size: ${baseFontSize};
                  line-height: 1.4;
                }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
                .logo { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin: 0 auto 8px; display: block; }
                .company-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
                .company-details { font-size: 11px; line-height: 1.4; }
                .doc-type { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 8px 0 0; letter-spacing: 1px; }
                .order-info { margin: 15px 0; font-size: 11px; }
                .order-info div { margin: 3px 0; }
                .customer-info { margin: 10px 0; padding: 8px; background: #f5f5f5; border-radius: 4px; font-size: 11px; }
                .customer-info div { margin: 2px 0; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background-color: #f5f5f5; padding: 8px; text-align: left; border-bottom: 2px solid #000; font-size: 11px; font-weight: bold; }
                td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .totals { margin-top: 20px; text-align: right; }
                .totals-row { display: flex; justify-content: flex-end; margin: 5px 0; font-size: 12px; }
                .totals-label { width: 150px; text-align: right; padding-right: 20px; }
                .totals-value { width: 120px; text-align: right; font-weight: bold; }
                .total-final { font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
                .payment-info { margin: 20px 0; padding: 10px; background-color: #f9f9f9; border: 1px solid #ddd; }
                .payment-info div { margin: 3px 0; font-size: 11px; }
                .pending-notice { margin: 15px 0; padding: 10px; background: #fff8e1; border: 1px solid #f0c040; border-radius: 4px; text-align: center; font-size: 11px; font-weight: bold; }
                .return-notice { margin: 15px 0; padding: 10px; background: #fee; border: 1px solid #faa; border-radius: 4px; text-align: center; font-size: 11px; font-weight: bold; color: #c00; }
                .returned-item { text-decoration: line-through; color: #999; }
                .returned-badge { display: inline-block; background: #fee; color: #c00; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 6px; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; font-size: 11px; border-top: 1px dashed #000; padding-top: 15px; }
                .served-by { margin: 10px 0 5px; text-align: center; font-size: 11px; font-style: italic; }
                .terms { margin: 8px 0; font-size: 10px; color: #444; text-align: left; white-space: pre-wrap; border-top: 1px dashed #ccc; padding-top: 6px; }
              </style>
            </head>
            <body>${receiptRef.current.innerHTML}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        
        // Auto-close window after printing
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
    // If it's a custom method, use the custom name
    if (payment.method === 'custom' && payment.customMethodName) {
      return payment.customMethodName
    }
    
    // Handle M-Pesa types
    if (payment.method === 'mpesa_stk') return 'M-Pesa STK'
    if (payment.method === 'mpesa_manual') return 'M-Pesa Manual'
    
    const names: Record<string, string> = {
      'cash': 'Cash',
      'mobile_money': 'M-Pesa',
      'card': 'Card',
      'credit': 'Credit',
      'bank': 'Bank Transfer',
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

  return (
    <div ref={receiptRef} style={{ display: 'none' }}>
      {/* Header */}
      <div className="header">
        {shopLogo && (
          <img src={resolveMediaUrl(shopLogo)} alt={shopName} className="logo" />
        )}
        <div className="company-name">{shopName}</div>
        {branchName && (
          <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '2px', marginBottom: '2px' }}>{branchName}</div>
        )}
        <div className="company-details">
          {shopPhone && <div>Phone: {shopPhone}</div>}
          {shopEmail && <div>Email: {shopEmail}</div>}
          {shopAddress && <div>Address: {shopAddress}</div>}
        </div>
        <div className="doc-type">
          {isSlip ? 'Rental Slip' : isRental ? 'Rental Receipt' : 'Sales Receipt'}
        </div>
      </div>

      {/* Order / Rental info */}
      <div className="order-info">
        <div><strong>{isRental ? 'Rental ID:' : 'Order Number:'}</strong> {receiptNumber}</div>
        <div><strong>Date:</strong> {date.toLocaleDateString('en-GB')}</div>
        <div><strong>Time:</strong> {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
        {rentalDuration && <div><strong>Duration:</strong> {rentalDuration}</div>}
      </div>

      {/* Customer info — show for all sale types */}
      {customerName ? (
        <div className="customer-info">
          <div><strong>Customer:</strong> {customerName}</div>
          {customerPhone && <div><strong>Phone:</strong> {customerPhone}</div>}
          {customerIdNo && <div><strong>ID:</strong> {customerIdNo}</div>}
          {customerBalance != null && customerBalance > 0 && !creditCleared && (
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ddd', color: '#92400e', fontWeight: 'bold' }}>
              Outstanding Balance: KES {customerBalance.toFixed(2)}
            </div>
          )}
          {customerBalance != null && customerBalance < 0 && (
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ddd', color: '#0c2d6b', fontWeight: 'bold' }}>
              Credit Available: KES {Math.abs(customerBalance).toFixed(2)}
            </div>
          )}
        </div>
      ) : !isRental && (
        <div className="customer-info">
          <div><strong>Customer:</strong> Cash Sale</div>
        </div>
      )}

      {/* Items table */}
      <table>
        <thead>
          <tr>
            <th>QTY</th>
            <th>Description</th>
            <th className="text-right">{isRental ? 'Rate' : 'KES'}</th>
            {!isSlip && <th className="text-right">Total</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const hasReturns = item.quantityReturned && item.quantityReturned > 0
            const allReturned = item.quantityReturned === item.quantity
            
            return (
              <tr key={index} className={allReturned ? 'returned-item' : ''}>
                <td className="text-center">
                  {item.quantity}
                  {hasReturns && (
                    <span className="returned-badge">
                      -{item.quantityReturned} RTN
                    </span>
                  )}
                </td>
                <td>
                  {item.productName}
                  {(item.brand || item.model || item.variant) && (
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      {[item.brand, item.model, item.variant].filter(Boolean).join(' - ')}
                    </div>
                  )}
                  {hasReturns && (
                    <div style={{ fontSize: '9px', color: '#c00', marginTop: '2px' }}>
                      {item.returnCondition === 'damaged' ? '⚠ Damaged' : '✓ Restocked'}
                    </div>
                  )}
                </td>
                <td className="text-right">
                  {item.price.toFixed(2)}{isRental ? rateLabel(item.rateType) : ''}
                </td>
                {!isSlip && <td className="text-right">{item.total.toFixed(2)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Return notice */}
      {(isPartiallyReturned || isFullyReturned) && (
        <div className="return-notice">
          {isFullyReturned ? 'FULLY REFUNDED' : 'PARTIALLY REFUNDED'}
        </div>
      )}

      <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '11px' }}>
        <strong>{items.length} Item{items.length !== 1 ? 's' : ''}</strong>
      </div>

      {/* Totals — only for non-slip */}
      {!isSlip && (
        <div className="totals">
          <div className="totals-row">
            <div className="totals-label">Sub Total</div>
            <div className="totals-value">{subtotal.toFixed(2)}</div>
          </div>
          {discount > 0 && (
            <div className="totals-row">
              <div className="totals-label">Discount</div>
              <div className="totals-value">- {discount.toFixed(2)}</div>
            </div>
          )}
          {totalReturned != null && totalReturned > 0 && (
            <div className="totals-row">
              <div className="totals-label">Amount Refunded</div>
              <div className="totals-value" style={{ color: '#c00' }}>- {totalReturned.toFixed(2)}</div>
            </div>
          )}
          {deposit != null && deposit > 0 && (
            <div className="totals-row">
              <div className="totals-label">Deposit Paid</div>
              <div className="totals-value">- {deposit.toFixed(2)}</div>
            </div>
          )}
          <div className="totals-row total-final">
            <div className="totals-label">TOTAL</div>
            <div className="totals-value">{total.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Deposit info on slip */}
      {isSlip && deposit != null && deposit > 0 && (
        <div className="payment-info">
          <div><strong>Deposit Paid:</strong> KES {deposit.toFixed(2)}</div>
          {depositPaymentMethod && (
            <div>Method: {depositPaymentMethod === 'mobile_money' ? 'M-Pesa' : depositPaymentMethod}</div>
          )}
        </div>
      )}

      {/* Pending notice on slip */}
      {isSlip && (
        <div className="pending-notice">
          Amount due on return — based on actual duration
        </div>
      )}

      {/* Payment info — non-slip */}
      {!isSlip && (
        <div className="payment-info">
          <div><strong>Payment</strong></div>
          
          {/* Show consolidated payment methods if available */}
          {payments && payments.length > 0 ? (
            <>
              {Object.entries(consolidatePayments(payments)).map(([key, payment]) => (
                <div key={key}>
                  <div>{getPaymentMethodName(payment)}:</div>
                  <div>KES {payment.amount.toFixed(2)}</div>
                </div>
              ))}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                <div style={{ marginBottom: '4px' }}>
                  <span>Total Paid:</span>
                  <span style={{ float: 'right', fontWeight: 'bold' }}>{payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</span>
                </div>
                {payments.reduce((sum, p) => sum + p.amount, 0) > total && (
                  <div style={{ marginBottom: '4px' }}>
                    <span>Change:</span>
                    <span style={{ float: 'right', fontWeight: 'bold', color: '#16a34a' }}>{(payments.reduce((sum, p) => sum + p.amount, 0) - total).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ccc' }}>
                  <span style={{ fontWeight: 'bold' }}>Sale Total:</span>
                  <span style={{ float: 'right', fontWeight: 'bold' }}>{total.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>Method: {paymentMethod === 'mobile_money' ? 'M-Pesa' : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</div>
              {/* Show payment breakdown if debt was created */}
              {debtCreated && debtCreated > 0 ? (
                <>
                  <div>Cash Received: {cashPaid?.toFixed(2) || '0.00'}</div>
                  <div>Amount on Account: {debtCreated.toFixed(2)}</div>
                  <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ccc' }}>
                    <strong>Total: {total.toFixed(2)}</strong>
                  </div>
                </>
              ) : (
                <div>Amount: {total.toFixed(2)}</div>
              )}
            </>
          )}
        </div>
      )}


      {!isSlip && paymentMethod === 'mobile_money' && mpesaPaybill && (
        <div style={{ margin: '15px 0', fontSize: '11px' }}>
          <div><strong>M-PESA</strong></div>
          <div>PAYBILL: {mpesaPaybill}</div>
          {mpesaAccountNumber && <div>AC/NO: {mpesaAccountNumber}</div>}
        </div>
      )}

      <div className="footer">
        {creditCleared && (
          <div style={{ backgroundColor: '#dcfce7', padding: '8px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#166534' }}>
            ✓ CREDIT CLEARED
          </div>
        )}
        {debtCreated && debtCreated > 0 && (
          <div style={{ backgroundColor: '#fef08a', padding: '8px', borderRadius: '4px', marginBottom: '10px', textAlign: 'center', fontSize: '11px', color: '#78350f' }}>
            KES {debtCreated.toFixed(2)} added to your account balance
          </div>
        )}
        {/* Custom message */}
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          {receiptType === 'rental_slip' ? 'Thank you! Please keep this slip.' : 'Thank You For Shopping With Us!'}
        </div>
        {/* Terms */}
        {termsEnabled && termsText && (
          <div className="terms">{termsText}</div>
        )}
        {/* Served by */}
        <div className="served-by">Served By: {cashierName}</div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
          Powered by Chambu Digital
        </div>
      </div>
    </div>
  )
})

Receipt.displayName = 'Receipt'
