'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope)
          setRegistration(reg)

          // Check for updates every 30 seconds
          const updateInterval = setInterval(() => {
            reg.update().catch((error) => {
              console.error('[PWA] Update check failed:', error)
            })
          }, 30000)

          // Listen for new service worker
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker is ready
                  console.log('[PWA] New version available')
                  setUpdateAvailable(true)
                  
                  // Show update notification
                  toast.info('New version available', {
                    description: 'Click to refresh and get the latest updates',
                    action: {
                      label: 'Refresh',
                      onClick: () => {
                        // Tell the new service worker to take control
                        newWorker.postMessage({ type: 'SKIP_WAITING' })
                        
                        // Reload after a short delay to ensure SW is activated
                        setTimeout(() => {
                          window.location.reload()
                        }, 500)
                      },
                    },
                    duration: Infinity, // Keep showing until dismissed
                  })
                }
              })
            }
          })

          // Listen for controller change (new SW activated)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[PWA] New service worker activated')
            // Optionally auto-reload when new SW takes control
            // window.location.reload()
          })

          return () => clearInterval(updateInterval)
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error)
        })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'BACKGROUND_SYNC') {
          console.log('[PWA] Background sync requested')
          window.dispatchEvent(new CustomEvent('background-sync'))
        }
      })
    }
  }, [])

  return null
}
