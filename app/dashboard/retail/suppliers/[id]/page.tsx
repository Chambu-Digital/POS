'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Edit2, Package, History, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface Supplier {
  _id: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  isActive: boolean
}

interface PurchaseHistoryItem {
  _id: string
  timestamp: string
  reference: string
  quantity: number
  unitCost?: number
  totalCost?: number
  productId?: {
    _id: string
    productName: string
  }
}

interface Stats {
  totalPurchases: number
  totalValue: number
  productsSupplied: number
}

export default function SupplierDetailPage() {
  return (
    <PermissionGuard requiredPermission="pos.suppliers">
      <SupplierDetailPageContent />
    </PermissionGuard>
  )
}

function SupplierDetailPageContent() {
  const params = useParams()
  const router = useRouter()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([])
  const [stats, setStats] = useState<Stats>({ totalPurchases: 0, totalValue: 0, productsSupplied: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchSupplierDetails()
    }
  }, [params.id])

  async function fetchSupplierDetails() {
    try {
      const response = await fetch(`/api/suppliers/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setSupplier(data.supplier)
        setPurchaseHistory(data.purchaseHistory || [])
        setStats(data.stats || { totalPurchases: 0, totalValue: 0, productsSupplied: 0 })
      } else if (response.status === 404) {
        toast.error('Supplier not found')
        router.push('/dashboard/retail/suppliers')
      }
    } catch (error) {
      toast.error('Failed to load supplier details')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">Loading supplier details...</div>
      </div>
    )
  }

  if (!supplier) {
    return null
  }

  // Group products from purchase history
  const productsList = purchaseHistory.reduce((acc: any[], item) => {
    if (!item.productId) return acc
    
    const existing = acc.find(p => p.productId === item.productId._id)
    if (existing) {
      existing.totalQuantity += item.quantity
      existing.totalCost += item.totalCost || 0
      existing.lastPurchase = item.timestamp
    } else {
      acc.push({
        productId: item.productId._id,
        productName: item.productId.productName,
        totalQuantity: item.quantity,
        totalCost: item.totalCost || 0,
        lastPurchase: item.timestamp,
        lastCost: item.unitCost || 0,
      })
    }
    return acc
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/retail/suppliers')}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            <p className="text-muted-foreground mt-1">Supplier Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/retail/suppliers?edit=${supplier._id}`)}
          >
            <Edit2 size={16} className="mr-2" />
            Edit Supplier
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPurchases}</div>
            <p className="text-xs text-muted-foreground">Stock-in orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KSh {stats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time purchases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Supplied</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.productsSupplied}</div>
            <p className="text-xs text-muted-foreground">Unique products</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="history">Purchase History</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        {/* Information Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
              <CardDescription>Contact and business details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact Person</p>
                  <p className="text-base">{supplier.contactPerson || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-base">{supplier.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base">{supplier.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={supplier.isActive ? 'default' : 'secondary'}>
                    {supplier.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              
              {supplier.address && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="text-base">{supplier.address}</p>
                </div>
              )}

              {supplier.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-base whitespace-pre-wrap">{supplier.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
              <CardDescription>Stock received from this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              {purchaseHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No purchase history yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseHistory.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell>
                            {new Date(item.timestamp).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.productId?.productName || 'Unknown'}
                          </TableCell>
                          <TableCell>{item.reference || '-'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            {item.unitCost ? `KSh ${item.unitCost.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {item.totalCost ? `KSh ${item.totalCost.toLocaleString()}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Products Supplied</CardTitle>
              <CardDescription>Products purchased from this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              {productsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No products yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Total Quantity</TableHead>
                        <TableHead>Total Value</TableHead>
                        <TableHead>Last Cost</TableHead>
                        <TableHead>Last Purchase</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsList.map((product) => (
                        <TableRow key={product.productId}>
                          <TableCell className="font-medium">{product.productName}</TableCell>
                          <TableCell>{product.totalQuantity}</TableCell>
                          <TableCell>KSh {product.totalCost.toLocaleString()}</TableCell>
                          <TableCell>KSh {product.lastCost.toLocaleString()}</TableCell>
                          <TableCell>
                            {new Date(product.lastPurchase).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
