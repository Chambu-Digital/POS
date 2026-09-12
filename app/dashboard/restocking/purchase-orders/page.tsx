'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  FileText, 
  Calendar, 
  DollarSign,
  Package,
  Loader2,
  ArrowLeft,
  Printer,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface PurchaseOrder {
  _id: string
  poNumber: string
  supplierId: string | null
  supplierName: string
  status: 'draft' | 'approved' | 'sent'
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
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchPurchaseOrders()
  }, [statusFilter])

  async function fetchPurchaseOrders() {
    setLoading(true)
    try {
      const url = statusFilter !== 'all' 
        ? `/api/restocking/purchase-orders?status=${statusFilter}`
        : '/api/restocking/purchase-orders'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrders(data.purchaseOrders)
      }
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPOs = purchaseOrders.filter((po) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      po.poNumber.toLowerCase().includes(search) ||
      po.supplierName.toLowerCase().includes(search)
    )
  })

  function getStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Draft</Badge>
      case 'approved':
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>
      case 'sent':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
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
            <h1 className="text-2xl sm:text-3xl font-bold">Purchase Orders</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              View and manage all purchase orders
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total POs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{purchaseOrders.length}</span>
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {purchaseOrders.filter(po => po.status === 'draft').length}
              </span>
              <Clock className="h-5 w-5 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {purchaseOrders.filter(po => po.status === 'approved').length}
              </span>
              <CheckCircle2 className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                KES {purchaseOrders.reduce((sum, po) => sum + po.total, 0).toLocaleString()}
              </span>
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>All Purchase Orders</CardTitle>
          <CardDescription>Browse and search purchase orders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search by PO number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <select
              className="px-3 py-2 border rounded-md w-full sm:w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 border rounded-lg">
              <FileText className="h-16 w-16 text-muted-foreground/50" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">No Purchase Orders</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {searchTerm 
                    ? 'No purchase orders match your search.'
                    : 'Create your first purchase order by adding items to the basket in the restocking module.'
                  }
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-sm">PO Number</th>
                        <th className="text-left p-3 font-medium text-sm">Supplier</th>
                        <th className="text-right p-3 font-medium text-sm">Items</th>
                        <th className="text-right p-3 font-medium text-sm">Total</th>
                        <th className="text-left p-3 font-medium text-sm">Status</th>
                        <th className="text-left p-3 font-medium text-sm">Date</th>
                        <th className="text-center p-3 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPOs.map((po) => (
                        <tr key={po._id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{po.poNumber}</td>
                          <td className="p-3">{po.supplierName}</td>
                          <td className="p-3 text-right">{po.items.length}</td>
                          <td className="p-3 text-right font-medium">
                            KES {po.total.toLocaleString()}
                          </td>
                          <td className="p-3">{getStatusBadge(po.status)}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/dashboard/restocking/purchase-orders/${po._id}`)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {filteredPOs.map((po) => (
                  <Card key={po._id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-base">{po.poNumber}</p>
                            <p className="text-sm text-muted-foreground">{po.supplierName}</p>
                          </div>
                          {getStatusBadge(po.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Items:</span>
                            <span className="ml-1 font-medium">{po.items.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <span className="ml-1 font-semibold">KES {po.total.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(po.createdAt).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/restocking/purchase-orders/${po._id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
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
