'use client'

import { Wine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OpenBottle {
  _id: string
  bottleNumber: number
  productName: string
  productSize: string
  brandCategory?: string
  openedAt: string
  openedBy?: { _id: string; name: string } | null
  remainingFraction: number
}

interface OpenBottlesListProps {
  bottles: OpenBottle[]
  onViewBottle: (bottleId: string) => void
  showProductInfo?: boolean
  compact?: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

export function OpenBottlesList({
  bottles,
  onViewBottle,
  showProductInfo = true,
  compact = false,
}: OpenBottlesListProps) {
  if (bottles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Wine size={32} className="opacity-20" />
        <p className="text-sm">No bottles currently open</p>
      </div>
    )
  }

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
      {bottles.map((bottle) => {
        const openedAgo = formatDistanceToNow(new Date(bottle.openedAt), {
          addSuffix: true,
        })
        const remainingPct = (bottle.remainingFraction * 100).toFixed(0)

        return (
          <div
            key={bottle._id}
            className="flex flex-col p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
          >
            {/* Product name and bottle number */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Wine size={16} className="text-muted-foreground shrink-0" />
                  <h3 className="font-semibold text-sm truncate">
                    {showProductInfo ? (
                      <>
                        {bottle.productName} {bottle.productSize}
                      </>
                    ) : (
                      `Bottle #${bottle.bottleNumber}`
                    )}
                  </h3>
                </div>
                {showProductInfo && (
                  <p className="text-xs text-muted-foreground ml-6">
                    Bottle #{bottle.bottleNumber}
                    {bottle.brandCategory && ` · ${bottle.brandCategory}`}
                  </p>
                )}
              </div>
              
              {/* Remaining fraction indicator */}
              <div className="shrink-0 text-right">
                <div className="text-xs font-medium text-emerald-600">
                  {remainingPct}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  remaining
                </div>
              </div>
            </div>

            {/* Opened info */}
            <div className="text-xs text-muted-foreground mb-3">
              Opened {openedAgo}
              {bottle.openedBy?.name && ` · ${bottle.openedBy.name}`}
            </div>

            {/* Action button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewBottle(bottle._id)}
              className="w-full"
            >
              View Bottle
            </Button>
          </div>
        )
      })}
    </div>
  )
}
