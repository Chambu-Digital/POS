'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MODULES,
  ALL_FEATURES,
  DEFAULT_MODULE_FEATURES,
  normaliseFeatures,
  getKitchenFeatures,
  getBarFeatures,
  type ModuleFeature,
  type ServiceModuleFeature,
} from '@/lib/modules'

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

// ── Helpers ────────────────────────────────────────────────────────────────────

/** True if at least one feature in this module is enabled */
function isModuleOn(moduleKey: string, features: Record<string, boolean>): boolean {
  const mod = MODULES.find(m => m.key === moduleKey)
  if (!mod) return false
  return mod.features.some(f => features[f.key] === true)
}

/** Enable or disable all features in a module */
function setModuleAll(
  moduleKey: string,
  on: boolean,
  prev: Record<string, boolean>
): Record<string, boolean> {
  const mod = MODULES.find(m => m.key === moduleKey)
  if (!mod) return prev
  const next = { ...prev }
  for (const f of mod.features) {
    next[f.key] = on ? f.defaultOn || on : false
  }
  // When turning a module on, ensure at least the first feature is on
  if (on && mod.features.length > 0) {
    next[mod.features[0].key] = true
  }
  return next
}

// ── Small submodule group for Service ─────────────────────────────────────────

function SubDomainGroup({
  label,
  features,
  values,
  onToggle,
}: {
  label: string
  features: ModuleFeature[]
  values: Record<string, boolean>
  onToggle: (key: string, val: boolean) => void
}) {
  const allOn = features.every(f => values[f.key])
  const anyOn = features.some(f => values[f.key])

  return (
    <div className="mt-2">
      {/* Sub-domain header with "select all" checkbox */}
      <div className="flex items-center gap-2 mb-1.5">
        <input
          type="checkbox"
          checked={allOn}
          ref={el => { if (el) el.indeterminate = !allOn && anyOn }}
          onChange={e => features.forEach(f => onToggle(f.key, e.target.checked))}
          className="w-3.5 h-3.5 rounded text-green-600 focus:ring-green-500"
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
      </div>
      <div className="pl-5 space-y-1">
        {features.map(f => (
          <label key={f.key} className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={values[f.key] === true}
              onChange={e => onToggle(f.key, e.target.checked)}
              className="w-3.5 h-3.5 mt-0.5 rounded text-green-600 focus:ring-green-500 shrink-0"
            />
            <div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                {f.label}
              </span>
              <p className="text-[11px] text-gray-400 leading-tight">{f.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Main form ──────────────────────────────────────────────────────────────────

export default function TenantForm({ initial, ownerEmail: initialOwnerEmail }: Props) {
  const router = useRouter()
  const isEdit = !!initial?._id

  const [shopName, setShopName]   = useState(initial?.shopName || '')
  const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'myshop'
  const [isActive, setIsActive]   = useState(initial?.isActive ?? true)
  const [clusterId, setClusterId] = useState('')
  const [clusters, setClusters]   = useState<Cluster[]>([])
  const [ownerEmail, setOwnerEmail]       = useState(initialOwnerEmail || '')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // ── Feature flags — the source of truth for what the tenant can access ────────
  // Initialise from stored features (or defaults for new tenants).
  const [features, setFeatures] = useState<Record<string, boolean>>(() =>
    normaliseFeatures(initial?.features || DEFAULT_MODULE_FEATURES)
  )

  // Track which module sections are expanded in the UI
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const mod of MODULES) {
      init[mod.key] = isModuleOn(mod.key, normaliseFeatures(initial?.features || DEFAULT_MODULE_FEATURES))
    }
    return init
  })

  useEffect(() => {
    if (!isEdit) {
      fetch('/api/admin/clusters')
        .then(r => r.json())
        .then(d => setClusters((d.clusters || []).filter((c: Cluster) => c.isActive)))
    }
  }, [isEdit])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function toggleFeature(key: string, val: boolean) {
    setFeatures(prev => ({ ...prev, [key]: val }))
  }

  function toggleModule(moduleKey: string, on: boolean) {
    setFeatures(prev => setModuleAll(moduleKey, on, prev))
    setExpanded(prev => ({ ...prev, [moduleKey]: on }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const url    = isEdit ? `/api/admin/tenants/${initial!._id}` : '/api/admin/tenants'
    const method = isEdit ? 'PUT' : 'POST'

    // Send the full feature flags record directly — no module-level abstraction
    const body = isEdit
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* Shop name */}
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

      {/* Cluster — create only */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cluster *</label>
          {clusters.length === 0 ? (
            <p className="text-sm text-red-500">
              No available clusters. <a href="/admin/clusters" className="underline">Add one first.</a>
            </p>
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
            Database will be created as{' '}
            <code className="bg-gray-100 px-1 rounded">{slug}</code> on the selected cluster.
          </p>
        </div>
      )}

      {/* Owner account */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-700">Owner Account</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isEdit
              ? "Update the tenant owner's login credentials."
              : 'Credentials the client will use to log in.'}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner Email {!isEdit && <span className="text-red-500">*</span>}
          </label>
          <input
            type="email"
            value={ownerEmail}
            onChange={e => setOwnerEmail(e.target.value)}
            placeholder="owner@allstarshop.com"
            required={!isEdit}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {isEdit && <p className="text-xs text-gray-400 mt-1">Leave blank to keep current email</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isEdit ? 'New Password' : <span>Owner Password <span className="text-red-500">*</span></span>}
          </label>
          <input
            type="password"
            value={ownerPassword}
            onChange={e => setOwnerPassword(e.target.value)}
            placeholder={isEdit ? 'Leave blank to keep current password' : 'Strong password'}
            required={!isEdit}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* ── Module + submodule access control ───────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Module & Submodule Access
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Enable top-level modules then choose exactly which submodules this tenant can access.
          Navigation and routes are automatically locked to the selected set.
        </p>

        <div className="space-y-3">
          {MODULES.map(mod => {
            const modOn   = isModuleOn(mod.key, features)
            const isOpen  = expanded[mod.key] && modOn
            const ModIcon = mod.icon

            // For Service, features are split by subDomain
            const kitchenFeatures = mod.key === 'service' ? getKitchenFeatures() : []
            const barFeatures     = mod.key === 'service' ? getBarFeatures()     : []

            return (
              <div
                key={mod.key}
                className={`rounded-xl border-2 transition-colors overflow-hidden ${
                  modOn ? 'border-green-400 bg-green-50/40' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Module header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Master toggle */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={modOn}
                      onChange={e => toggleModule(mod.key, e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                  </label>

                  {/* Icon + name */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {ModIcon && <ModIcon size={16} className={modOn ? 'text-green-600' : 'text-gray-400'} />}
                    <div>
                      <p className={`text-sm font-semibold ${modOn ? 'text-green-800' : 'text-gray-600'}`}>
                        {mod.label}
                      </p>
                      <p className="text-xs text-gray-400 leading-tight">{mod.description}</p>
                    </div>
                  </div>

                  {/* Expand/collapse when module is on */}
                  {modOn && (
                    <button
                      type="button"
                      onClick={() => setExpanded(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                      className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1"
                    >
                      {isOpen ? '▲ collapse' : '▼ expand'}
                    </button>
                  )}
                </div>

                {/* Feature checkboxes — shown when module is on and expanded */}
                {isOpen && (
                  <div className="border-t border-green-100 px-4 pb-4 pt-3 bg-white/60">
                    {mod.key === 'service' ? (
                      // Service: split into Kitchen and Bar sub-sections
                      <div className="grid md:grid-cols-2 gap-4">
                        <SubDomainGroup
                          label="Restaurant / Kitchen"
                          features={kitchenFeatures}
                          values={features}
                          onToggle={toggleFeature}
                        />
                        <SubDomainGroup
                          label="Bar"
                          features={barFeatures}
                          values={features}
                          onToggle={toggleFeature}
                        />
                      </div>
                    ) : (
                      // All other modules: flat checkbox list
                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
                        {mod.features.map(f => (
                          <label key={f.key} className="flex items-start gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={features[f.key] === true}
                              onChange={e => toggleFeature(f.key, e.target.checked)}
                              className="w-3.5 h-3.5 mt-0.5 rounded text-green-600 focus:ring-green-500 shrink-0"
                            />
                            <div>
                              <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                                {f.label}
                                {f.adminOnly && (
                                  <span className="ml-1 text-[10px] text-amber-600 font-normal">(admin)</span>
                                )}
                              </span>
                              <p className="text-[11px] text-gray-400 leading-tight">{f.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Summary of enabled count */}
                    <p className="text-[11px] text-gray-400 mt-3">
                      {mod.features.filter(f => features[f.key]).length} of {mod.features.length} submodules enabled
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Active toggle — edit only */}
      {isEdit && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Active (tenant can log in)</span>
        </label>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Tenant'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/tenants')}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
