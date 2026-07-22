'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Plus, AlertTriangle, ChevronDown, ChevronUp, Upload, Download, FolderTree, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { DrugForm } from '@/components/pharmacy/drug-form'

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
  internalBatchId: string
  manufacturerLot?: string
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
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)
  const [historyBatchId, setHistoryBatchId] = useState<string | null>(null)
  const [isRecallOpen, setIsRecallOpen] = useState(false)

  // Receive stock modal
  const [showReceive, setShowReceive] = useState(false)
  const [receiveDrugId, setReceiveDrugId] = useState('')
  const [receiveForm, setReceiveForm] = useState({
    manufacturerLot: '', invoiceNumber: '', poReference: '', expiryDate: '', manufactureDate: '',
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
    const { expiryDate, quantity, buyingPrice } = receiveForm
    if (!expiryDate || !quantity || !buyingPrice) {
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
      setReceiveForm({ manufacturerLot: '', invoiceNumber: '', poReference: '', expiryDate: '', manufactureDate: '', quantity: '', buyingPrice: '', sellingPrice: '', supplier: '', notes: '' })
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

  async function handleDeleteDrug(drugId: string) {
    if (!confirm('Delete this drug and all its batches? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/pharmacy/drugs/${drugId}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success('Drug deleted')
      setIsViewOpen(false)
      setSelectedDrug(null)
      load()
    } catch (err: any) { toast.error(err.message || 'Failed to delete drug') }
  }

  // Derived stats
  const expiringBatches = batches.filter(b => b.status === 'active' && daysUntil(b.expiryDate) <= 90)
  const expiredBatches  = batches.filter(b => b.status === 'expired')
  const lowDrugs        = drugs.filter(d => d.stock > 0 && d.stock <= (d.reorderLevel || 10))
  const outDrugs        = drugs.filter(d => d.stock <= 0)
  const stockValue      = batches.filter(b => b.status === 'active').reduce((s, b) => s + b.quantity * b.buyingPrice, 0)
  const totalStock      = drugs.reduce((sum, d) => sum + d.stock, 0)
  const estimatedProfit = drugs.reduce((sum, d) => sum + (d.stock * (d.sellingPrice - d.buyingPrice)), 0)

  function handleDownloadTemplate() {
    const headers = ['genericName', 'brandName', 'category', 'dosageForm', 'strength', 'unit', 'buyingPrice', 'sellingPrice', 'wholesalePrice', 'reorderLevel', 'requiresPrescription', 'isControlled', 'barcode', 'manufacturer', 'description', 'sideEffects']
    const csv = headers.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pharmacy_drugs_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Drug Inventory</h1>
          <p className="text-muted-foreground mt-2">Manage your pharmacy catalog and stock</p>
        </div>
        <button
          onClick={() => setShowReceive(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Plus size={15} /> Receive Stock
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items in Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drugs.length}</div>
            <p className="text-sm text-muted-foreground">Estimated Profit</p>
            <p className="text-lg font-semibold text-primary mt-2">
              KES {estimatedProfit.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Stock Value (Active Batches)</p>
            <p className="text-lg font-semibold text-primary mt-2">
              KES {stockValue.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button onClick={() => setIsCreateOpen(true)} size="sm" className="w-full">
              <Plus size={16} className="mr-2" />
              Create Drug
            </Button>
            <Button onClick={() => setIsImportOpen(true)} variant="outline" size="sm" className="w-full">
              <Upload size={16} className="mr-2" />
              Import
            </Button>
            <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="w-full">
              <Download size={16} className="mr-2" />
              Template
            </Button>
            <Button onClick={() => setIsCategoryManagerOpen(true)} variant="outline" size="sm" className="w-full">
              <FolderTree size={16} className="mr-2" />
              Categories
            </Button>
            <Button onClick={() => setIsRecallOpen(true)} variant="outline" size="sm" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 col-span-2 mt-2">
              <AlertTriangle size={16} className="mr-2" />
              Global Recall
            </Button>
          </CardContent>
        </Card>
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
                          <div className="flex items-center gap-2">
                            <button onClick={() => setExpanded(expanded === drug._id ? null : drug._id)} className="text-gray-400 hover:text-gray-700">
                              {expanded === drug._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDrug(drug)
                                  setIsViewOpen(true)
                                }}
                              >
                                <Search size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDrug(drug)
                                  setIsEditOpen(true)
                                }}
                              >
                                <Edit2 size={14} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteDrug(drug._id)
                                }}
                              >
                                <Trash2 size={14} className="text-red-500" />
                              </Button>
                            </div>
                          </div>
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
                                      <span className="font-mono font-semibold text-gray-800">Lot: {b.manufacturerLot || 'N/A'}</span>
                                      <span className="text-[10px] text-gray-400">ID: {b.internalBatchId}</span>
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
                                      <button onClick={() => setHistoryBatchId(b._id)} className="text-gray-400 hover:text-blue-500 font-semibold px-2">History</button>
                                      {b.status === 'active' && (
                                        <button onClick={() => recallBatch(b._id)} className="text-gray-300 hover:text-red-500 font-semibold px-2">Recall</button>
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
                      <p className="text-xs text-gray-400">Lot: <span className="font-mono">{b.manufacturerLot || 'N/A'}</span></p>
                      <p className="text-[10px] text-gray-300">ID: {b.internalBatchId}</p>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Manufacturer Lot</label>
                <Input placeholder="Optional" value={receiveForm.manufacturerLot} onChange={e => setReceiveForm(f => ({ ...f, manufacturerLot: e.target.value }))} />
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Invoice Number</label>
                <Input placeholder="Optional" value={receiveForm.invoiceNumber} onChange={e => setReceiveForm(f => ({ ...f, invoiceNumber: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">PO Reference</label>
                <Input placeholder="Optional" value={receiveForm.poReference} onChange={e => setReceiveForm(f => ({ ...f, poReference: e.target.value }))} />
              </div>
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

      {/* Create/Edit Drug Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setIsEditOpen(false)
          setSelectedDrug(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>
            {selectedDrug ? 'Edit Drug' : 'Create Drug'}
          </DialogTitle>
          <DialogDescription>
            {selectedDrug ? 'Update drug information' : 'Add a new drug to your catalog'}
          </DialogDescription>
          <DrugForm
            drug={selectedDrug}
            onSuccess={(savedDrug) => {
              setIsCreateOpen(false)
              setIsEditOpen(false)
              setSelectedDrug(null)
              load()
              
              // Handoff to Receive Stock if a new drug was created
              if (savedDrug && !selectedDrug) {
                setReceiveDrugId(savedDrug._id)
                setReceiveForm(f => ({
                  ...f,
                  buyingPrice: String(savedDrug.buyingPrice || ''),
                  sellingPrice: String(savedDrug.sellingPrice || '')
                }))
                setShowReceive(true)
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Drug Dialog */}
      <Dialog open={isViewOpen} onOpenChange={(open) => {
        if (!open) {
          setIsViewOpen(false)
          setSelectedDrug(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Drug Details</DialogTitle>
          <DialogDescription>View and manage drug information</DialogDescription>
          {selectedDrug && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Generic Name</label>
                  <p className="text-lg font-semibold">{selectedDrug.genericName}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Brand Name</label>
                  <p className="text-lg font-semibold">{selectedDrug.brandName || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Category</label>
                  <p className="text-lg font-semibold">{selectedDrug.category}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Drug Class</label>
                  <p className="text-lg font-semibold">{(selectedDrug as any).drugClass || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dosage Form</label>
                  <p className="text-lg font-semibold">{selectedDrug.dosageForm || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Strength</label>
                  <p className="text-lg font-semibold">{selectedDrug.strength || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Unit</label>
                  <p className="text-lg font-semibold">{selectedDrug.unit || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Stock</label>
                  <p className="text-lg font-semibold text-green-600">{selectedDrug.stock}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reorder Level</label>
                  <p className="text-lg font-semibold">{selectedDrug.reorderLevel || 10}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Barcode</label>
                  <p className="text-lg font-semibold">{selectedDrug.barcode || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Buying Price</label>
                  <p className="text-lg font-semibold">KES {selectedDrug.buyingPrice.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Selling Price</label>
                  <p className="text-lg font-semibold">KES {selectedDrug.sellingPrice.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Wholesale Price</label>
                  <p className="text-lg font-semibold">KES {((selectedDrug as any).wholesalePrice || 0).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">SKU</label>
                  <p className="text-lg font-semibold">{(selectedDrug as any).sku || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Manufacturer</label>
                  <p className="text-lg font-semibold">{selectedDrug.manufacturer || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <p className="text-lg font-semibold">{(selectedDrug as any).status || 'active'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Requires Prescription</label>
                  <p className="text-lg font-semibold">{selectedDrug.requiresPrescription ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Controlled Drug</label>
                  <p className="text-lg font-semibold">{selectedDrug.isControlled ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {selectedDrug.description && (
                <div>
                  <label className="text-xs text-muted-foreground">Description</label>
                  <p className="text-sm mt-1">{selectedDrug.description}</p>
                </div>
              )}

              {(selectedDrug as any).sideEffects && (
                <div>
                  <label className="text-xs text-muted-foreground">Side Effects</label>
                  <p className="text-sm mt-1">{(selectedDrug as any).sideEffects}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setIsViewOpen(false)
                    setIsEditOpen(true)
                  }}
                  className="flex-1"
                >
                  <Edit2 size={16} className="mr-2" />
                  Edit Drug
                </Button>
                <Button
                  onClick={() => {
                    setIsViewOpen(false)
                    handleDeleteDrug(selectedDrug._id)
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Drug
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Modal Placeholder */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
          <DialogTitle>Import Drugs</DialogTitle>
          <DialogDescription>Import drugs from CSV file</DialogDescription>
          <div className="py-8 text-center text-muted-foreground">
            <Upload size={48} className="mx-auto mb-4 opacity-50" />
            <p>Import functionality coming soon</p>
            <p className="text-sm mt-2">Download the template first to prepare your data</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Manager Placeholder */}
      <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
        <DialogContent>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>Manage drug categories</DialogDescription>
          <div className="py-8 text-center text-muted-foreground">
            <FolderTree size={48} className="mx-auto mb-4 opacity-50" />
            <p>Category manager coming soon</p>
          </div>
        </DialogContent>
      </Dialog>
      {/* Global Recall Dialog */}
      <GlobalRecallDialog open={isRecallOpen} onOpenChange={setIsRecallOpen} onRecallSuccess={load} />

      {/* Batch History Dialog */}
      {historyBatchId && (
        <BatchHistoryDialog batchId={historyBatchId} open={!!historyBatchId} onOpenChange={(o) => !o && setHistoryBatchId(null)} />
      )}
    </div>
  )
}

function GlobalRecallDialog({ open, onOpenChange, onRecallSuccess }: { open: boolean, onOpenChange: (o: boolean) => void, onRecallSuccess: () => void }) {
  const [lotNumber, setLotNumber] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRecall() {
    if (!lotNumber) return toast.error('Enter a manufacturer lot number')
    if (!confirm(`Are you sure you want to recall all active batches with lot number: ${lotNumber}?`)) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/pharmacy/batches/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturerLot: lotNumber })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to recall')
      
      toast.success(data.message || 'Recall successful')
      onOpenChange(false)
      onRecallSuccess()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-red-600 flex items-center gap-2">
          <AlertTriangle size={20} /> Global Batch Recall
        </DialogTitle>
        <DialogDescription>
          Enter a Manufacturer Lot number. All batches matching this lot will be immediately marked as recalled and blocked from sales.
        </DialogDescription>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Manufacturer Lot Number *</label>
            <Input 
              placeholder="e.g. AMX240615" 
              value={lotNumber} 
              onChange={e => setLotNumber(e.target.value)} 
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="destructive" disabled={loading || !lotNumber} onClick={handleRecall}>
              {loading ? 'Recalling...' : 'Execute Recall'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BatchHistoryDialog({ batchId, open, onOpenChange }: { batchId: string, open: boolean, onOpenChange: (o: boolean) => void }) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (batchId && open) {
      setLoading(true)
      fetch(`/api/pharmacy/batches/${batchId}/history`)
        .then(res => res.json())
        .then(data => {
          setTransactions(data.transactions || [])
        })
        .finally(() => setLoading(false))
    }
  }, [batchId, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogTitle>Batch History</DialogTitle>
        <DialogDescription>Timeline of stock movements for this batch.</DialogDescription>
        
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500">Loading history...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions found for this batch.</p>
          ) : (
            transactions.map(tx => (
              <div key={tx._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-xl bg-gray-50">
                <div>
                  <p className="font-semibold text-sm">
                    {tx.type} <span className="text-gray-400 font-normal ml-2">{tx.reason || ''}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(tx.timestamp).toLocaleString()} {tx.userIdPerformed?.name && `by ${tx.userIdPerformed.name}`}
                  </p>
                </div>
                <div className="text-right mt-2 sm:mt-0">
                  <p className={`font-bold ${tx.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                  </p>
                  <p className="text-xs text-gray-400">Bal: {tx.newBalance}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
