'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Loader2,
  Download,
  Printer,
  FileText
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { generateRFQCSV, downloadCSV } from '@/lib/restocking/csv-export'

interface PurchaseOrder {
  _id: string
  poNumber: string
  supplierName: string
  items: Array<{
    moduleItemId: string
    module: string
    itemName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  total: number
  notes: string
  createdAt: string
}

function PurchaseOrderDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchPurchaseOrder()
  }, [id])

  async function fetchPurchaseOrder() {
    setLoading(true)
    try {
      const response = await fetch(`/api/restocking/purchase-orders/${id}`)
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrder(data.purchaseOrder)
      } else {
        router.push('/dashboard/restocking/purchase-orders')
      }
    } catch (error) {
      console.error('Failed to fetch RFQ:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!purchaseOrder) return
    const csv = generateRFQCSV(purchaseOrder)
    downloadCSV(csv, `${purchaseOrder.poNumber}.csv`)
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!purchaseOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold">RFQ Not Found</h2>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 pb-20 sm:pb-6">
      {/* Header — no print */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-3 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/restocking/purchase-orders')}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to RFQs
          </Button>
          <div>
            <h1 className="text-xl font-bold">{purchaseOrder.poNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(purchaseOrder.createdAt).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="gap-2 flex-1 sm:flex-none"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
          <Button
            variant="outline"
            className="gap-2 flex-1 sm:flex-none"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Printable RFQ */}
      <div className="bg-white rounded-lg border p-6 print:shadow-none print:border-0">
        {/* Print-only header */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-bold">RESTOCK LIST</h1>
          <p className="text-lg text-muted-foreground">{purchaseOrder.poNumber}</p>
        </div>

        {/* RFQ details */}
        <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-6">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1">DATE</h3>
            <p className="font-medium text-sm">
              {new Date(purchaseOrder.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className="sm:text-right">
            <h3 className="text-xs font-semibold text-muted-foreground mb-1">RFQ NUMBER</h3>
            <p className="font-medium text-sm">{purchaseOrder.poNumber}</p>
          </div>
        </div>

        {/* Items — Desktop table */}
        <div className="hidden sm:block border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left p-3 font-medium text-sm">Item</th>
                <th className="text-right p-3 font-medium text-sm">Quantity</th>
                <th className="text-right p-3 font-medium text-sm">Unit Price</th>
                <th className="text-right p-3 font-medium text-sm">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrder.items.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="p-3 text-sm">{item.itemName}</td>
                  <td className="p-3 text-right text-sm">{item.quantity}</td>
                  <td className="p-3 text-right text-sm">
                    {item.unitPrice > 0 ? `KES ${Math.round(item.unitPrice).toLocaleString('en-KE')}` : '—'}
                  </td>
                  <td className="p-3 text-right text-sm font-medium">
                    {item.lineTotal > 0 ? `KES ${Math.round(item.lineTotal).toLocaleString('en-KE')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {purchaseOrder.total > 0 && (
              <tfoot className="bg-muted/30">
                <tr className="border-t-2">
                  <td colSpan={3} className="p-3 text-right font-semibold text-sm">TOTAL</td>
                  <td className="p-3 text-right font-bold text-base">
                    KES {Math.round(purchaseOrder.total).toLocaleString('en-KE')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Items — Mobile cards */}
        <div className="sm:hidden space-y-2">
          {purchaseOrder.items.map((item, index) => (
            <div key={index} className="border rounded-lg p-3">
              <p className="font-medium text-sm mb-2">{item.itemName}</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Qty</p>
                  <p className="font-medium">{item.quantity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unit Price</p>
                  <p className="font-medium">
                    {item.unitPrice > 0 ? `KES ${Math.round(item.unitPrice).toLocaleString('en-KE')}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">
                    {item.lineTotal > 0 ? `KES ${Math.round(item.lineTotal).toLocaleString('en-KE')}` : '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {purchaseOrder.total > 0 && (
            <div className="flex items-center justify-between bg-muted/30 border rounded-lg p-3">
              <span className="font-semibold text-sm">TOTAL</span>
              <span className="font-bold text-base">
                KES {Math.round(purchaseOrder.total).toLocaleString('en-KE')}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        {purchaseOrder.notes && (
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-xs font-semibold text-muted-foreground mb-1">NOTES</h3>
            <p className="text-sm whitespace-pre-wrap">{purchaseOrder.notes}</p>
          </div>
        )}

        {/* Print-only footer */}
        <div className="hidden print:block mt-12 pt-8 border-t">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-semibold mb-8">Authorized By:</p>
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground">Signature</p>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-8">Received By:</p>
              <div className="border-t pt-2">
                <p className="text-sm text-muted-foreground">Signature &amp; Date</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PurchaseOrderDetailPage() {
  return (
    <PermissionGuard requiredPermission="core.restocking">
      <PurchaseOrderDetailPageContent />
    </PermissionGuard>
  )
}
