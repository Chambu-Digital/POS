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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [paymentNotification, setPaymentNotification] = useState<{
    enabled: boolean
    paymentUrl: string
    message: string
    daysOverdue: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch tenant configuration on mount
    fetch('/api/tenant/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.paymentNotification) {
          setPaymentNotification(data.paymentNotification)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Show overlay if payment notification is enabled
  const showOverlay = !loading && paymentNotification?.enabled && paymentNotification?.paymentUrl

  return (
    <NetworkStatusProvider>
      <div className="flex h-screen bg-background">
        <ServiceWorkerRegister />
        <BackupPermissionDialog />
        <ConflictNotification />
        <InstallPrompt />
        <Toaster position="top-right" />
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DemoBanner />
          <TopNav />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">
              {children}
            </div>
          </main>
        </div>

        {/* Payment notification overlay - blocks everything */}
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
