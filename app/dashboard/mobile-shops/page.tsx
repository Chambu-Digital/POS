'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Store,
  Plus,
  Calendar,
  Users,
  Package,
  TrendingUp,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface MobileShop {
  _id: string
  name: string
  status: 'active' | 'closed'
  sourceBranchId: {
    _id: string
    name: string
    code: string
  }
  sellers: Array<{
    _id: string
    name: string
    email: string
  }>
  stockOut: Array<{
    productName: string
    quantity: number
  }>
  salesMade: {
    totalRevenue: number
    salesCount: number
    itemsSold: number
  }
  deployedAt: string
  closedAt?: string
  variance?: Array<{
    difference: number
  }>
}

export default function MobileShopsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active')
  const [shops, setShops] = useState<MobileShop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchShops(activeTab)
  }, [activeTab])

  const fetchShops = async (status: 'active' | 'closed') => {
    try {
      setLoading(true)
      const res = await fetch(`/api/mobile-shops?status=${status}`)
      const data = await res.json()
      setShops(data.shops || [])
    } catch (error) {
      console.error('Error fetching mobile shops:', error)
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

  const getVarianceStatus = (shop: MobileShop) => {
    if (!shop.variance || shop.variance.length === 0) return null
    const totalVariance = shop.variance.reduce((sum, v) => sum + v.difference, 0)
    if (totalVariance === 0) return { label: 'Balanced', color: 'text-green-600' }
    if (totalVariance < 0) return { label: 'Shortage', color: 'text-red-600' }
    return { label: 'Surplus', color: 'text-blue-600' }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6" />
            Mobile Shops
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Deploy field sales teams with stock and temp sellers
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/mobile-shops/deploy')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Deploy Mobile Shop
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 px-2 font-medium transition-colors ${
              activeTab === 'active'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active Shops
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`pb-3 px-2 font-medium transition-colors ${
              activeTab === 'closed'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Closed Shops
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && shops.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {activeTab} mobile shops
          </h3>
          <p className="text-gray-600 mb-4">
            {activeTab === 'active'
              ? 'Deploy your first mobile shop to start field sales'
              : 'Closed shops will appear here'}
          </p>
          {activeTab === 'active' && (
            <button
              onClick={() => router.push('/dashboard/mobile-shops/deploy')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Deploy Mobile Shop
            </button>
          )}
        </div>
      )}

      {/* Shop Cards */}
      {!loading && shops.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => {
            const varianceStatus = getVarianceStatus(shop)
            return (
              <div
                key={shop._id}
                onClick={() => router.push(`/dashboard/mobile-shops/${shop._id}`)}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{shop.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-3 w-3" />
                      {shop.sourceBranchId.name}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      shop.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {shop.status}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                      <TrendingUp className="h-3 w-3" />
                      Revenue
                    </div>
                    <div className="font-semibold text-sm">
                      {formatCurrency(shop.salesMade.totalRevenue)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                      <Package className="h-3 w-3" />
                      Items Sold
                    </div>
                    <div className="font-semibold text-sm">
                      {shop.salesMade.itemsSold}
                    </div>
                  </div>
                </div>

                {/* Sellers */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Users className="h-4 w-4" />
                  <span>{shop.sellers.length} seller(s)</span>
                </div>

                {/* Stock Items */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <Package className="h-4 w-4" />
                  <span>{shop.stockOut.length} product(s) deployed</span>
                </div>

                {/* Variance Status (closed shops only) */}
                {shop.status === 'closed' && varianceStatus && (
                  <div className={`flex items-center gap-2 text-sm mb-3 ${varianceStatus.color}`}>
                    {varianceStatus.label === 'Balanced' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span>{varianceStatus.label}</span>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-1 text-xs text-gray-500 pt-3 border-t">
                  <Calendar className="h-3 w-3" />
                  {shop.status === 'active'
                    ? `Deployed ${formatDate(shop.deployedAt)}`
                    : `Closed ${formatDate(shop.closedAt!)}`}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
