'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { clearCachedProducts } from '@/lib/indexeddb'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        
        // Try offline login if online login fails
        const offlineSuccess = await tryOfflineLogin(email, password)
        if (offlineSuccess) {
          toast.success('Login successful (offline mode)')
          router.push('/dashboard')
          return
        }
        
        toast.error(data.error || 'Login failed')
        return
      }

      const data = await response.json()
      
      // Clear any cached session data from previous user/demo session
      sessionStorage.clear()
      await clearCachedProducts()
      
      // Cache login credentials for offline use
      const credentialHash = await hashPassword(password)
      localStorage.setItem('cachedCredentials', JSON.stringify({
        email,
        passwordHash: credentialHash,
        timestamp: Date.now(),
      }))
      
      toast.success('Login successful')
      router.push('/dashboard')
    } catch (error) {
      // Try offline login on network error
      const offlineSuccess = await tryOfflineLogin(email, password)
      if (offlineSuccess) {
        toast.success('Login successful (offline mode)')
        router.push('/dashboard')
        return
      }
      
      toast.error('An error occurred during login')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function tryOfflineLogin(email: string, password: string): Promise<boolean> {
    try {
      const cached = localStorage.getItem('cachedCredentials')
      if (!cached) return false

      const { email: cachedEmail, passwordHash } = JSON.parse(cached)
      
      // Check if email matches
      if (cachedEmail !== email) return false
      
      // Simple password verification (in production, use proper hashing)
      const inputHash = await hashPassword(password)
      if (inputHash !== passwordHash) return false
      
      return true
    } catch (error) {
      console.error('Offline login error:', error)
      return false
    }
  }

  async function hashPassword(password: string): Promise<string> {
    // Simple hash for offline verification (not cryptographically secure)
    // In production, use a proper hashing library
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-center mx-auto">
            <img 
              src="/chambu-logo.svg" 
              alt="Chambu Digital" 
              className="h-20 w-auto"
            />
          </div>
          <CardTitle className="text-center text-2xl">Chambu Digital POS</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Contact Chambu Digital to get access.
          </div>
          <div className="mt-2 text-center text-sm">
            <span className="text-muted-foreground">Want to explore first? </span>
            <Link href="/auth/demo" className="text-primary hover:underline font-medium">
              Try the demo
            </Link>
          </div>
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Powered by <a href="https://www.chambudigital.co.ke/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Chambu Digital</a>
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Need help? Contact us:</p>
              <p>Phone: <a href="tel:+254748069158" className="text-primary hover:underline">+254 748 069 158</a></p>
              <p>WhatsApp: <a href="https://wa.me/254748069158" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">+254 748 069 158</a></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
