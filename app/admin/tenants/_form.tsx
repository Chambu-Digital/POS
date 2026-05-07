'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MODULES, DEFAULT_MODULE_FEATURES, normaliseFeatures, modulesToFeatures, featuresToModuleKeys } from '@/lib/modules'

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
  ownerEmail?: string
}

export default function TenantForm({ initial, ownerEmail: initialOwnerEmail }: Props) {
  const router = useRouter()
  const isEdit = !!initial?._id

  const [shopName, setShopName]           = useState(initial?.shopName || '')
  // Slug is auto-derived from shop name — shown as preview, not editable
  const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'myshop'
  const [isActive, setIsActive]           = useState(initial?.isActive ?? true)
  // Derive initially selected modules from existing feature flags (edit mode)
  const [selectedModules, setSelectedModules] = useState<string[]>(() =>
    featuresToModuleKeys(normaliseFeatures(initial?.features || DEFAULT_MODULE_FEATURES))
  )
  const [clusterId, setClusterId]         = useState('')
  const [clusters, setClusters]           = useState<Cluster[]>([])
  const [ownerEmail, setOwnerEmail]       = useState(initialOwnerEmail || '')
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


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const url    = isEdit ? `/api/admin/tenants/${initial!._id}` : '/api/admin/tenants'
    const method = isEdit ? 'PUT' : 'POST'
    const features = modulesToFeatures(selectedModules)
    const body   = isEdit
      ? { shopName, isActive, features }
      : { subdomain: slug, clusterId, shopName, features }

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

    // Handle owner account creation/update
    if (ownerEmail || ownerPassword) {
      let tenantId = initial?._id
      if (!isEdit) {
        const data = await res.json()
        tenantId = data.tenant._id
      }
      const ownerUrl = `/api/admin/tenants/${tenantId}/${isEdit ? 'update-owner' : 'provision'}`
      const ownerRes = await fetch(ownerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, password: ownerPassword, shopName }),
      })
      if (!ownerRes.ok) {
        let errMsg = 'Unknown error'
        try { const d = await ownerRes.json(); errMsg = d.error || errMsg } catch {}
        setError(`${isEdit ? 'Tenant updated but' : 'Tenant created but'} account ${isEdit ? 'update' : 'setup'} failed: ${errMsg}`)
        setSaving(false)
        return
      }
    }

    router.push('/admin/tenants')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
        <input
          value={shopName}
          onChange={e => setShopName(e.target.value)}
          placeholder="Allstar Shop"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {!isEdit && shopName && (
          <p className="text-xs text-gray-400 mt-1">
            Database ID: <code className="bg-gray-100 px-1 rounded text-gray-600">{slug}</code>
          </p>
        )}
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
            The database will be created automatically as <code className="bg-gray-100 px-1 rounded">{slug}</code> on the selected cluster.
          </p>
        </div>
      )}

      {/* Owner account — create or edit */}
      {!isEdit ? (
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
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
          <div>
            <p className="text-sm font-semibold text-gray-700">Owner Account</p>
            <p className="text-xs text-gray-500 mt-0.5">Update the tenant owner's login credentials.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email</label>
            <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
              placeholder="owner@allstarshop.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="text-xs text-gray-400 mt-1">Leave blank to keep current email</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="text-xs text-gray-400 mt-1">Only fill this if you want to change the password</p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Modules</label>
        <p className="text-xs text-gray-400 mb-3">Select which modules this business will have access to. All features within a module are enabled by default.</p>
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map(mod => {
            const ModIcon = mod.icon
            const on = selectedModules.includes(mod.key)
            return (
              <button
                key={mod.key}
                type="button"
                onClick={() => setSelectedModules(prev =>
                  on ? prev.filter(k => k !== mod.key) : [...prev, mod.key]
                )}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                  on
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`mt-0.5 p-1.5 rounded-md ${on ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <ModIcon size={16} className={on ? 'text-green-700' : 'text-gray-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${on ? 'text-green-800' : 'text-gray-700'}`}>{mod.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{mod.description}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                  on ? 'border-green-500 bg-green-500' : 'border-gray-300'
                }`}>
                  {on && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
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
