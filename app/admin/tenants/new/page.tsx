import TenantForm from '../_form'
import Link from 'next/link'

export default function NewTenantPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin/tenants" className="hover:text-gray-700">Tenants</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">New Tenant</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Create Tenant</h2>
        <TenantForm />
      </main>
    </div>
  )
}
