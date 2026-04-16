'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FEATURES, DEFAULT_FEATURES } from '@/lib/features'

interface Cluster {
  _id: string
  name: string
  tenantCount: number
  maxTenants: number
  isActive: boolean
}

interface Props {
  initial?: {
    _id?: string
    subdomain?: string
    mongoUri?: string
    shopName?: string
    isActive?: boolean
    features?: Record<string, boolean>
  }
}

export default function TenantForm({ initial }: Props) {
  const router = useRouter()
  const isEdit = !!initial?._id

  const [subdomain, setSubdomain]         = useState(initial?.subdomain || '')
  const [shopName, setShopName]           = useState(initial?.shopName || '')
  const [isActive, setIsActive]           = useState(initial?.isActive ?? true)
  const [features, setFeatures]           = useState<Record<string, boolean>>(initial?.features || DEFAULT_FEATURES)
  const [clusterId, setClusterId]         = useState('')
  const [clusters, setClusters]           = useState<Cluster[]>([])
  const [ownerEmail, setOwnerEmail]       = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    if (!isEdit) {
      fetch('/api/admin/clusters')
        .then(r => r.json())
        .then(d => setClusters((d.clusters || []).filter((c: Cluster) => c.isActive)))
    }
  }, [isEdit])

  function toggleFeature(key: string) {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const url    = isEdit ? `/api/admin/tenants/${initial!._id}` : '/api/admin/tenants'
    const method = isEdit ? 'PUT' : 'POST'
    const body   = isEdit
      ? { shopName, isActive, features }
      : { subdomain, clusterId, shopName, features }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Failed to save')
      setSaving(false)
      return
    }

    if (!isEdit && ownerEmail && ownerPassword) {
      const { tenant } = await res.json()
      const provRes = await fetch(`/api/admin/tenants/${tenant._id}/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, password: ownerPassword, shopName }),
      })
      if (!provRes.ok) {
        const d = await provRes.json()
        setError(`Tenant created but account setup failed: ${d.error}`)
        setSaving(false)
        return
      }
    }

    router.push('/admin/tenants')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain *</label>
        <div className="flex items-center gap-2">
          <input
            value={subdomain}
            onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="allstar"
            required
            disabled={isEdit}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
          />
          <span className="text-sm text-gray-400">.{process.env.NEXT_PUBLIC_APP_DOMAIN || 'yourapp.com'}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
        <input
          value={shopName}
          onChange={e => setShopName(e.target.value)}
          placeholder="Allstar Shop"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Cluster selector — only on create */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cluster *</label>
          {clusters.length === 0 ? (
            <p className="text-sm text-red-500">No available clusters. <a href="/admin/clusters" className="underline">Add one first.</a></p>
          ) : (
            <select
              value={clusterId}
              onChange={e => setClusterId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select a cluster...</option>
              {clusters.map(c => {
                const full = c.tenantCount >= c.maxTenants
                return (
                  <option key={c._id} value={c._id} disabled={full}>
                    {c.name} — {c.tenantCount}/{c.maxTenants} used{full ? ' (Full)' : ''}
                  </option>
                )
              })}
            </select>
          )}
          <p className="text-xs text-gray-400 mt-1">
            The database will be created automatically as <code className="bg-gray-100 px-1 rounded">{subdomain || 'subdomain'}</code> on the selected cluster.
          </p>
        </div>
      )}

      {/* Owner account — only on create */}
      {!isEdit && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
          <div>
            <p className="text-sm font-semibold text-gray-700">Owner Account</p>
            <p className="text-xs text-gray-500 mt-0.5">Credentials the client will use to log in.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
            <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
              placeholder="owner@allstarshop.com" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Password *</label>
            <input type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)}
              placeholder="Strong password" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Features</label>
        <div className="space-y-2">
          {FEATURES.map(({ key, label, description }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={!!features[key]} onChange={() => toggleFeature(key)}
                className="w-4 h-4 rounded text-green-600 focus:ring-green-500 mt-0.5" />
              <div>
                <span className="text-sm text-gray-700 font-medium">{label}</span>
                <p className="text-xs text-gray-400">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {isEdit && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded text-green-600 focus:ring-green-500" />
          <span className="text-sm text-gray-700">Active (tenant can log in)</span>
        </label>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Tenant'}
        </button>
        <button type="button" onClick={() => router.push('/admin/tenants')}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
          Cancel
        </button>
      </div>
    </form>
  )
}
