'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Cluster {
  _id: string
  name: string
  baseUri: string
  maxTenants: number
  tenantCount: number
  isActive: boolean
}

export default function ClustersPage() {
  const router = useRouter()
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [baseUri, setBaseUri] = useState('')
  const [maxTenants, setMaxTenants] = useState(5)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/admin/clusters')
    if (res.status === 401) { router.push('/admin/login'); return }
    const data = await res.json()
    setClusters(data.clusters || [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/clusters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, baseUri, maxTenants }),
    })
    if (res.ok) {
      setName(''); setBaseUri(''); setMaxTenants(5); setShowForm(false)
      load()
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to add cluster')
    }
    setSaving(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/admin/clusters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    load()
  }

  async function deleteCluster(id: string, name: string) {
    if (!confirm(`Delete cluster "${name}"?`)) return
    await fetch(`/api/admin/clusters/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin/tenants" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Clusters</span>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Add Cluster
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Add cluster form */}
        {showForm && (
          <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">New Cluster</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Cluster A"
                  required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Tenants</label>
                <input type="number" value={maxTenants} onChange={e => setMaxTenants(Number(e.target.value))}
                  min={1} max={20} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URI</label>
              <input value={baseUri} onChange={e => setBaseUri(e.target.value)} type="password"
                placeholder="mongodb+srv://user:pass@cluster.xyz.mongodb.net"
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-xs text-gray-400 mt-1">Do not include a database name — it will be appended automatically per tenant.</p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {saving ? 'Saving...' : 'Add Cluster'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Cluster list */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : clusters.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="mb-2">No clusters yet.</p>
            <p className="text-sm">Add a cluster to start onboarding tenants.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Capacity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clusters.map(c => {
                  const full = c.tenantCount >= c.maxTenants
                  const pct  = Math.round((c.tenantCount / c.maxTenants) * 100)
                  return (
                    <tr key={c._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${full ? 'bg-red-400' : pct > 60 ? 'bg-yellow-400' : 'bg-green-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${full ? 'text-red-600' : 'text-gray-600'}`}>
                            {c.tenantCount}/{c.maxTenants} {full ? '— Full' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(c._id, c.isActive)}
                          className={`text-xs font-medium px-2 py-1 rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteCluster(c._id, c.name)} className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
