'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Store,
  Package,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Users,
  ShoppingCart,
  XCircle,
} from 'lucide-react'

interface MobileShop {
  _id: string
  name: string
  sourceBranchId: {
    _id: string
    name: string
  }
  sellers: Array<{
    _id: string
    name: string
  }>
  salesMade: {
    totalRevenue: number
    salesCount: number
    itemsSold: number
  }
}

interface StockItem {
  productId: string
  productName: string
  deployed: number
  sold: number
  remaining: number
  returned: number
}

interface Variance {
  productId: string
  productName: string
  deployed: number
  sold: number
  expected: number
  actual: number
  difference: number
}

export default function CloseMobileShopPage() {
  const router = useRouter()
  const params = useParams()
  const shopId = params.id as string

  const [shop, setShop] = useState<MobileShop | null>(null)
  const [currentStock, setCurrentStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [variance, setVariance] = useState<Variance[]>([])
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchShopDetails()
  }, [shopId])

  const fetchShopDetails = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/mobile-shops/${shopId}`)
      const data = await res.json()

      if (res.ok) {
        setShop(data.shop)
        
        // Initialize stock items with live stats
        const stockItems = data.liveStats.currentStock.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          deployed: item.deployed,
          sold: item.sold,
          remaining: item.remaining,
          returned: item.remaining, // Default to remaining stock
        }))
        setCurrentStock(stockItems)
        calculateVariance(stockItems)
      }
    } catch (error) {
      console.error('Error fetching shop details:', error)
      setError('Failed to load shop details')
    } finally {
      setLoading(false)
    }
  }

  const updateReturned = (productId: string, quantity: number) => {
    const updated = currentStock.map((item) =>
      item.productId === productId
        ? { ...item, returned: Math.max(0, quantity) }
        : item
    )
    setCurrentStock(updated)
    calculateVariance(updated)
  }

  const calculateVariance = (stockItems: StockItem[]) => {
    const calculated = stockItems.map((item) => {
      const expected = item.remaining // What should remain after sales
      const actual = item.returned // What's actually being returned
      const difference = actual - expected // negative = shortage, positive = surplus

      return {
        productId: item.productId,
        productName: item.productName,
        deployed: item.deployed,
        sold: item.sold,
        expected,
        actual,
        difference,
      }
    })
    setVariance(calculated)
  }

  const hasVariance = variance.some((v) => v.difference !== 0)
  const totalVariance = variance.reduce((sum, v) => sum + v.difference, 0)

  const handleClose = async () => {
    try {
      setSubmitting(true)
      setError('')

      const stockReturned = currentStock.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.returned,
      }))

      const res = await fetch(`/api/mobile-shops/${shopId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockReturned,
          notes,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to close mobile shop')
      }

      // Success - redirect to detail page
      router.push(`/dashboard/mobile-shops/${shopId}`)
    } catch (error: any) {
      setError(error.message)
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount)
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <XCircle className="h-6 w-6 text-red-600" />
          Close Mobile Shop
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Reconcile stock and deactivate sellers for <strong>{shop.name}</strong>
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1 text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Total Revenue</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(shop.salesMade.totalRevenue)}</div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm">Sales Made</span>
          </div>
          <div className="text-2xl font-bold">{shop.salesMade.salesCount}</div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm">Sellers</span>
          </div>
          <div className="text-2xl font-bold">{shop.sellers.length}</div>
        </div>
      </div>

      {/* Stock Reconciliation */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Stock Reconciliation
        </h2>

        <div className="space-y-4">
          {currentStock.map((item) => {
            const itemVariance = variance.find((v) => v.productId === item.productId)
            const hasIssue = itemVariance && itemVariance.difference !== 0

            return (
              <div
                key={item.productId}
                className={`p-4 rounded-lg border-2 ${
                  hasIssue
                    ? itemVariance.difference < 0
                      ? 'border-red-200 bg-red-50'
                      : 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.productName}</h3>
                    <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                      <div>
                        <div className="text-gray-600">Deployed</div>
                        <div className="font-semibold">{item.deployed}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Sold</div>
                        <div className="font-semibold">{item.sold}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Expected</div>
                        <div className="font-semibold">{item.remaining}</div>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 text-right">
                    <label className="block text-sm text-gray-600 mb-1">Returned *</label>
                    <input
                      type="number"
                      min="0"
                      value={item.returned}
                      onChange={(e) =>
                        updateReturned(item.productId, parseInt(e.target.value) || 0)
                      }
                      className="w-24 border rounded px-3 py-2 text-center font-semibold"
                    />
                  </div>
                </div>

                {/* Variance Indicator */}
                {itemVariance && itemVariance.difference !== 0 && (
                  <div
                    className={`mt-3 p-2 rounded flex items-center gap-2 text-sm ${
                      itemVariance.difference < 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      {itemVariance.difference < 0 ? 'Shortage' : 'Surplus'}:{' '}
                      <strong>
                        {Math.abs(itemVariance.difference)} unit(s)
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Variance Summary */}
      {hasVariance && (
        <div
          className={`mb-6 p-4 rounded-lg border-2 ${
            totalVariance < 0
              ? 'border-red-300 bg-red-50'
              : 'border-blue-300 bg-blue-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className={`h-5 w-5 mt-0.5 ${
                totalVariance < 0 ? 'text-red-600' : 'text-blue-600'
              }`}
            />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">
                {totalVariance < 0 ? 'Stock Shortage Detected' : 'Stock Surplus Detected'}
              </h3>
              <p className="text-sm mb-3">
                Total variance: <strong>{Math.abs(totalVariance)} unit(s)</strong>
              </p>
              <ul className="space-y-1 text-sm">
                {variance
                  .filter((v) => v.difference !== 0)
                  .map((v) => (
                    <li key={v.productId}>
                      • {v.productName}:{' '}
                      <strong>
                        {v.difference > 0 ? '+' : ''}
                        {v.difference}
                      </strong>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Closing Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any issues, observations, or notes about this deployment..."
          className="w-full border rounded-lg px-3 py-2 h-24 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="bg-gray-50 border rounded-lg p-6">
        <h3 className="font-semibold mb-2">What happens when you close?</h3>
        <ul className="text-sm text-gray-700 space-y-1 mb-4">
          <li>✓ Stock will be returned to {shop.sourceBranchId.name}</li>
          <li>✓ All {shop.sellers.length} temp seller(s) will be deactivated</li>
          <li>✓ Sales data and variance report will be saved</li>
          <li>✓ This action cannot be undone</li>
        </ul>

        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            disabled={submitting}
            className="flex-1 border px-6 py-3 rounded-lg hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
            className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Closing...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Close Mobile Shop
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Confirm Close Shop</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to close <strong>{shop.name}</strong>?
                </p>
                {hasVariance && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ There is a variance of {Math.abs(totalVariance)} unit(s)
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 border px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Closing...' : 'Confirm Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
