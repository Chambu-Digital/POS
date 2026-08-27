'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Wine, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ServingSale {
  servingId: string
  servingName: string
  servingsPerContainer: number
  sellingPrice: number
  quantity: number
  revenue: number
  bottlesUsed: number[]
  bottleCount: number
  estimatedBottlesConsumed: string | null
}

interface ProductServingSales {
  inventoryItemId: string
  productName: string
  productSize: string
  brandName: string
  brandCategory: string
  servings: ServingSale[]
  totalRevenue: number
  totalQuantity: number
}

interface ServingSalesSummary {
  totalRevenue: number
  totalServings: number
  productsCount: number
  bottleTrackingCoverage: number
  totalSalesLines: number
  linesWithBottleTracking: number
}

interface ServingSalesReportProps {
  products: ProductServingSales[]
  summary: ServingSalesSummary
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ServingSalesReport({ products, summary }: ServingSalesReportProps) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <Wine size={32} className="opacity-20" />
          <p className="text-sm">No serving sales in this period</p>
        </CardContent>
      </Card>
    )
  }

  const coverageColor = summary.bottleTrackingCoverage >= 80 
    ? 'text-emerald-600'
    : summary.bottleTrackingCoverage >= 50
    ? 'text-orange-600'
    : 'text-red-600'

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">KES {summary.totalRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Servings</p>
              <p className="text-2xl font-bold">{summary.totalServings.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Products</p>
              <p className="text-2xl font-bold">{summary.productsCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bottle Tracking</p>
              <p className={cn('text-2xl font-bold', coverageColor)}>
                {summary.bottleTrackingCoverage.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.linesWithBottleTracking} of {summary.totalSalesLines} sales
              </p>
            </div>
          </div>

          {/* Data quality warning */}
          {summary.bottleTrackingCoverage < 80 && (
            <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-200 flex gap-2">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-900">
                  {summary.bottleTrackingCoverage < 50 ? 'Poor' : 'Partial'} Bottle Tracking Coverage
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  {summary.totalSalesLines - summary.linesWithBottleTracking} serving sales lack bottle tracking.
                  This may indicate incomplete POS data or sales from before V2 tracking was enabled.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Serving Sales by Product
            <Badge variant="secondary" className="text-xs">
              {products.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {products.map((product, idx) => (
            <div key={product.inventoryItemId} className="space-y-2">
              {/* Product Header */}
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                    <p className="font-semibold truncate">
                      {product.productName} {product.productSize}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {product.brandName && (
                      <Badge variant="outline" className="text-xs">
                        {product.brandName}
                      </Badge>
                    )}
                    {product.brandCategory && (
                      <Badge variant="secondary" className="text-xs">
                        {product.brandCategory}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-semibold">
                    KES {product.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product.totalQuantity} servings
                  </p>
                </div>
              </div>

              {/* Servings Breakdown */}
              <div className="pl-4 space-y-1">
                {product.servings.map((serving) => (
                  <div
                    key={serving.servingId}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/40 text-sm"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Wine size={14} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{serving.servingName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                          {serving.bottleCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {serving.bottleCount} bottle{serving.bottleCount !== 1 ? 's' : ''}
                              </Badge>
                              {serving.bottlesUsed.length > 0 && (
                                <span className="font-mono">
                                  #{serving.bottlesUsed.join(', #')}
                                </span>
                              )}
                            </span>
                          )}
                          {serving.estimatedBottlesConsumed && (
                            <span className="text-muted-foreground">
                              ≈ {serving.estimatedBottlesConsumed} bottles consumed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <span className="text-muted-foreground">
                        {serving.quantity} sold
                      </span>
                      <span className="font-semibold w-24 text-right">
                        KES {serving.revenue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Separator between products (except last) */}
              {idx < products.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}

          {/* Grand Total */}
          <Separator className="my-4" />
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg">
            <div>
              <p className="font-semibold">Total</p>
              <p className="text-xs text-muted-foreground">
                {products.length} product{products.length !== 1 ? 's' : ''} · {summary.totalServings} servings
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">
                KES {summary.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 flex gap-3">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-blue-900">
            <p className="font-medium">About This Report</p>
            <p className="text-xs text-blue-700 mt-1">
              This report shows serving-level sales breakdown with bottle tracking. It uses V2 tracking data from BarTabLine,
              showing which specific bottles were used for each serving. The "estimated bottles consumed" is calculated as:
              servings sold ÷ servings per container.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
