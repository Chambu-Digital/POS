import { useBarStore } from '@/store/bar-store'
import { Button } from '@/components/ui/button'

export function DiscountSelector() {
  const { activeTab, applyDiscount } = useBarStore()
  if (!activeTab) return null

  const pcts = [0, 5, 10, 15, 20]

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Apply Discount</p>
      <div className="flex gap-2">
        {pcts.map(pct => (
          <Button
            key={pct}
            variant={activeTab.discountPct === pct ? 'default' : 'outline'}
            size="sm"
            onClick={() => applyDiscount(activeTab._id, pct)}
            disabled={activeTab.status !== 'open'}
          >
            {pct}%
          </Button>
        ))}
      </div>
    </div>
  )
}
