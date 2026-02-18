'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'
import { getConflicts } from '@/lib/indexeddb'
import Link from 'next/link'

export function ConflictNotification() {
  const [conflicts, setConflicts] = useState<any[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    checkForConflicts()

    // Check periodically
    const interval = setInterval(checkForConflicts, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  async function checkForConflicts() {
    try {
      const activeConflicts = await getConflicts()
      setConflicts(activeConflicts)
      
      if (activeConflicts.length > 0) {
        setDismissed(false)
      }
    } catch (error) {
      console.error('[Conflicts] Failed to check conflicts:', error)
    }
  }

  if (conflicts.length === 0 || dismissed) {
    return null
  }

  return (
    <div className="fixed top-20 right-6 z-50 max-w-md">
      <Alert variant="destructive" className="border-2 shadow-lg">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="flex items-center justify-between">
          <span>Data Conflict Detected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="h-6 w-6 p-0"
          >
            <X size={16} />
          </Button>
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>
            {conflicts.length} {conflicts.length === 1 ? 'conflict' : 'conflicts'} found between local and server data.
            This requires manual review.
          </p>
          <div className="flex gap-2 mt-3">
            <Link href="/dashboard/settings?tab=conflicts">
              <Button size="sm" variant="outline" className="bg-white">
                Review Conflicts
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
