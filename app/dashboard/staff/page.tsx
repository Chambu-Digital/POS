'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { toast } from 'sonner'

interface Staff {
  _id: string
  name: string
  email: string
  role: 'cashier' | 'manager'
  active: boolean
  createdAt: string
  permissions?: {
    canMakeSales: boolean
    canViewInventory: boolean
    canEditInventory: boolean
    canAddProducts: boolean
    canDeleteProducts: boolean
    canViewSalesReports: boolean
    canManageStaff: boolean
    canEditSettings: boolean
    canProcessRefunds: boolean
    canApplyDiscounts: boolean
  }
}

export default function StaffPage() {
  const router = useRouter()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier' as const,
    permissions: {
      canMakeSales: true,
      canViewInventory: true,
      canEditInventory: false,
      canAddProducts: false,
      canDeleteProducts: false,
      canViewSalesReports: false,
      canManageStaff: false,
      canEditSettings: false,
      canProcessRefunds: false,
      canApplyDiscounts: true,
    },
  })

  useEffect(() => {
    checkAdminAccess()
    fetchStaff()
  }, [])

  async function checkAdminAccess() {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        if (data.user.type !== 'user') {
          toast.error('Access denied. Only admins can manage staff.')
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Error checking access:', error)
    }
  }

  async function fetchStaff() {
    try {
      const response = await fetch('/api/staff')
      if (response.ok) {
        const data = await response.json()
        setStaff(data.staff || [])
      }
    } catch (error) {
      toast.error('Failed to load staff')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (editingStaff && !formData.password) {
      // Editing without password change
      try {
        const response = await fetch(`/api/staff/${editingStaff._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            permissions: formData.permissions,
          }),
        })

        if (response.ok) {
          toast.success('Staff updated')
          setIsOpen(false)
          resetForm()
          await fetchStaff()
        } else {
          toast.error('Failed to update staff')
        }
      } catch (error) {
        toast.error('Error updating staff')
      }
    } else {
      // Creating new staff
      try {
        const response = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (response.ok) {
          toast.success('Staff created successfully')
          setIsOpen(false)
          resetForm()
          await fetchStaff()
        } else {
          const data = await response.json()
          toast.error(data.error || 'Failed to create staff')
        }
      } catch (error) {
        toast.error('Error creating staff')
      }
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'cashier',
      permissions: {
        canMakeSales: true,
        canViewInventory: true,
        canEditInventory: false,
        canAddProducts: false,
        canDeleteProducts: false,
        canViewSalesReports: false,
        canManageStaff: false,
        canEditSettings: false,
        canProcessRefunds: false,
        canApplyDiscounts: true,
      },
    })
    setEditingStaff(null)
  }

  function handleEdit(s: Staff) {
    setEditingStaff(s)
    setFormData({
      name: s.name,
      email: s.email,
      password: '',
      role: s.role,
      permissions: s.permissions || {
        canMakeSales: true,
        canViewInventory: true,
        canEditInventory: false,
        canAddProducts: false,
        canDeleteProducts: false,
        canViewSalesReports: false,
        canManageStaff: false,
        canEditSettings: false,
        canProcessRefunds: false,
        canApplyDiscounts: true,
      },
    })
    setIsOpen(true)
  }

  function handleRoleChange(role: 'cashier' | 'manager') {
    const defaultPermissions = role === 'manager' ? {
      canMakeSales: true,
      canViewInventory: true,
      canEditInventory: true,
      canAddProducts: true,
      canDeleteProducts: true,
      canViewSalesReports: true,
      canManageStaff: false,
      canEditSettings: false,
      canProcessRefunds: true,
      canApplyDiscounts: true,
    } : {
      canMakeSales: true,
      canViewInventory: true,
      canEditInventory: false,
      canAddProducts: false,
      canDeleteProducts: false,
      canViewSalesReports: false,
      canManageStaff: false,
      canEditSettings: false,
      canProcessRefunds: false,
      canApplyDiscounts: true,
    }
    
    setFormData({ ...formData, role, permissions: defaultPermissions })
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this staff member?')) return

    try {
      const response = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setStaff(staff.filter((s) => s._id !== id))
        toast.success('Staff deleted')
      } else {
        toast.error('Failed to delete staff')
      }
    } catch (error) {
      toast.error('Error deleting staff')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground mt-2">Manage staff accounts and permissions</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm()
              setIsOpen(true)
            }}>
              <Plus size={16} className="mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? 'Edit Staff' : 'Add New Staff'}
              </DialogTitle>
              <DialogDescription>
                {editingStaff ? 'Update staff information and permissions' : 'Create a new staff account with custom permissions'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingStaff}
                  required={!editingStaff}
                />
              </div>

              {!editingStaff && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingStaff}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleRoleChange(value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canMakeSales"
                      checked={formData.permissions.canMakeSales}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canMakeSales: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canMakeSales" className="font-normal cursor-pointer">
                      Make Sales
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canViewInventory"
                      checked={formData.permissions.canViewInventory}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewInventory: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canViewInventory" className="font-normal cursor-pointer">
                      View Inventory
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canEditInventory"
                      checked={formData.permissions.canEditInventory}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canEditInventory: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canEditInventory" className="font-normal cursor-pointer">
                      Edit Inventory
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canAddProducts"
                      checked={formData.permissions.canAddProducts}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canAddProducts: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canAddProducts" className="font-normal cursor-pointer">
                      Add Products
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canDeleteProducts"
                      checked={formData.permissions.canDeleteProducts}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDeleteProducts: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canDeleteProducts" className="font-normal cursor-pointer">
                      Delete Products
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canViewSalesReports"
                      checked={formData.permissions.canViewSalesReports}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewSalesReports: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canViewSalesReports" className="font-normal cursor-pointer">
                      View Sales Reports
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canProcessRefunds"
                      checked={formData.permissions.canProcessRefunds}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canProcessRefunds: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canProcessRefunds" className="font-normal cursor-pointer">
                      Process Refunds
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canApplyDiscounts"
                      checked={formData.permissions.canApplyDiscounts}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canApplyDiscounts: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canApplyDiscounts" className="font-normal cursor-pointer">
                      Apply Discounts
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageStaff"
                      checked={formData.permissions.canManageStaff}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageStaff: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canManageStaff" className="font-normal cursor-pointer">
                      Manage Staff
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canEditSettings"
                      checked={formData.permissions.canEditSettings}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canEditSettings: !!checked },
                        })
                      }
                    />
                    <Label htmlFor="canEditSettings" className="font-normal cursor-pointer">
                      Edit Settings
                    </Label>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full">
                {editingStaff ? 'Update' : 'Create'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {staff.length} staff member{staff.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No staff members yet. Create your first staff account to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member._id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === 'manager' ? 'default' : 'secondary'}>
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.active ? 'outline' : 'destructive'}>
                          {member.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(member)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(member._id)}
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
