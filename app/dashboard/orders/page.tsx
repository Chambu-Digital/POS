'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
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
    filterSales()
  }, [sales, searchQuery, dateRange])

  async function fetchSales() {
    try {
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
          item.productId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    }

    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start)
      const end = new Date(dateRange.end)
      end.setHours(23, 59, 59, 999)
      
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.createdAt)
        return saleDate >= start && saleDate <= end
      })
    }

    setFilteredSales(filtered)
    setCurrentPage(1)
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  function formatCurrency(amount: number) {
    return `KES ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  function handleOrderClick(sale: Sale) {
    setSelectedOrder(sale)
    setDialogOpen(true)
  }

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Include Deleted Orders
          </Button>
          <Button variant="outline" size="sm">
            Daily Sales Analysis
          </Button>
          <Button variant="destructive" size="sm">
            Action on Orders
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-40"
              />
              <span>-</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-40"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">#</th>
                  <th className="text-left p-3 font-medium">Order</th>
                  <th className="text-left p-3 font-medium">Time</th>
                  <th className="text-left p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Mode</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map((sale, index) => (
                    <tr 
                      key={sale._id} 
                      className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleOrderClick(sale)}
                    >
                      <td className="p-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">SALE-{sale._id.slice(-8).toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">
                          {sale.items.map(item => item.productId?.name || 'Unknown').join(', ')}
                        </div>
                      </td>
                      <td className="p-3 text-sm">{formatDate(sale.createdAt)}</td>
                      <td className="p-3 font-medium">{formatCurrency(sale.total)}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                          {sale.paymentMethod === 'mobile_money' ? 'M-Pesa' : 
                           sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
                Next
              </Button>
            </div>
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
