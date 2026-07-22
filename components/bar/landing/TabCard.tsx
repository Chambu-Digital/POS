import { BarTab } from '@/store/bar-store'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function TabCard({ tab }: { tab: BarTab }) {
  const statusColors = {
    open: 'bg-blue-100 text-blue-800',
    hold: 'bg-orange-100 text-orange-800',
    billing: 'bg-purple-100 text-purple-800',
    paid: 'bg-green-100 text-green-800'
  }

  return (
    <Link href={`/dashboard/bar/tabs/${tab._id}`}>
      <Card className="hover:bg-muted/50 cursor-pointer min-h-[44px] transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {tab.tabNumber}
          </CardTitle>
          <Badge variant="secondary" className={statusColors[tab.status]}>
            {tab.status}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">KES {tab.remaining !== undefined ? tab.remaining.toLocaleString() : tab.total.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {tab.customerName || 'Walk-in'} {tab.tableNumber ? `• Table ${tab.tableNumber}` : ''}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
