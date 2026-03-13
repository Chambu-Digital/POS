'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import {
  getPWAStatus,
  clearAllCaches,
  getCachedUrls,
  unregisterAllServiceWorkers,
  forceUpdate,
  getServiceWorkerInfo,
} from '@/lib/pwa-update'

/**
 * PWA Debug Component
 * Shows PWA status and provides debugging tools
 * Only visible in development mode
 */
export function PWADebug() {
  const [status, setStatus] = useState<any>(null)
  const [cachedUrls, setCachedUrls] = useState<string[]>([])
  const [swInfo, setSwInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return
    }

    const updateStatus = async () => {
      const pwaStatus = await getPWAStatus()
      setStatus(pwaStatus)

      const urls = await getCachedUrls()
      setCachedUrls(urls)

      const info = getServiceWorkerInfo()
      setSwInfo(info)
    }

    updateStatus()
    const interval = setInterval(updateStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  if (process.env.NODE_ENV !== 'development' || !status) {
    return null
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-white hover:bg-slate-800 transition-colors"
        title="Open PWA Debug"
      >
        🔧
      </button>
    )
  }

  const handleClearCache = async () => {
    setLoading(true)
    await clearAllCaches()
    const urls = await getCachedUrls()
    setCachedUrls(urls)
    setLoading(false)
  }

  const handleUnregisterSW = async () => {
    setLoading(true)
    await unregisterAllServiceWorkers()
    const info = getServiceWorkerInfo()
    setSwInfo(info)
    setLoading(false)
  }

  const handleForceUpdate = async () => {
    setLoading(true)
    await forceUpdate()
    setLoading(false)
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 z-50">
      <Card className="bg-slate-900 text-white border-slate-700">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">PWA Debug</CardTitle>
            <CardDescription className="text-xs text-slate-400">Development Only</CardDescription>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white transition-colors"
            title="Close PWA Debug"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Status */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Online:</span>
              <span className={status.isOnline ? 'text-green-400' : 'text-red-400'}>
                {status.isOnline ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>SW Active:</span>
              <span className={status.swActive ? 'text-green-400' : 'text-red-400'}>
                {status.swActive ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Update Available:</span>
              <span className={status.hasUpdate ? 'text-yellow-400' : 'text-green-400'}>
                {status.hasUpdate ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cache Version:</span>
              <span className="text-slate-300 truncate">{status.cacheVersion}</span>
            </div>
          </div>

          {/* SW Info */}
          {swInfo && (
            <div className="space-y-1 text-xs border-t border-slate-700 pt-2">
              <div className="flex justify-between">
                <span>SW Controlled:</span>
                <span className={swInfo.isControlled ? 'text-green-400' : 'text-red-400'}>
                  {swInfo.isControlled ? '✓' : '✗'}
                </span>
              </div>
              {swInfo.scriptURL && (
                <div className="text-slate-400 truncate">
                  <span className="text-slate-500">URL:</span> {swInfo.scriptURL}
                </div>
              )}
            </div>
          )}

          {/* Cached URLs */}
          <div className="space-y-1 text-xs border-t border-slate-700 pt-2">
            <div className="flex justify-between">
              <span>Cached URLs:</span>
              <span className="text-slate-300">{cachedUrls.length}</span>
            </div>
            {cachedUrls.length > 0 && (
              <div className="max-h-24 overflow-y-auto text-slate-400 space-y-1">
                {cachedUrls.slice(0, 5).map((url, i) => (
                  <div key={i} className="truncate text-xs">
                    {new URL(url).pathname}
                  </div>
                ))}
                {cachedUrls.length > 5 && (
                  <div className="text-slate-500">+{cachedUrls.length - 5} more</div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 border-t border-slate-700 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              onClick={handleForceUpdate}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Force Update'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              onClick={handleClearCache}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Clear Cache'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              onClick={handleUnregisterSW}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Unregister SW'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
