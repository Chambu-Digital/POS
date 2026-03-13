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
        toast.error(data.error || 'Login failed')
        return
      }

      toast.success('Login successful')
      router.push('/dashboard')
    } catch (error) {
      toast.error('An error occurred during login')
      console.error(error)
    } finally {
      setLoading(false)
    }
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
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <span className="text-muted-foreground">Staff member? </span>
            <Link href="/auth/staff-login" className="text-primary hover:underline font-medium">
              Staff Login
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
