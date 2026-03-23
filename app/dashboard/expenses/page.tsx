'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

interface Expense {
  _id: string
  title: string
  category: string
  notes: string
  amount: number
  date: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
  staffId?: { firstName?: string; lastName?: string; name?: string } | null
}

interface ExpenseCategory {
  _id: string
  name: string
}

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const cfg = {
    pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600 border-red-200' },
  }
  const c = cfg[status]
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${c.cls}`}>{c.label}</span>
}

export default function ExpensesPage() {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [form, setForm] = useState({ title: '', category: '', notes: '', amount: '', date: '' })

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/expenses?search=${encodeURIComponent(search)}`)
    const data = await res.json()
    setExpenses(data.expenses || [])
    setLoading(false)
  }, [search])

  const fetchCategories = async () => {
    const res = await fetch('/api/expenses/categories')
    const data = await res.json()
    setCategories(data.categories || [])
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setIsAdmin(d.user?.type === 'user')).catch(() => {})
    fetchCategories()
  }, [])
  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.category || !form.amount) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), date: form.date ? new Date(form.date) : new Date() }),
    })
    if (res.ok) {
      toast({ title: 'Expense submitted for approval' })
      setDialogOpen(false)
      setForm({ title: '', category: '', notes: '', amount: '', date: '' })
      fetchExpenses()
    } else {
      const err = await res.json()
      toast({ title: err.error || 'Failed to create expense', variant: 'destructive' })
    }
    setSubmitting(false)
  }

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast({ title: status === 'approved' ? 'Expense approved' : 'Expense rejected' })
      fetchExpenses()
    } else {
      toast({ title: 'Failed to update expense', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) { toast({ title: 'Expense deleted' }); fetchExpenses() }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    const res = await fetch('/api/expenses/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    })
    if (res.ok) {
      toast({ title: 'Category created' })
      setNewCategoryName('')
      setCategoryDialogOpen(false)
      fetchCategories()
    } else {
      const err = await res.json()
      toast({ title: err.error || 'Failed to create category', variant: 'destructive' })
    }
  }

  const pending  = expenses.filter(e => e.status === 'pending')
  const approved = expenses.filter(e => e.status === 'approved')
  const rejected = expenses.filter(e => e.status === 'rejected')
  const approvedTotal = approved.reduce((s, e) => s + e.amount, 0)
  const pendingTotal  = pending.reduce((s, e) => s + e.amount, 0)

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function ExpenseRow({ expense, showActions }: { expense: Expense; showActions?: boolean }) {
    const s = expense.staffId as any
    const name = s?.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s?.name || null
    return (
      <div className="flex items-center justify-between bg-white border rounded-lg p-4 shadow-sm">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{expense.title}</p>
            <StatusBadge status={expense.status} />
          </div>
          <p className="text-sm text-muted-foreground">{expense.category}</p>
          {expense.notes && <p className="text-xs text-muted-foreground">{expense.notes}</p>}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{fmtDate(expense.date || expense.createdAt)}</span>
            {name && <span>· {name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="font-semibold text-green-700">
            KES {expense.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </span>
          {isAdmin && showActions && expense.status === 'pending' && (
            <>
              <button onClick={() => handleApprove(expense._id, 'approved')}
                className="text-green-500 hover:text-green-700 transition-colors" title="Approve">
                <CheckCircle size={18} />
              </button>
              <button onClick={() => handleApprove(expense._id, 'rejected')}
                className="text-red-400 hover:text-red-600 transition-colors" title="Reject">
                <XCircle size={18} />
              </button>
            </>
          )}
          {isAdmin && (
            <button onClick={() => handleDelete(expense._id)}
              className="text-gray-300 hover:text-red-500 transition-colors" title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button onClick={() => setDialogOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus size={16} className="mr-2" /> Create an Expense
        </Button>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-xs text-green-700">Approved Expenses</p>
          <p className="text-xl font-bold text-green-800">KES {approvedTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
        </div>
        {pendingTotal > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-700">Pending Approval</p>
            <p className="text-xl font-bold text-amber-800">KES {pendingTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search Expenses" value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Tabs defaultValue={isAdmin && pending.length > 0 ? 'pending' : 'approved'}>
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-1.5">
              <Clock size={14} /> Pending
              {pending.length > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pending.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-1.5">
              <CheckCircle size={14} /> Approved ({approved.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-1.5">
              <XCircle size={14} /> Rejected ({rejected.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pending.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No pending expenses</div>
            ) : (
              <div className="space-y-3">
                {pending.map(e => <ExpenseRow key={e._id} expense={e} showActions />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            {approved.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No approved expenses yet</div>
            ) : (
              <div className="space-y-3">
                {approved.map(e => <ExpenseRow key={e._id} expense={e} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            {rejected.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No rejected expenses</div>
            ) : (
              <div className="space-y-3">
                {rejected.map(e => <ExpenseRow key={e._id} expense={e} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Create Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600 text-center">Create Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Enter Expense Title" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <select value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-green-500" required>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground -mt-2">
              Can&apos;t see a category?{' '}
              <button type="button" onClick={() => setCategoryDialogOpen(true)} className="text-green-600 hover:underline">
                Create Expense Category
              </button>
            </p>
            <Input type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <textarea placeholder="Notes/Reason" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[80px] resize-none" />
            <Input type="number" placeholder="Amount Spent" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} min="0" step="0.01" required />
            <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white">
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-green-600">Create Expense Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <Input placeholder="Category name" value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)} required />
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">Create</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
