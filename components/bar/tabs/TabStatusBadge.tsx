import { Badge } from '@/components/ui/badge'

export function TabStatusBadge({ status }: { status: string }) {
  const statusColors: any = {
    open: 'bg-blue-100 text-blue-800',
    hold: 'bg-orange-100 text-orange-800',
    billing: 'bg-purple-100 text-purple-800',
    paid: 'bg-green-100 text-green-800'
  }
  return (
    <Badge variant="secondary" className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
      {status}
    </Badge>
  )
}
