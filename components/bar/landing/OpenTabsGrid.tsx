import { useBarStore } from '@/store/bar-store'
import { TabCard } from './TabCard'

export function OpenTabsGrid() {
  const { openTabs } = useBarStore()

  if (openTabs.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        No open tabs found.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {openTabs.map((tab) => (
        <TabCard key={tab._id} tab={tab} />
      ))}
    </div>
  )
}
