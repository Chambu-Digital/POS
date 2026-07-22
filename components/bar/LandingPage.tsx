'use client'

import { useEffect, useState } from 'react'
import { useBarStore } from '@/store/bar-store'
import { OpenTabsGrid } from './landing/OpenTabsGrid'
import { OutstandingBadge } from './landing/OutstandingBadge'
import { RecentlyClosedList } from './landing/RecentlyClosedList'
import { NewTabForm } from './tabs/NewTabForm'
import { Button } from '@/components/ui/button'
import { Plus, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function LandingPage() {
  const { loadLandingData } = useBarStore()
  const [newTabOpen, setNewTabOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadLandingData()
    const interval = setInterval(() => loadLandingData(), 30000)
    return () => clearInterval(interval)
  }, [loadLandingData])

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bar & Restaurant</h1>
          <p className="text-muted-foreground mt-1">Manage open tabs, sales, and inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <OutstandingBadge />
          <Button variant="outline" onClick={() => router.push('/dashboard/bar/quick-sale')}>
            <Zap className="mr-2 h-4 w-4" /> Quick Sale
          </Button>
          <Button onClick={() => setNewTabOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Tab
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-xl font-semibold">Open Tabs</h2>
          <OpenTabsGrid />
        </div>
        <div className="lg:col-span-1">
          <RecentlyClosedList />
        </div>
      </div>

      <NewTabForm open={newTabOpen} onOpenChange={setNewTabOpen} />
    </div>
  )
}
