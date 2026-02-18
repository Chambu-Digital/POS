'use client'

import { useEffect, useRef } from 'react'

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

export function Receipt({
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
}: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-print when component mounts
    const timer = setTimeout(() => {
      handlePrint()
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '', 'width=302,height=600')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt</title>
              <style>
                @media print {
                  @page {
                    size: 80mm auto;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                  }
                }
                body {
                  font-family: 'Courier New', monospace;
                  width: 80mm;
                  margin: 0 auto;
                  padding: 10mm 5mm;
                  font-size: 12px;
                  line-height: 1.4;
                }
                .center {
                  text-align: center;
                }
                .bold {
                  font-weight: bold;
                }
                .large {
                  font-size: 16px;
                }
                .divider {
                  border-top: 1px dashed #000;
                  margin: 8px 0;
                }
                .row {
                  display: flex;
                  justify-content: space-between;
                  margin: 2px 0;
                }
                .item {
                  margin: 4px 0;
                }
                .item-details {
                  font-size: 10px;
                  color: #666;
                  margin-left: 10px;
                }
                .total-row {
                  font-size: 14px;
                  font-weight: bold;
                  margin-top: 8px;
                }
                .footer {
                  margin-top: 16px;
                  font-size: 11px;
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
        printWindow.print()
        printWindow.close()
        
        if (onPrintComplete) {
          onPrintComplete()
        }
      }
    }
  }

  return (
    <div ref={receiptRef} style={{ display: 'none' }}>
      <div className="center large bold">{shopName}</div>
      <div className="center" style={{ fontSize: '10px', marginTop: '4px' }}>
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
      </div>
      <div className="center" style={{ fontSize: '10px' }}>
        Receipt: {receiptNumber}
      </div>
      <div className="center" style={{ fontSize: '10px' }}>
        Cashier: {cashierName}
      </div>

      <div className="divider"></div>

      {items.map((item, index) => (
        <div key={index} className="item">
          <div className="row">
            <span>{item.productName}</span>
          </div>
          {(item.brand || item.model || item.variant) && (
            <div className="item-details">
              {item.brand && `Brand: ${item.brand} `}
              {item.model && `Model: ${item.model} `}
              {item.variant && `Variant: ${item.variant}`}
            </div>
          )}
          <div className="row" style={{ fontSize: '11px' }}>
            <span>
              {item.quantity} x KSh {item.price.toLocaleString()}
            </span>
            <span>KSh {item.total.toLocaleString()}</span>
          </div>
          {item.discount > 0 && (
            <div className="row" style={{ fontSize: '10px', color: '#666' }}>
              <span>Discount</span>
              <span>-KSh {item.discount.toLocaleString()}</span>
            </div>
          )}
        </div>
      ))}

      <div className="divider"></div>

      <div className="row">
        <span>Subtotal:</span>
        <span>KSh {subtotal.toLocaleString()}</span>
      </div>

      {discount > 0 && (
        <div className="row">
          <span>Discount:</span>
          <span>-KSh {discount.toLocaleString()}</span>
        </div>
      )}

      <div className="row total-row">
        <span>TOTAL:</span>
        <span>KSh {total.toLocaleString()}</span>
      </div>

      <div className="divider"></div>

      <div className="row" style={{ fontSize: '11px' }}>
        <span>Payment Method:</span>
        <span className="bold">{paymentMethod.toUpperCase()}</span>
      </div>

      <div className="divider"></div>

      <div className="center footer">
        <div className="bold">Thank you for shopping with us!</div>
        <div style={{ marginTop: '4px' }}>Please come again</div>
        <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
          Powered by Chambu Digital
        </div>
      </div>
    </div>
  )
}
