'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Plus, Phone, Edit2, ChevronRight, Truck, Loader2,
  ArrowDownToLine, CreditCard, Clock, PackageSearch, Link2,
  ChevronsUpDown, Check,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { QuickAddSupplierDialog } from '@/components/suppliers/quick-add-supplier-dialog'
import { useRouter } from 'next/navigation'
import { LoadingOrOffline } from '@/components/offline-indicator'
import { apiGet, handleApiError } from '@/lib/api-client'

// ── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  _id: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  isActive: boolean
  createdAt: string
}

interface Receipt {
  _id: string
  receiptNumber: string
  supplierId: string | null
  supplierName: string
  totalCost: number
  paymentStatus: 'paid' | 'unpaid' | 'prepaid'
  paymentMethod: string
  bankProviderName: string
  customMethodName: string
  paymentReference: string
  date: string
  paidAt: string | null
  createdAt: string
  notes: string
  items: Array<{ itemName: string; quantity: number }>
}

interface SupplierBalance {
  totalSpent: number
  totalOwed: number
  totalAdvances: number
  lastPurchaseDate: string | null
  receiptCount: number
}

interface BankProvider { _id: string; name: string }
interface CustomMethod { _id: string; name: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtKES(n: number) {
  return `KES ${Math.round(n).toLocaleString('en-KE')}`
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function resolveMethod(r: Receipt): string {
  if (r.paymentMethod === 'cash') return 'Cash'
  if (r.paymentMethod === 'mobile_money') return 'M-Pesa'
  if (r.paymentMethod === 'bank' && r.bankProviderName) return r.bankProviderName
  if (r.paymentMethod === 'custom' && r.customMethodName) return r.customMethodName
  return r.paymentMethod || ''
}

const EMPTY_SUPPLIER = { name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' }
const EMPTY_ADVANCE  = { supplierId: '', amount: '', paymentMethod: 'cash', bankId: '', reference: '', notes: '' }

// ── Page wrapper ─────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  return (
    <PermissionGuard requiredPermission="core.suppliers">
      <SuppliersContent />
    </PermissionGuard>
  )
}

// ── Main content ─────────────────────────────────────────────────────────────

function SuppliersContent() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'suppliers' | 'payables' | 'advances'>('suppliers')

  // ── Data ──────────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [receipts,  setReceipts]  = useState<Receipt[]>([])
  const [loading,   setLoading]   = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [search,    setSearch]    = useState('')

  const [banks,  setBanks]  = useState<BankProvider[]>([])
  const [custom, setCustom] = useState<CustomMethod[]>([])

  // ── Supplier dialog ────────────────────────────────────────────────────
  const [supDialog,  setSupDialog]  = useState(false)
  const [editingSup, setEditingSup] = useState<Supplier | null>(null)
  const [supForm,    setSupForm]    = useState(EMPTY_SUPPLIER)
  const [supSaving,  setSupSaving]  = useState(false)

  // ── Pay-payable dialog ─────────────────────────────────────────────────
  const [payDialog,  setPayDialog]  = useState(false)
  const [payReceipt, setPayReceipt] = useState<Receipt | null>(null)
  const [payMethod,  setPayMethod]  = useState('cash')
  const [payBankId,  setPayBankId]  = useState('')
  const [payRef,     setPayRef]     = useState('')
  const [paying,     setPaying]     = useState(false)

  // ── Record-advance dialog ──────────────────────────────────────────────
  const [advDialog,   setAdvDialog]   = useState(false)
  const [advForm,     setAdvForm]     = useState(EMPTY_ADVANCE)
  const [advSaving,   setAdvSaving]   = useState(false)
  const [advSupOpen,  setAdvSupOpen]  = useState(false)
  const [advQuickAdd, setAdvQuickAdd] = useState(false)

  // ── Link-receipt dialog ────────────────────────────────────────────────
  const [linkDialog,   setLinkDialog]   = useState(false)
  const [linkReceipt,  setLinkReceipt]  = useState<Receipt | null>(null)
  const [linkSupId,    setLinkSupId]    = useState('')
  const [linkSupOpen,  setLinkSupOpen]  = useState(false)
  const [linkSaving,   setLinkSaving]   = useState(false)
  const [linkQuickAdd, setLinkQuickAdd] = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => { load(); loadPaymentMethods() }, [])

  async function load() {
    setLoading(true)
    setIsOffline(false)
    const [supResult, recResult] = await Promise.all([
      apiGet<{ suppliers: Supplier[] }>('/api/suppliers'),
      apiGet<{ receipts: Receipt[] }>('/api/stock-receipts'),
    ])
    if (supResult.success && supResult.data) {
      setSuppliers(supResult.data.suppliers || [])
    } else if (supResult.error) {
      setIsOffline(supResult.error.isOffline ?? false)
      toast.error(handleApiError(supResult.error, 'Failed to load suppliers'))
    }
    if (recResult.success && recResult.data) {
      setReceipts(recResult.data.receipts || [])
    }
    setLoading(false)
  }

  async function loadPaymentMethods() {
    const [bRes, cRes] = await Promise.all([
      fetch('/api/bank-providers'),
      fetch('/api/payment-methods'),
    ])
    if (bRes.ok) setBanks((await bRes.json()).providers || [])
    if (cRes.ok) setCustom((await cRes.json()).methods || [])
  }

  // ── Derived data ───────────────────────────────────────────────────────
  const balanceMap = useMemo(() => {
    const map = new Map<string, SupplierBalance>()
    for (const r of receipts) {
      if (!r.supplierId) continue
      const b = map.get(r.supplierId) ?? {
        totalSpent: 0, totalOwed: 0, totalAdvances: 0,
        lastPurchaseDate: null, receiptCount: 0,
      }
      b.receiptCount++
      if (!b.lastPurchaseDate || r.createdAt > b.lastPurchaseDate) b.lastPurchaseDate = r.createdAt
      if (r.paymentStatus === 'paid')    b.totalSpent    += r.totalCost
      if (r.paymentStatus === 'unpaid')  b.totalOwed     += r.totalCost
      if (r.paymentStatus === 'prepaid') b.totalAdvances += r.totalCost
      map.set(r.supplierId, b)
    }
    return map
  }, [receipts])

  const globalSpent    = receipts.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + r.totalCost, 0)
  const globalOwed     = receipts.filter(r => r.paymentStatus === 'unpaid').reduce((s, r) => s + r.totalCost, 0)
  const globalAdvances = receipts.filter(r => r.paymentStatus === 'prepaid').reduce((s, r) => s + r.totalCost, 0)

  const unpaidReceipts  = useMemo(() => receipts.filter(r => r.paymentStatus === 'unpaid'), [receipts])
  const prepaidReceipts = useMemo(() => receipts.filter(r => r.paymentStatus === 'prepaid'), [receipts])

  const sorted = useMemo(() => {
    const active = suppliers.filter(s => s.isActive)
    const q = search.toLowerCase()
    const filtered = q
      ? active.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.contactPerson?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q))
      : active
    return [...filtered].sort((a, b) => {
      const aB = balanceMap.get(a._id)
      const bB = balanceMap.get(b._id)
      const aHas = (aB?.totalOwed ?? 0) > 0 || (aB?.totalAdvances ?? 0) > 0
      const bHas = (bB?.totalOwed ?? 0) > 0 || (bB?.totalAdvances ?? 0) > 0
      if (aHas !== bHas) return aHas ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [suppliers, search, balanceMap])

  // ── Supplier dialog ────────────────────────────────────────────────────
  function openCreate() {
    setEditingSup(null); setSupForm(EMPTY_SUPPLIER); setSupDialog(true)
  }
  function openEdit(s: Supplier, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingSup(s)
    setSupForm({ name: s.name, contactPerson: s.contactPerson || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', notes: s.notes || '' })
    setSupDialog(true)
  }
  async function handleSaveSupplier() {
    if (!supForm.name.trim()) { toast.error('Supplier name is required'); return }
    setSupSaving(true)
    try {
      const url    = editingSup ? `/api/suppliers/${editingSup._id}` : '/api/suppliers'
      const method = editingSup ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supForm) })
      if (res.ok) { toast.success(editingSup ? 'Supplier updated' : 'Supplier added'); setSupDialog(false); load() }
      else toast.error((await res.json()).error || 'Failed to save')
    } catch { toast.error('Error saving supplier') }
    finally { setSupSaving(false) }
  }

  // ── Pay dialog ─────────────────────────────────────────────────────────
  function openPayDialog(r: Receipt, e: React.MouseEvent) {
    e.stopPropagation()
    setPayReceipt(r); setPayMethod('cash'); setPayBankId(''); setPayRef(''); setPayDialog(true)
  }
  async function handlePay() {
    if (!payReceipt) return
    const isCustom   = payMethod.startsWith('custom:')
    const normMethod = isCustom ? 'custom' : payMethod
    const customId   = isCustom ? payMethod.split(':')[1] : ''
    const customName = customId ? custom.find(m => m._id === customId)?.name || '' : ''
    const bankName   = payBankId ? banks.find(b => b._id === payBankId)?.name || '' : ''
    if (normMethod === 'bank' && !payBankId) { toast.error('Select a bank'); return }
    setPaying(true)
    try {
      const res = await fetch(`/api/stock-receipts/${payReceipt._id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: normMethod,
          bankProviderId: normMethod === 'bank' ? payBankId : '',
          bankProviderName: normMethod === 'bank' ? bankName : '',
          customMethodId: normMethod === 'custom' ? customId : '',
          customMethodName: normMethod === 'custom' ? customName : '',
          paymentReference: payRef }),
      })
      if (res.ok) { toast.success(`Paid ${fmtKES(payReceipt.totalCost)} to ${payReceipt.supplierName}`); setPayDialog(false); load() }
      else toast.error((await res.json()).error || 'Payment failed')
    } catch { toast.error('Payment failed') }
    finally { setPaying(false) }
  }

  // ── Advance dialog ─────────────────────────────────────────────────────
  async function handleRecordAdvance() {
    if (!advForm.supplierId) { toast.error('Select a supplier'); return }
    const amt = parseFloat(advForm.amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    const isCustom   = advForm.paymentMethod.startsWith('custom:')
    const normMethod = isCustom ? 'custom' : advForm.paymentMethod
    const customId   = isCustom ? advForm.paymentMethod.split(':')[1] : ''
    const customName = customId ? custom.find(m => m._id === customId)?.name || '' : ''
    const bankName   = advForm.bankId ? banks.find(b => b._id === advForm.bankId)?.name || '' : ''
    if (normMethod === 'bank' && !advForm.bankId) { toast.error('Select a bank'); return }
    const sel = suppliers.find(s => s._id === advForm.supplierId)
    setAdvSaving(true)
    try {
      const res = await fetch('/api/stock-receipts/advance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: advForm.supplierId, supplierName: sel?.name || '',
          amount: amt, paymentMethod: normMethod,
          bankProviderId: normMethod === 'bank' ? advForm.bankId : '',
          bankProviderName: normMethod === 'bank' ? bankName : '',
          customMethodId: normMethod === 'custom' ? customId : '',
          customMethodName: normMethod === 'custom' ? customName : '',
          paymentReference: advForm.reference, notes: advForm.notes }),
      })
      if (res.ok) {
        toast.success(`Advance of ${fmtKES(amt)} recorded for ${sel?.name}`)
        setAdvDialog(false); setAdvForm(EMPTY_ADVANCE); load()
        setActiveTab('advances')
      } else toast.error((await res.json()).error || 'Failed to record advance')
    } catch { toast.error('Failed to record advance') }
    finally { setAdvSaving(false) }
  }

  // ── Link dialog ────────────────────────────────────────────────────────
  function openLinkDialog(r: Receipt, e: React.MouseEvent) {
    e.stopPropagation(); setLinkReceipt(r); setLinkSupId(''); setLinkDialog(true)
  }
  async function handleLinkSupplier() {
    if (!linkReceipt || !linkSupId) { toast.error('Select a supplier'); return }
    setLinkSaving(true)
    try {
      const res = await fetch(`/api/stock-receipts/${linkReceipt._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId: linkSupId }),
      })
      if (res.ok) {
        toast.success(`Linked to ${suppliers.find(s => s._id === linkSupId)?.name}`)
        setLinkDialog(false); load()
      } else toast.error((await res.json()).error || 'Failed to link supplier')
    } catch { toast.error('Failed to link supplier') }
    finally { setLinkSaving(false) }
  }

  // ── Payment method selector ────────────────────────────────────────────
  function PayMethodSelect({ value, onChange, bankId, onBankChange }: {
    value: string; onChange: (v: string) => void; bankId: string; onBankChange: (v: string) => void
  }) {
    return (
      <>
        <div>
          <Label className="text-xs text-muted-foreground">Payment Method</Label>
          <select value={value} onChange={e => { onChange(e.target.value); onBankChange('') }}
            className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background">
            <optgroup label="Standard">
              <option value="cash">Cash</option>
              <option value="mobile_money">M-Pesa / Mobile Money</option>
              <option value="card">Card</option>
              {banks.length > 0 && <option value="bank">Bank Transfer</option>}
            </optgroup>
            {custom.length > 0 && (
              <optgroup label="Custom">
                {custom.map(m => <option key={m._id} value={`custom:${m._id}`}>{m.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        {value === 'bank' && (
          <div>
            <Label className="text-xs text-muted-foreground">Bank</Label>
            <select value={bankId} onChange={e => onBankChange(e.target.value)}
              className="w-full h-9 px-3 border rounded-md text-sm mt-1 bg-background">
              <option value="">Select bank…</option>
              {banks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </>
    )
  }

  // ── Tab definitions ────────────────────────────────────────────────────
  const tabs = [
    { key: 'suppliers' as const, label: 'Suppliers', count: suppliers.filter(s => s.isActive).length, amount: null },
    { key: 'payables'  as const, label: 'Payables',  count: unpaidReceipts.length,  amount: globalOwed     },
    { key: 'advances'  as const, label: 'Advances',  count: prepaidReceipts.length, amount: globalAdvances },
  ]

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage suppliers and purchasing history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAdvForm(EMPTY_ADVANCE); setAdvDialog(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-semibold"
          >
            <ArrowDownToLine size={14} /> Record Advance
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
          >
            <Plus size={15} /> Add Supplier
          </button>
        </div>
      </div>

      {/* ── Summary pills ── */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 min-w-[130px]">
            <p className="text-xs text-blue-600 font-medium">Total Spent</p>
            <p className="text-lg font-bold text-blue-900">{fmtKES(globalSpent)}</p>
          </div>
          {globalOwed > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 min-w-[130px]">
              <p className="text-xs text-amber-600 font-medium">Owed to Suppliers</p>
              <p className="text-lg font-bold text-amber-900">{fmtKES(globalOwed)}</p>
            </div>
          )}
          {globalAdvances > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 min-w-[130px]">
              <p className="text-xs text-purple-600 font-medium">Advances Out</p>
              <p className="text-lg font-bold text-purple-900">{fmtKES(globalAdvances)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {/* Badge: amber for payables, purple for advances, gray for suppliers */}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                tab.key === 'payables'  ? 'bg-amber-100 text-amber-700' :
                tab.key === 'advances'  ? 'bg-purple-100 text-purple-700' :
                                          'bg-gray-100 text-gray-600'
              }`}>
                {tab.amount && tab.amount > 0 ? fmtKES(tab.amount) : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Suppliers
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'suppliers' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input className="pl-9" placeholder="Search by name, contact, or phone…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <LoadingOrOffline isLoading={loading} isOffline={isOffline} onRetry={load}
            loadingText="Loading suppliers…"
            offlineMessage="Unable to load suppliers. Check your connection.">
            {sorted.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                {search ? 'No suppliers match your search.' : 'No suppliers yet. Add your first one.'}
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.map(supplier => {
                  const bal         = balanceMap.get(supplier._id)
                  const hasOwed     = (bal?.totalOwed ?? 0) > 0
                  const hasAdvances = (bal?.totalAdvances ?? 0) > 0
                  const isClear     = !hasOwed && !hasAdvances
                  return (
                    <div key={supplier._id}
                      onClick={() => router.push(`/dashboard/suppliers/${supplier._id}`)}
                      className={`bg-white rounded-lg border cursor-pointer hover:shadow-sm transition-all ${
                        hasOwed ? 'border-amber-200' : hasAdvances ? 'border-purple-200' : 'border-gray-200'
                      }`}>
                      <div className="flex items-center gap-4 px-4 py-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          hasOwed ? 'bg-amber-100' : hasAdvances ? 'bg-purple-100' : 'bg-gray-100'
                        }`}>
                          <Truck size={16} className={
                            hasOwed ? 'text-amber-600' : hasAdvances ? 'text-purple-600' : 'text-gray-500'
                          } />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{supplier.name}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {supplier.contactPerson && (
                              <span className="text-xs text-gray-500">{supplier.contactPerson}</span>
                            )}
                            {supplier.phone && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Phone size={10} />{supplier.phone}
                              </span>
                            )}
                            {!supplier.contactPerson && !supplier.phone && (
                              <span className="text-xs text-gray-400 italic">No contact info</span>
                            )}
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 min-w-[110px]">
                          {bal?.lastPurchaseDate
                            ? <span className="text-xs text-gray-500">Last: {fmtDate(bal.lastPurchaseDate)}</span>
                            : <span className="text-xs text-gray-400 italic">No purchases</span>
                          }
                          {bal && bal.receiptCount > 0 && (
                            <span className="text-xs text-gray-400">{bal.receiptCount} receipt{bal.receiptCount !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0 items-end min-w-[100px]">
                          {isClear ? (
                            <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">Clear</span>
                          ) : (
                            <>
                              {hasOwed && (
                                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 whitespace-nowrap">
                                  Owes {fmtKES(bal!.totalOwed)}
                                </span>
                              )}
                              {hasAdvances && (
                                <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5 whitespace-nowrap">
                                  Adv {fmtKES(bal!.totalAdvances)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={e => openEdit(supplier, e)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <ChevronRight size={16} className="text-gray-300" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </LoadingOrOffline>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Payables
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payables' && (
        <div className="space-y-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : unpaidReceipts.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 bg-white rounded-lg border">
              <CreditCard size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No outstanding payables</p>
              <p className="text-xs mt-1">Amounts owed to suppliers will appear here when you receive stock on credit.</p>
            </div>
          ) : (
            unpaidReceipts.map(r => {
              const totalUnits = r.items.reduce((s, i) => s + i.quantity, 0)
              return (
                <div key={r._id}
                  className="flex items-center justify-between gap-3 bg-white border border-amber-100 rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900">{r.receiptNumber}</p>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={10} />{fmtDate(r.date)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.supplierName} · {r.items.length} item{r.items.length !== 1 ? 's' : ''} · {totalUnits} units
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-sm text-gray-900">{fmtKES(r.totalCost)}</span>
                    <button onClick={e => openPayDialog(r, e)}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-green-600 hover:bg-green-700 text-white">
                      Pay
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: Advances
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'advances' && (
        <div className="space-y-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : prepaidReceipts.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 bg-white rounded-lg border">
              <PackageSearch size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No outstanding advances</p>
              <p className="text-xs mt-1">Advance payments made to suppliers awaiting delivery will appear here.</p>
            </div>
          ) : (
            prepaidReceipts.map(r => (
              <div key={r._id}
                className="flex items-center justify-between gap-3 bg-purple-50/40 border border-purple-100 rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-gray-900">{r.receiptNumber}</p>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={10} />{fmtDate(r.paidAt || r.date)}
                    </span>
                    {!r.supplierId && (
                      <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                        Unlinked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.supplierName} · {resolveMethod(r)}{r.notes ? ` · ${r.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm text-purple-700">{fmtKES(r.totalCost)}</span>
                  {!r.supplierId && (
                    <button onClick={e => openLinkDialog(r, e)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700">
                      <Link2 size={11} /> Link
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Dialogs
      ════════════════════════════════════════════════════════════════════ */}

      {/* Add / Edit Supplier */}
      <Dialog open={supDialog} onOpenChange={open => { if (!open) setSupDialog(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSup ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
            <DialogDescription>{editingSup ? 'Update supplier information' : 'Enter supplier details'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Supplier Name *</Label>
              <Input value={supForm.name} onChange={e => setSupForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ABC Distributors" className="mt-1" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Contact Person</Label>
                <Input value={supForm.contactPerson} onChange={e => setSupForm(f => ({ ...f, contactPerson: e.target.value }))}
                  placeholder="John Kamau" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={supForm.phone} onChange={e => setSupForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0722 xxx xxx" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={supForm.email} onChange={e => setSupForm(f => ({ ...f, email: e.target.value }))}
                placeholder="supplier@example.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input value={supForm.address} onChange={e => setSupForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Nairobi, Kenya" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea value={supForm.notes} onChange={e => setSupForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes…" className="mt-1 resize-none" rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSupDialog(false)} disabled={supSaving}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveSupplier} disabled={supSaving}>
                {supSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : editingSup ? 'Save Changes' : 'Add Supplier'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settle Payable */}
      <Dialog open={payDialog} onOpenChange={open => { if (!open) setPayDialog(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard size={16} /> Settle Payable</DialogTitle>
            <DialogDescription>Record a payment for this stock receipt</DialogDescription>
          </DialogHeader>
          {payReceipt && (
            <div className="space-y-4 mt-1">
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt</span>
                  <span className="font-medium">{payReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier</span>
                  <span className="font-medium">{payReceipt.supplierName}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t">
                  <span className="font-medium">Amount Owed</span>
                  <span className="font-bold text-base">{fmtKES(payReceipt.totalCost)}</span>
                </div>
              </div>
              <PayMethodSelect value={payMethod} onChange={setPayMethod} bankId={payBankId} onBankChange={setPayBankId} />
              <div>
                <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
                <Input value={payRef} onChange={e => setPayRef(e.target.value)}
                  placeholder="M-Pesa code, receipt no." className="mt-1" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setPayDialog(false)} disabled={paying}>Cancel</Button>
                <Button className="flex-1" onClick={handlePay} disabled={paying}>
                  {paying ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Paying…</> : `Pay ${fmtKES(payReceipt.totalCost)}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Advance */}
      <Dialog open={advDialog} onOpenChange={open => { if (!open) { setAdvDialog(false); setAdvForm(EMPTY_ADVANCE) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowDownToLine size={16} /> Record Advance Payment</DialogTitle>
            <DialogDescription>Pay a supplier now for goods arriving later</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div>
              <Label className="text-xs text-muted-foreground">Supplier *</Label>
              <div className="flex gap-2 mt-1">
                <Popover open={advSupOpen} onOpenChange={setAdvSupOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal" type="button">
                      {advForm.supplierId
                        ? suppliers.find(s => s._id === advForm.supplierId)?.name || 'Select supplier…'
                        : 'Select supplier…'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search suppliers…" />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          {suppliers.filter(s => s.isActive).map(s => (
                            <CommandItem key={s._id} value={s.name}
                              onSelect={() => { setAdvForm(f => ({ ...f, supplierId: s._id })); setAdvSupOpen(false) }}>
                              <Check className={cn('mr-2 h-4 w-4', advForm.supplierId === s._id ? 'opacity-100' : 'opacity-0')} />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={() => setAdvQuickAdd(true)}>
                  <Plus size={15} />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Amount Paid (KES)</Label>
              <Input type="number" min="0" value={advForm.amount}
                onChange={e => setAdvForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
            <PayMethodSelect
              value={advForm.paymentMethod}
              onChange={v => setAdvForm(f => ({ ...f, paymentMethod: v, bankId: '' }))}
              bankId={advForm.bankId}
              onBankChange={v => setAdvForm(f => ({ ...f, bankId: v }))}
            />
            <div>
              <Label className="text-xs text-muted-foreground">Reference (optional)</Label>
              <Input value={advForm.reference} onChange={e => setAdvForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="M-Pesa code, receipt no." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
              <Input value={advForm.notes} onChange={e => setAdvForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. 50 tyres expected next week" className="mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setAdvDialog(false); setAdvForm(EMPTY_ADVANCE) }} disabled={advSaving}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleRecordAdvance} disabled={advSaving}>
                {advSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Record Advance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddSupplierDialog open={advQuickAdd} onOpenChange={setAdvQuickAdd}
        onSuccess={s => {
          setSuppliers(prev => [...prev, { ...s, isActive: true, createdAt: new Date().toISOString() } as any])
          setAdvForm(f => ({ ...f, supplierId: s._id }))
        }}
      />

      {/* Link Supplier to Orphaned Receipt */}
      <Dialog open={linkDialog} onOpenChange={open => { if (!open) setLinkDialog(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 size={16} /> Link Supplier</DialogTitle>
            <DialogDescription>
              {linkReceipt && <>Attach <strong>{linkReceipt.receiptNumber}</strong> ({fmtKES(linkReceipt.totalCost)}) to a supplier record.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div>
              <Label className="text-xs text-muted-foreground">Supplier</Label>
              <div className="flex gap-2 mt-1">
                <Popover open={linkSupOpen} onOpenChange={setLinkSupOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal" type="button">
                      {linkSupId ? suppliers.find(s => s._id === linkSupId)?.name || 'Select supplier…' : 'Select supplier…'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search suppliers…" />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          {suppliers.filter(s => s.isActive).map(s => (
                            <CommandItem key={s._id} value={s.name}
                              onSelect={() => { setLinkSupId(s._id); setLinkSupOpen(false) }}>
                              <Check className={cn('mr-2 h-4 w-4', linkSupId === s._id ? 'opacity-100' : 'opacity-0')} />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="icon" onClick={() => setLinkQuickAdd(true)}>
                  <Plus size={15} />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setLinkDialog(false)} disabled={linkSaving}>Cancel</Button>
              <Button className="flex-1" onClick={handleLinkSupplier} disabled={linkSaving || !linkSupId}>
                {linkSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Linking…</> : 'Link Supplier'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddSupplierDialog open={linkQuickAdd} onOpenChange={setLinkQuickAdd}
        onSuccess={s => {
          setSuppliers(prev => [...prev, { ...s, isActive: true, createdAt: new Date().toISOString() } as any])
          setLinkSupId(s._id)
        }}
      />

    </div>
  )
}
