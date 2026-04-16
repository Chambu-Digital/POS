'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, LogOut, Menu, X, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media-url'
import { FEATURES, DEFAULT_FEATURES } from '@/lib/features'

// Items always shown regardless of tenant features
const STATIC_TOP = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', adminOnly: false, permission: null },
]
const STATIC_BOTTOM = [
  { icon: Users,    label: 'Staff',    href: '/dashboard/staff',    adminOnly: true,  permission: null },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings', adminOnly: true,  permission: null },
]

const FEATURES_CACHE_KEY = 'sidebar_tenant_features'
const LOGO_CACHE_KEY     = 'sidebar_logo'

function readCachedFeatures(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FEATURES_CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_FEATURES
}

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen]           = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [userType, setUserType]       = useState<'user' | 'staff' | null>(null)
  const [shopName, setShopName]       = useState<string>('My Shop')
  const [shopLogo, setShopLogo]       = useState<string>('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [features, setFeatures]       = useState<Record<string, boolean>>(DEFAULT_FEATURES)

  useEffect(() => {
    setFeatures(readCachedFeatures())
    try { const l = localStorage.getItem(LOGO_CACHE_KEY); if (l) setShopLogo(l) } catch {}
    setMounted(true)

    function loadUser() {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUserType(data.user.type)
            setShopName(data.user.shopName || 'My Shop')
            if (data.user.type === 'staff' && data.user.permissions) {
              setPermissions(data.user.permissions)
            }
          }
        })
        .catch(() => {})
    }

    function loadFeatures() {
      // Load tenant feature flags
      fetch('/api/tenant/config')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return
          setFeatures(data.features)
          try { localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(data.features)) } catch {}
        })
        .catch(() => {})

      // Load logo from settings
      fetch('/api/settings')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return
          const logo = data.settings?.general?.logo || ''
          setShopLogo(logo)
          try { localStorage.setItem(LOGO_CACHE_KEY, logo) } catch {}
        })
        .catch(() => {})
    }

    loadUser()
    loadFeatures()

    const onFocus = () => loadFeatures()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') loadFeatures()
    })
    window.addEventListener('settings_updated', loadFeatures)
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === 'settings_updated') loadFeatures()
    })

    const interval = setInterval(loadFeatures, 5000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('settings_updated', loadFeatures)
      clearInterval(interval)
    }
  }, [])

  function canSee(item: { adminOnly: boolean; permission: string | null }) {
    if (userType === 'user') return true
    if (userType === null)   return !item.adminOnly
    if (userType === 'staff') {
      if (item.adminOnly) return false
      if (!item.permission) return true
      return permissions[item.permission] === true
    }
    return false
  }

  // Build the full menu: static top + feature-gated modules + static bottom
  const featureItems = FEATURES.filter(f => features[f.key] === true)
  const liveItems = new Set(['/dashboard/kds', '/dashboard/bar'])

  function renderItem(item: { icon: any; label: string; href: string; adminOnly: boolean; permission: string | null }) {
    if (!canSee(item)) return null
    const Icon = item.icon
    const isActive = item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === item.href || pathname.startsWith(item.href + '/')
    const showDot = liveItems.has(item.href) && isActive

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative',
          isActive
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
            : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
        )}
      >
        <Icon size={20} />
        <span>{item.label}</span>
        {showDot && <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
      </Link>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-primary text-primary-foreground"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={cn(
        'fixed lg:static left-0 top-0 h-screen w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 z-40',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-6 flex flex-col h-full">

          {/* Shop branding */}
          <div className="flex flex-col items-center gap-3 mb-8 mt-12 lg:mt-0">
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] flex items-center justify-center font-bold text-2xl overflow-hidden">
              {shopLogo
                ? <img src={resolveMediaUrl(shopLogo)} alt={shopName} className="w-full h-full object-cover" />
                : shopName.charAt(0).toUpperCase()
              }
            </div>
            <div className="text-center">
              <h2 className="font-bold text-lg">{shopName}</h2>
              <p className="text-xs text-[hsl(var(--sidebar-foreground))]/70 mt-1">Powered by Chambu Digital</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-1 flex-1 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {!mounted ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-11 rounded-lg bg-[hsl(var(--sidebar-accent))]/20 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {STATIC_TOP.map(renderItem)}
                {featureItems.map(renderItem)}
                {STATIC_BOTTOM.map(renderItem)}
              </>
            )}
          </nav>

          {/* Logout */}
          <div className="pt-4 mt-auto border-t border-[hsl(var(--sidebar-foreground))]/10">
            <button
              onClick={() => fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/auth/login' })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[hsl(var(--sidebar-foreground))] hover:bg-red-500/20 transition-colors"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 lg:hidden z-30" onClick={() => setIsOpen(false)} />
      )}
    </>
  )
}
