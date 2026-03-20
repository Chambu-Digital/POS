'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface Expense {
  _id: string
  title: string
  category: string
  notes: string
  amount: number
  date: string
  createdAt: string
}

interface ExpenseCategory {
  _id: string
  name: string
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

  const [form, setForm] = useState({
    title: '',
    category: '',
    notes: '',
    amount: '',
    date: '',
  })

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

  useEffect(() => { fetchExpenses() }, [fetchExpenses])
  useEffect(() => { fetchCategories() }, [])

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
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        date: form.date ? new Date(form.date) : new Date(),
      }),
    })
    if (res.ok) {
      toast({ title: 'Expense created successfully' })
      setDialogOpen(false)
      setForm({ title: '', category: '', notes: '', amount: '', date: '' })
      fetchExpenses()
    } else {
      const err = await res.json()
      toast({ title: err.error || 'Failed to create expense', variant: 'destructive' })
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Expense deleted' })
      fetchExpenses()
    }
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

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus size={16} className="mr-2" />
          Create an Expense
        </Button>
      </div>

      {/* Summary card */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 inline-block">
        <p className="text-sm text-green-700">Total Expenses</p>
        <p className="text-2xl font-bold text-green-800">
          KES {totalExpenses.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search Expenses"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Expenses list */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No expenses found.</p>
          <p className="text-sm mt-1">Click "Create an Expense" to add one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map(expense => (
            <div
              key={expense._id}
              className="flex items-center justify-between bg-white border rounded-lg p-4 shadow-sm"
            >
              <div className="space-y-1">
                <p className="font-medium">{expense.title}</p>
                <p className="text-sm text-muted-foreground">{expense.category}</p>
                {expense.notes && (
                  <p className="text-xs text-muted-foreground">{expense.notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(expense.date || expense.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold text-green-700">
                  KES {expense.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </span>
                <button
                  onClick={() => handleDelete(expense._id)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600 text-center">Create Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Enter Expense Title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />

            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <p className="text-xs text-muted-foreground -mt-2">
              Can&apos;t see a category?{' '}
              <button
                type="button"
                onClick={() => setCategoryDialogOpen(true)}
                className="text-green-600 hover:underline"
              >
                Create Expense Category
              </button>
            </p>

            <Input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              placeholder="Select to change expense date"
            />

            <textarea
              placeholder="Notes/Reason"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[80px] resize-none"
            />

            <Input
              type="number"
              placeholder="Amount Spent"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              min="0"
              step="0.01"
              required
            />

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? 'Submitting...' : 'Submit'}
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
            <Input
              placeholder="Category name"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              required
            />
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
