/**
 * API client wrapper with network error detection and structured error handling
 */

import { isOnline, parseNetworkError, type NetworkError } from './network'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: NetworkError
}

export interface ApiClientOptions extends RequestInit {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Retry on network error (default: false) */
  retry?: boolean
  /** Number of retries (default: 1) */
  retries?: number
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number
}

/**
 * Custom fetch wrapper that handles network errors gracefully
 */
export async function apiFetch<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const {
    timeout = 30000,
    retry = false,
    retries = 1,
    retryDelay = 1000,
    ...fetchOptions
  } = options

  let lastError: unknown = null
  let lastResponse: Response | undefined

  // Check if offline before attempting
  if (!isOnline()) {
    return {
      success: false,
      error: parseNetworkError(new Error('No internet connection'))
    }
  }

  const attemptFetch = async (): Promise<ApiResponse<T>> => {
    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      lastResponse = response

      // Handle non-ok responses
      if (!response.ok) {
        const error = parseNetworkError(null, response)
        return {
          success: false,
          error
        }
      }

      // Parse JSON response
      let data: T
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text() as any
      }

      return {
        success: true,
        data
      }
    } catch (error) {
      lastError = error

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            type: 'network',
            message: 'Request timed out. Please check your connection.',
            isOffline: !isOnline()
          }
        }
      }

      // Parse the error
      const networkError = parseNetworkError(error, lastResponse)
      return {
        success: false,
        error: networkError
      }
    }
  }

  // Try initial fetch
  let result = await attemptFetch()

  // Retry logic for network errors
  if (!result.success && retry && result.error?.type === 'network') {
    for (let i = 0; i < retries; i++) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay))

      // Check if back online
      if (!isOnline()) {
        continue
      }

      result = await attemptFetch()
      if (result.success) {
        break
      }
    }
  }

  return result
}

/**
 * GET request
 */
export async function apiGet<T = any>(
  url: string,
  options?: ApiClientOptions
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { ...options, method: 'GET' })
}

/**
 * POST request
 */
export async function apiPost<T = any>(
  url: string,
  data?: any,
  options?: ApiClientOptions
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: data ? JSON.stringify(data) : undefined
  })
}

/**
 * PUT request
 */
export async function apiPut<T = any>(
  url: string,
  data?: any,
  options?: ApiClientOptions
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: data ? JSON.stringify(data) : undefined
  })
}

/**
 * PATCH request
 */
export async function apiPatch<T = any>(
  url: string,
  data?: any,
  options?: ApiClientOptions
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, {
    ...options,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: data ? JSON.stringify(data) : undefined
  })
}

/**
 * DELETE request
 */
export async function apiDelete<T = any>(
  url: string,
  options?: ApiClientOptions
): Promise<ApiResponse<T>> {
  return apiFetch<T>(url, { ...options, method: 'DELETE' })
}

/**
 * Helper to handle API response and show appropriate error messages
 */
export function handleApiError(error: NetworkError | undefined, defaultMessage = 'An error occurred'): string {
  if (!error) return defaultMessage
  
  if (error.isOffline) {
    return 'No internet connection. Please check your network and try again.'
  }
  
  return error.message || defaultMessage
}
