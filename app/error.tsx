'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { isOnline, onNetworkChange } from '@/lib/network'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Check initial online status
    setOnline(isOnline())

    // Listen for network changes
    const cleanup = onNetworkChange(
      () => setOnline(true),
      () => setOnline(false)
    )

    // Log error for debugging
    console.error('Application error:', error)

    return cleanup
  }, [error])

  // Determine if this is a network error
  const isNetworkError = !online || 
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('network')

  if (isNetworkError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">No Internet Connection</CardTitle>
            <CardDescription className="text-base">
              Unable to connect to the server
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground space-y-2">
            <p>Please check your network connection and try again.</p>
            <p>Make sure you are connected to Wi-Fi or mobile data.</p>
            {!online && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                <p className="text-destructive font-medium">
                  Your device is currently offline
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button 
              onClick={reset} 
              className="w-full"
              disabled={!online}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {online ? 'Retry Connection' : 'Waiting for connection...'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Generic error
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Something Went Wrong</CardTitle>
          <CardDescription className="text-base">
            An unexpected error occurred
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground space-y-2">
          <p>We apologize for the inconvenience. Please try again.</p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-muted rounded-md text-left">
              <p className="font-mono text-xs break-all">
                {error.message}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={reset} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="w-full"
          >
            Go to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
