'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'

interface ReceiptItem {
  productName: string
  brand?: string
  model?: string
  variant?: string
  quantity: number
  price: number
  discount: number
  total: number
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
  onPrintComplete,
}, ref) => {
  const receiptRef = useRef<HTMLDivElement>(null)

  // Don't auto-print, let the user trigger it
  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt - ${receiptNumber}</title>
              <style>
                @media print {
                  @page {
                    size: A4;
                    margin: 20mm;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                  }
                }
                body {
                  font-family: Arial, sans-serif;
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 20px;
                  font-size: 12px;
                  line-height: 1.6;
                }
                .header {
                  text-align: center;
                  margin-bottom: 20px;
                  border-bottom: 2px solid #000;
                  padding-bottom: 15px;
                }
                .company-name {
                  font-size: 18px;
                  font-weight: bold;
                  margin-bottom: 5px;
                }
                .company-details {
                  font-size: 11px;
                  line-height: 1.4;
                }
                .order-info {
                  margin: 15px 0;
                  font-size: 11px;
                }
                .order-info div {
                  margin: 3px 0;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 15px 0;
                }
                th {
                  background-color: #f5f5f5;
                  padding: 8px;
                  text-align: left;
                  border-bottom: 2px solid #000;
                  font-size: 11px;
                  font-weight: bold;
                }
                td {
                  padding: 8px;
                  border-bottom: 1px solid #ddd;
                  font-size: 11px;
                }
                .text-right {
                  text-align: right;
                }
                .text-center {
                  text-align: center;
                }
                .totals {
                  margin-top: 20px;
                  text-align: right;
                }
                .totals-row {
                  display: flex;
                  justify-content: flex-end;
                  margin: 5px 0;
                  font-size: 12px;
                }
                .totals-label {
                  width: 150px;
                  text-align: right;
                  padding-right: 20px;
                }
                .totals-value {
                  width: 120px;
                  text-align: right;
                  font-weight: bold;
                }
                .total-final {
                  font-size: 14px;
                  font-weight: bold;
                  border-top: 2px solid #000;
                  padding-top: 8px;
                  margin-top: 8px;
                }
                .payment-info {
                  margin: 20px 0;
                  padding: 10px;
                  background-color: #f9f9f9;
                  border: 1px solid #ddd;
                }
                .payment-info div {
                  margin: 3px 0;
                  font-size: 11px;
                }
                .footer {
                  margin-top: 30px;
                  text-align: center;
                  font-size: 11px;
                  border-top: 1px solid #ddd;
                  padding-top: 15px;
                }
                .served-by {
                  margin: 15px 0;
                  text-align: center;
                  font-size: 11px;
                  font-style: italic;
                }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        
        // Small delay to ensure content is loaded before printing
        setTimeout(() => {
          printWindow.print()
        }, 250)
        
        if (onPrintComplete) {
          onPrintComplete()
        }
      }
    }
  }

  // Expose print method to parent
  useImperativeHandle(ref, () => ({
    print: handlePrint
  }))

  return (
    <div ref={receiptRef} style={{ display: 'none' }}>
      <div className="header">
        <div className="company-name">{shopName}</div>
        <div className="company-details">
          Phone: +254748069158 / 0728756727<br/>
          Email: sales@chambudigital.co.ke<br/>
          Address: Nairobi, Kenya
        </div>
      </div>

      <div className="order-info">
        <div><strong>Order Number:</strong> {receiptNumber}</div>
        <div><strong>Date:</strong> {date.toLocaleDateString('en-GB')}</div>
        <div><strong>Time:</strong> {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>QTY</th>
            <th>Description</th>
            <th className="text-right">KES</th>
            <th className="text-right">Totals</th>
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
              <td className="text-right">{item.price.toFixed(2)}</td>
              <td className="text-right">{item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '11px' }}>
        <strong>{items.length} Items</strong>
      </div>

      <div className="totals">
        <div className="totals-row">
          <div className="totals-label">Sub Total</div>
          <div className="totals-value">{subtotal.toFixed(2)}</div>
        </div>
        <div className="totals-row total-final">
          <div className="totals-label">TOTAL</div>
          <div className="totals-value">{total.toFixed(2)}</div>
        </div>
      </div>

      <div className="payment-info">
        <div><strong>Payment</strong></div>
        <div>Payment: {paymentMethod === 'mobile_money' ? 'M-Pesa' : paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</div>
        <div>Amount: {total.toFixed(2)}</div>
      </div>

      <div className="served-by">
        You Were Served By: {cashierName}
      </div>

      {paymentMethod === 'mobile_money' && (
        <div style={{ margin: '15px 0', fontSize: '11px' }}>
          <div><strong>M-PESA</strong></div>
          <div>PAYBILL: 522522</div>
          <div>AC/NO: 7716828</div>
        </div>
      )}

      <div className="footer">
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Thank You For Shopping With Us!</div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
          Powered by Chambu Digital
        </div>
      </div>
    </div>
  )
})
