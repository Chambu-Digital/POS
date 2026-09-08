/**
 * Network utilities for detecting online/offline state and network errors
 */

export interface NetworkError {
  type: 'network' | 'server' | 'unknown'
  message: string
  statusCode?: number
  isOffline: boolean
}

/**
 * Check if the browser is currently online
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

/**
 * Detect if an error is a network error (no internet connection)
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false
  
  // TypeError: Failed to fetch is the standard network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  
  // Check error message patterns
  const message = error instanceof Error ? error.message : String(error)
  const networkPatterns = [
    'failed to fetch',
    'network request failed',
    'networkerror',
    'network error',
    'no internet',
    'offline'
  ]
  
  return networkPatterns.some(pattern => 
    message.toLowerCase().includes(pattern)
  )
}

/**
 * Parse fetch error and return structured error information
 */
export function parseNetworkError(error: unknown, response?: Response): NetworkError {
  // Check if browser is offline
  const offline = !isOnline()
  
  // Network error (no connection)
  if (offline || isNetworkError(error)) {
    return {
      type: 'network',
      message: 'No internet connection. Please check your network and try again.',
      isOffline: true
    }
  }
  
  // Server error (got response but not ok)
  if (response && !response.ok) {
    const statusCode = response.status
    let message = 'Server error occurred'
    
    if (statusCode === 404) {
      message = 'Resource not found'
    } else if (statusCode === 401 || statusCode === 403) {
      message = 'Authentication required'
    } else if (statusCode >= 500) {
      message = 'Server error. Please try again later.'
    } else if (statusCode >= 400) {
      message = 'Request failed. Please check your input.'
    }
    
    return {
      type: 'server',
      message,
      statusCode,
      isOffline: false
    }
  }
  
  // Unknown error
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  return {
    type: 'unknown',
    message,
    isOffline: false
  }
}

/**
 * Wait for the network to come back online
 * Returns a promise that resolves when online or rejects after timeout
 */
export function waitForOnline(timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isOnline()) {
      resolve()
      return
    }
    
    const timeout = setTimeout(() => {
      window.removeEventListener('online', handleOnline)
      reject(new Error('Timeout waiting for network'))
    }, timeoutMs)
    
    const handleOnline = () => {
      clearTimeout(timeout)
      window.removeEventListener('online', handleOnline)
      resolve()
    }
    
    window.addEventListener('online', handleOnline)
  })
}

/**
 * Register callbacks for online/offline events
 * Returns cleanup function
 */
export function onNetworkChange(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
