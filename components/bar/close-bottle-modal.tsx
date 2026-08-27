'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface OpenBottle {
  _id: string
  bottleNumber: number
  openedAt: string
  remainingFraction: number
}

interface CloseBottleModalProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  productSize: string
  bottles: OpenBottle[]
  onBottleClosed: () => void
}

export function CloseBottleModal({
  isOpen,
  onClose,
  productName,
  productSize,
  bottles,
  onBottleClosed,
}: CloseBottleModalProps) {
  const [closing, setClosing] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleCloseBottle(bottleId: string) {
    setClosing(bottleId)
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
      
      onBottleClosed()
      
      // If only one bottle was open, close the modal
      if (bottles.length === 1) {
        onClose()
      }
    } catch (error: any) {
      console.error('Failed to close bottle:', error)
      toast.error(error.message || 'Failed to close bottle')
    } finally {
      setClosing(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Close Bottle</h2>
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
        </div>

        {/* Bottle List */}
        <div className="p-4 space-y-2">
          {bottles.map((bottle) => {
            const remainingPct = (bottle.remainingFraction * 100).toFixed(0)
            const openedAgo = formatDistanceToNow(new Date(bottle.openedAt), { addSuffix: true })

            return (
              <div
                key={bottle._id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium">Bottle #{bottle.bottleNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Opened {openedAgo} • {remainingPct}% remaining
                  </p>
                </div>
                <button
                  onClick={() => handleCloseBottle(bottle._id)}
                  disabled={closing !== null}
                  className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {closing === bottle._id ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    '×'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
