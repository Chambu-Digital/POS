import { useState, useEffect } from 'react'

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine)

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[v0] Back online')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.log('[v0] Gone offline')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return !isOnline
}
