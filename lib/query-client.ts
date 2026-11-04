/**
 * React Query Client Configuration
 * Centralized configuration for caching, retries, and stale time
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes before considering it stale
      staleTime: 5 * 60 * 1000,
      
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      
      // Don't refetch just because the window regained focus — staleTime
      // already controls when data is considered fresh enough.
      refetchOnWindowFocus: false,
      
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
      
      // Retry failed requests twice
      retry: 2,
      
      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
})
