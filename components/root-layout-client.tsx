'use client'

import { Toaster } from 'sonner'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { PWADebug } from '@/components/pwa/pwa-debug'
import { QueryProvider } from '@/components/providers/query-provider'

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster position="top-center" richColors />
      <ServiceWorkerRegister />
      <PWADebug />
    </QueryProvider>
  )
}
