'use client'

import { ReactNode, useEffect, useState } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopNav } from '@/components/dashboard/top-nav'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { BackupPermissionDialog } from '@/components/pwa/backup-permission-dialog'
import { ConflictNotification } from '@/components/pwa/conflict-notification'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { DemoBanner } from '@/components/demo/demo-banner'
import { NetworkStatusProvider } from '@/components/network-status-provider'
import { Toaster } from 'sonner'
import PaymentNotificationOverlay from '@/components/payment-notification-overlay'

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [paymentNotification, setPaymentNotification] = useState<{
    enabled: boolean
    paymentUrl: string
    message: string
    daysOverdue: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (stored !== null) setSidebarCollapsed(stored === 'true')
    } catch {}
  }, [])

  function handleCollapsedChange(v: boolean) {
    setSidebarCollapsed(v)
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(v)) } catch {}
  }

  useEffect(() => {
    fetch('/api/tenant/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.paymentNotification) setPaymentNotification(data.paymentNotification)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const showOverlay = !loading && paymentNotification?.enabled && paymentNotification?.paymentUrl

  return (
    <NetworkStatusProvider>
      <div className="flex h-screen bg-background">
        <ServiceWorkerRegister />
        <BackupPermissionDialog />
        <ConflictNotification />
        <InstallPrompt />
        <Toaster position="top-right" />
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={handleCollapsedChange} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <DemoBanner />
          <TopNav />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">
              {children}
            </div>
          </main>
        </div>

        {showOverlay && (
          <PaymentNotificationOverlay
            paymentUrl={paymentNotification.paymentUrl}
            message={paymentNotification.message}
            daysOverdue={paymentNotification.daysOverdue}
          />
        )}
      </div>
    </NetworkStatusProvider>
  )
}
