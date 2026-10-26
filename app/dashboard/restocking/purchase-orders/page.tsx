'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Loader2,
  Download,
  FileText,
  Package,
  Calendar
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { generateRFQCSV, downloadCSV } from '@/lib/restocking/csv-export'

interface PurchaseOrder {
  _id: string
  poNumber: string
  supplierId: string | null
  supplierName: string
  status: string
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
  createdBy: string
}

function PurchaseOrdersPageContent() {
  const router = useRouter()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPurchaseOrders()
  }, [])

  async function fetchPurchaseOrders() {
    setLoading(true)
    try {
      const response = await fetch('/api/restocking/purchase-orders')
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrders(data.purchaseOrders)
      }
    } catch (error) {
      console.error('Failed to fetch RFQs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPOs = purchaseOrders.filter((po) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return po.poNumber.toLowerCase().includes(search)
  })

  function handleDownload(po: PurchaseOrder) {
    const csv = generateRFQCSV(po)
    downloadCSV(csv, `${po.poNumber}.csv`)
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-3 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/restocking')}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Restocking
          </Button>
          <div>
            <h1 className="text-xl font-bold">RFQs</h1>
            <p className="text-xs text-muted-foreground">Restock lists generated from your basket</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search by RFQ number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 h-9 text-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPOs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-medium">No RFQs Yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Generate a restock list from the basket to create your first RFQ.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPOs.map((po) => {
            const totalUnits = po.items.reduce((sum, item) => sum + item.quantity, 0)
            return (
              <div
                key={po._id}
                className="border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/restocking/purchase-orders/${po._id}`)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{po.poNumber}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(po.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {po.items.length} items · {totalUnits} units
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {po.total > 0 && (
                      <span className="text-sm font-medium hidden sm:inline">
                        KES {Math.round(po.total).toLocaleString('en-KE')}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(po)
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PurchaseOrdersPage() {
  return (
    <PermissionGuard requiredPermission="core.restocking">
      <PurchaseOrdersPageContent />
    </PermissionGuard>
  )
}
