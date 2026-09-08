'use client'

import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface OfflineIndicatorProps {
  /** Custom message to display */
  message?: string
  /** Show as full page or inline */
  variant?: 'fullpage' | 'inline' | 'banner'
  /** Callback when retry button is clicked */
  onRetry?: () => void
  /** Show retry button */
  showRetry?: boolean
  /** Additional className for styling */
  className?: string
}

export function OfflineIndicator({
  message = 'No internet connection',
  variant = 'inline',
  onRetry,
  showRetry = true,
  className = ''
}: OfflineIndicatorProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      // Default: reload the page
      window.location.reload()
    }
  }

  // Banner variant - thin bar at top
  if (variant === 'banner') {
    return (
      <div className={`bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">{message}</span>
        </div>
        {showRetry && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRetry}
            className="h-7"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  // Full page variant - centered card
  if (variant === 'fullpage') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 bg-muted/50 ${className}`}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">No Internet Connection</CardTitle>
            <CardDescription className="text-base">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>Please check your network connection and try again.</p>
            <p className="mt-2">Make sure you are connected to Wi-Fi or mobile data.</p>
          </CardContent>
          {showRetry && (
            <CardFooter className="flex justify-center">
              <Button onClick={handleRetry} className="w-full max-w-xs">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Connection
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    )
  }

  // Inline variant - card within page
  return (
    <Card className={`border-destructive/50 ${className}`}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="mt-1 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <WifiOff className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Connection Lost</CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Please check your internet connection and try again.
      </CardContent>
      {showRetry && (
        <CardFooter>
          <Button onClick={handleRetry} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

/**
 * Simple loading state component that can switch to offline indicator
 */
interface LoadingOrOfflineProps {
  isLoading: boolean
  isOffline: boolean
  onRetry?: () => void
  loadingText?: string
  offlineMessage?: string
  children?: React.ReactNode
}

export function LoadingOrOffline({
  isLoading,
  isOffline,
  onRetry,
  loadingText = 'Loading...',
  offlineMessage = 'Unable to load data. Please check your connection.',
  children
}: LoadingOrOfflineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{loadingText}</p>
        </div>
      </div>
    )
  }

  if (isOffline) {
    return (
      <div className="py-8">
        <OfflineIndicator
          message={offlineMessage}
          variant="inline"
          onRetry={onRetry}
        />
      </div>
    )
  }

  return <>{children}</>
}
