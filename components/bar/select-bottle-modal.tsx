'use client'

import { X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface BottleOption {
  bottleId: string
  bottleNumber: number
  remainingFraction: number
  openedAt: string
  canProvide: boolean
  availableServings: number
}

interface SelectBottleModalProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  productSize: string
  servingName: string
  quantity: number
  bottles: BottleOption[]
  onBottleSelected: (bottleId: string) => void
}

export function SelectBottleModal({
  isOpen,
  onClose,
  productName,
  productSize,
  servingName,
  quantity,
  bottles,
  onBottleSelected,
}: SelectBottleModalProps) {
  if (!isOpen) return null

  function handleSelect(bottleId: string) {
    onBottleSelected(bottleId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Select Bottle</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {productName} {productSize}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selling: {quantity}× {servingName}
          </p>
        </div>

        {/* Bottle List */}
        <div className="p-4 space-y-2">
          {bottles.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No bottles available
            </div>
          ) : (
            bottles.map((bottle) => {
              const remainingPct = (bottle.remainingFraction * 100).toFixed(0)
              const openedAgo = formatDistanceToNow(new Date(bottle.openedAt), { addSuffix: true })

              return (
                <button
                  key={bottle.bottleId}
                  onClick={() => handleSelect(bottle.bottleId)}
                  disabled={!bottle.canProvide}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    bottle.canProvide
                      ? 'hover:bg-muted/50 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium">Bottle #{bottle.bottleNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Opened {openedAgo} • {remainingPct}% remaining
                    </p>
                    {!bottle.canProvide && (
                      <p className="text-xs text-yellow-700 mt-1">
                        ⚠️ Can only provide {bottle.availableServings} {servingName}
                      </p>
                    )}
                  </div>
                  <div className="text-sm font-medium text-primary">
                    {bottle.canProvide ? 'Select →' : 'Unavailable'}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="p-4 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Select the physical bottle you're pouring from
          </p>
        </div>
      </div>
    </div>
  )
}
