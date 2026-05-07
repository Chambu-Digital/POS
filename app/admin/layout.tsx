import type { Metadata } from 'next'
import { AdminSidebar } from '@/components/admin/admin-sidebar'

export const metadata: Metadata = { title: 'Chambu Admin' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
