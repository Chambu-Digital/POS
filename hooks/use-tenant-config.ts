/**
 * useTenantConfig Hook
 * Manages tenant feature flags with React Query caching
 * 
 * Replaces direct fetch('/api/tenant/config') calls
 */

import { useQuery } from '@tanstack/react-query'
import { normaliseFeatures } from '@/lib/modules'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TenantConfig {
  features: Record<string, boolean>
}

// ── Query Keys ─────────────────────────────────────────────────────────────

export const tenantConfigKeys = {
  all: ['tenant', 'config'] as const,
  config: () => [...tenantConfigKeys.all] as const,
}

// ── API Function ───────────────────────────────────────────────────────────

async function fetchTenantConfig(): Promise<TenantConfig> {
  const response = await fetch('/api/tenant/config')
  
  if (!response.ok) {
    throw new Error('Failed to fetch tenant config')
  }
  
  return response.json()
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTenantConfig(isAuthenticated: boolean = false) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: tenantConfigKeys.config(),
    queryFn: fetchTenantConfig,
    staleTime: 10 * 60 * 1000, // 10 minutes (features rarely change)
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    // Only fetch when a user is authenticated — no auth means no features
    enabled: isAuthenticated,
  })
  
  // Normalize features — empty until API responds
  const features = normaliseFeatures(data?.features ?? {})
  
  return {
    features,
    isLoading,
    isError: !!error,
    error,
    refetch,
  }
}
