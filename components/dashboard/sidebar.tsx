'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, ChevronLeft, ChevronRight,
  LayoutDashboard, ShoppingCart, ClipboardList, Package,
  ArrowLeftRight, BarChart2, Receipt, Users, Truck,
  UserCog, Settings, BedDouble, Pill, UtensilsCrossed,
  Repeat2, Building2, RefreshCcw, FileText, Smartphone,
  FlaskConical, CalendarDays, CreditCard, Layers,
  TrendingUp, ChefHat, Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/media-url'
import { MODULES, type ModuleFeature } from '@/lib/modules'
import { BranchSelector } from '@/components/branch-selector'
import { useAuth } from '@/hooks/use-auth'
import { useTenantConfig } from '@/hooks/use-tenant-config'
import { useSettings } from '@/hooks/use-settings'

// ── Icon map: href → lucide icon ────────────────────────────────────────────
const HREF_ICONS: Record<string, LucideIcon> = {
  '/dashboard':                      LayoutDashboard,
  '/dashboard/retail/sales':         ShoppingCart,
  '/dashboard/retail/orders':        ClipboardList,
  '/dashboard/retail/inventory':     Package,
  '/dashboard/retail/stock-movements': ArrowLeftRight,
  '/dashboard/retail/reports':       BarChart2,
  '/dashboard/retail/expenses':      Receipt,
  '/dashboard/customers':            Users,
  '/dashboard/suppliers':            Truck,
  '/dashboard/restocking':           RefreshCcw,
  '/dashboard/quotations':           FileText,
  '/dashboard/staff':                UserCog,
  '/dashboard/stock-transfers':      Repeat2,
  '/dashboard/mobile-shops':         Smartphone,
  '/dashboard/settings':             Settings,
  '/dashboard/rental-services':      BedDouble,
  '/dashboard/rentals':              Building2,
  '/dashboard/pharmacy/pos':         Pill,
  '/dashboard/pharmacy/inventory':   FlaskConical,
  '/dashboard/pharmacy/patients':    Users,
  '/dashboard/pharmacy/appointments': CalendarDays,
  '/dashboard/pharmacy/billing':     CreditCard,
  '/dashboard/hospitality/pos':      UtensilsCrossed,
  '/dashboard/hospitality/orders':   ClipboardList,
  '/dashboard/hospitality/menu':     Layers,
  '/dashboard/hospitality/inventory': Warehouse,
  '/dashboard/hospitality/stock':    ArrowLeftRight,
  '/dashboard/hospitality/production': ChefHat,
  '/dashboard/hospitality/reports':  TrendingUp,
}

function NavIcon({ href, size = 18 }: { href: string; size?: number }) {
  const Icon = HREF_ICONS[href] ?? LayoutDashboard
  return <Icon size={size} className="shrink-0" />
}

// ── Static items ─────────────────────────────────────────────────────────────
const STATIC_TOP = [
  { label: 'Dashboard', href: '/dashboard', adminOnly: false, permission: null },
]

const LIVE_HREFS = new Set(['/dashboard'])

type UserType = 'user' | 'staff' | null

interface StaticItem {
  label: string
  href: string
  adminOnly: boolean
  permission: string | null
}

interface SidebarProps {
  collapsed: boolean
  onCollapsedChange: (v: boolean) => void
}

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({})

  const {
    user,
    isLoading: isLoadingAuth,
    logout,
    isLoggingOut,
    isCashierMode,
    isBranchManager,
    permissions,
  } = useAuth()

  const { features } = useTenantConfig()
  const { logo, shopName } = useSettings()

  const userType = user?.type ?? null
  const allowedRoutes = user?.allowedRoutes ?? []
  const managerOfBranches = user?.managerOfBranches ?? []
  const branches = user?.branches ?? []
  const selectedBranch = user?.selectedBranch ?? null
  const displayShopName = shopName || user?.shopName || 'My Shop'

  useEffect(() => { setMounted(true) }, [])

  // ── Visibility helpers ────────────────────────────────────────────────────

  function canSeeFeature(f: ModuleFeature): boolean {
    if (userType === 'user') return true
    if (userType === null) return !f.adminOnly
    if (isCashierMode) {
      return allowedRoutes.some(r => f.href === r || f.href.startsWith(r + '/'))
    }
    if (f.adminOnly) return false
    return permissions[f.key] === true
  }

  function canSeeStatic(item: StaticItem): boolean {
    if (userType === 'user') return true
    if (userType === null) return !item.adminOnly
    if (userType === 'staff') {
      if (isCashierMode) {
        return allowedRoutes.some(r => item.href === r || item.href.startsWith(r + '/'))
      }
      if (item.adminOnly) return false
      if (!item.permission) return true
      return permissions[item.permission] === true
    }
    return false
  }

  // ── Active helpers ────────────────────────────────────────────────────────

  const LEGACY_ACTIVE_MAP: Record<string, string[]> = {
    '/dashboard/retail/sales':     ['/dashboard/sales'],
    '/dashboard/retail/orders':    ['/dashboard/orders'],
    '/dashboard/retail/inventory': ['/dashboard/inventory'],
    '/dashboard/retail/reports':   ['/dashboard/reports'],
    '/dashboard/retail/expenses':  ['/dashboard/expenses'],
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

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderNavItem(item: { label: string; href: string }) {
    const active  = isActive(item.href)
    const showDot = LIVE_HREFS.has(item.href) && active

    if (collapsed) {
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setIsOpen(false)}
          title={item.label}
          className={cn(
            'flex items-center justify-center w-10 h-10 mx-auto transition-colors relative',
            active
              ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
              : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
          )}
        >
          <NavIcon href={item.href} size={18} />
          {showDot && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />}
        </Link>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center gap-3 justify-between px-3 py-2.5 transition-colors relative text-sm font-medium',
          active
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
            : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
        )}
      >
        <span className="flex items-center gap-3">
          <NavIcon href={item.href} size={16} />
          {item.label}
        </span>
        {showDot && <span className="w-2 h-2 bg-orange-400 animate-pulse" />}
      </Link>
    )
  }

  function renderFeatureLink(f: ModuleFeature) {
    const active  = isActive(f.href)
    const showDot = LIVE_HREFS.has(f.href) && active

    if (collapsed) {
      return (
        <Link
          key={f.href}
          href={f.href}
          onClick={() => setIsOpen(false)}
          title={f.label}
          className={cn(
            'flex items-center justify-center w-10 h-10 mx-auto transition-colors relative',
            active
              ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
              : 'text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
          )}
        >
          <NavIcon href={f.href} size={16} />
          {showDot && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />}
        </Link>
      )
    }

    return (
      <Link
        key={f.href}
        href={f.href}
        onClick={() => setIsOpen(false)}
        className={cn(
          'flex items-center gap-3 justify-between px-3 py-2 transition-colors relative text-sm',
          active
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]'
            : 'text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-accent-foreground))]'
        )}
      >
        <span className="flex items-center gap-3">
          <NavIcon href={f.href} size={15} />
          {f.label}
        </span>
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

    const isGroupCollapsed = groupCollapsed[mod.key] ?? false
    const anyChildActive   = visibleFeatures.some(f => isActive(f.href))
    const ModIcon          = mod.icon ?? LayoutDashboard

    if (visibleFeatures.length === 1) {
      return renderNavItem(visibleFeatures[0])
    }

    // Collapsed sidebar — show just the module icon with a tooltip
    if (collapsed) {
      return (
        <div key={mod.key} className="relative group">
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 mx-auto cursor-default',
              anyChildActive
                ? 'text-[hsl(var(--sidebar-accent-foreground))]'
                : 'text-[hsl(var(--sidebar-foreground))]/60'
            )}
            title={mod.label}
          >
            {anyChildActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[hsl(var(--sidebar-accent-foreground))] rounded-r" />
            )}
            <ModIcon size={18} className="shrink-0" />
          </div>
          {/* Fly-out submenu on hover */}
          <div className="absolute left-full top-0 ml-1 w-44 bg-[hsl(var(--sidebar-background))] border border-[hsl(var(--sidebar-foreground))]/10 shadow-lg z-50 py-1 hidden group-hover:block">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--sidebar-foreground))]/50">
              {mod.label}
            </p>
            {visibleFeatures.map(renderFeatureLink)}
          </div>
        </div>
      )
    }

    return (
      <div key={mod.key}>
        <button
          onClick={() => setGroupCollapsed(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2.5 transition-colors text-sm font-medium',
            anyChildActive
              ? 'text-[hsl(var(--sidebar-accent-foreground))]'
              : 'text-[hsl(var(--sidebar-foreground))]/70 hover:text-[hsl(var(--sidebar-foreground))]'
          )}
        >
          <span className="flex items-center gap-3">
            <ModIcon size={16} className="shrink-0" />
            {mod.label}
          </span>
          <span className="text-xs">{isGroupCollapsed ? '▸' : '▾'}</span>
        </button>

        {!isGroupCollapsed && (
          <div className="ml-7 pl-3 border-l border-[hsl(var(--sidebar-foreground))]/10 space-y-0.5 mt-0.5">
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

  // ── Collapse toggle tab — floats off the right edge of the sidebar ────────
  const CollapseTab = () => (
    <button
      onClick={() => onCollapsedChange(!collapsed)}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="hidden lg:flex absolute -right-3 top-6 z-50 items-center justify-center w-6 h-6 rounded-full border border-[hsl(var(--sidebar-foreground))]/20 bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shadow-sm hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] transition-colors"
    >
      {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
    </button>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-primary text-primary-foreground"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={cn(
        'relative fixed lg:static left-0 top-0 h-screen bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] transition-all duration-300 z-40 flex flex-col',
        collapsed ? 'w-16' : 'w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>

        {/* Collapse tab — always visible on desktop, peeks out from the right edge */}
        <CollapseTab />

        {/* Top: branding */}
        <div className={cn(
          'flex items-center gap-3 border-b border-[hsl(var(--sidebar-foreground))]/10 mt-12 lg:mt-0',
          collapsed ? 'flex-col justify-center py-4 px-2' : 'px-4 py-4'
        )}>
          <div className={cn(
            'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] flex items-center justify-center font-bold overflow-hidden shrink-0',
            collapsed ? 'w-9 h-9 text-base' : 'w-12 h-12 text-xl'
          )}>
            {logo
              ? <img src={resolveMediaUrl(logo)} alt={displayShopName} className="w-full h-full object-cover" />
              : displayShopName.charAt(0).toUpperCase()
            }
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm truncate">{displayShopName}</h2>
              <p className="text-[10px] text-[hsl(var(--sidebar-foreground))]/60 truncate">Powered by Chambu Digital</p>
            </div>
          )}
        </div>

        {/* Branch selector — hidden when collapsed */}
        {!collapsed && (
          <>
            {branches.length > 0 && (userType === 'user' || (userType === 'staff' && isBranchManager)) && (
              <div className="px-3 pt-3">
                <BranchSelector
                  branches={branches}
                  selectedBranch={selectedBranch}
                  isBranchManager={isBranchManager}
                  managerOfBranches={managerOfBranches}
                />
              </div>
            )}

            {branches.length > 0 && userType === 'staff' && !isBranchManager && selectedBranch && (
              <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-[hsl(var(--sidebar-accent))] border border-[hsl(var(--sidebar-accent-foreground))]/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[hsl(var(--sidebar-accent-foreground))] truncate">
                      {selectedBranch.name}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--sidebar-accent-foreground))]/60">
                      Assigned Branch
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Nav */}
        <nav className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-2',
          collapsed ? 'space-y-1' : 'space-y-1 px-1'
        )}>
          {!mounted || isLoadingAuth ? (
            <div className="space-y-2 px-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={cn('h-10 bg-[hsl(var(--sidebar-accent))]/20 animate-pulse', collapsed ? 'mx-3' : '')} />
              ))}
            </div>
          ) : (
            <>
              {STATIC_TOP.filter(canSeeStatic).map(renderNavItem)}

              <div className={cn('space-y-0.5 py-1', collapsed && 'flex flex-col items-center')}>
                {MODULES.map(renderModule)}
              </div>

              <div className={cn(
                'pt-2 mt-2 border-t border-[hsl(var(--sidebar-foreground))]/10 space-y-0.5',
                collapsed && 'flex flex-col items-center'
              )}>
                {renderCoreFeatures()}
              </div>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="border-t border-[hsl(var(--sidebar-foreground))]/10 shrink-0">
          {collapsed ? (
            <button
              onClick={logout}
              disabled={isLoggingOut}
              title="Logout"
              className="flex items-center justify-center w-10 h-10 mx-auto my-2 transition-colors text-[hsl(var(--sidebar-foreground))] hover:bg-red-500/20 disabled:opacity-50"
            >
              <span className="text-base">→</span>
            </button>
          ) : (
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
          )}
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
