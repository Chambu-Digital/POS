'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  LogOut,
  Menu,
  X,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    href: '/dashboard',
    adminOnly: false,
  },
  {
    icon: ShoppingCart,
    label: 'Make Sale',
    href: '/dashboard/sales',
    adminOnly: false,
  },
  {
    icon: FileText,
    label: 'Orders',
    href: '/dashboard/orders',
    adminOnly: false,
  },
  {
    icon: Package,
    label: 'Inventory',
    href: '/dashboard/inventory',
    adminOnly: false,
  },
  {
    icon: BarChart3,
    label: 'Reports',
    href: '/dashboard/reports',
    adminOnly: false,
  },
  {
    icon: Users,
    label: 'Staff',
    href: '/dashboard/staff',
    adminOnly: true,
  },
  {
    icon: Settings,
    label: 'Settings',
    href: '/dashboard/settings',
    adminOnly: true,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [userType, setUserType] = useState<'user' | 'staff' | null>(null)
  const [shopName, setShopName] = useState<string>('My Shop')

  useEffect(() => {
    // Fetch user info to determine if admin and get shop name
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUserType(data.user.type)
          setShopName(data.user.shopName || 'My Shop')
        }
      })
      .catch(() => {
        // Ignore errors
      })
  }, [])

  const visibleMenuItems = menuItems.filter(item => 
    !item.adminOnly || userType === 'user'
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-primary text-primary-foreground"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static left-0 top-0 h-screen w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 z-40',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-6">
          <div className="flex flex-col items-center gap-3 mb-8 mt-12 lg:mt-0">
            {/* Shop Logo Placeholder - can be replaced with actual logo */}
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] flex items-center justify-center font-bold text-2xl">
              {shopName.charAt(0).toUpperCase()}
            </div>
            {/* Shop Name */}
            <div className="text-center">
              <h2 className="font-bold text-lg">{shopName}</h2>
              <p className="text-xs text-[hsl(var(--sidebar-foreground))]/70 mt-1">
                Powered by Chambu Digital
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                      : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            <Link
              href="/api/auth/logout"
              onClick={(e) => {
                e.preventDefault()
                fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                  window.location.href = '/auth/login'
                })
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-[hsl(var(--sidebar-foreground))] hover:bg-red-500/20 transition-colors"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
