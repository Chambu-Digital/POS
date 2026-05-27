'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Search, Plus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

interface Drug {
  _id: string
  genericName: string
  brandName?: string
  category: string
  dosageForm?: string
  strength?: string
  unit?: string
  manufacturer?: string
  barcode?: string
  sellingPrice: number
  buyingPrice: number
  stock: number
  reorderLevel?: number
  requiresPrescription?: boolean
  isControlled?: boolean
}

interface Batch {
  _id: string
  drugId: string | { _id: string; genericName: string; unit?: string; category: string; barcode?: string }
  batchNumber: string
  expiryDate: string
  manufactureDate?: string
  quantity: number
  initialQuantity: number
  buyingPrice: number
  sellingPrice?: number
  supplier: string
  receivedDate: string
  status: 'active' | 'expired' | 'recalled' | 'depleted'
  notes?: string
}

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export default function PharmacyInventoryPage() {
  return (
    <PermissionGuard requiredPermission="pharmacy.inventory">
      <InventoryContent />
    </PermissionGuard>
  )
}

function InventoryContent() {
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'stock' | 'expiring' | 'low' | 'expired'>('stock')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Receive stock modal
  const [showReceive, setShowReceive] = useState(false)
  const [receiveDrugId, setReceiveDrugId] = useState('')
  const [receiveForm, setReceiveForm] = useState({
    batchNumber: '', expiryDate: '', manufactureDate: '',
    quantity: '', buyingPrice: '', sellingPrice: '', supplier: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [drugsRes, batchesRes] = await Promise.all([
        fetch('/api/pharmacy/drugs'),
        fetch('/api/pharmacy/batches'),
      ])
      if (drugsRes.ok) { const d = await drugsRes.json(); setDrugs(d.drugs || []) }
      if (batchesRes.ok) { const d = await batchesRes.json(); setBatches(d.batches || []) }
    } catch { toast.error('Failed to load inventory') }
    setLoading(false)
  }

  async function receiveStock() {
    if (!receiveDrugId) { toast.error('Select a drug'); return }
    const { batchNumber, expiryDate, quantity, buyingPrice } = receiveForm
    if (!batchNumber || !expiryDate || !quantity || !buyingPrice) {
      toast.error('Fill all required fields'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/pharmacy/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drugId: receiveDrugId, ...receiveForm,
          quantity: parseInt(receiveForm.quantity),
          buyingPrice: parseFloat(receiveForm.buyingPrice),
          sellingPrice: receiveForm.sellingPrice ? parseFloat(receiveForm.sellingPrice) : undefined,
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success('Stock received')
      setShowReceive(false)
      setReceiveForm({ batchNumber: '', expiryDate: '', manufactureDate: '', quantity: '', buyingPrice: '', sellingPrice: '', supplier: '', notes: '' })
      setReceiveDrugId('')
      load()
    } catch (err: any) { toast.error(err.message || 'Failed') }
    setSaving(false)
  }

  async function recallBatch(batchId: string) {
    if (!confirm('Mark this batch as recalled?')) return
    await fetch(`/api/pharmacy/batches/${batchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'recalled' }),
    })
    toast.success('Batch recalled')
    load()
  }

  // Derived stats
  const expiringBatches = batches.filter(b => b.status === 'active' && daysUntil(b.expiryDate) <= 90)
  const expiredBatches  = batches.filter(b => b.status === 'expired')
  const lowDrugs        = drugs.filter(d => d.stock > 0 && d.stock <= (d.reorderLevel || 10))
  const outDrugs        = drugs.filter(d => d.stock <= 0)
  const stockValue      = batches.filter(b => b.status === 'active').reduce((s, b) => s + b.quantity * b.buyingPrice, 0)

  const displayDrugs = drugs.filter(d =>
    !search ||
    d.genericName.toLowerCase().includes(search.toLowerCase()) ||
    d.brandName?.toLowerCase().includes(search.toLowerCase()) ||
    d.barcode?.includes(search)
  )

  const batchesByDrug = (drugId: string) =>
    batches.filter(b => {
      const id = typeof b.drugId === 'object' ? b.drugId._id : b.drugId
      return id === drugId
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Drug Inventory</h1>
          <p className="text-sm text-gray-500">
            Stock value: <span className="font-semibold text-green-700">KES {stockValue.toLocaleString()}</span>
          </p>
        </div>
        <button
          onClick={() => setShowReceive(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Plus size={15} /> Receive Stock
        </button>
      </div>

      {/* Alert summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Expiring (90d)', count: expiringBatches.length, color: 'bg-amber-50 border-amber-200 text-amber-700', tab: 'expiring' },
          { label: 'Expired Batches', count: expiredBatches.length, color: 'bg-red-50 border-red-200 text-red-700', tab: 'expired' },
          { label: 'Low Stock', count: lowDrugs.length, color: 'bg-orange-50 border-orange-200 text-orange-700', tab: 'low' },
          { label: 'Out of Stock', count: outDrugs.length, color: 'bg-red-50 border-red-200 text-red-700', tab: 'low' },
        ].map(card => (
          <button
            key={card.label}
            onClick={() => setTab(card.tab as any)}
            className={`border rounded-xl p-3 text-left hover:shadow-sm transition-shadow ${card.color}`}
          >
            <p className="text-2xl font-bold">{card.count}</p>
            <p className="text-xs font-medium mt-0.5">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {(['stock', 'expiring', 'low', 'expired'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'stock' ? 'All Stock'
              : t === 'expiring' ? `Expiring (${expiringBatches.length})`
              : t === 'low' ? `Low/Out (${lowDrugs.length + outDrugs.length})`
              : `Expired (${expiredBatches.length})`}
          </button>
        ))}
      </div>

      {/* Search — stock tab only */}
      {tab === 'stock' && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder="Search generic name, brand, barcode..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : tab === 'stock' ? (
        displayDrugs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm">No drugs in the catalog yet.</p>
            <p className="text-xs mt-1">Go to Drug List to add drugs, then receive stock here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Drug</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Form / Strength</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Next Expiry</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Value</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayDrugs.map(drug => {
                  const drugBatches = batchesByDrug(drug._id)
                  const activeBatches = drugBatches.filter(b => b.status === 'active')
                  const nextExpiry = activeBatches[0]?.expiryDate
                  const daysLeft = nextExpiry ? daysUntil(nextExpiry) : null
                  const isExpiring = daysLeft !== null && daysLeft <= 90
                  const isLow = drug.stock > 0 && drug.stock <= (drug.reorderLevel || 10)
                  const isOut = drug.stock <= 0
                  const value = activeBatches.reduce((s, b) => s + b.quantity * b.buyingPrice, 0)

                  return (
                    <>
                      <tr key={drug._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {drug.genericName}
                            {drug.requiresPrescription && <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Rx</span>}
                            {drug.isControlled && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">CD</span>}
                          </p>
                          {drug.brandName && <p className="text-xs text-gray-400">{drug.brandName}</p>}
                          {drug.unit && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{drug.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                          {[drug.dosageForm, drug.strength].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                            {drug.stock}
                          </span>
                          {(isLow || isOut) && <AlertTriangle size={12} className={`inline ml-1 ${isOut ? 'text-red-500' : 'text-amber-500'}`} />}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {nextExpiry ? (
                            <span className={`text-xs ${isExpiring ? 'text-amber-600 font-semibold' : 'text-gray-500'}`}>
                              {fmtDate(nextExpiry)}{isExpiring && ` (${daysLeft}d)`}
                            </span>
                          ) : <span className="text-gray-300 text-xs">No batches</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">KES {value.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setExpanded(expanded === drug._id ? null : drug._id)} className="text-gray-400 hover:text-gray-700">
                            {expanded === drug._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded batch rows */}
                      {expanded === drug._id && (
                        <tr key={`${drug._id}-expand`}>
                          <td colSpan={6} className="bg-gray-50 px-4 pb-3">
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batches — FEFO order</p>
                                <button
                                  onClick={() => { setReceiveDrugId(drug._id); setReceiveForm(f => ({ ...f, buyingPrice: String(drug.buyingPrice), sellingPrice: String(drug.sellingPrice) })); setShowReceive(true) }}
                                  className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                                >
                                  <Plus size={12} /> Add batch
                                </button>
                              </div>
                              {drugBatches.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">No batches. Click "Add batch" to receive stock.</p>
                              ) : drugBatches.map(b => {
                                const days = daysUntil(b.expiryDate)
                                const badgeColor = b.status === 'expired' ? 'bg-red-100 text-red-700'
                                  : b.status === 'recalled' ? 'bg-purple-100 text-purple-700'
                                  : b.status === 'depleted' ? 'bg-gray-100 text-gray-500'
                                  : days <= 30 ? 'bg-red-50 text-red-600'
                                  : days <= 90 ? 'bg-amber-50 text-amber-600'
                                  : 'bg-green-50 text-green-700'
                                return (
                                  <div key={b._id} className="flex items-center justify-between text-xs py-2 px-3 bg-white rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono font-semibold text-gray-800">{b.batchNumber}</span>
                                      {b.supplier && <span className="text-gray-400">{b.supplier}</span>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-gray-900">{b.quantity} units</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}>
                                        {b.status === 'active'
                                          ? `Exp: ${fmtDate(b.expiryDate)} (${days}d)`
                                          : b.status.toUpperCase()}
                                      </span>
                                      <span className="text-gray-400">KES {b.buyingPrice}/unit</span>
                                      {b.status === 'active' && (
                                        <button onClick={() => recallBatch(b._id)} className="text-gray-300 hover:text-red-500">Recall</button>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : tab === 'expiring' ? (
        <div className="space-y-2">
          {expiringBatches.length === 0
            ? <p className="text-center py-16 text-gray-400 text-sm">No batches expiring within 90 days</p>
            : expiringBatches.map(b => {
                const drug = typeof b.drugId === 'object' ? b.drugId : null
                const days = daysUntil(b.expiryDate)
                return (
                  <div key={b._id} className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 ${days <= 30 ? 'border-red-200' : 'border-amber-200'}`}>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{drug ? drug.genericName : 'Unknown'}</p>
                      <p className="text-xs text-gray-400">Batch: <span className="font-mono">{b.batchNumber}</span>{b.supplier && ` · ${b.supplier}`}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${days <= 30 ? 'text-red-600' : 'text-amber-600'}`}>{days} days left</p>
                      <p className="text-xs text-gray-400">{fmtDate(b.expiryDate)} · {b.quantity} units</p>
                    </div>
                  </div>
                )
              })
          }
        </div>
      ) : tab === 'low' ? (
        <div className="space-y-2">
          {[...outDrugs, ...lowDrugs].length === 0
            ? <p className="text-center py-16 text-gray-400 text-sm">All stock levels are healthy</p>
            : [...outDrugs, ...lowDrugs].map(d => (
                <div key={d._id} className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 ${d.stock <= 0 ? 'border-red-200' : 'border-orange-200'}`}>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{d.genericName}</p>
                    <p className="text-xs text-gray-400">{d.category}{d.unit && ` · ${d.unit}`}{d.strength && ` · ${d.strength}`}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${d.stock <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {d.stock <= 0 ? 'Out of stock' : `${d.stock} left`}
                    </p>
                    <p className="text-xs text-gray-400">Reorder at {d.reorderLevel || 10}</p>
                  </div>
                </div>
              ))
          }
        </div>
      ) : (
        <div className="space-y-2">
          {expiredBatches.length === 0
            ? <p className="text-center py-16 text-gray-400 text-sm">No expired batches</p>
            : expiredBatches.map(b => {
                const drug = typeof b.drugId === 'object' ? b.drugId : null
                return (
                  <div key={b._id} className="flex items-center justify-between bg-white border border-red-100 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{drug ? drug.genericName : 'Unknown'}</p>
                      <p className="text-xs text-gray-400">Batch: <span className="font-mono">{b.batchNumber}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">EXPIRED {fmtDate(b.expiryDate)}</p>
                      <p className="text-xs text-gray-400">{b.quantity} units remaining</p>
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* Receive Stock Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-md">
          <DialogTitle>Receive Stock</DialogTitle>
          <DialogDescription className="sr-only">Add a new drug batch to inventory</DialogDescription>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Drug *</label>
              <select
                value={receiveDrugId}
                onChange={e => {
                  setReceiveDrugId(e.target.value)
                  const drug = drugs.find(d => d._id === e.target.value)
                  if (drug) setReceiveForm(f => ({ ...f, buyingPrice: String(drug.buyingPrice), sellingPrice: String(drug.sellingPrice) }))
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select drug...</option>
                {drugs.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.genericName}{d.brandName ? ` (${d.brandName})` : ''}{d.strength ? ` ${d.strength}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Batch Number *</label>
                <Input placeholder="e.g. BTH-001" value={receiveForm.batchNumber} onChange={e => setReceiveForm(f => ({ ...f, batchNumber: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Quantity *</label>
                <Input type="number" placeholder="0" value={receiveForm.quantity} onChange={e => setReceiveForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Expiry Date *</label>
                <Input type="date" value={receiveForm.expiryDate} onChange={e => setReceiveForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Manufacture Date</label>
                <Input type="date" value={receiveForm.manufactureDate} onChange={e => setReceiveForm(f => ({ ...f, manufactureDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Buying Price (KES) *</label>
                <Input type="number" step="0.01" value={receiveForm.buyingPrice} onChange={e => setReceiveForm(f => ({ ...f, buyingPrice: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Selling Price Override</label>
                <Input type="number" step="0.01" placeholder="Use drug default" value={receiveForm.sellingPrice} onChange={e => setReceiveForm(f => ({ ...f, sellingPrice: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Supplier</label>
              <Input placeholder="Supplier / distributor name" value={receiveForm.supplier} onChange={e => setReceiveForm(f => ({ ...f, supplier: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
              <Input placeholder="Optional" value={receiveForm.notes} onChange={e => setReceiveForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={receiveStock} disabled={saving} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                {saving ? 'Saving...' : 'Receive Stock'}
              </button>
              <button onClick={() => setShowReceive(false)} className="px-4 py-2.5 border border-gray-200 text-sm rounded-xl text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
