import { ReactNode } from 'react'
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopNav } from '@/components/dashboard/top-nav'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { BackupPermissionDialog } from '@/components/pwa/backup-permission-dialog'
import { ConflictNotification } from '@/components/pwa/conflict-notification'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Dashboard - POS System',
  description: 'Manage your POS system',
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <ServiceWorkerRegister />
      <BackupPermissionDialog />
      <ConflictNotification />
      <InstallPrompt />
      <Toaster position="top-right" />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
