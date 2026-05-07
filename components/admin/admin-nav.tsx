'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, Server, LogOut, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin/tenants',  label: 'Tenants',  icon: Building2 },
  { href: '/admin/clusters', label: 'Clusters', icon: Server },
]

export function AdminNav() {
  const pathname = usePathname()
  const router   = useRouter()

  async function logout() {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/admin/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
        {/* Brand */}
        <Link href="/admin/tenants" className="flex items-center gap-2 shrink-0">
          <LayoutDashboard size={18} className="text-green-600" />
          <span className="font-bold text-gray-900 text-sm">Chambu Admin</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </header>
  )
}
