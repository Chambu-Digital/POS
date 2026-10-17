'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media-url'
import { MODULES, type ModuleFeature } from '@/lib/modules'
import { BranchSelector } from '@/components/branch-selector'
import { useAuth } from '@/hooks/use-auth'
import { useTenantConfig } from '@/hooks/use-tenant-config'
import { useSettings } from '@/hooks/use-settings'

// ── Static items that appear outside the module groups ─────────────────────────
const STATIC_TOP = [
  { label: 'Dashboard', href: '/dashboard', adminOnly: false, permission: null },
]

// Routes that show a live animated dot indicator when active
const LIVE_HREFS = new Set(['/dashboard'])

// ── Type helpers ───────────────────────────────────────────────────────────

type UserType = 'user' | 'staff' | null

interface StaticItem {
  label: string
  href: string
  adminOnly: boolean
  permission: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  
  // React Query hooks - automatic caching and deduplication!
  const { 
    user,
    isLoading: isLoadingAuth,
    logout,
    isLoggingOut,
    isCashierMode,
    isBranchManager,
    permissions 
  } = useAuth()
  
  const { features } = useTenantConfig()
  const { logo, shopName } = useSettings()
  
  // Derived state from user
  const userType = user?.type ?? null
  const allowedRoutes = user?.allowedRoutes ?? []
  const managerOfBranches = user?.managerOfBranches ?? []
  const branches = user?.branches ?? []
  const selectedBranch = user?.selectedBranch ?? null
  const displayShopName = shopName || user?.shopName || 'My Shop'

  useEffect(() => {
    setMounted(true)
  }, [])

  // ── Visibility helpers ─────────────────────────────────────────────────────

  function canSeeFeature(f: ModuleFeature): boolean {
    if (userType === 'user') return true
    if (userType === null) return !f.adminOnly
    
    // staff — check cashier mode first
    if (isCashierMode) {
      return allowedRoutes.some(route => 
        f.href === route || f.href.startsWith(route + '/')
      )
    }
    
    // Non-cashier staff — check per-feature permission
    if (f.adminOnly) return false
    return permissions[f.key] === true
  }

  function canSeeStatic(item: StaticItem): boolean {
    if (userType === 'user') return true
    if (userType === null) return !item.adminOnly
    
    if (userType === 'staff') {
      if (isCashierMode) {
        return allowedRoutes.some(route => 
          item.href === route || item.href.startsWith(route + '/')
        )
      }
      
      if (item.adminOnly) return false
      if (!item.permission) return true
      return permissions[item.permission] === true
    }
    return false
  }

  // ── Active path helpers ────────────────────────────────────────────────────

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
    if (pathname === href || pathname.startsWith(href + '/')) return true
    
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

  function renderModule(mod: typeof MODULES[number]) {
    if (mod.key === 'core') return null

    const visibleFeatures = mod.features.filter(
      f => features[f.key] === true && canSeeFeature(f)
    )
    if (visibleFeatures.length === 0) return null

    const isCollapsed = collapsed[mod.key] ?? false
    const anyChildActive = visibleFeatures.some(f => isActive(f.href))

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
              {logo
                ? <img src={resolveMediaUrl(logo)} alt={displayShopName} className="w-full h-full object-cover" />
                : displayShopName.charAt(0).toUpperCase()
              }
            </div>
            <div className="text-center">
              <h2 className="font-bold text-lg">{displayShopName}</h2>
              <p className="text-xs text-[hsl(var(--sidebar-foreground))]/70 mt-1">Powered by Chambu Digital</p>
            </div>
          </div>

          {/* Branch selector */}
          {branches.length > 0 && (userType === 'user' || (userType === 'staff' && isBranchManager)) && (
            <BranchSelector 
              branches={branches} 
              selectedBranch={selectedBranch}
              isBranchManager={isBranchManager}
              managerOfBranches={managerOfBranches}
            />
          )}
          
          {/* Branch indicator for regular staff */}
          {branches.length > 0 && userType === 'staff' && !isBranchManager && selectedBranch && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-[hsl(var(--sidebar-accent))] border border-[hsl(var(--sidebar-accent-foreground))]/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[hsl(var(--sidebar-accent-foreground))]">
                    {selectedBranch.name}
                  </div>
                  <div className="text-[10px] text-[hsl(var(--sidebar-accent-foreground))]/60">
                    Assigned Branch
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="space-y-1 flex-1 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {!mounted || isLoadingAuth ? (
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

                {/* Core features at bottom */}
                <div className="pt-3 mt-3 border-t border-[hsl(var(--sidebar-foreground))]/10 space-y-0.5">
                  {renderCoreFeatures()}
                </div>
              </>
            )}
          </nav>

          {/* Logout */}
          <div className="pt-4 mt-auto border-t border-[hsl(var(--sidebar-foreground))]/10">
            <button
              onClick={logout}
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
