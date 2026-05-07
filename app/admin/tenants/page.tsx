'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { featuresToModuleKeys, MODULES } from '@/lib/modules'

interface Tenant {
  _id: string
  subdomain: string
  shopName: string
  isActive: boolean
  features: Record<string, boolean>
  createdAt: string
}

export default function TenantsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/admin/tenants')
    if (res.status === 401) { router.push('/admin/login'); return }
    if (!res.ok) { console.error('Failed to load tenants:', res.status); setLoading(false); return }
    const data = await res.json()
    setTenants(data.tenants || [])
    setLoading(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/admin/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    load()
  }

  async function deleteTenant(id: string, subdomain: string) {
    if (!confirm(`Delete tenant "${subdomain}"? This cannot be undone.`)) return
    await fetch(`/api/admin/tenants/${id}`, { method: 'DELETE' })
    load()
  }

  function getEnabledModules(features: Record<string, boolean>) {
    const moduleKeys = featuresToModuleKeys(features)
    return moduleKeys.map(key => {
      const module = MODULES.find(m => m.key === key)
      return module ? module.label : key
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tenants</h1>
        <Link href="/admin/tenants/new" className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + New Tenant
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">No tenants yet.</p>
          <Link href="/admin/tenants/new" className="text-green-600 font-medium text-sm hover:underline">
            Create your first tenant →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Subdomain</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Shop Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Modules</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map(t => {
                const enabledModules = getEnabledModules(t.features || {})
                return (
                  <tr key={t._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-green-700">{t.subdomain}</td>
                    <td className="px-4 py-3 text-gray-800">{t.shopName || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {enabledModules.length > 0 ? (
                          enabledModules.map(moduleName => (
                            <span key={moduleName} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                              {moduleName}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(t._id, t.isActive)}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/admin/tenants/${t._id}`} className="text-xs text-blue-600 hover:underline">
                          Edit
                        </Link>
                        <button onClick={() => deleteTenant(t._id, t.subdomain)} className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
