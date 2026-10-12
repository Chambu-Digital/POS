'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Store,
  MapPin,
  Calendar,
  Users,
  Package,
  TrendingUp,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  XCircle,
} from 'lucide-react'

interface MobileShop {
  _id: string
  name: string
  status: 'active' | 'closed'
  sourceBranchId: {
    _id: string
    name: string
    code: string
    address?: string
  }
  sellers: Array<{
    _id: string
    name: string
    email: string
    phone?: string
    isTemporary: boolean
    active: boolean
  }>
  stockOut: Array<{
    productId: string
    productName: string
    quantity: number
    deployedAt: string
  }>
  stockReturned: Array<{
    productId: string
    productName: string
    quantity: number
    returnedAt: string
  }>
  salesMade: {
    totalRevenue: number
    salesCount: number
    itemsSold: number
  }
  variance?: Array<{
    productId: string
    productName: string
    deployed: number
    sold: number
    expected: number
    actual: number
    difference: number
    notes: string
  }>
  deployedAt: string
  closedAt?: string
  closedBy?: {
    name: string
  }
  notes: string
}

interface LiveStats {
  totalRevenue: number
  salesCount: number
  itemsSold: number
  currentStock: Array<{
    productId: string
    productName: string
    deployed: number
    sold: number
    remaining: number
  }>
}

interface Sale {
  _id: string
  orderNumber: string
  staffId: {
    name: string
  }
  items: Array<{
    productName: string
    quantity: number
    price: number
  }>
  total: number
  createdAt: string
}

export default function MobileShopDetailPage() {
  const router = useRouter()
  const params = useParams()
  const shopId = params.id as string

  const [shop, setShop] = useState<MobileShop | null>(null)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'sellers'>('overview')

  useEffect(() => {
    fetchShopDetails()
    // Auto-refresh for active shops
    const interval = setInterval(() => {
      if (shop?.status === 'active') {
        fetchShopDetails()
      }
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [shopId, shop?.status])

  const fetchShopDetails = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/mobile-shops/${shopId}`)
      const data = await res.json()

      if (res.ok) {
        setShop(data.shop)
        setLiveStats(data.liveStats)
        setSales(data.sales || [])
      }
    } catch (error) {
      console.error('Error fetching shop details:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Mobile shop not found</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6" />
              {shop.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {shop.sourceBranchId.name}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(shop.deployedAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                shop.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {shop.status === 'active' ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 animate-pulse" />
                  Active
                </span>
              ) : (
                'Closed'
              )}
            </span>

            {shop.status === 'active' && (
              <button
                onClick={() => router.push(`/dashboard/mobile-shops/${shopId}/close`)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Close Shop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Total Revenue</span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(shop.status === 'active' ? liveStats?.totalRevenue || 0 : shop.salesMade.totalRevenue)}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm">Sales Count</span>
          </div>
          <div className="text-2xl font-bold">
            {shop.status === 'active' ? liveStats?.salesCount || 0 : shop.salesMade.salesCount}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Package className="h-4 w-4" />
            <span className="text-sm">Items Sold</span>
          </div>
          <div className="text-2xl font-bold">
            {shop.status === 'active' ? liveStats?.itemsSold || 0 : shop.salesMade.itemsSold}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">Sellers</span>
          </div>
          <div className="text-2xl font-bold">{shop.sellers.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-4">
          {['overview', 'sales', 'sellers'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 px-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Current Stock */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Current Stock
            </h2>
            <div className="space-y-2">
              {shop.status === 'active' && liveStats?.currentStock.map((item) => (
                <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-sm text-gray-600">
                      Deployed: {item.deployed} | Sold: {item.sold}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{item.remaining}</div>
                    <div className="text-xs text-gray-500">remaining</div>
                  </div>
                </div>
              ))}

              {shop.status === 'closed' && shop.variance && shop.variance.map((item) => (
                <div key={item.productId} className="p-3 bg-gray-50 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{item.productName}</div>
                    <span
                      className={`text-sm font-medium ${
                        item.difference === 0
                          ? 'text-green-600'
                          : item.difference < 0
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {item.difference > 0 && '+'}
                      {item.difference}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                    <div>
                      <div className="font-medium">Deployed</div>
                      <div>{item.deployed}</div>
                    </div>
                    <div>
                      <div className="font-medium">Sold</div>
                      <div>{item.sold}</div>
                    </div>
                    <div>
                      <div className="font-medium">Expected</div>
                      <div>{item.expected}</div>
                    </div>
                    <div>
                      <div className="font-medium">Returned</div>
                      <div>{item.actual}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {shop.notes && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-2">Notes</h2>
              <p className="text-gray-700">{shop.notes}</p>
            </div>
          )}

          {/* Closed Info */}
          {shop.status === 'closed' && (
            <div className="bg-gray-50 border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold">Shop Closed</h2>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Closed on: {formatDate(shop.closedAt!)}</p>
                {shop.closedBy && <p>Closed by: {shop.closedBy.name}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Sales History</h2>
          </div>
          <div className="divide-y">
            {sales.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                No sales yet
              </div>
            ) : (
              sales.map((sale) => (
                <div key={sale._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium">Order #{sale.orderNumber}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {sale.staffId.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(sale.total)}</div>
                      <div className="text-xs text-gray-500">{formatTime(sale.createdAt)}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {sale.items.map((item, i) => (
                      <span key={i}>
                        {item.quantity}x {item.productName}
                        {i < sale.items.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sellers Tab */}
      {activeTab === 'sellers' && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Sellers</h2>
          </div>
          <div className="divide-y">
            {shop.sellers.map((seller) => {
              const sellerSales = sales.filter((s) => s.staffId.name === seller.name)
              const sellerRevenue = sellerSales.reduce((sum, s) => sum + s.total, 0)

              return (
                <div key={seller._id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {seller.name}
                        {seller.isTemporary && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            Temp
                          </span>
                        )}
                        {!seller.active && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{seller.email}</div>
                      {seller.phone && (
                        <div className="text-sm text-gray-600">{seller.phone}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(sellerRevenue)}</div>
                      <div className="text-sm text-gray-600">{sellerSales.length} sales</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
