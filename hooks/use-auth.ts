/**
 * useAuth Hook
 * Centralized authentication state management with React Query
 * 
 * Replaces direct fetch('/api/auth/me') calls throughout the app
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Branch {
  _id: string
  name: string
  code: string
  status: string
}

export interface User {
  id: string
  email: string
  name: string
  shopName?: string
  role: string
  type: 'user' | 'staff'
  isDemo?: boolean
  
  // Staff-specific fields
  permissions?: Record<string, boolean>
  isCashierMode?: boolean
  allowedRoutes?: string[]
  isBranchManager?: boolean
  managerOfBranches?: string[]
  branchId?: string
  
  // Branch data
  branches?: Branch[]
  selectedBranch?: Branch | null
}

interface AuthResponse {
  user: User
}

// ── Query Keys ─────────────────────────────────────────────────────────────

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
}

// ── API Functions ──────────────────────────────────────────────────────────

async function fetchAuthMe(): Promise<AuthResponse> {
  const response = await fetch('/api/auth/me')
  
  if (!response.ok) {
    throw new Error('Unauthorized')
  }
  
  return response.json()
}

async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' })
  
  if (!response.ok) {
    throw new Error('Logout failed')
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // Fetch user data with caching
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchAuthMe,
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthorized)
      if (error.message === 'Unauthorized') return false
      return failureCount < 2
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
  
  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all queries
      queryClient.clear()
      
      // Redirect to login
      router.push('/auth/login')
    },
    onError: () => {
      // Even if logout API fails, clear cache and redirect
      queryClient.clear()
      router.push('/auth/login')
    },
  })
  
  return {
    user: data?.user ?? null,
    isLoading,
    isError: !!error,
    error,
    
    // Actions
    refetch,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
    
    // Computed properties for convenience
    isAuthenticated: !!data?.user,
    isOwner: data?.user?.type === 'user',
    isStaff: data?.user?.type === 'staff',
    isCashierMode: data?.user?.isCashierMode ?? false,
    isBranchManager: data?.user?.isBranchManager ?? false,
    permissions: data?.user?.permissions ?? {},
  }
}

// ── Helper Hook: Require Auth ──────────────────────────────────────────────

/**
 * Redirects to login if user is not authenticated
 * Use in protected pages
 */
export function useRequireAuth() {
  const router = useRouter()
  const { isAuthenticated, isLoading, error } = useAuth()
  
  // Redirect on auth error (401)
  if (!isLoading && (error || !isAuthenticated)) {
    router.push('/auth/login')
  }
  
  return { isLoading, isAuthenticated }
}
