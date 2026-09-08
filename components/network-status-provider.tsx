'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { onNetworkChange, isOnline } from '@/lib/network'
import { OfflineIndicator } from './offline-indicator'

/**
 * Global network status provider
 * Shows a banner when offline and toast notifications on status changes
 */
export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check initial status
    const initialOnline = isOnline()
    setOnline(initialOnline)
    setShowBanner(!initialOnline)

    // Listen for network changes
    const cleanup = onNetworkChange(
      () => {
        // Back online
        setOnline(true)
        setShowBanner(false)
        toast.success('Connection restored', {
          description: 'You are back online',
          duration: 3000,
        })
      },
      () => {
        // Gone offline
        setOnline(false)
        setShowBanner(true)
        toast.error('No internet connection', {
          description: 'You are currently offline',
          duration: 5000,
        })
      }
    )

    return cleanup
  }, [])

  return (
    <>
      {/* Persistent offline banner */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <OfflineIndicator
            variant="banner"
            message="No internet connection. Some features may not work."
            showRetry={false}
          />
        </div>
      )}
      {/* Add padding when banner is visible */}
      <div className={showBanner ? 'pt-12' : ''}>
        {children}
      </div>
    </>
  )
}
