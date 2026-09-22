'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media-url'
import {
  MODULES,
  DEFAULT_MODULE_FEATURES,
  normaliseFeatures,
  type ModuleFeature,
} from '@/lib/modules'
import { BranchSelector } from '@/components/branch-selector'

// ── Static items that appear outside the module groups ─────────────────────────
const STATIC_TOP = [
  { label: 'Dashboard', href: '/dashboard', adminOnly: false, permission: null },
]

const FEATURES_CACHE_KEY = 'sidebar_tenant_features'
const LOGO_CACHE_KEY     = 'sidebar_logo'

// Routes that show a live animated dot indicator when active
const LIVE_HREFS = new Set([
  '/dashboard',
])

function readCachedFeatures(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FEATURES_CACHE_KEY)
    if (raw) return normaliseFeatures(JSON.parse(raw))
  } catch {}
  return DEFAULT_MODULE_FEATURES
}

// ── Type helpers ───────────────────────────────────────────────────────────────

type UserType = 'user' | 'staff' | null

interface StaticItem {
  label: string
  href: string
  adminOnly: boolean
  permission: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen]             = useState(false)
  const [mounted, setMounted]           = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [userType, setUserType]         = useState<UserType>(null)
  const [shopName, setShopName]         = useState<string>('My Shop')
  const [shopLogo, setShopLogo]         = useState<string>('')
  const [permissions, setPermissions]   = useState<Record<string, boolean>>({})
  const [isCashierMode, setIsCashierMode] = useState(false)
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([])
  const [features, setFeatures]         = useState<Record<string, boolean>>(DEFAULT_MODULE_FEATURES)
  const [branches, setBranches]         = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<any>(null)
  // Track which top-level module sections are collapsed
  const [collapsed, setCollapsed]       = useState<Record<string, boolean>>({})

  useEffect(() => {
    setFeatures(readCachedFeatures())
    try { const l = localStorage.getItem(LOGO_CACHE_KEY); if (l) setShopLogo(l) } catch {}
    setMounted(true)

    function loadUser() {
      // Prevent API calls during logout
      if (isLoggingOut) return

      fetch('/api/auth/me')
        .then(res => {
          // Handle 401 - session expired or logged out
          if (res.status === 401) {
            setIsLoggingOut(true)
            router.push('/auth/login')
            return null
          }
          return res.json()
        })
        .then(data => {
          if (!data) return
          if (data.user) {
            setUserType(data.user.type)
            setShopName(data.user.shopName || 'My Shop')
            if (data.user.type === 'staff') {
              if (data.user.permissions) setPermissions(data.user.permissions)
              if (data.user.isCashierMode) setIsCashierMode(data.user.isCashierMode)
              if (data.user.allowedRoutes) setAllowedRoutes(data.user.allowedRoutes)
            }
            if (data.user.branches)       setBranches(data.user.branches)
            if (data.user.selectedBranch) setSelectedBranch(data.user.selectedBranch)
          }
        })
        .catch(() => {})
    }

    function loadFeatures() {
      // Prevent API calls during logout
      if (isLoggingOut) return

      fetch('/api/tenant/config')
        .then(res => {
          // Handle 401 - session expired or logged out
          if (res.status === 401) {
            setIsLoggingOut(true)
            router.push('/auth/login')
            return null
          }
          return res.ok ? res.json() : null
        })
        .then(data => {
          if (!data || isLoggingOut) return
          const normalised = normaliseFeatures(data.features || {})
          setFeatures(normalised)
          try { localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(normalised)) } catch {}
        })
        .catch(() => {})

      fetch('/api/settings')
        .then(res => {
          // Handle 401 - session expired or logged out
          if (res.status === 401) {
            setIsLoggingOut(true)
            router.push('/auth/login')
            return null
          }
          return res.ok ? res.json() : null
        })
        .then(data => {
          if (!data || isLoggingOut) return
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
  }, [isLoggingOut, router])

  // ── Logout handler ─────────────────────────────────────────────────────────
  function handleLogout() {
    // Set flag immediately to stop all API calls
    setIsLoggingOut(true)
    
    // Redirect immediately for instant UX
    router.push('/auth/login')
    
    // Fire logout API in background for proper server cleanup
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
      // Silent fail - user already redirected, cookie will be invalid anyway
    })
  }

  // ── Visibility helpers ─────────────────────────────────────────────────────

  function canSeeFeature(f: ModuleFeature): boolean {
    if (userType === 'user') return true
    if (userType === null)   return !f.adminOnly
    
    // staff — check cashier mode first
    if (isCashierMode) {
      // In cashier mode, only show routes in allowedRoutes list
      return allowedRoutes.some(route => 
        f.href === route || f.href.startsWith(route + '/')
      )
    }
    
    // Non-cashier staff — check per-feature permission using the dotted key
    if (f.adminOnly) return false
    return permissions[f.key] === true
  }

  function canSeeStatic(item: StaticItem): boolean {
    if (userType === 'user') return true
    if (userType === null)   return !item.adminOnly
    
    if (userType === 'staff') {
      // Cashier mode: only show if in allowed routes
      if (isCashierMode) {
        return allowedRoutes.some(route => 
          item.href === route || item.href.startsWith(route + '/')
        )
      }
      
      // Non-cashier staff: check permissions
      if (item.adminOnly) return false
      if (!item.permission) return true
      return permissions[item.permission] === true
    }
    return false
  }

  // ── Active path helpers ────────────────────────────────────────────────────

  // Maps canonical new paths to their legacy equivalents so that navigating
  // via old bookmarked URLs still highlights the correct sidebar item.
  const LEGACY_ACTIVE_MAP: Record<string, string[]> = {
    '/dashboard/retail/sales':     ['/dashboard/sales'],
    '/dashboard/retail/orders':    ['/dashboard/orders'],
    '/dashboard/retail/inventory': ['/dashboard/inventory'],
    '/dashboard/retail/reports':   ['/dashboard/reports'],
    '/dashboard/retail/expenses':  ['/dashboard/expenses'],
    '/dashboard/retail/customers': ['/dashboard/customers'],
    '/dashboard/customers':        ['/dashboard/retail/customers'],
    '/dashboard/suppliers':        ['/dashboard/retail/suppliers'],
  }

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    // Check canonical path
    if (pathname === href || pathname.startsWith(href + '/')) return true
    // Check legacy equivalents
    const legacyPaths = LEGACY_ACTIVE_MAP[href]
    if (legacyPaths) {
      return legacyPaths.some(lp => pathname === lp || pathname.startsWith(lp + '/'))
    }
    return false
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderNavItem(item: { label: string; href: string }) {
    const active  = isActive(item.href)
    const showDot = LIVE_HREFS.has(item.href) && active

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center justify-between px-4 py-2.5 transition-colors relative text-sm font-medium',
          active
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
            : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
        )}
      >
        <span>{item.label}</span>
        {showDot && <span className="w-2 h-2 bg-orange-400 animate-pulse" />}
      </Link>
    )
  }

  // Renders a flat child feature link (used inside module and sub-domain groups)
  function renderFeatureLink(f: ModuleFeature) {
    const active  = isActive(f.href)
    const showDot = LIVE_HREFS.has(f.href) && active

    return (
      <Link
        key={f.href}
        href={f.href}
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center justify-between px-3 py-2 transition-colors relative text-sm',
          active
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
            : 'text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
        )}
      >
        <span>{f.label}</span>
        {showDot && <span className="w-2 h-2 bg-orange-400 animate-pulse" />}
      </Link>
    )
  }

  // Renders a standard module (Retail, Rentals, Pharmacy)
  function renderModule(mod: typeof MODULES[number]) {
    // Core module is rendered separately as flat items
    if (mod.key === 'core') return null

    const visibleFeatures = mod.features.filter(
      f => features[f.key] === true && canSeeFeature(f)
    )
    if (visibleFeatures.length === 0) return null

    const isCollapsed   = collapsed[mod.key] ?? false
    const anyChildActive = visibleFeatures.some(f => isActive(f.href))

    // If only one visible feature, render it without a group header
    if (visibleFeatures.length === 1) {
      return renderNavItem(visibleFeatures[0])
    }

    return (
      <div key={mod.key}>
        <button
          onClick={() => setCollapsed(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
          className={cn(
            'w-full flex items-center justify-between px-4 py-2.5 transition-colors text-sm font-medium',
            anyChildActive
              ? 'text-[hsl(var(--sidebar-accent-foreground))]'
              : 'text-[hsl(var(--sidebar-foreground))]/70 hover:text-[hsl(var(--sidebar-foreground))]'
          )}
        >
          <span className="text-left">{mod.label}</span>
          <span className="text-xs">{isCollapsed ? '▸' : '▾'}</span>
        </button>

        {!isCollapsed && (
          <div className="ml-4 pl-3 border-l border-[hsl(var(--sidebar-foreground))]/10 space-y-0.5 mt-0.5">
            {visibleFeatures.map(renderFeatureLink)}
          </div>
        )}
      </div>
    )
  }

  // Renders core features as flat items (Customers, Suppliers, Staff, Settings)
  function renderCoreFeatures() {
    const coreModule = MODULES.find(m => m.key === 'core')
    if (!coreModule) return null

    const visibleFeatures = coreModule.features.filter(
      f => features[f.key] === true && canSeeFeature(f)
    )

    return visibleFeatures.map(renderNavItem)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-primary text-primary-foreground"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={cn(
        'fixed lg:static left-0 top-0 h-screen w-64 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 z-40',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-6 flex flex-col h-full">

          {/* Shop branding */}
          <div className="flex flex-col items-center gap-3 mb-4 mt-12 lg:mt-0">
            <div className="w-16 h-16 bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] flex items-center justify-center font-bold text-2xl overflow-hidden">
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

          {/* Branch selector */}
          {branches.length > 0 && (
            <BranchSelector branches={branches} selectedBranch={selectedBranch} />
          )}

          {/* Nav */}
          <nav className="space-y-1 flex-1 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {!mounted ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-[hsl(var(--sidebar-accent))]/20 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {STATIC_TOP.filter(canSeeStatic).map(renderNavItem)}

                {/* Business modules */}
                <div className="space-y-1 py-1">
                  {MODULES.map(renderModule)}
                </div>

                {/* Core features at bottom as flat items */}
                <div className="pt-3 mt-3 border-t border-[hsl(var(--sidebar-foreground))]/10 space-y-0.5">
                  {renderCoreFeatures()}
                </div>
              </>
            )}
          </nav>

          {/* Logout */}
          <div className="pt-4 mt-auto border-t border-[hsl(var(--sidebar-foreground))]/10">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 transition-colors text-sm font-medium',
                isLoggingOut
                  ? 'text-[hsl(var(--sidebar-foreground))]/50 cursor-not-allowed'
                  : 'text-[hsl(var(--sidebar-foreground))] hover:bg-red-500/20'
              )}
            >
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
