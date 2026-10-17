'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, X, ChevronDown, ChevronUp, CreditCard, Mail, Phone, User, Calendar, MessageCircle, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { apiGet, apiPost, apiPut, apiPatch, handleApiError } from '@/lib/api-client'
import { LoadingOrOffline } from '@/components/offline-indicator'
import { CustomerInvoiceDialog } from '@/components/customers/customer-invoice-dialog'

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
  idNumber?: string
  creditBalance: number
  creditLimit: number
  ledger: LedgerEntry[]
  createdAt: string
}

export default function CustomersPage() {
  return (
    <PermissionGuard requiredPermission="core.customers">
      <CustomersContent />
    </PermissionGuard>
  )
}

function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Add customer
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newIdNumber, setNewIdNumber] = useState('')
  const [newCreditLimit, setNewCreditLimit] = useState('')
  const [saving, setSaving] = useState(false)

  // Pay credit
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [selectedBankId, setSelectedBankId] = useState('')
  const [selectedCustomMethodId, setSelectedCustomMethodId] = useState('')
  const [paying, setPaying] = useState(false)

  // Payment methods data
  const [bankProviders, setBankProviders] = useState<Array<{ _id: string; name: string }>>([])
  const [customMethods, setCustomMethods] = useState<Array<{ _id: string; name: string }>>([])


  // Edit customer
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editIdNumber, setEditIdNumber] = useState('')
  const [editCreditLimit, setEditCreditLimit] = useState('')
  const [editing, setEditing] = useState(false)

  // Invoice dialog
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)

  // WhatsApp invoice sharing (legacy - keeping for compatibility)
  useEffect(() => { 
    load()
    fetchSettings()
    fetchBankProviders()
    fetchCustomMethods()
  }, [])

  async function load() {
    setLoading(true)
    setIsOffline(false)
    
    const result = await apiGet<{ customers: Customer[] }>(`/api/customers?search=${encodeURIComponent(search)}`)
    
    if (result.success && result.data) {
      setCustomers(result.data.customers || [])
    } else if (result.error) {
      setIsOffline(result.error.isOffline)
      if (!result.error.isOffline) {
        toast.error(handleApiError(result.error, 'Failed to load customers'))
      }
    }
    
    setLoading(false)
  }

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setShopSettings(data.settings || {})
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  async function fetchBankProviders() {
    try {
      const res = await fetch('/api/bank-providers')
      if (res.ok) {
        const data = await res.json()
        setBankProviders(data.providers || [])
      }
    } catch (error) {
      console.error('Failed to fetch bank providers:', error)
    }
  }

  async function fetchCustomMethods() {
    try {
      const res = await fetch('/api/payment-methods')
      if (res.ok) {
        const data = await res.json()
        setCustomMethods(data.methods || [])
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error)
    }
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
        body: JSON.stringify({ 
          name: newName, 
          phone: newPhone, 
          email: newEmail,
          idNumber: newIdNumber,
          creditLimit: parseFloat(newCreditLimit) || 0 
        }),
      })
      if (res.ok) {
        toast.success('Customer added')
        setShowAdd(false); setNewName(''); setNewPhone(''); setNewEmail(''); setNewIdNumber(''); setNewCreditLimit('')
        load()
      } else {
        const d = await res.json(); toast.error(d.error || 'Failed to add customer')
      }
    } catch { toast.error('Failed to add customer') }
    setSaving(false)
  }

  async function recordPayment() {
    if (!payCustomer || !payAmount || parseFloat(payAmount) <= 0) { 
      toast.error('Enter a valid amount')
      return 
    }
    
    if (!paymentMethod) {
      toast.error('Select a payment method')
      return
    }
    
    // Determine if this is a custom method
    const isCustomMethod = paymentMethod.startsWith('custom:')
    const actualPaymentMethod = isCustomMethod ? 'custom' : paymentMethod
    const customMethodId = isCustomMethod ? paymentMethod.split(':')[1] : selectedCustomMethodId
    
    // Validation for specific payment methods
    if (paymentMethod === 'bank' && !selectedBankId) {
      toast.error('Select a bank provider')
      return
    }
    
    if (isCustomMethod && !customMethodId) {
      toast.error('Select a payment method')
      return
    }
    
    setPaying(true)
    try {
      const payload: any = {
        amount: parseFloat(payAmount),
        note: payNote,
        paymentMethod: actualPaymentMethod,
      }
      
      // Add method-specific fields
      if (actualPaymentMethod === 'mobile_money') {
        payload.mpesaCode = mpesaCode
        payload.mpesaPhone = mpesaPhone
      }
      
      if (actualPaymentMethod === 'bank' && selectedBankId) {
        payload.bankProviderId = selectedBankId
        const provider = bankProviders.find(p => p._id === selectedBankId)
        if (provider) payload.bankProviderName = provider.name
      }
      
      if (actualPaymentMethod === 'custom' && customMethodId) {
        payload.customMethodId = customMethodId
        const method = customMethods.find(m => m._id === customMethodId)
        if (method) payload.customMethodName = method.name
      }
      
      const res = await fetch(`/api/customers/${payCustomer._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        toast.success('Payment recorded')
        setPayCustomer(null)
        setPayAmount('')
        setPayNote('')
        setPaymentMethod('cash')
        setMpesaCode('')
        setMpesaPhone('')
        setSelectedBankId('')
        setSelectedCustomMethodId('')
        load()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to record payment')
      }
    } catch { 
      toast.error('Failed to record payment') 
    }
    setPaying(false)
  }

  function openEditCustomer(customer: Customer) {
    setEditCustomer(customer)
    setEditName(customer.name)
    setEditPhone(customer.phone)
    setEditEmail(customer.email || '')
    setEditIdNumber(customer.idNumber || '')
    setEditCreditLimit(String(customer.creditLimit))
  }

  async function updateCustomer() {
    if (!editCustomer || !editName.trim()) { toast.error('Name is required'); return }
    setEditing(true)
    try {
      const res = await fetch(`/api/customers/${editCustomer._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          email: editEmail,
          idNumber: editIdNumber,
          creditLimit: parseFloat(editCreditLimit) || 0,
        }),
      })
      if (res.ok) {
        toast.success('Customer updated')
        setEditCustomer(null); setEditName(''); setEditPhone(''); setEditEmail(''); setEditIdNumber(''); setEditCreditLimit('')
        load()
      } else {
        const d = await res.json(); toast.error(d.error || 'Failed to update customer')
      }
    } catch { toast.error('Failed to update customer') }
    setEditing(false)
  }

  async function deleteCustomer(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      toast.success('Customer deleted')
      load()
    } catch { toast.error('Failed to delete') }
  }

  function formatPhone(phone: string): string {
    // Format Kenyan phone numbers for WhatsApp
    if (!phone) return ''
    let cleaned = phone.replace(/\D/g, '')
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1)
    }
    // If doesn't start with country code, add 254
    else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned
    }
    
    return cleaned
  }

  function shareInvoiceViaWhatsApp(customer: Customer) {
    if (!customer.phone) {
      toast.error('No phone number registered for this customer')
      return
    }

    const businessName = shopSettings?.general?.shopName || shopSettings?.shopName || 'Our Business'
    const phone = formatPhone(customer.phone)
    
    if (phone.length < 12) {
      toast.error('Invalid phone number format')
      return
    }

    // Create invoice message
    const message = `Hello ${customer.name},

Thank you for your business with ${businessName}!

${customer.creditBalance > 0 
  ? `Current Balance: KES ${customer.creditBalance.toLocaleString()}
${customer.creditLimit > 0 ? `Credit Limit: KES ${customer.creditLimit.toLocaleString()}` : ''}

Please contact us to settle your outstanding balance.`
  : 'Your account is in good standing. Thank you for your prompt payments!'}

For any inquiries, please contact us.

Thank you for choosing ${businessName}!`

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    
    // Open WhatsApp in new window
    window.open(whatsappUrl, '_blank')
    toast.success('Opening WhatsApp...')
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

      {/* Customer Cards Grid */}
      <LoadingOrOffline
        isLoading={loading}
        isOffline={isOffline}
        onRetry={load}
        loadingText="Loading customers..."
        offlineMessage="Unable to load customers. Please check your connection."
      >
        {customers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {search ? 'No customers match your search.' : 'No customers yet. Add your first one.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {customers.map(c => (
              <div key={c._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
                {/* Card Content */}
                <div className="p-2.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{c.name}</h3>
                      {c.phone && <p className="text-xs text-gray-500 truncate">{c.phone}</p>}
                    </div>
                    <button
                      onClick={() => setExpanded(expanded === c._id ? null : c._id)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      {expanded === c._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Credit Info */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div>
                      {c.creditBalance > 0 ? (
                        <span className="text-red-600 font-semibold">-KES {c.creditBalance.toLocaleString()}</span>
                      ) : (
                        <span className="text-green-600 font-medium">Clear</span>
                      )}
                    </div>
                    <div className="text-gray-400">
                      {c.creditLimit > 0 ? `Limit: ${c.creditLimit.toLocaleString()}` : 'No limit'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditCustomer(c)}
                      className="flex-1 px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    {c.creditBalance > 0 ? (
                      <button
                        onClick={() => { setPayCustomer(c); setPayAmount(String(c.creditBalance)) }}
                        className="flex-1 px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                      >
                        Pay
                      </button>
                    ) : (
                      <button
                        onClick={() => shareInvoiceViaWhatsApp(c)}
                        disabled={!c.phone}
                        className="flex-1 px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-40"
                      >
                        <MessageCircle size={11} className="inline" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Ledger */}
                {expanded === c._id && (
                  <div className="px-2.5 pb-2.5 bg-gray-50 border-t border-gray-200">
                    <div className="mt-2">
                      {c.idNumber && (
                        <p className="text-xs text-gray-500 mb-1">ID: {c.idNumber}</p>
                      )}
                      {c.email && (
                        <p className="text-xs text-gray-500 mb-2 truncate">{c.email}</p>
                      )}
                      <p className="text-xs font-medium text-gray-700 mb-1">History</p>
                      {c.ledger.length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">No transactions</p>
                      ) : (
                        <div className="space-y-0.5 max-h-32 overflow-y-auto">
                          {[...c.ledger].reverse().slice(0, 5).map((entry, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                              <span className={entry.type === 'payment' ? 'text-green-600' : 'text-gray-600'}>
                                {entry.type === 'payment' ? 'Payment' : entry.type === 'purchase' ? 'Purchase' : 'Adj'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={entry.amount < 0 ? 'text-green-600' : 'text-red-500'}>
                                  {entry.amount < 0 ? '-' : '+'}KES {Math.abs(entry.amount).toLocaleString()}
                                </span>
                                <span className="text-gray-300 text-xs">{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {c.creditBalance > 0 && (
                        <button
                          onClick={() => setInvoiceCustomer(c)}
                          disabled={!c.phone}
                          className="w-full mt-2 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-1"
                        >
                          <FileText size={12} />
                          Send Invoice
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </LoadingOrOffline>

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
            <div>
              <label className="text-sm font-medium text-gray-700">ID Number</label>
              <Input 
                className="mt-1" 
                value={newIdNumber} 
                onChange={e => setNewIdNumber(e.target.value)} 
                placeholder="Required for credit (e.g. National ID, Passport)" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Credit Limit</label>
              <Input 
                className="mt-1" 
                type="number" 
                value={newCreditLimit} 
                onChange={e => setNewCreditLimit(e.target.value)} 
                placeholder="0 for no credit" 
              />
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
              
              {/* Payment Method Selection - Dynamic */}
              <div>
                <label className="text-sm font-medium text-gray-700">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const value = e.target.value
                    setPaymentMethod(value)
                    
                    // Reset method-specific fields
                    setMpesaCode('')
                    setMpesaPhone('')
                    setSelectedBankId('')
                    setSelectedCustomMethodId('')
                    
                    // If custom method selected, set the customMethodId
                    if (value.startsWith('custom:')) {
                      setSelectedCustomMethodId(value.split(':')[1])
                    }
                  }}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {/* Built-in payment methods */}
                  <optgroup label="Standard Methods">
                    <option value="cash">Cash</option>
                    <option value="mobile_money">M-Pesa / Mobile Money</option>
                    <option value="card">Card</option>
                    {bankProviders.length > 0 && <option value="bank">Bank Transfer</option>}
                  </optgroup>
                  
                  {/* Custom payment methods from database */}
                  {customMethods.length > 0 && (
                    <optgroup label="Custom Methods">
                      {customMethods.map(method => (
                        <option key={method._id} value={`custom:${method._id}`}>
                          {method.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* M-Pesa Fields */}
              {paymentMethod === 'mobile_money' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700">M-Pesa Code</label>
                    <Input
                      className="mt-1"
                      value={mpesaCode}
                      onChange={e => setMpesaCode(e.target.value)}
                      placeholder="e.g. SG7XK3M9"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">M-Pesa Phone</label>
                    <Input
                      className="mt-1"
                      value={mpesaPhone}
                      onChange={e => setMpesaPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                    />
                  </div>
                </>
              )}

              {/* Bank Selection */}
              {paymentMethod === 'bank' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank *</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select bank</option>
                    {bankProviders.map(bank => (
                      <option key={bank._id} value={bank._id}>{bank.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-gray-700">Amount Paid *</label>
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

      {/* Edit Customer Dialog */}
      <Dialog open={!!editCustomer} onOpenChange={v => !v && setEditCustomer(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Edit Customer</DialogTitle>
          {editCustomer && (
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Name *</label>
                <Input className="mt-1" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <Input className="mt-1" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="e.g. 0712345678" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input className="mt-1" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="optional" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">ID Number</label>
                <Input 
                  className="mt-1" 
                  value={editIdNumber} 
                  onChange={e => setEditIdNumber(e.target.value)} 
                  placeholder="Required for credit (e.g. National ID, Passport)" 
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Credit Limit</label>
                <Input 
                  className="mt-1" 
                  type="number" 
                  value={editCreditLimit} 
                  onChange={e => setEditCreditLimit(e.target.value)} 
                  placeholder="0 for no credit" 
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={updateCustomer}
                  disabled={editing}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {editing ? 'Saving...' : 'Update Customer'}
                </button>
                <button onClick={() => setEditCustomer(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Invoice Dialog */}
      <CustomerInvoiceDialog
        open={!!invoiceCustomer}
        onOpenChange={(open) => !open && setInvoiceCustomer(null)}
        customer={invoiceCustomer}
        shopName={shopSettings?.general?.shopName || 'Our Shop'}
      />
    </div>
  )
}
