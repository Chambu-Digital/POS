'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, X, ChevronDown, ChevronUp, CreditCard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface LedgerEntry {
  date: string
  type: 'purchase' | 'payment' | 'adjustment'
  amount: number
  balance: number
  note?: string
}

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  creditBalance: number
  ledger: LedgerEntry[]
  createdAt: string
}

export default function CustomersPage() {
  return (
    <PermissionGuard requiredPermission="pos.customers">
      <CustomersContent />
    </PermissionGuard>
  )
}

function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Add customer
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)

  // Pay credit
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}`)
      if (res.ok) { const d = await res.json(); setCustomers(d.customers || []) }
    } catch { toast.error('Failed to load customers') }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search])

  async function addCustomer() {
    if (!newName.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, phone: newPhone, email: newEmail }),
      })
      if (res.ok) {
        toast.success('Customer added')
        setShowAdd(false); setNewName(''); setNewPhone(''); setNewEmail('')
        load()
      } else {
        const d = await res.json(); toast.error(d.error || 'Failed to add customer')
      }
    } catch { toast.error('Failed to add customer') }
    setSaving(false)
  }

  async function recordPayment() {
    if (!payCustomer || !payAmount || parseFloat(payAmount) <= 0) { toast.error('Enter a valid amount'); return }
    setPaying(true)
    try {
      const res = await fetch(`/api/customers/${payCustomer._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(payAmount), note: payNote }),
      })
      if (res.ok) {
        toast.success('Payment recorded')
        setPayCustomer(null); setPayAmount(''); setPayNote('')
        load()
      } else {
        const d = await res.json(); toast.error(d.error || 'Failed to record payment')
      }
    } catch { toast.error('Failed to record payment') }
    setPaying(false)
  }

  async function deleteCustomer(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      toast.success('Customer deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const totalDebt = customers.reduce((s, c) => s + c.creditBalance, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          {totalDebt > 0 && (
            <p className="text-sm text-red-500 mt-0.5">Total outstanding credit: KES {totalDebt.toLocaleString()}</p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
        >
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {search ? 'No customers match your search.' : 'No customers yet. Add your first one.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Credit Balance</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map(c => (
                <>
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <button
                        onClick={() => setExpanded(expanded === c._id ? null : c._id)}
                        className="flex items-center gap-1.5 hover:text-green-700"
                      >
                        {expanded === c._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {c.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3">
                      {c.creditBalance > 0 ? (
                        <span className="text-red-600 font-semibold">KES {c.creditBalance.toLocaleString()}</span>
                      ) : (
                        <span className="text-green-600 text-xs">No debt</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {c.creditBalance > 0 && (
                          <button
                            onClick={() => { setPayCustomer(c); setPayAmount(String(c.creditBalance)) }}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                          >
                            <CreditCard size={13} /> Pay
                          </button>
                        )}
                        <button
                          onClick={() => deleteCustomer(c._id, c.name)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Ledger expansion */}
                  {expanded === c._id && (
                    <tr key={`${c._id}-ledger`}>
                      <td colSpan={5} className="px-4 pb-4 bg-gray-50">
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction History</p>
                          {c.ledger.length === 0 ? (
                            <p className="text-xs text-gray-400">No transactions yet</p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {[...c.ledger].reverse().map((entry, i) => (
                                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                                  <div>
                                    <span className={`font-medium ${entry.type === 'payment' ? 'text-green-600' : 'text-gray-700'}`}>
                                      {entry.type === 'payment' ? 'Payment' : entry.type === 'purchase' ? 'Purchase' : 'Adjustment'}
                                    </span>
                                    {entry.note && <span className="text-gray-400 ml-2">{entry.note}</span>}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className={entry.amount < 0 ? 'text-green-600' : 'text-red-500'}>
                                      {entry.amount < 0 ? '-' : '+'}KES {Math.abs(entry.amount).toLocaleString()}
                                    </span>
                                    <span className="text-gray-400 w-24 text-right">Bal: {entry.balance.toLocaleString()}</span>
                                    <span className="text-gray-300 w-20 text-right">{new Date(entry.date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Add Customer</DialogTitle>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <Input className="mt-1" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <Input className="mt-1" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="e.g. 0712345678" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input className="mt-1" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="optional" />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={addCustomer}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Customer'}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Credit Dialog */}
      <Dialog open={!!payCustomer} onOpenChange={v => !v && setPayCustomer(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Record Payment — {payCustomer?.name}</DialogTitle>
          {payCustomer && (
            <div className="space-y-3 mt-2">
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                <span className="text-red-600 font-semibold">Outstanding: KES {payCustomer.creditBalance.toLocaleString()}</span>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Amount Paid</label>
                <Input
                  className="mt-1"
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Note (optional)</label>
                <Input className="mt-1" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. Cash payment" />
              </div>
              {parseFloat(payAmount) > 0 && (
                <div className="text-xs text-gray-500">
                  Remaining after payment: KES {Math.max(0, payCustomer.creditBalance - parseFloat(payAmount)).toLocaleString()}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={recordPayment}
                  disabled={paying}
                  className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {paying ? 'Saving...' : 'Record Payment'}
                </button>
                <button onClick={() => setPayCustomer(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
