'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, LogOut, Menu, X, Settings, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media-url'
import { MODULES, DEFAULT_MODULE_FEATURES, normaliseFeatures } from '@/lib/modules'
import type { ModuleFeature } from '@/lib/modules'

const STATIC_TOP = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', adminOnly: false, permission: null },
]
const STATIC_BOTTOM = [
  { icon: Users,    label: 'Staff',    href: '/dashboard/staff',    adminOnly: true,  permission: null },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings', adminOnly: true,  permission: null },
]

const FEATURES_CACHE_KEY = 'sidebar_tenant_features'
const LOGO_CACHE_KEY     = 'sidebar_logo'

// Live-indicator routes (show animated dot when active)
const LIVE_HREFS = new Set(['/dashboard/kds', '/dashboard/bar'])

function readCachedFeatures(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FEATURES_CACHE_KEY)
    if (raw) return normaliseFeatures(JSON.parse(raw))
  } catch {}
  return DEFAULT_MODULE_FEATURES
}

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen]           = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [userType, setUserType]       = useState<'user' | 'staff' | null>(null)
  const [shopName, setShopName]       = useState<string>('My Shop')
  const [shopLogo, setShopLogo]       = useState<string>('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [features, setFeatures]       = useState<Record<string, boolean>>(DEFAULT_MODULE_FEATURES)
  // Track which module sections are collapsed (key = module key)
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({})

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
      fetch('/api/tenant/config')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return
          const normalised = normaliseFeatures(data.features || {})
          setFeatures(normalised)
          try { localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(normalised)) } catch {}
        })
        .catch(() => {})

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

  // ── Visibility helpers ───────────────────────────────────────────────────────

  function canSeeFeature(f: ModuleFeature): boolean {
    if (userType === 'user') return true
    if (userType === null)   return !f.adminOnly
    // staff — use dotted key (e.g. 'pos.sales') to check permissions
    if (f.adminOnly) return false
    return permissions[f.key] === true
  }

  function canSeeStatic(item: { adminOnly: boolean; permission: string | null }): boolean {
    if (userType === 'user') return true
    if (userType === null)   return !item.adminOnly
    if (userType === 'staff') {
      if (item.adminOnly) return false
      if (!item.permission) return true
      return permissions[item.permission] === true
    }
    return false
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderNavItem(item: { icon: any; label: string; href: string }) {
    const Icon = item.icon
    const isActive = item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === item.href || pathname.startsWith(item.href + '/')
    const showDot = LIVE_HREFS.has(item.href) && isActive

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors relative text-sm',
          isActive
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
            : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
        )}
      >
        <Icon size={18} />
        <span>{item.label}</span>
        {showDot && <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
      </Link>
    )
  }

  // Renders a module section with its visible child features
  function renderModule(mod: typeof MODULES[number]) {
    const visibleFeatures = mod.features.filter(f => features[f.key] === true && canSeeFeature(f))
    if (visibleFeatures.length === 0) return null

    const isCollapsed = collapsed[mod.key] ?? false
    const ModIcon = mod.icon
    // Module header is "active" if any child is active
    const anyChildActive = visibleFeatures.some(f =>
      pathname === f.href || pathname.startsWith(f.href + '/')
    )

    // If only one feature in the module, render it directly (no group header)
    if (visibleFeatures.length === 1) {
      return renderNavItem(visibleFeatures[0])
    }

    return (
      <div key={mod.key}>
        {/* Module group header */}
        <button
          onClick={() => setCollapsed(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium',
            anyChildActive
              ? 'text-[hsl(var(--sidebar-accent-foreground))]'
              : 'text-[hsl(var(--sidebar-foreground))]/70 hover:text-[hsl(var(--sidebar-foreground))]'
          )}
        >
          <ModIcon size={18} />
          <span className="flex-1 text-left">{mod.label}</span>
          <ChevronDown
            size={14}
            className={cn('transition-transform', isCollapsed ? '-rotate-90' : 'rotate-0')}
          />
        </button>

        {/* Child features */}
        {!isCollapsed && (
          <div className="ml-4 pl-3 border-l border-[hsl(var(--sidebar-foreground))]/10 space-y-0.5 mt-0.5">
            {visibleFeatures.map(f => {
              const Icon = f.icon
              const isActive = pathname === f.href || pathname.startsWith(f.href + '/')
              const showDot = LIVE_HREFS.has(f.href) && isActive
              return (
                <Link
                  key={f.href}
                  href={f.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative text-sm',
                    isActive
                      ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
                      : 'text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
                  )}
                >
                  <Icon size={16} />
                  <span>{f.label}</span>
                  {showDot && <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
                </Link>
              )
            })}
          </div>
        )}
      </div>
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
                  <div key={i} className="h-10 rounded-lg bg-[hsl(var(--sidebar-accent))]/20 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {STATIC_TOP.filter(canSeeStatic).map(renderNavItem)}

                {/* Module groups */}
                <div className="space-y-1 py-1">
                  {MODULES.map(renderModule)}
                </div>

                {STATIC_BOTTOM.filter(canSeeStatic).map(renderNavItem)}
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
