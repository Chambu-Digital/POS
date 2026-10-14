'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { QuotationReceipt, QuotationReceiptRef } from './quotation-receipt'

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
  const receiptRef = useRef<QuotationReceiptRef>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
    receiptRef.current?.print()
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  const paperSize = (shopSettings?.documents?.paperSize || 'A4') as '58mm' | '80mm' | 'A4'

  return (
    <div className="space-y-4">
      {/* Print Button */}
      <div className="flex justify-end">
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print Quotation
        </Button>
      </div>

      {/* Hidden Receipt Component */}
      <QuotationReceipt
        ref={receiptRef}
        shopName={shopSettings?.general?.shopName || shopSettings?.shopName || 'Business Name'}
        shopLogo={shopSettings?.general?.logo || shopSettings?.logo}
        shopPhone={shopSettings?.general?.phone || shopSettings?.phone}
        shopEmail={shopSettings?.general?.email || shopSettings?.email}
        shopAddress={shopSettings?.general?.address || shopSettings?.address}
        quotationNumber={quotation.quotationNumber}
        date={new Date(quotation.createdAt)}
        validUntil={new Date(quotation.validUntil)}
        customerName={quotation.customerName}
        customerPhone={quotation.customerPhone}
        customerEmail={quotation.customerEmail}
        items={quotation.items}
        subtotal={quotation.subtotal}
        discount={quotation.discount}
        total={quotation.total}
        notes={quotation.notes}
        terms={shopSettings?.quotationTerms}
        mpesaPaybill={shopSettings?.mpesaPaybill}
        mpesaAccountNumber={shopSettings?.mpesaAccountNumber}
        bankDetails={shopSettings?.bankDetails}
        website={shopSettings?.website}
        paperSize={paperSize}
        onPrintComplete={() => console.log('Print completed')}
      />

      {/* Preview (optional - shows what will be printed) */}
      <div className="border rounded-lg p-6 bg-white">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">{shopSettings?.general?.shopName || shopSettings?.shopName || 'Business Name'}</h2>
          {(shopSettings?.general?.address || shopSettings?.address) && (
            <p className="text-sm text-gray-600">{shopSettings?.general?.address || shopSettings?.address}</p>
          )}
          {(shopSettings?.general?.phone || shopSettings?.phone) && (
            <p className="text-sm text-gray-600">{shopSettings?.general?.phone || shopSettings?.phone}</p>
          )}
          <div className="mt-4 text-xl font-bold">QUOTATION</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="font-semibold">To:</p>
            <p>{quotation.customerName}</p>
            {quotation.customerPhone && <p className="text-sm">{quotation.customerPhone}</p>}
          </div>
          <div className="text-right">
            <p><span className="font-semibold">Quotation #:</span> {quotation.quotationNumber}</p>
            <p><span className="font-semibold">Date:</span> {new Date(quotation.createdAt).toLocaleDateString()}</p>
            <p><span className="font-semibold">Valid Until:</span> {new Date(quotation.validUntil).toLocaleDateString()}</p>
          </div>
        </div>

        <table className="w-full mb-6">
          <thead className="border-b-2">
            <tr>
              <th className="text-left py-2">#</th>
              <th className="text-left py-2">Description</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Unit Price</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="py-2">{index + 1}</td>
                <td className="py-2">{item.productName}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">KSh {item.unitPrice.toLocaleString()}</td>
                <td className="text-right py-2">KSh {item.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-64">
            <div className="flex justify-between py-1">
              <span>Subtotal:</span>
              <span>KSh {quotation.subtotal.toLocaleString()}</span>
            </div>
            {quotation.discount > 0 && (
              <div className="flex justify-between py-1">
                <span>Discount:</span>
                <span>- KSh {quotation.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t-2 font-bold text-lg">
              <span>TOTAL:</span>
              <span>KSh {quotation.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
