'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'
import { resolveMediaUrl } from '@/lib/media-url'

interface QuotationItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface QuotationReceiptProps {
  shopName: string
  shopLogo?: string
  shopPhone?: string
  shopEmail?: string
  shopAddress?: string
  quotationNumber: string
  date: Date
  validUntil: Date
  customerName: string
  customerPhone?: string
  customerEmail?: string
  items: QuotationItem[]
  subtotal: number
  discount: number
  total: number
  notes?: string
  terms?: string
  mpesaPaybill?: string
  mpesaAccountNumber?: string
  bankDetails?: string
  website?: string
  preparedBy?: string
  paperSize?: '58mm' | '80mm' | 'A4'
  onPrintComplete?: () => void
}

export interface QuotationReceiptRef {
  print: () => void
}

export const QuotationReceipt = forwardRef<QuotationReceiptRef, QuotationReceiptProps>(({
  shopName,
  shopLogo,
  shopPhone,
  shopEmail,
  shopAddress,
  quotationNumber,
  date,
  validUntil,
  customerName,
  customerPhone,
  customerEmail,
  items,
  subtotal,
  discount,
  total,
  notes,
  terms,
  mpesaPaybill,
  mpesaAccountNumber,
  bankDetails,
  website,
  preparedBy,
  paperSize = 'A4',
  onPrintComplete,
}, ref) => {
  const receiptRef = useRef<HTMLDivElement>(null)

  // Build @page CSS based on paper size
  const pageCSS = paperSize === 'A4'
    ? `@page { size: A4; margin: 15mm; }`
    : paperSize === '80mm'
    ? `@page { size: 80mm auto; margin: 4mm; }`
    : `@page { size: 58mm auto; margin: 3mm; }`

  // Body width matches paper
  const bodyWidth = paperSize === 'A4' 
    ? '190mm' 
    : paperSize === '80mm' 
    ? '72mm' 
    : '52mm'
  
  const baseFontSize = paperSize === 'A4' ? '11px' : '9px'
  const isLargeFormat = paperSize === 'A4'

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Quotation - ${quotationNumber}</title>
              <style>
                @media print {
                  ${pageCSS}
                  body { margin: 0; padding: 0; }
                }
                body {
                  font-family: Arial, sans-serif;
                  max-width: ${bodyWidth};
                  margin: 0 auto;
                  padding: ${isLargeFormat ? '10mm' : '4mm'};
                  font-size: ${baseFontSize};
                  line-height: 1.4;
                  color: #000;
                }
                .header { text-align: center; margin-bottom: ${isLargeFormat ? '15px' : '8px'}; border-bottom: 2px solid #000; padding-bottom: ${isLargeFormat ? '10px' : '6px'}; }
                .logo { max-width: ${isLargeFormat ? '80px' : '50px'}; height: auto; margin-bottom: 5px; }
                .company-name { font-size: ${isLargeFormat ? '18px' : '13px'}; font-weight: bold; margin-bottom: 3px; }
                .company-details { font-size: ${isLargeFormat ? '10px' : '8px'}; line-height: 1.3; margin-bottom: 5px; color: #333; }
                .doc-type { font-size: ${isLargeFormat ? '16px' : '12px'}; font-weight: bold; margin-top: ${isLargeFormat ? '10px' : '6px'}; letter-spacing: 1px; }
                
                .quotation-info { margin: ${isLargeFormat ? '15px 0' : '8px 0'}; font-size: ${isLargeFormat ? '10px' : '8px'}; }
                .quotation-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: ${isLargeFormat ? '15px' : '8px'}; }
                .info-section h3 { font-size: ${isLargeFormat ? '11px' : '9px'}; font-weight: bold; margin: 0 0 4px 0; }
                .info-section p { margin: 2px 0; }
                .info-right { text-align: right; }
                
                table { width: 100%; border-collapse: collapse; margin: ${isLargeFormat ? '15px 0' : '8px 0'}; }
                thead { border-bottom: 2px solid #000; }
                th { text-align: left; padding: ${isLargeFormat ? '6px 4px' : '4px 2px'}; font-size: ${isLargeFormat ? '10px' : '8px'}; font-weight: bold; }
                td { padding: ${isLargeFormat ? '5px 4px' : '3px 2px'}; font-size: ${isLargeFormat ? '10px' : '8px'}; border-bottom: 1px solid #ddd; }
                th.text-right, td.text-right { text-align: right; }
                th.text-center, td.text-center { text-align: center; }
                
                .totals { margin: ${isLargeFormat ? '15px 0' : '8px 0'}; }
                .totals-row { display: flex; justify-content: space-between; padding: ${isLargeFormat ? '4px 0' : '3px 0'}; font-size: ${isLargeFormat ? '10px' : '8px'}; }
                .totals-row.total-final { font-size: ${isLargeFormat ? '13px' : '10px'}; font-weight: bold; border-top: 2px solid #000; padding-top: ${isLargeFormat ? '8px' : '5px'}; margin-top: ${isLargeFormat ? '8px' : '5px'}; }
                
                .notes-section { margin: ${isLargeFormat ? '15px 0' : '8px 0'}; padding: ${isLargeFormat ? '10px' : '6px'}; background: #f9f9f9; border: 1px solid #ddd; }
                .notes-section h3 { font-size: ${isLargeFormat ? '11px' : '9px'}; font-weight: bold; margin: 0 0 5px 0; }
                .notes-section p { font-size: ${isLargeFormat ? '9px' : '7px'}; margin: 3px 0; line-height: 1.4; }
                .notes-section ul { margin: 5px 0; padding-left: 15px; }
                .notes-section li { font-size: ${isLargeFormat ? '9px' : '7px'}; margin: 2px 0; }
                
                .payment-info { margin: ${isLargeFormat ? '15px 0' : '8px 0'}; font-size: ${isLargeFormat ? '9px' : '7px'}; }
                .payment-info h3 { font-size: ${isLargeFormat ? '10px' : '8px'}; font-weight: bold; margin: 0 0 4px 0; }
                .payment-info p { margin: 2px 0; }
                
                .signature-section { margin-top: ${isLargeFormat ? '30px' : '15px'}; padding-top: ${isLargeFormat ? '20px' : '10px'}; border-top: 1px solid #ccc; }
                .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: ${isLargeFormat ? '20px' : '10px'}; }
                .signature-box { font-size: ${isLargeFormat ? '9px' : '7px'}; }
                .signature-box p { margin: 0 0 ${isLargeFormat ? '30px' : '20px'} 0; }
                .signature-line { border-top: 1px solid #000; padding-top: 5px; margin-top: ${isLargeFormat ? '30px' : '20px'}; }
                
                .footer { text-align: center; margin-top: ${isLargeFormat ? '20px' : '10px'}; padding-top: ${isLargeFormat ? '10px' : '6px'}; border-top: 1px solid #ddd; font-size: ${isLargeFormat ? '9px' : '7px'}; color: #666; }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
          onPrintComplete?.()
        }, 250)
      }
    }
  }

  useImperativeHandle(ref, () => ({ print: handlePrint }))

  return (
    <div ref={receiptRef} style={{ display: 'none' }}>
      {/* Header */}
      <div className="header">
        {shopLogo && (
          <img src={resolveMediaUrl(shopLogo)} alt={shopName} className="logo" />
        )}
        <div className="company-name">{shopName}</div>
        <div className="company-details">
          {shopPhone && <div>Phone: {shopPhone}</div>}
          {shopEmail && <div>Email: {shopEmail}</div>}
          {shopAddress && <div>Address: {shopAddress}</div>}
        </div>
        <div className="doc-type">QUOTATION</div>
      </div>

      {/* Quotation Info */}
      <div className="quotation-info">
        <div className="quotation-info-grid">
          <div className="info-section">
            <h3>To:</h3>
            <p><strong>{customerName}</strong></p>
            {customerPhone && <p>{customerPhone}</p>}
            {customerEmail && <p>{customerEmail}</p>}
          </div>
          <div className="info-section info-right">
            <p><strong>Quotation #:</strong> {quotationNumber}</p>
            <p><strong>Date:</strong> {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p><strong>Valid Until:</strong> {validUntil.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            {preparedBy && <p><strong>Prepared By:</strong> {preparedBy}</p>}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table>
        <thead>
          <tr>
            <th className="text-center">#</th>
            <th>Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="text-center">{index + 1}</td>
              <td>{item.productName}</td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">KSh {item.unitPrice.toLocaleString()}</td>
              <td className="text-right">KSh {item.lineTotal.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="totals">
        <div className="totals-row">
          <span>Subtotal:</span>
          <span>KSh {subtotal.toLocaleString()}</span>
        </div>
        {discount > 0 && (
          <div className="totals-row">
            <span>Discount:</span>
            <span>- KSh {discount.toLocaleString()}</span>
          </div>
        )}
        <div className="totals-row total-final">
          <span>TOTAL:</span>
          <span>KSh {total.toLocaleString()}</span>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="notes-section">
          <h3>Notes:</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{notes}</p>
        </div>
      )}

      {/* Terms & Conditions */}
      <div className="notes-section">
        <h3>Terms & Conditions:</h3>
        <ul>
          <li>This quotation is valid until {validUntil.toLocaleDateString('en-GB')}</li>
          <li>Prices are subject to change without notice after the validity period</li>
          <li>Payment terms: As agreed upon acceptance</li>
          <li>Delivery terms: As agreed upon acceptance</li>
          {terms && <li>{terms}</li>}
        </ul>
      </div>

      {/* Payment Information */}
      {(mpesaPaybill || bankDetails) && (
        <div className="payment-info">
          <h3>Payment Information:</h3>
          {mpesaPaybill && (
            <p>
              <strong>M-PESA Paybill:</strong> {mpesaPaybill}
              {mpesaAccountNumber && ` | Account: ${mpesaAccountNumber}`}
            </p>
          )}
          {bankDetails && <p style={{ whiteSpace: 'pre-wrap' }}>{bankDetails}</p>}
        </div>
      )}

      {/* Signature Section */}
      {isLargeFormat && (
        <div className="signature-section">
          <div className="signature-grid">
            <div className="signature-box">
              <p>Prepared by:</p>
              <div className="signature-line">Signature & Date</div>
            </div>
            <div className="signature-box">
              <p>Customer Acceptance:</p>
              <div className="signature-line">Signature & Date</div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <p>Thank you for your business!</p>
        {website && <p>{website}</p>}
      </div>
    </div>
  )
})

QuotationReceipt.displayName = 'QuotationReceipt'
