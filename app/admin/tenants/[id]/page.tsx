'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import TenantForm from '../_form'
import Link from 'next/link'

export default function EditTenantPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/tenants/${id}`)
      .then(res => {
        if (res.status === 401) { router.push('/admin/login'); return null }
        return res.json()
      })
      .then(data => { if (data) { setTenant(data.tenant); setLoading(false) } })
  }, [id])

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin/tenants" className="hover:text-gray-700">Tenants</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{tenant?.subdomain || 'Edit'}</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Edit Tenant</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <TenantForm initial={tenant} />
        )}
      </main>
    </div>
  )
}
