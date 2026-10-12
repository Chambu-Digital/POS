'use client'

import { Toaster } from 'sonner'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { PWADebug } from '@/components/pwa/pwa-debug'

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
      <ServiceWorkerRegister />
      <PWADebug />
    </>
  )
}
