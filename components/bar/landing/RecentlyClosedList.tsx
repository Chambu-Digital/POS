import { useBarStore } from '@/store/bar-store'

export function RecentlyClosedList() {
  const { recentlyClosed } = useBarStore()

  if (recentlyClosed.length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Recently Closed</h3>
      <div className="space-y-2">
        {recentlyClosed.map(tab => (
          <div key={tab._id} className="flex justify-between items-center p-3 rounded-md border">
            <div>
              <p className="font-medium">{tab.tabNumber}</p>
              <p className="text-xs text-muted-foreground">Closed at {tab.closedAt ? new Date(tab.closedAt).toLocaleTimeString() : ''}</p>
            </div>
            <div className="font-medium text-green-600">KES {tab.total.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
