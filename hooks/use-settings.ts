/**
 * useSettings Hook
 * Manages shop settings with React Query caching
 * 
 * Replaces direct fetch('/api/settings') calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Settings {
  general?: {
    logo?: string
    shopName?: string
    currency?: string
    timezone?: string
  }
  receipt?: {
    footer?: string
    showLogo?: boolean
  }
  [key: string]: any
}

interface SettingsResponse {
  settings: Settings
}

// ── Query Keys ─────────────────────────────────────────────────────────────

export const settingsKeys = {
  all: ['settings'] as const,
  detail: () => [...settingsKeys.all] as const,
}

// ── API Functions ──────────────────────────────────────────────────────────

async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch('/api/settings')
  
  if (!response.ok) {
    throw new Error('Failed to fetch settings')
  }
  
  return response.json()
}

async function updateSettings(settings: Partial<Settings>): Promise<SettingsResponse> {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  
  if (!response.ok) {
    throw new Error('Failed to update settings')
  }
  
  return response.json()
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSettings() {
  const queryClient = useQueryClient()
  
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: fetchSettings,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  })
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (newData) => {
      // Update cache with new data
      queryClient.setQueryData(settingsKeys.detail(), newData)
      
      // Dispatch event for components listening to settings updates
      window.dispatchEvent(new Event('settings_updated'))
    },
  })
  
  return {
    settings: data?.settings ?? {},
    isLoading,
    isError: !!error,
    error,
    
    // Actions
    refetch,
    update: (settings: Partial<Settings>) => updateMutation.mutate(settings),
    isUpdating: updateMutation.isPending,
    
    // Convenience accessors
    logo: data?.settings?.general?.logo ?? '',
    shopName: data?.settings?.general?.shopName ?? '',
    currency: data?.settings?.general?.currency ?? 'KES',
  }
}
