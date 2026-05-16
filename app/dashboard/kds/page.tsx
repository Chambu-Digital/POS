'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ModuleGuard } from '@/components/auth/module-guard'

function KDSRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to the orders page (default KDS landing)
    router.replace('/dashboard/kds/orders')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-4xl mb-4">🔄</div>
        <div className="text-lg text-gray-600">Redirecting to KDS...</div>
      </div>
    </div>
  )
}

export default function KDSPage() {
  return (
    <ModuleGuard featureKey="kds.orders">
      <KDSRedirect />
    </ModuleGuard>
  )
}
