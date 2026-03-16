'use client'

import { useEffect, useState } from 'react'
import { Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface UserData {
  id: string
  email: string
  name: string
  shopName: string
  role: string
}

export function TopNav() {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <header className="border-b border-border bg-background">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
      </header>
    )
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="relative flex items-center justify-between h-16 px-6">
        {/* Welcome text — centered on mobile, left-aligned on desktop */}
        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:flex items-center gap-2">
          <h1 className="text-lg font-semibold text-muted-foreground whitespace-nowrap">
            Welcome, <span className="text-foreground">{user?.name || 'User'}</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
          >
            <Bell size={20} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
              >
                <User size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-1">
                <p>{user?.name}</p>
                <p className="text-sm font-normal text-muted-foreground">
                  {user?.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/dashboard/settings">Settings</a>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                    window.location.href = '/auth/login'
                  })
                }}
                className="text-red-600"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
