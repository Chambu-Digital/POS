'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo'

export default function DemoLoginPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    login()
  }, [])

  async function login() {
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="flex items-center justify-center mx-auto mb-2">
            <img src="/chambu-logo.svg" alt="Chambu Digital" className="h-16 w-auto" />
          </div>
          <CardTitle>Loading Demo</CardTitle>
          <CardDescription>Setting up your demo account...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">Failed to load demo. Please try again.</p>
              <Button onClick={login} className="w-full">Retry</Button>
              <Button variant="outline" onClick={() => router.push('/auth/login')} className="w-full">
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
