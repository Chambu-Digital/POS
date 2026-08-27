'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Clock, User, Receipt } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BottleData {
  _id: string
  bottleNumber: number
  state: 'open' | 'closed'
  remainingFraction: number
  openedAt: string
  openedBy?: { _id: string; name: string } | null
  closedAt?: string
  closedBy?: { _id: string; name: string } | null
  inventoryItemId: {
    _id: string
    name: string
    size: string
    brandName?: string
    brandCategory?: string
  }
}

interface CapacityProjection {
  servingId: string
  servingName: string
  servingsPerContainer: number
  sellingPrice: number
  availableServings: number
  potentialRevenue: number
}

interface ProjectionSummary {
  totalPotentialRevenue: number
  remainingPercentage: number
  servingTypesAvailable: number
}

interface VarianceData {
  hasVarianceData: boolean
  bottleNumber?: number
  productName?: string
  productSize?: string
  brandCategory?: string
  remainingFraction?: number
  fractionConsumed?: number
  expectedServings?: Array<{ servingName: string; quantity: number }>
  totalExpected?: number
  actualServings?: Array<{ servingName: string; quantity: number }>
  totalActual?: number
  varianceQuantity?: number
  variancePercentage?: number
  varianceFlag?: 'normal' | 'warning' | 'critical'
  closedBy?: string
  closedAt?: string
  notes?: string
  message?: string
}

interface ActivityEntry {
  timestamp: string
  type: 'serving_sold' | 'bottle_opened' | 'bottle_closed'
  servingName?: string
  quantity?: number
  tabNumber?: string
  staffName: string
  lineTotal?: number
  operation?: string
  details?: any
}

interface BottleTimelineDrawerProps {
  isOpen: boolean
  onClose: () => void
  bottleId: string | null
  onBottleClosed?: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BottleTimelineDrawer({
  isOpen,
  onClose,
  bottleId,
  onBottleClosed,
}: BottleTimelineDrawerProps) {
  const [loading, setLoading] = useState(true)
  const [bottle, setBottle] = useState<BottleData | null>(null)
  const [projections, setProjections] = useState<CapacityProjection[]>([])
  const [projectionSummary, setProjectionSummary] = useState<ProjectionSummary | null>(null)
  const [varianceData, setVarianceData] = useState<VarianceData | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (isOpen && bottleId) {
      loadBottleActivity()
    }
  }, [isOpen, bottleId])

  async function loadBottleActivity() {
    if (!bottleId) return
    
    setLoading(true)
    try {
      // Load bottle details with projections
      const [bottleRes, activityRes] = await Promise.all([
        fetch(`/api/bar/bottles/${bottleId}`),
        fetch(`/api/bar/bottles/${bottleId}/activity`)
      ])
      
      if (!bottleRes.ok) {
        const data = await bottleRes.json()
        throw new Error(data.error || 'Failed to load bottle')
      }
      
      if (!activityRes.ok) {
        const data = await activityRes.json()
        throw new Error(data.error || 'Failed to load bottle activity')
      }
      
      const bottleData = await bottleRes.json()
      const activityData = await activityRes.json()
      
      setBottle(bottleData.bottle)
      setProjections(bottleData.projections || [])
      setProjectionSummary(bottleData.summary || null)
      setActivity(activityData.activity)

      // If bottle is closed, fetch variance data
      if (bottleData.bottle.state === 'closed') {
        const varianceRes = await fetch(`/api/bar/bottles/${bottleId}/variance`)
        if (varianceRes.ok) {
          const varianceJson = await varianceRes.json()
          setVarianceData(varianceJson)
        }
      }
    } catch (error: any) {
      console.error('Failed to load bottle activity:', error)
      toast.error(error.message || 'Failed to load bottle activity')
    } finally {
      setLoading(false)
    }
  }

  async function handleCloseBottle() {
    if (!bottleId || !bottle) return
    
    const confirmed = confirm(
      `Close bottle #${bottle.bottleNumber}?\n\nThis will record any remaining fraction as variance.`
    )
    if (!confirmed) return

    setClosing(true)
    try {
      const res = await fetch(`/api/bar/bottles/${bottleId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to close bottle')
      }

      const data = await res.json()
      const variancePct = ((data.bottle.varianceFraction || 0) * 100).toFixed(1)
      
      toast.success(
        `Closed bottle #${data.bottle.bottleNumber}`,
        variancePct !== '0.0'
          ? { description: `Variance: ${variancePct}% remaining` }
          : undefined
      )
      
      onBottleClosed?.()
      onClose()
    } catch (error: any) {
      console.error('Failed to close bottle:', error)
      toast.error(error.message || 'Failed to close bottle')
    } finally {
      setClosing(false)
    }
  }

  const productName = bottle?.inventoryItemId?.name || 'Unknown Product'
  const productSize = bottle?.inventoryItemId?.size || ''
  const remainingPct = bottle ? (bottle.remainingFraction * 100).toFixed(0) : '0'

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">
              {productName} {productSize}
            </SheetTitle>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {bottle && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-muted-foreground">Bottle #{bottle.bottleNumber}</span>
              <Badge variant={bottle.state === 'open' ? 'default' : 'secondary'}>
                {bottle.state === 'open' ? '● Open' : 'Closed'}
              </Badge>
            </div>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">Loading bottle history...</p>
          </div>
        ) : !bottle ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Bottle not found</p>
          </div>
        ) : (
          <div className="space-y-6 pt-6">
            {/* ── Bottle Metadata ─────────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="text-muted-foreground" size={16} />
                <div>
                  <p className="font-medium">Opened</p>
                  <p className="text-muted-foreground">
                    {format(new Date(bottle.openedAt), 'PPp')}
                    {' · '}
                    {formatDistanceToNow(new Date(bottle.openedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <User className="text-muted-foreground" size={16} />
                <div>
                  <p className="font-medium">Opened by</p>
                  <p className="text-muted-foreground">
                    {bottle.openedBy?.name || 'Unknown'}
                  </p>
                </div>
              </div>

              {bottle.state === 'closed' && bottle.closedAt && (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="text-muted-foreground" size={16} />
                    <div>
                      <p className="font-medium">Closed</p>
                      <p className="text-muted-foreground">
                        {format(new Date(bottle.closedAt), 'PPp')}
                        {' · '}
                        {formatDistanceToNow(new Date(bottle.closedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {bottle.closedBy && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="text-muted-foreground" size={16} />
                      <div>
                        <p className="font-medium">Closed by</p>
                        <p className="text-muted-foreground">
                          {bottle.closedBy.name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <Separator />

            {/* ── Remaining Capacity (for open bottles) ──────────────────── */}
            {bottle.state === 'open' && projections.length > 0 && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Remaining Capacity</h3>
                    <Badge variant="secondary" className="text-xs">
                      {remainingPct}% left
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {projections.map((proj) => (
                      <div
                        key={proj.servingId}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{proj.servingName}</p>
                          <p className="text-xs text-muted-foreground">
                            {proj.availableServings} serving{proj.availableServings !== 1 ? 's' : ''} available
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            KES {proj.potentialRevenue.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            @ KES {proj.sellingPrice}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {projectionSummary && projectionSummary.totalPotentialRevenue > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-emerald-900">
                          Total Potential Revenue
                        </span>
                        <span className="text-sm font-bold text-emerald-700">
                          KES {projectionSummary.totalPotentialRevenue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />
              </>
            )}

            {/* ── Variance Analysis (for closed bottles) ─────────────────── */}
            {bottle.state === 'closed' && varianceData?.hasVarianceData && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Variance Analysis</h3>
                    <Badge
                      variant={
                        varianceData.varianceFlag === 'critical'
                          ? 'destructive'
                          : varianceData.varianceFlag === 'warning'
                          ? 'default'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {varianceData.varianceFlag === 'critical'
                        ? '⚠ Critical'
                        : varianceData.varianceFlag === 'warning'
                        ? '⚡ Warning'
                        : '✓ Normal'}
                    </Badge>
                  </div>

                  {/* Variance Summary Card */}
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      varianceData.varianceFlag === 'critical'
                        ? 'bg-red-50 border-red-300'
                        : varianceData.varianceFlag === 'warning'
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-emerald-50 border-emerald-300'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Expected Servings</p>
                        <p className="text-lg font-bold">{varianceData.totalExpected || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Actual Servings</p>
                        <p className="text-lg font-bold">{varianceData.totalActual || 0}</p>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Variance</span>
                      <div className="text-right">
                        <span
                          className={`text-lg font-bold ${
                            varianceData.varianceFlag === 'critical'
                              ? 'text-red-700'
                              : varianceData.varianceFlag === 'warning'
                              ? 'text-yellow-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {varianceData.varianceQuantity || 0} servings
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {Math.abs(varianceData.variancePercentage || 0).toFixed(1)}%{' '}
                          {(varianceData.varianceQuantity || 0) > 0 ? 'under' : 'over'}-sold
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expected Servings Breakdown */}
                  {varianceData.expectedServings && varianceData.expectedServings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">
                        Expected Breakdown
                      </p>
                      {varianceData.expectedServings.map((serving, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded border bg-muted/20"
                        >
                          <span className="text-sm">{serving.servingName}</span>
                          <span className="text-sm font-medium">{serving.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actual Servings Breakdown */}
                  {varianceData.actualServings && varianceData.actualServings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">
                        Actual Sales
                      </p>
                      {varianceData.actualServings.map((serving, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded border bg-muted/20"
                        >
                          <span className="text-sm">{serving.servingName}</span>
                          <span className="text-sm font-medium">{serving.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interpretation Help */}
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground">
                      {varianceData.varianceFlag === 'critical' ? (
                        <>
                          <strong className="text-red-700">Critical variance detected.</strong> This
                          bottle has significant discrepancy between expected and actual servings.
                          Investigate for spillage, theft, or measurement errors.
                        </>
                      ) : varianceData.varianceFlag === 'warning' ? (
                        <>
                          <strong className="text-yellow-700">Moderate variance.</strong> This bottle
                          shows some difference between expected and actual servings. Normal spillage
                          or pour variations may explain this.
                        </>
                      ) : (
                        <>
                          <strong className="text-emerald-700">Normal variance.</strong> This bottle's
                          serving count matches expectations within acceptable limits.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* ── Activity Timeline ───────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Bottle Activity</h3>

              {activity.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No activity recorded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="shrink-0 pt-0.5">
                        {entry.type === 'serving_sold' ? (
                          <Receipt size={16} className="text-emerald-600" />
                        ) : entry.type === 'bottle_opened' ? (
                          <div className="w-4 h-4 rounded-full bg-blue-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.timestamp), 'p')}
                        </p>
                        
                        {entry.type === 'serving_sold' && (
                          <div className="mt-0.5">
                            <p className="text-sm font-medium">
                              {entry.servingName} × {entry.quantity}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Tab {entry.tabNumber} · {entry.staffName}
                              {entry.lineTotal && (
                                <span className="ml-2 font-medium">
                                  KES {entry.lineTotal.toLocaleString()}
                                </span>
                              )}
                            </p>
                          </div>
                        )}

                        {entry.type === 'bottle_opened' && (
                          <p className="text-sm font-medium mt-0.5">
                            Bottle opened · {entry.staffName}
                          </p>
                        )}

                        {entry.type === 'bottle_closed' && (
                          <p className="text-sm font-medium mt-0.5">
                            Bottle closed · {entry.staffName}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Current Status ──────────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Current Status</h3>
              
              {bottle.state === 'open' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Bottle is currently open
                    <span className="ml-2 font-medium text-foreground">
                      {remainingPct}% remaining
                    </span>
                  </p>
                  <Button
                    onClick={handleCloseBottle}
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                    disabled={closing}
                  >
                    {closing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Closing...
                      </>
                    ) : (
                      'Close Bottle'
                    )}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Bottle is closed
                  {bottle.remainingFraction > 0 && (
                    <span className="ml-2 text-orange-600 font-medium">
                      ⚠ {remainingPct}% unaccounted
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
