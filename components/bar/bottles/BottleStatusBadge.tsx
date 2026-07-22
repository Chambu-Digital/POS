import { Badge } from '@/components/ui/badge'

export function BottleStatusBadge({ state }: { state: 'full' | 'open' | 'closed' }) {
  const colors = {
    full: 'bg-green-100 text-green-800',
    open: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-800'
  }
  return <Badge variant="outline" className={colors[state]}>{state}</Badge>
}
