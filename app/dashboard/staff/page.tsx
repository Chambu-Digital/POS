'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Search, Plus, Trash2, Edit2, ChevronUp, ChevronDown,
  User, ChevronDown as ChevronDownIcon, X, TrendingUp, ShoppingCart, DollarSign,
  TrendingDown, Wallet, Calendar,
} from 'lucide-react'
import { toast } from 'sonner'

interface Staff {
  _id: string
  name: string
  email: string
  phone?: string
  jobDescription?: string
  firstName?: string
  middleName?: string
  lastName?: string
  nationalId?: string
  kraPin?: string
  nhifNo?: string
  nssfNo?: string
  leaveDays?: number
  salary?: number
  commissionStructure?: string
  employmentType?: string
  role: 'cashier' | 'manager' | 'supervisor' | 'employee' | 'admin'
  active: boolean
  createdAt: string
  permissions?: Record<string, boolean>
  isOwner?: boolean   // synthetic flag for the admin user
  position?: string
}

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee', cashier: 'Cashier',
  supervisor: 'Supervisor', manager: 'Manager', admin: 'Admin',
}

const DEFAULT_PERMS = {
  canMakeSales: true, canViewOrders: true, canViewInventory: true,
  canEditInventory: false, canAddProducts: false, canDeleteProducts: false,
  canViewSalesReports: false, canViewDashboard: true, canManageStaff: false,
  canEditSettings: false, canProcessRefunds: false, canApplyDiscounts: true,
  canDeleteOrders: false, canExportData: false,
}

const MANAGER_PERMS = {
  ...DEFAULT_PERMS,
  canEditInventory: true, canAddProducts: true, canDeleteProducts: true,
  canViewSalesReports: true, canProcessRefunds: true,
}

const PERM_LABELS: { key: keyof typeof DEFAULT_PERMS; label: string }[] = [
  { key: 'canMakeSales',        label: 'Make Sales' },
  { key: 'canViewOrders',       label: 'View Orders' },
  { key: 'canViewInventory',    label: 'View Inventory' },
  { key: 'canEditInventory',    label: 'Edit Inventory' },
  { key: 'canAddProducts',      label: 'Add Products' },
  { key: 'canDeleteProducts',   label: 'Delete Products' },
  { key: 'canViewSalesReports', label: 'View Sales Reports' },
  { key: 'canProcessRefunds',   label: 'Process Refunds' },
  { key: 'canApplyDiscounts',   label: 'Apply Discounts' },
  { key: 'canManageStaff',      label: 'Manage Staff' },
  { key: 'canEditSettings',     label: 'Edit Settings' },
]

// ── Inline editable field ────────────────────────────────────────────────────
function InlineField({ label, value, display, editable, onSave }: {
  label: string; value: string; display: string; editable: boolean; onSave: (val: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const [saving, setSaving]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Always sync draft when parent value changes (e.g. after save)
  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function commit() {
    const trimmed = draft.trim()
    // If unchanged, just close
    if (trimmed === value) { setEditing(false); return }
    setSaving(true)
    try { await onSave(trimmed) } catch { setDraft(value) } finally { setSaving(false); setEditing(false) }
  }

  return (
    <div className="text-sm">
      <span className="font-semibold text-gray-700">{label}: </span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value) } }}
          disabled={saving}
          className="mt-0.5 w-full rounded border border-green-400 px-1.5 py-0.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      ) : (
        <span
          onClick={() => editable && setEditing(true)}
          className={`text-gray-600 ${editable ? 'cursor-pointer hover:text-green-700 hover:underline decoration-dashed underline-offset-2' : ''}`}
          title={editable ? 'Click to edit' : undefined}
        >
          {saving ? '…' : display || (editable ? '+ Add' : '—')}
        </span>
      )}
    </div>
  )
}

// ── Action dropdown ──────────────────────────────────────────────────────────
function ActionMenu({ onChangeRole, onChangePassword, onPermissions, onEdit, onDelete }: {
  onChangeRole: () => void
  onChangePassword: () => void
  onPermissions: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { label: 'Change user role',        action: onChangeRole },
    { label: 'Change Password',         action: onChangePassword },
    // { label: 'Set Employee code and PIN', action: () => {} },
    { label: 'Add/Revoke Permissions',  action: onPermissions },
    { label: 'Edit',                    action: onEdit },
    { label: 'Delete',                  action: onDelete },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium transition-colors"
      >
        Action <ChevronDownIcon size={13} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg border border-gray-200 shadow-xl z-[200] py-1">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub?: string
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-xs text-green-600 font-medium">{sub}</p>}
    </div>
  )
}

export default function StaffPage() {
  const router = useRouter()
  const [staff, setStaff]           = useState<Staff[]>([])
  const [owner, setOwner]           = useState<Staff | null>(null)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')

  // View modal
  const [viewStaff, setViewStaff]   = useState<Staff | null>(null)
  const [viewOpen, setViewOpen]     = useState(false)

  // Create/edit modal
  const [formOpen, setFormOpen]     = useState(false)
  const [editingStaff, setEditing]  = useState<Staff | null>(null)
  const [showPassword, setShowPwd]  = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Sub-modals
  const [roleOpen, setRoleOpen]         = useState(false)
  const [pwdOpen, setPwdOpen]           = useState(false)
  const [permsOpen, setPermsOpen]       = useState(false)
  const [newRole, setNewRole]           = useState<Staff['role']>('employee')
  const [newPassword, setNewPassword]   = useState('')
  const [editPerms, setEditPerms]       = useState<Record<string, boolean>>({ ...DEFAULT_PERMS })

  const [form, setForm] = useState({
    name: '', email: '', phone: '', jobDescription: '',
    firstName: '', middleName: '', lastName: '',
    nationalId: '', kraPin: '', nhifNo: '', nssfNo: '',
    leaveDays: 14, salary: 0, commissionStructure: '', employmentType: '',
    password: '', role: 'employee' as Staff['role'],
    permissions: { ...DEFAULT_PERMS },
  })

  useEffect(() => { checkAccess(); fetchStaff(); fetchOwner() }, [])

  async function checkAccess() {
    const res = await fetch('/api/auth/me')
    if (res.ok) {
      const { user } = await res.json()
      if (user?.type !== 'user') { toast.error('Access denied'); router.push('/dashboard') }
    }
  }

  async function fetchOwner() {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      const { user } = await res.json()
      if (user?.type === 'user') {
        const ownerEntry: Staff = {
          _id: user.id,
          name: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ') || user.shopName || user.email,
          email: user.email,
          phone: user.phone || '',
          firstName: user.firstName || '',
          middleName: user.middleName || '',
          lastName: user.lastName || '',
          nationalId: user.nationalId || '',
          kraPin: user.kraPin || '',
          role: 'admin',
          active: true,
          createdAt: user.createdAt || new Date().toISOString(),
          isOwner: true,
          position: 'OWNER',
          jobDescription: 'Shop Owner / Administrator',
        }
        setOwner(ownerEntry)
      }
    } catch { /* silent */ }
  }

  async function fetchStaff() {
    setLoading(true)
    try {
      const res = await fetch('/api/staff')
      if (res.ok) { const d = await res.json(); setStaff(d.staff || []) }
    } catch { toast.error('Failed to load staff') }
    finally { setLoading(false) }
  }

  function openView(s: Staff) {
    setViewStaff(s)
    setViewOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setForm({
      name: '', email: '', phone: '', jobDescription: '',
      firstName: '', middleName: '', lastName: '',
      nationalId: '', kraPin: '', nhifNo: '', nssfNo: '',
      leaveDays: 14, salary: 0, commissionStructure: '', employmentType: '',
      password: '', role: 'employee', permissions: { ...DEFAULT_PERMS },
    })
    setShowPwd(false)
    setFormOpen(true)
  }

  function openEdit(s: Staff) {
    setEditing(s)
    setForm({
      name: s.name, email: s.email, phone: s.phone || '',
      jobDescription: s.jobDescription || '',
      firstName: s.firstName || '', middleName: s.middleName || '', lastName: s.lastName || '',
      nationalId: s.nationalId || '', kraPin: s.kraPin || '',
      nhifNo: s.nhifNo || '', nssfNo: s.nssfNo || '',
      leaveDays: s.leaveDays ?? 14, salary: s.salary ?? 0,
      commissionStructure: s.commissionStructure || '', employmentType: s.employmentType || '',
      password: '', role: s.role,
      permissions: { ...DEFAULT_PERMS, ...(s.permissions || {}) },
    })
    setShowPwd(false)
    setViewOpen(false)
    setFormOpen(true)
  }

  function handleRoleChange(role: Staff['role']) {
    setForm(f => ({ ...f, role, permissions: role === 'manager' ? { ...MANAGER_PERMS } : { ...DEFAULT_PERMS } }))
  }

  // Generic helper: PUT to API and sync both staff list + viewStaff
  async function patchStaff(id: string, data: Partial<Staff> & { password?: string }) {
    // Owner is updated via /api/auth/me PATCH
    if (owner && id === owner._id) {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update') }
      const { user } = await res.json()
      const updated: Staff = {
        ...owner,
        name: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ') || user.shopName || user.email,
        phone: user.phone || '',
        firstName: user.firstName || '',
        middleName: user.middleName || '',
        lastName: user.lastName || '',
        nationalId: user.nationalId || '',
        kraPin: user.kraPin || '',
      }
      setOwner(updated)
      setViewStaff(v => v?._id === id ? updated : v)
      return updated
    }
    const res = await fetch(`/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update') }
    const updated: Staff = await res.json()
    setStaff(s => s.map(x => x._id === id ? updated : x))
    setViewStaff(v => v?._id === id ? updated : v)
    return updated
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingStaff) {
        const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') || form.name
        const updated = await patchStaff(editingStaff._id, {
          name: fullName, role: form.role,
          phone: form.phone, jobDescription: form.jobDescription,
          firstName: form.firstName, middleName: form.middleName, lastName: form.lastName,
          nationalId: form.nationalId, kraPin: form.kraPin,
          nhifNo: form.nhifNo, nssfNo: form.nssfNo,
          leaveDays: form.leaveDays, salary: form.salary,
          commissionStructure: form.commissionStructure, employmentType: form.employmentType,
          permissions: form.permissions as Staff['permissions'],
        })
        toast.success('Employee updated')
        setFormOpen(false)
        setViewStaff(updated)
        setViewOpen(true)
      } else {
        const res = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
        toast.success('Employee created')
        setFormOpen(false)
        await fetchStaff()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save employee')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this employee?')) return
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setStaff(s => s.filter(x => x._id !== id))
      setViewOpen(false)
      toast.success('Deleted')
    } else toast.error('Failed to delete')
  }

  async function saveRole() {
    if (!viewStaff) return
    try {
      await patchStaff(viewStaff._id, { role: newRole })
      toast.success('Role updated')
      setRoleOpen(false)
    } catch { toast.error('Failed to update role') }
  }

  async function savePassword() {
    if (!viewStaff || !newPassword.trim()) return
    try {
      await patchStaff(viewStaff._id, { password: newPassword } as any)
      toast.success('Password updated')
      setPwdOpen(false)
      setNewPassword('')
    } catch { toast.error('Failed to update password') }
  }

  async function savePerms() {
    if (!viewStaff) return
    try {
      await patchStaff(viewStaff._id, { permissions: editPerms })
      toast.success('Permissions updated')
      setPermsOpen(false)
    } catch { toast.error('Failed to update permissions') }
  }

  const filtered = [
    ...(owner ? [owner] : []),
    ...staff.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase())
    ),
  ].filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search Employee" value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-white border-gray-200 focus-visible:ring-green-500" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Staff Management</h1>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
          Create Employee <Plus size={15} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {search ? 'No employees match your search.' : 'No employees yet. Create your first one.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-12">Index</th>
                {['Name', 'Job Title', 'Phone', 'Salary (KES)', 'Employment Type'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="flex flex-col leading-none"><ChevronUp size={9} /><ChevronDown size={9} /></span>
                      {h}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s._id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-green-700 cursor-pointer hover:underline" onClick={() => openView(s)}>
                        {s.name}
                      </span>
                      {s.isOwner && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          OWNER
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-green-600 font-medium">
                    {s.isOwner ? 'Owner / Admin' : (ROLE_LABELS[s.role] || s.role)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.salary ? `${s.salary.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{s.employmentType || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(s)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      {!s.isOwner && (
                        <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── VIEW EMPLOYEE MODAL ─────────────────────────────────────────────── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col">
          {viewStaff && (
            <>
              {/* Top bar — no manual X, DialogContent provides its own */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 shrink-0 pr-12">
                {viewStaff.isOwner ? (
                  <button
                    onClick={() => openEdit(viewStaff)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <ActionMenu
                    onChangeRole={() => { setNewRole(viewStaff.role); setRoleOpen(true) }}
                    onChangePassword={() => { setNewPassword(''); setPwdOpen(true) }}
                    onPermissions={() => { setEditPerms({ ...DEFAULT_PERMS, ...(viewStaff.permissions || {}) }); setPermsOpen(true) }}
                    onEdit={() => openEdit(viewStaff)}
                    onDelete={() => handleDelete(viewStaff._id)}
                  />
                )}
                <div className="flex items-center gap-2 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
                  <Calendar size={13} /> Filter by Date
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden min-h-0">
                {/* Left: profile card */}
                <div className="w-64 shrink-0 border-r border-gray-100 p-6 flex flex-col gap-3">
                  <div className="flex justify-center mb-2">
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                      <User size={36} className="text-gray-500" />
                    </div>
                  </div>

                  {/* Inline-editable fields */}
                  {([
                    { label: 'Name',     field: 'name',  value: viewStaff.name,           display: viewStaff.name,              editable: !viewStaff.isOwner },
                    { label: 'Joined',   field: '',       value: fmt(viewStaff.createdAt),  display: fmt(viewStaff.createdAt),    editable: false },
                    { label: 'Phone',    field: 'phone', value: viewStaff.phone || '',      display: viewStaff.phone || '—',      editable: true  },
                    { label: 'Email',    field: 'email', value: viewStaff.email,            display: viewStaff.email,             editable: false },
                    { label: 'Position', field: '',       value: viewStaff.isOwner ? 'OWNER' : (viewStaff.role), display: viewStaff.isOwner ? 'OWNER' : `[ "${viewStaff.role}" ]`, editable: false },
                  ] as { label: string; field: string; value: string; display: string; editable: boolean }[]).map(row => (
                    <InlineField
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      display={row.display}
                      editable={row.editable}
                      onSave={async (val) => {
                        await patchStaff(viewStaff._id, { [row.field]: val })
                        toast.success(`${row.label} updated`)
                      }}
                    />
                  ))}                </div>

                {/* Right: stats + recent sales */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={DollarSign}   label="Salary"           value="KES 0.00" />
                    <StatCard icon={TrendingUp}   label="Commission"       value="0" />
                    <StatCard icon={ShoppingCart} label="Total Sales value" value="—" />
                    <StatCard icon={DollarSign}   label="Total Earnings"   value="KES 0.00" />
                    <StatCard icon={TrendingDown} label="Total Deductions"  value="KES 0.00" sub="View all Deductions" />
                    <StatCard icon={Wallet}       label="Net Earning"      value="KES 0.00" />
                  </div>

                  {/* Recent sales */}
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <span className="text-4xl mb-2"></span>
                    <p className="text-sm">No recent sales</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── CHANGE ROLE SUB-MODAL ───────────────────────────────────────────── */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="max-w-sm">
          <h3 className="font-bold text-gray-900 mb-4">Change User Role</h3>
          <Select value={newRole} onValueChange={v => setNewRole(v as Staff['role'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={saveRole}
            className="mt-4 w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
            Save Role
          </button>
        </DialogContent>
      </Dialog>

      {/* ── CHANGE PASSWORD SUB-MODAL ───────────────────────────────────────── */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="max-w-sm">
          <h3 className="font-bold text-gray-900 mb-4">Change Password</h3>
          <Input type="password" placeholder="New password" value={newPassword}
            onChange={e => setNewPassword(e.target.value)} className="focus-visible:ring-green-500" />
          <button onClick={savePassword}
            className="mt-4 w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
            Update Password
          </button>
        </DialogContent>
      </Dialog>

      {/* ── PERMISSIONS SUB-MODAL ──────────────────────────────────────────── */}
      <Dialog open={permsOpen} onOpenChange={setPermsOpen}>
        <DialogContent className="max-w-sm">
          <h3 className="font-bold text-gray-900 mb-4">Add / Revoke Permissions</h3>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {PERM_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={!!editPerms[key]}
                  onCheckedChange={v => setEditPerms(p => ({ ...p, [key]: !!v }))} />
                <span className="text-xs text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <button onClick={savePerms}
            className="mt-4 w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
            Save Permissions
          </button>
        </DialogContent>
      </Dialog>

      {/* ── CREATE / EDIT FORM MODAL ────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 text-center">
            <h2 className="text-lg font-bold text-gray-900">
              {editingStaff ? `Edit ${editingStaff.name}'s Details` : 'New Employee'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[78vh] overflow-y-auto">

            {/* Name row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'First Name', key: 'firstName', required: true },
                { label: 'Middle Name', key: 'middleName', required: false },
                { label: 'Last Name', key: 'lastName', required: true },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  <Input value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    required={f.required && !editingStaff}
                    className="focus-visible:ring-green-500 text-sm" />
                </div>
              ))}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <Input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={!!editingStaff} required={!editingStaff}
                className="focus-visible:ring-green-500 text-sm" />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Phone Number</label>
              <Input placeholder="+254700000000" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="focus-visible:ring-green-500 text-sm" />
            </div>

            {/* Title / Role + Employment Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Title / Role</label>
                <Select value={form.role} onValueChange={v => handleRoleChange(v as Staff['role'])}>
                  <SelectTrigger className="text-sm focus:ring-green-500"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Employment Type</label>
                <Select value={form.employmentType} onValueChange={v => setForm(f => ({ ...f, employmentType: v }))}>
                  <SelectTrigger className="text-sm focus:ring-green-500"><SelectValue placeholder="— Select —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* National ID + KRA PIN */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">National ID</label>
                <Input value={form.nationalId}
                  onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))}
                  className="focus-visible:ring-green-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">KRA PIN</label>
                <Input placeholder="A000000000X" value={form.kraPin}
                  onChange={e => setForm(f => ({ ...f, kraPin: e.target.value }))}
                  className="focus-visible:ring-green-500 text-sm" />
              </div>
            </div>

            {/* NHIF + NSSF */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">NHIF No.</label>
                <Input value={form.nhifNo}
                  onChange={e => setForm(f => ({ ...f, nhifNo: e.target.value }))}
                  className="focus-visible:ring-green-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">NSSF No.</label>
                <Input value={form.nssfNo}
                  onChange={e => setForm(f => ({ ...f, nssfNo: e.target.value }))}
                  className="focus-visible:ring-green-500 text-sm" />
              </div>
            </div>

            {/* Leave days + Salary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Leave Days</label>
                <Input type="number" min={0} value={form.leaveDays}
                  onChange={e => setForm(f => ({ ...f, leaveDays: parseInt(e.target.value) || 0 }))}
                  className="focus-visible:ring-green-500 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Salary (KES)</label>
                <Input type="number" min={0} placeholder="0" value={form.salary}
                  onChange={e => setForm(f => ({ ...f, salary: parseFloat(e.target.value) || 0 }))}
                  className="focus-visible:ring-green-500 text-sm" />
              </div>
            </div>

            {/* Commission Structure */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Commission Structure</label>
              <Select value={form.commissionStructure} onValueChange={v => setForm(f => ({ ...f, commissionStructure: v }))}>
                <SelectTrigger className="text-sm focus:ring-green-500"><SelectValue placeholder="Select Commission Structure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Commission</SelectItem>
                  <SelectItem value="percentage">Percentage of Sales</SelectItem>
                  <SelectItem value="fixed">Fixed per Sale</SelectItem>
                  <SelectItem value="tiered">Tiered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Job Description</label>
              <textarea placeholder="Brief job description for this position" value={form.jobDescription}
                onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))} rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 resize-none" />
            </div>

            {/* Password (create only) */}
            {!editingStaff && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Password <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <Input type={showPassword ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
                    className="focus-visible:ring-green-500 flex-1 text-sm" />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="px-3 py-2 rounded-md border border-input text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                    {showPassword ? 'Hide' : 'Show Password'}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
              {submitting ? 'Saving…' : 'Submit'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
