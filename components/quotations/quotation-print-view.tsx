'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { getPrintStyles, generatePrintCSS } from '@/lib/print-styles'

interface QuotationItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface Quotation {
  _id: string
  quotationNumber: string
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  status: string
  items: QuotationItem[]
  subtotal: number
  discount: number
  total: number
  validUntil: string
  notes: string
  createdAt: string
}

interface QuotationPrintViewProps {
  quotation: Quotation
}

export function QuotationPrintView({ quotation }: QuotationPrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Get print styles from settings
  const printStyles = shopSettings?.documents 
    ? getPrintStyles(shopSettings.documents)
    : getPrintStyles({ paperSize: 'A4', fontSize: 12, fontFamily: 'Arial' })

  // Generate CSS string for styled-jsx - must be computed before JSX
  const defaultSettings = { paperSize: 'A4' as const, fontSize: 12, fontFamily: 'Arial' as const }
  const printCSSString = generatePrintCSS(shopSettings?.documents || defaultSettings, 'quotation-print-content')

  useEffect(() => {
    fetchShopSettings()
  }, [])

  async function fetchShopSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setShopSettings(data.settings || {})
      }
    } catch (error) {
      console.error('Failed to fetch shop settings:', error)
    }
    setLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div className="space-y-4">
      {/* Print Button - Hidden on print */}
      <div className="flex justify-end print:hidden">
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Quotation
        </Button>
      </div>

      {/* Quotation Document */}
      <div 
        ref={printRef} 
        id="quotation-print-content" 
        className="bg-white p-8 rounded-lg border print:border-0 print:p-0"
        style={{
          fontFamily: printStyles.fontFamily,
          fontSize: printStyles.baseFontSize,
          maxWidth: printStyles.maxWidth,
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{shopSettings?.shopName || 'Business Name'}</h1>
          {shopSettings?.address && (
            <p className="text-sm text-gray-600 mt-1">{shopSettings.address}</p>
          )}
          {shopSettings?.phone && (
            <p className="text-sm text-gray-600">{shopSettings.phone}</p>
          )}
          {shopSettings?.email && (
            <p className="text-sm text-gray-600">{shopSettings.email}</p>
          )}
          
          <div className="mt-6 pt-4 border-t-2 border-gray-900">
            <h2 className="text-2xl font-bold">QUOTATION</h2>
          </div>
        </div>

        {/* Quotation Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">To:</h3>
            <div className="text-gray-700">
              <p className="font-medium">{quotation.customerName}</p>
              {quotation.customerPhone && <p>{quotation.customerPhone}</p>}
              {quotation.customerEmail && <p>{quotation.customerEmail}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <p>
                <span className="font-semibold">Quotation #:</span>{' '}
                <span className="font-mono">{quotation.quotationNumber}</span>
              </p>
              <p>
                <span className="font-semibold">Date:</span>{' '}
                {new Date(quotation.createdAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p>
                <span className="font-semibold">Valid Until:</span>{' '}
                {new Date(quotation.validUntil).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-3 font-semibold">#</th>
                <th className="text-left py-3 font-semibold">Description</th>
                <th className="text-right py-3 font-semibold">Qty</th>
                <th className="text-right py-3 font-semibold">Unit Price</th>
                <th className="text-right py-3 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-3">{index + 1}</td>
                  <td className="py-3">{item.productName}</td>
                  <td className="text-right py-3">{item.quantity}</td>
                  <td className="text-right py-3">KSh {item.unitPrice.toLocaleString()}</td>
                  <td className="text-right py-3">KSh {item.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between py-2">
              <span className="font-medium">Subtotal:</span>
              <span>KSh {quotation.subtotal.toLocaleString()}</span>
            </div>
            {quotation.discount > 0 && (
              <div className="flex justify-between py-2">
                <span className="font-medium">Discount:</span>
                <span>- KSh {quotation.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t-2 border-gray-900 font-bold text-lg">
              <span>TOTAL:</span>
              <span>KSh {quotation.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quotation.notes && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-2">Notes:</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        <div className="mb-8 p-4 bg-gray-50 rounded border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Terms & Conditions:</h3>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>This quotation is valid until {new Date(quotation.validUntil).toLocaleDateString()}</li>
            <li>Prices are subject to change without notice after the validity period</li>
            <li>Payment terms: As agreed upon acceptance</li>
            <li>Delivery terms: As agreed upon acceptance</li>
            {shopSettings?.quotationTerms && <li>{shopSettings.quotationTerms}</li>}
          </ul>
        </div>

        {/* Payment Information */}
        {(shopSettings?.mpesaPaybill || shopSettings?.bankDetails) && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-2">Payment Information:</h3>
            <div className="text-sm text-gray-700 space-y-1">
              {shopSettings?.mpesaPaybill && (
                <p>
                  <span className="font-medium">M-PESA Paybill:</span> {shopSettings.mpesaPaybill}
                  {shopSettings?.mpesaAccountNumber && ` | Account: ${shopSettings.mpesaAccountNumber}`}
                </p>
              )}
              {shopSettings?.bankDetails && (
                <p className="whitespace-pre-wrap">{shopSettings.bankDetails}</p>
              )}
            </div>
          </div>
        )}

        {/* Signature Section */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-gray-300">
          <div>
            <p className="mb-8">Prepared by:</p>
            <div className="border-t border-gray-900 pt-2">
              <p className="text-sm text-gray-600">Signature & Date</p>
            </div>
          </div>
          <div>
            <p className="mb-8">Customer Acceptance:</p>
            <div className="border-t border-gray-900 pt-2">
              <p className="text-sm text-gray-600">Signature & Date</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
          <p>Thank you for your business!</p>
          {shopSettings?.website && <p className="mt-1">{shopSettings.website}</p>}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{printCSSString}</style>
    </div>
  )
}
