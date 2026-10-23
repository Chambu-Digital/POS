'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Building2, UserCheck, X, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Branch {
  _id: string
  name: string
  code: string
  address: string
  phone: string
  phones?: string[]
  status: 'active' | 'inactive' | 'closed'
  isDefault: boolean
  createdAt: string
  managers?: Array<{ _id: string; name: string; email: string }>
}

interface Staff {
  _id: string
  name: string
  email: string
  role: string
  branchId?: string
  managerOfBranches?: string[]
}

export function BranchesSettings() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phones: [''] as string[],
    status: 'active' as Branch['status'],
  })
  const [selectedManagers, setSelectedManagers] = useState<string[]>([])
  const [addingManager, setAddingManager] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [branchesRes, staffRes] = await Promise.all([
        fetch('/api/branches?status=all'),
        fetch('/api/staff'),
      ])

      let branchList: Branch[] = []
      let allStaff: Staff[] = []

      if (branchesRes.ok) {
        const d = await branchesRes.json()
        branchList = d.branches || []
      }
      if (staffRes.ok) {
        const d = await staffRes.json()
        allStaff = d.staff || []
        setStaff(allStaff)
      }

      const branchesWithManagers = branchList.map(branch => {
        const managers = allStaff.filter((s: any) =>
          s.managerOfBranches?.some((bid: string) =>
            bid === branch._id || bid.toString() === branch._id.toString()
          )
        )
        return { ...branch, managers }
      })

      setBranches(branchesWithManagers)
    } catch {
      toast.error('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingBranch(null)
    setFormData({ name: '', code: '', address: '', phones: [''], status: 'active' })
    setSelectedManagers([])
    setAddingManager(false)
    setIsModalOpen(true)
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch)
    const phones =
      branch.phones && branch.phones.length > 0
        ? branch.phones
        : branch.phone
        ? [branch.phone]
        : ['']
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phones,
      status: branch.status,
    })
    setSelectedManagers(branch.managers?.map(m => m._id) || [])
    setAddingManager(false)
    setIsModalOpen(true)
  }

  async function handleSubmit() {
    if (!formData.name || !formData.code) {
      toast.error('Name and code are required')
      return
    }
    setIsSubmitting(true)
    try {
      const cleanPhones = formData.phones.filter(p => p.trim() !== '')
      const url = editingBranch ? `/api/branches/${editingBranch._id}` : '/api/branches'
      const method = editingBranch ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          address: formData.address,
          phones: cleanPhones,
          phone: cleanPhones[0] || '',
          status: formData.status,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save branch')
      }

      const { branch } = await response.json()

      // Handle manager changes
      const oldManagerIds = editingBranch?.managers?.map(m => m._id) || []
      const managersToRemove = oldManagerIds.filter(id => !selectedManagers.includes(id))
      const managersToAdd = selectedManagers.filter(id => !oldManagerIds.includes(id))

      for (const managerId of managersToRemove) {
        const res = await fetch(`/api/staff/${managerId}`)
        if (res.ok) {
          const { staff: s } = await res.json()
          await fetch(`/api/staff/${managerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              managerOfBranches: (s.managerOfBranches || []).filter((bid: string) => bid !== branch._id),
            }),
          })
        }
      }
      for (const managerId of managersToAdd) {
        const res = await fetch(`/api/staff/${managerId}`)
        if (res.ok) {
          const { staff: s } = await res.json()
          await fetch(`/api/staff/${managerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              managerOfBranches: [...(s.managerOfBranches || []), branch._id],
            }),
          })
        }
      }

      toast.success(editingBranch ? 'Branch updated' : 'Branch created')
      setIsModalOpen(false)
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save branch')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(branchId: string) {
    if (!confirm('Are you sure you want to delete this branch?')) return
    try {
      const response = await fetch(`/api/branches/${branchId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete branch')
      toast.success('Branch deleted')
      fetchData()
    } catch {
      toast.error('Failed to delete branch')
    }
  }

  const availableManagers = staff.filter(s => !selectedManagers.includes(s._id))

  function addManager(managerId: string) {
    setSelectedManagers([...selectedManagers, managerId])
    setAddingManager(false)
  }

  function removeManager(managerId: string) {
    setSelectedManagers(selectedManagers.filter(id => id !== managerId))
  }

  const statusColor = (status: Branch['status']) => {
    if (status === 'active') return 'bg-green-100 text-green-700 border-green-200'
    if (status === 'inactive') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-red-100 text-red-700 border-red-200'
  }

  return (
    <div className="space-y-6">
      {/* Header — matches Section header bar style */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Branch Management</h3>
            <p className="text-xs text-gray-500 mt-0.5">Manage your business locations and assign managers</p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={14} /> Add Branch
          </button>
        </div>

        {/* Branch list */}
        <div className="divide-y divide-gray-100">
          {loading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="px-6 py-5">
                <div className="h-4 bg-gray-100 rounded w-48 mb-3 animate-pulse" />
                <div className="h-3 bg-gray-100 rounded w-72 animate-pulse" />
              </div>
            ))
          ) : branches.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-4">No branches yet</p>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Create First Branch
              </button>
            </div>
          ) : (
            branches.map(branch => {
              const phones =
                branch.phones && branch.phones.filter(p => p).length > 0
                  ? branch.phones.filter(p => p)
                  : branch.phone
                  ? [branch.phone]
                  : []

              return (
                <div key={branch._id} className="px-6 py-5 flex items-start justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    {/* Name row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Building2 size={15} className="text-green-600 shrink-0" />
                      <span className="font-semibold text-gray-900 text-sm">{branch.name}</span>
                      <span className="text-xs text-gray-400 font-mono border border-gray-200 px-1.5 py-0.5 rounded">{branch.code}</span>
                      {branch.isDefault && (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Default</span>
                      )}
                      <span className={`text-xs font-semibold border px-2 py-0.5 rounded-full ${statusColor(branch.status)}`}>
                        {branch.status.charAt(0).toUpperCase() + branch.status.slice(1)}
                      </span>
                    </div>

                    {/* Contact details */}
                    <div className="space-y-1 mt-2">
                      {branch.address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <MapPin size={12} className="shrink-0" />
                          <span>{branch.address}</span>
                        </div>
                      )}
                      {phones.map((p, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Phone size={12} className="shrink-0" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>

                    {/* Managers */}
                    <div className="mt-3">
                      {branch.managers && branch.managers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {branch.managers.map(m => (
                            <div key={m._id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-2.5 py-1 text-xs text-gray-700">
                              <UserCheck size={11} className="text-green-600" />
                              {m.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                          <span>No managers assigned</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => openEditModal(branch)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    {!branch.isDefault && (
                      <button
                        onClick={() => handleDelete(branch._id)}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch ? 'Update branch details and managers' : 'Add a new location to your business'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Branch Name *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Downtown Branch"
                className="focus-visible:ring-green-500"
              />
            </div>

            {/* Code */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Branch Code *</Label>
              <Input
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. DT01"
                maxLength={10}
                className="focus-visible:ring-green-500 font-mono"
              />
              <p className="text-xs text-gray-400">Unique short identifier for this branch</p>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Address</Label>
              <Input
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. 123 Main Street, Nairobi"
                className="focus-visible:ring-green-500"
              />
            </div>

            {/* Phone numbers */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone Number(s)</Label>
              <div className="space-y-2">
                {formData.phones.map((phone, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={phone}
                      onChange={e => {
                        const updated = [...formData.phones]
                        updated[idx] = e.target.value
                        setFormData({ ...formData, phones: updated })
                      }}
                      placeholder="e.g. +254 712 345 678"
                      className="focus-visible:ring-green-500"
                    />
                    {formData.phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, phones: formData.phones.filter((_, i) => i !== idx) })
                        }
                        className="shrink-0 p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {formData.phones.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, phones: [...formData.phones, ''] })}
                    className="w-full py-1.5 rounded-lg border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={12} /> Add Another Number
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val: any) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger className="focus:ring-green-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Managers */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Branch Managers</Label>

              {selectedManagers.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {selectedManagers.map(managerId => {
                    const manager = staff.find(s => s._id === managerId)
                    if (!manager) return null
                    return (
                      <div key={managerId} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <UserCheck size={13} className="text-green-600" />
                          <span className="text-sm font-medium text-gray-800">{manager.name}</span>
                          <span className="text-xs text-gray-400">{manager.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeManager(managerId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {!addingManager ? (
                <button
                  type="button"
                  onClick={() => setAddingManager(true)}
                  disabled={availableManagers.length === 0}
                  className="w-full py-1.5 rounded-lg border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={12} /> Add Manager
                </button>
              ) : (
                <div className="space-y-2">
                  <Select onValueChange={addManager}>
                    <SelectTrigger className="focus:ring-green-500">
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableManagers.map(s => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name} — {s.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setAddingManager(false)}
                    className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-1">
                {selectedManagers.length === 0
                  ? 'No managers — owner handles all duties'
                  : `${selectedManagers.length} manager${selectedManagers.length > 1 ? 's' : ''} assigned`}
              </p>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {isSubmitting
                  ? editingBranch ? 'Updating…' : 'Creating…'
                  : editingBranch ? 'Update Branch' : 'Create Branch'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
