import { useBarStore } from '@/store/bar-store'
import { Badge } from '@/components/ui/badge'

export function OutstandingBadge() {
  const { outstandingTotal } = useBarStore()

  if (outstandingTotal <= 0) return null

  return (
    <Badge variant="destructive" className="text-sm px-3 py-1">
      Outstanding: KES {outstandingTotal.toLocaleString()}
    </Badge>
  )
}
