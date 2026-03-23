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
  Receipt,
  UtensilsCrossed,
  Wine,
  BedDouble,      // ← Rental Services icon
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',       href: '/dashboard',           adminOnly: false, permission: null,                  featureFlag: null        },
  { icon: ShoppingCart,    label: 'Make Order Sale', href: '/dashboard/sales',     adminOnly: false, permission: 'canMakeSales',         featureFlag: null        },
  { icon: FileText,        label: 'Orders',          href: '/dashboard/orders',    adminOnly: false, permission: 'canViewOrders',        featureFlag: null        },
  { icon: UtensilsCrossed, label: 'Kitchen Display', href: '/dashboard/kds',       adminOnly: false, permission: null,                  featureFlag: 'kdsEnabled' },
  { icon: Wine,            label: 'Bar',        href: '/dashboard/bar',       adminOnly: false, permission: null,                  featureFlag: 'barEnabled' },
  { icon: Package,         label: 'Inventory',       href: '/dashboard/inventory', adminOnly: false, permission: 'canViewInventory',     featureFlag: null        },
  { icon: BarChart3,       label: 'Reports',         href: '/dashboard/reports',   adminOnly: false, permission: 'canViewSalesReports',  featureFlag: null        },
  { icon: BedDouble,       label: 'Rental Services', href: '/dashboard/rental-services', adminOnly: false, permission: null,            featureFlag: null        },
  { icon: Receipt,         label: 'Expenses',        href: '/dashboard/expenses',  adminOnly: false, permission: null,                  featureFlag: null        },
  { icon: Users,           label: 'Staff',           href: '/dashboard/staff',     adminOnly: true,  permission: null,                  featureFlag: null        },
  { icon: Settings,        label: 'Settings',        href: '/dashboard/settings',  adminOnly: true,  permission: null,                  featureFlag: null        },
]

// Feature flags that are loaded from /api/settings
type FeatureFlags = {
  kdsEnabled: boolean
  barEnabled: boolean
}

const FEATURES_CACHE_KEY = 'sidebar_features'

function readCachedFeatures(): FeatureFlags {
  try {
    const raw = localStorage.getItem(FEATURES_CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { kdsEnabled: true, barEnabled: true }
}

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen]           = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [userType, setUserType]       = useState<'user' | 'staff' | null>(null)
  const [shopName, setShopName]       = useState<string>('My Shop')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  // Initialise from cache so flags are correct immediately on refresh
  const [features, setFeatures]       = useState<FeatureFlags>({ kdsEnabled: true, barEnabled: true })

  useEffect(() => {
    // Hydrate from cache before any network call
    setFeatures(readCachedFeatures())
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
      fetch('/api/settings')
        .then(res => {
          if (!res.ok) throw new Error('settings fetch failed')
          return res.json()
        })
        .then(data => {
          const flags: FeatureFlags = {
            kdsEnabled: data.settings?.features?.kdsEnabled === true,
            barEnabled: data.settings?.features?.barEnabled === true,
          }
          setFeatures(flags)
          // Persist so next refresh is instant
          try { localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(flags)) } catch {}
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

    const onSettingsUpdated = () => loadFeatures()
    window.addEventListener('settings_updated', onSettingsUpdated)

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'settings_updated') loadFeatures()
    }
    window.addEventListener('storage', onStorage)

    const interval = setInterval(loadFeatures, 5000)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('settings_updated', onSettingsUpdated)
      window.removeEventListener('storage', onStorage)
      clearInterval(interval)
    }
  }, [])

  const visibleMenuItems = menuItems.filter(item => {
    // Check feature flag — if the item requires a flag and it is off, hide it
    if (item.featureFlag && !features[item.featureFlag as keyof FeatureFlags]) return false

    // Owners see everything that passes the feature flag check
    if (userType === 'user') return true

    // While auth is loading, show all non-admin items so sidebar isn't blank
    if (userType === null) return !item.adminOnly

    // Staff: hide admin-only items
    if (userType === 'staff') {
      if (item.adminOnly) return false
      // If no permission required, show it
      if (!item.permission) return true
      // Otherwise check the specific permission
      return permissions[item.permission] === true
    }

    return false
  })

  // Items that should show a live indicator dot
  const liveItems = new Set(['/dashboard/kds', '/dashboard/bar'])

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
        <div className="p-6 flex flex-col h-full">

          {/* Shop branding */}
          <div className="flex flex-col items-center gap-3 mb-8 mt-12 lg:mt-0">
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] flex items-center justify-center font-bold text-2xl">
              {shopName.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <h2 className="font-bold text-lg">{shopName}</h2>
              <p className="text-xs text-[hsl(var(--sidebar-foreground))]/70 mt-1">
                Powered by Chambu Digital
              </p>
            </div>
          </div>

          {/* Nav items */}
          <nav className="space-y-1 flex-1 overflow-y-auto">
            {!mounted ? (
              // Skeleton during SSR / hydration to avoid layout shift
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-11 rounded-lg bg-[hsl(var(--sidebar-accent))]/20 animate-pulse" />
                ))}
              </div>
            ) : (
              visibleMenuItems.map((item) => {
                const Icon    = item.icon
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                const showDot  = liveItems.has(item.href) && isActive

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
                    {/* Live pulse dot — shown for KDS and Bar when active */}
                    {showDot && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    )}
                  </Link>
                )
              })
            )}
          </nav>

          {/* Logout */}
          <div className="pt-4 mt-auto border-t border-[hsl(var(--sidebar-foreground))]/10">
            <button
              onClick={() => {
                fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                  window.location.href = '/auth/login'
                })
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[hsl(var(--sidebar-foreground))] hover:bg-red-500/20 transition-colors"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
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