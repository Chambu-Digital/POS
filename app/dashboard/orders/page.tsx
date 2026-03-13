'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { OrderDetailsDialog } from '@/components/orders/order-details-dialog'

interface SaleItem {
  productId: {
    _id: string
    name: string
  }
  quantity: number
  price: number
  discount: number
}

interface Sale {
  _id: string
  items: SaleItem[]
  total: number
  subtotal?: number
  discount: number
  paymentMethod: string
  createdAt: string
  notes?: string
  staffId?: {
    name: string
  }
}

export default function OrdersPage() {
  return (
    <PermissionGuard requiredPermission="canViewOrders">
      <OrdersPageContent />
    </PermissionGuard>
  )
}

function OrdersPageContent() {
  const [sales, setSales] = useState<Sale[]>([])
  const [filteredSales, setFilteredSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const itemsPerPage = 10

  useEffect(() => {
    fetchSales()
  }, [])

  useEffect(() => {
    setFilteredSales(filterSales())
    setCurrentPage(1)
  }, [searchQuery, dateRange, sales])

  async function fetchSales() {
    try {
      setLoading(true)
      const response = await fetch('/api/sales')
      if (!response.ok) throw new Error('Failed to fetch sales')
      const data = await response.json()
      setSales(data.sales || [])
    } catch (error) {
      toast.error('Failed to load orders')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function filterSales() {
    let filtered = [...sales]

    if (searchQuery) {
      filtered = filtered.filter(sale =>
        sale._id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.items.some(item =>
          item.productId.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    }

    if (dateRange.start) {
      filtered = filtered.filter(sale =>
        new Date(sale.createdAt) >= new Date(dateRange.start)
      )
    }

    if (dateRange.end) {
      filtered = filtered.filter(sale =>
        new Date(sale.createdAt) <= new Date(dateRange.end)
      )
    }

    return filtered
  }

  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-muted-foreground">View and manage all sales orders</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders ({filteredSales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading orders...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No orders found</div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedSales.map((sale) => (
                  <div
                    key={sale._id}
                    className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedOrder(sale)
                      setDialogOpen(true)
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">Order #{sale._id.slice(-8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">KES {sale.total.toFixed(2)}</p>
                        <Badge variant="outline">{sale.paymentMethod}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </p>
                      {sale.staffId && (
                        <p className="text-sm text-muted-foreground">
                          Sold by: {sale.staffId.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <OrderDetailsDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
      />
    </div>
  )
}
