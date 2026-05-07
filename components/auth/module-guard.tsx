'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normaliseFeatures, DEFAULT_MODULE_FEATURES } from '@/lib/modules'

interface ModuleGuardProps {
  /** The dotted feature key this page requires, e.g. 'bar.tabs' or 'rentals.bookings' */
  featureKey: string
  children: React.ReactNode
}

/**
 * Wraps a dashboard page and redirects to /dashboard if the tenant
 * does not have the required feature enabled.
 *
 * Uses the same localStorage cache the sidebar uses, so there's no
 * extra network request on page load.
 */
export function ModuleGuard({ featureKey, children }: ModuleGuardProps) {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    // 1. Check cached features immediately (no flash)
    let features = DEFAULT_MODULE_FEATURES
    try {
      const raw = localStorage.getItem('sidebar_tenant_features')
      if (raw) features = normaliseFeatures(JSON.parse(raw))
    } catch {}

    if (features[featureKey] === false) {
      router.replace('/dashboard')
      return
    }

    // 2. Verify live from API (catches stale cache)
    fetch('/api/tenant/config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setAllowed(true); return }
        const live = normaliseFeatures(data.features || {})
        if (live[featureKey] === false) {
          router.replace('/dashboard')
        } else {
          setAllowed(true)
        }
      })
      .catch(() => setAllowed(true)) // fail open — don't block on network error
  }, [featureKey, router])

  if (allowed === null) return null // brief invisible wait for live check
  return <>{children}</>
}
