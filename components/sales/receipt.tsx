'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'

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
}

interface ReceiptProps {
  shopName: string
  cashierName: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  date: Date
  receiptNumber: string
  // Contact / payment details
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
  paperSize?: '58mm' | '80mm' | 'A4'
  onPrintComplete?: () => void
}
export interface ReceiptRef {
  print: () => void
}

export const Receipt = forwardRef<ReceiptRef, ReceiptProps>(({
  shopName,
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
}, ref) => {
  const receiptRef = useRef<HTMLDivElement>(null)

  const isRental = receiptType === 'rental_slip' || receiptType === 'rental_return'
  const isSlip = receiptType === 'rental_slip'

  // Build @page CSS based on paper size
  const pageCSS = paperSize === 'A4'
    ? `@page { size: A4; margin: 20mm; }`
    : paperSize === '80mm'
    ? `@page { size: 80mm auto; margin: 4mm; }`
    : `@page { size: 58mm auto; margin: 3mm; }`

  // Body width matches paper
  const bodyWidth = paperSize === 'A4' ? '800px' : paperSize === '80mm' ? '72mm' : '52mm'
  const baseFontSize = paperSize === 'A4' ? '12px' : '10px'

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
                  padding: ${paperSize === 'A4' ? '20px' : '4px'};
                  font-size: ${baseFontSize};
                  line-height: 1.4;
                }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
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
                .footer { margin-top: 30px; text-align: center; font-size: 11px; border-top: 1px solid #ddd; padding-top: 15px; }
                .served-by { margin: 15px 0; text-align: center; font-size: 11px; font-style: italic; }
              </style>
            </head>
            <body>${receiptRef.current.innerHTML}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
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

  return (
    <div ref={receiptRef} style={{ display: 'none' }}>
      {/* Header */}
      <div className="header">
        <div className="company-name">{shopName}</div>
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

      {/* Customer info — rentals only */}
      {isRental && customerName && (
        <div className="customer-info">
          <div><strong>Customer:</strong> {customerName}</div>
          {customerPhone && <div><strong>Phone:</strong> {customerPhone}</div>}
          {customerIdNo && <div><strong>ID:</strong> {customerIdNo}</div>}
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
          {items.map((item, index) => (
            <tr key={index}>
              <td className="text-center">{item.quantity}</td>
              <td>
                {item.productName}
                {(item.brand || item.model || item.variant) && (
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    {[item.brand, item.model, item.variant].filter(Boolean).join(' - ')}
                  </div>
                )}
              </td>
              <td className="text-right">
                {item.price.toFixed(2)}{isRental ? rateLabel(item.rateType) : ''}
              </td>
              {!isSlip && <td className="text-right">{item.total.toFixed(2)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '11px' }}>
        <strong>{items.length} Item{items.length !== 1 ? 's' : ''}</strong>
      </div>

      {/* T
otals — only for non-slip */}
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
          <div>Method: {paymentMethod === 'mobile_money' ? 'M-Pesa' : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</div>
          <div>Amount: {total.toFixed(2)}</div>
        </div>
      )}

      <div className="served-by">You Were Served By: {cashierName}</div>

      {!isSlip && paymentMethod === 'mobile_money' && mpesaPaybill && (
        <div style={{ margin: '15px 0', fontSize: '11px' }}>
          <div><strong>M-PESA</strong></div>
          <div>PAYBILL: {mpesaPaybill}</div>
          {mpesaAccountNumber && <div>AC/NO: {mpesaAccountNumber}</div>}
        </div>
      )}

      <div className="footer">
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          {isSlip ? 'Thank you! Please keep this slip.' : 'Thank You For Shopping With Us!'}
        </div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
          Powered by Chambu Digital
        </div>
      </div>
    </div>
  )
})

Receipt.displayName = 'Receipt'
