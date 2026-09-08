'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, WifiOff, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { isOnline, onNetworkChange } from '@/lib/network'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Check initial online status
    setOnline(isOnline())

    // Listen for network changes
    const cleanup = onNetworkChange(
      () => {
        setOnline(true)
        // Optionally auto-retry when connection is restored
        // reset()
      },
      () => setOnline(false)
    )

    // Log error for debugging
    console.error('Dashboard error:', error)

    return cleanup
  }, [error])

  // Determine if this is a network error
  const isNetworkError = !online || 
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('failed to load')

  if (isNetworkError) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <WifiOff className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-xl">Connection Lost</CardTitle>
            <CardDescription>
              Unable to load this page due to network issues
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Please check your internet connection and try again.
            </p>
            {!online && (
              <div className="p-3 bg-destructive/10 rounded-md">
                <p className="text-sm text-destructive font-medium">
                  Your device is currently offline
                </p>
              </div>
            )}
            {online && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Connection restored. You can retry now.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button 
              onClick={reset} 
              className="flex-1"
              disabled={!online}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {online ? 'Retry' : 'Waiting...'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/dashboard'}
              className="flex-1"
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Generic error within dashboard
  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <Card className="w-full max-w-lg border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-xl">Page Error</CardTitle>
          <CardDescription>
            Something went wrong loading this page
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="mt-4 p-3 bg-muted rounded-md text-left">
              <p className="text-xs font-mono break-all text-muted-foreground">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={reset} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/dashboard'}
            className="flex-1"
          >
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
