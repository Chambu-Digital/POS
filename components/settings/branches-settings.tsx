'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Building2, UserCheck } from 'lucide-react'
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
  status: 'active' | 'inactive' | 'closed'
  isDefault: boolean
  createdAt: string
  manager?: { _id: string; name: string; email: string }
}

interface Staff {
  _id: string
  name: string
  email: string
  role: string
  branchId?: string
  isBranchManager: boolean
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
    phone: '',
    status: 'active' as Branch['status'],
    managerId: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [branchesRes, staffRes] = await Promise.all([
        fetch('/api/branches?status=all'),
        fetch('/api/staff')
      ])

      if (branchesRes.ok) {
        const branchData = await branchesRes.json()
        const branchList = branchData.branches || []
        
        // Fetch manager info for each branch
        const branchesWithManagers = await Promise.all(
          branchList.map(async (branch: Branch) => {
            const staffInBranch = await fetch(`/api/staff?branchId=${branch._id}`)
            if (staffInBranch.ok) {
              const staffData = await staffInBranch.json()
              const manager = staffData.staff?.find((s: Staff) => s.isBranchManager)
              return { ...branch, manager }
            }
            return branch
          })
        )
        
        setBranches(branchesWithManagers)
      }

      if (staffRes.ok) {
        const staffData = await staffRes.json()
        setStaff(staffData.staff || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingBranch(null)
    setFormData({
      name: '',
      code: '',
      address: '',
      phone: '',
      status: 'active',
      managerId: '',
    })
    setIsModalOpen(true)
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch)
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      status: branch.status,
      managerId: branch.manager?._id || '',
    })
    setIsModalOpen(true)
  }

  async function handleSubmit() {
    if (!formData.name || !formData.code) {
      toast.error('Name and code are required')
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingBranch
        ? `/api/branches/${editingBranch._id}`
        : '/api/branches'
      
      const method = editingBranch ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          address: formData.address,
          phone: formData.phone,
          status: formData.status,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save branch')
      }

      const { branch } = await response.json()

      // If managerId is set and not "none", update the staff member
      if (formData.managerId && formData.managerId !== 'none') {
        await fetch(`/api/staff/${formData.managerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchId: branch._id,
            isBranchManager: true,
          }),
        })
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
      const response = await fetch(`/api/branches/${branchId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete branch')
      }

      toast.success('Branch deleted')
      fetchData()
    } catch (error) {
      toast.error('Failed to delete branch')
    }
  }

  const availableManagers = staff.filter(s => 
    !s.isBranchManager || s._id === editingBranch?.manager?._id
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Branch Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your business branches and assign managers</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={16} className="mr-2" />
          Add Branch
        </Button>
      </div>

      {/* Branches List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Building2 size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
          <p className="text-muted-foreground">No branches yet</p>
          <Button onClick={openCreateModal} className="mt-4" variant="outline">
            <Plus size={16} className="mr-2" />
            Create First Branch
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {branches.map(branch => (
            <div
              key={branch._id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={20} className="text-primary" />
                    <h3 className="font-semibold text-lg">{branch.name}</h3>
                    <Badge variant="outline">{branch.code}</Badge>
                    {branch.isDefault && (
                      <Badge>Default</Badge>
                    )}
                    <Badge variant={branch.status === 'active' ? 'default' : 'secondary'}>
                      {branch.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {branch.address && <p>📍 {branch.address}</p>}
                    {branch.phone && <p>📞 {branch.phone}</p>}
                    {branch.manager && (
                      <div className="flex items-center gap-2 mt-2">
                        <UserCheck size={16} className="text-green-600" />
                        <span className="font-medium text-foreground">Manager:</span>
                        <span>{branch.manager.name}</span>
                        <span className="text-xs">({branch.manager.email})</span>
                      </div>
                    )}
                    {!branch.manager && (
                      <p className="text-amber-600 mt-2">⚠️ No manager assigned</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(branch)}
                  >
                    <Edit size={14} className="mr-1" />
                    Edit
                  </Button>
                  {!branch.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(branch._id)}
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch
                ? 'Update branch details and assign a manager'
                : 'Add a new branch to your business'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Branch Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Downtown Branch"
              />
            </div>

            <div>
              <Label>Branch Code *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. DT01"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Unique identifier for this branch
              </p>
            </div>

            <div>
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. 123 Main Street"
              />
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +254 712 345 678"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val: any) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Branch Manager</Label>
              <Select
                value={formData.managerId}
                onValueChange={(val) => setFormData({ ...formData, managerId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableManagers.map(s => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} ({s.email}) - {s.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Staff member must not already be a manager of another branch
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting
                  ? editingBranch ? 'Updating...' : 'Creating...'
                  : editingBranch ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
