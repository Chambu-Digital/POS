'use client'

import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronUp, Package, CreditCard, Download, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import { LoadingOrOffline } from '@/components/offline-indicator'
import { apiGet, handleApiError } from '@/lib/api-client'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReceiptItem {
  moduleItemId: string
  module: string
  itemName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface Receipt {
  _id: string
  receiptNumber: string
  date: string
  paidAt: string | null
  createdAt: string
  supplierName: string
  supplierId: string | null
  reference: string
  notes: string
  items: ReceiptItem[]
  totalCost: number
  paymentStatus: 'paid' | 'unpaid' | 'prepaid'
  paymentMethod: string
  bankProviderName: string
  customMethodName: string
  paymentReference: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtKES(n: number) {
  return `KES ${Math.round(n).toLocaleString('en-KE')}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function resolveMethod(r: Receipt): string {
  if (r.paymentMethod === 'cash') return 'Cash'
  if (r.paymentMethod === 'mobile_money') return 'M-Pesa'
  if (r.paymentMethod === 'bank' && r.bankProviderName) return r.bankProviderName
  if (r.paymentMethod === 'custom' && r.customMethodName) return r.customMethodName
  return r.paymentMethod || '—'
}

function StatusPill({ status }: { status: Receipt['paymentStatus'] }) {
  if (status === 'paid')
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-200">Paid</span>
  if (status === 'unpaid')
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Unpaid</span>
  return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Advance</span>
}

const PER_PAGE = 20

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  return (
    <PermissionGuard requiredPermission="core.purchases">
      <PurchasesContent />
    </PermissionGuard>
  )
}

function PurchasesContent() {
  const [receipts, setReceipts]     = useState<Receipt[]>([])
  const [loading, setLoading]       = useState(true)
  const [isOffline, setIsOffline]   = useState(false)
  const [search, setSearch]         = useState('')
  const [statusTab, setStatusTab]   = useState<'all' | 'paid' | 'unpaid' | 'prepaid'>('all')
  const [dateRange, setDateRange]   = useState({ start: '', end: '' })
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [page, setPage]             = useState(1)

  // Default date range: first of current month → today
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    setDateRange({ start: `${y}-${m}-01`, end: `${y}-${m}-${d}` })
  }, [])

  useEffect(() => { fetchReceipts() }, [])

  async function fetchReceipts() {
    setLoading(true)
    setIsOffline(false)
    const result = await apiGet<{ receipts: Receipt[] }>('/api/stock-receipts')
    if (result.success && result.data) {
      setReceipts(result.data.receipts || [])
    } else if (result.error) {
      setIsOffline(result.error.isOffline ?? false)
      toast.error(handleApiError(result.error, 'Failed to load purchases'))
    }
    setLoading(false)
  }

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filtered = receipts.filter(r => {
    if (statusTab !== 'all' && r.paymentStatus !== statusTab) return false
    if (dateRange.start && new Date(r.createdAt) < new Date(dateRange.start)) return false
    if (dateRange.end && new Date(r.createdAt) > new Date(dateRange.end + 'T23:59:59')) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.receiptNumber.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        r.items.some(i => i.itemName.toLowerCase().includes(q))
      )
    }
    return true
  })

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, statusTab, dateRange])

  // ── Aggregates ────────────────────────────────────────────────────────────
  const totalSpent    = receipts.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + r.totalCost, 0)
  const totalOwed     = receipts.filter(r => r.paymentStatus === 'unpaid').reduce((s, r) => s + r.totalCost, 0)
  const totalAdvances = receipts.filter(r => r.paymentStatus === 'prepaid').reduce((s, r) => s + r.totalCost, 0)

  const filteredTotal = filtered.reduce((s, r) => s + r.totalCost, 0)

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCSV() {
    let csv = `Receipt,Date,Supplier,Items,Units,Status,Payment,Reference,Total\n`
    filtered.forEach(r => {
      const totalUnits = r.items.reduce((s, i) => s + i.quantity, 0)
      csv += [
        `"${r.receiptNumber}"`,
        fmtDate(r.createdAt),
        `"${r.supplierName}"`,
        r.items.length,
        totalUnits,
        r.paymentStatus,
        resolveMethod(r),
        `"${r.paymentReference}"`,
        r.totalCost.toFixed(2),
      ].join(',') + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `purchases-${dateRange.start || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Tab counts ────────────────────────────────────────────────────────────
  const counts = {
    all:     receipts.length,
    paid:    receipts.filter(r => r.paymentStatus === 'paid').length,
    unpaid:  receipts.filter(r => r.paymentStatus === 'unpaid').length,
    prepaid: receipts.filter(r => r.paymentStatus === 'prepaid').length,
  }

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Purchases</h1>
          <p className="text-xs text-muted-foreground mt-0.5">All stock receipts and advance payments</p>
        </div>
      </div>

      {/* ── Summary pills ── */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 min-w-[140px]">
            <p className="text-xs text-blue-600 font-medium">Total Spent</p>
            <p className="text-lg font-bold text-blue-900">{fmtKES(totalSpent)}</p>
            <p className="text-xs text-blue-500">{counts.paid} paid receipt{counts.paid !== 1 ? 's' : ''}</p>
          </div>
          {totalOwed > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 min-w-[140px]">
              <p className="text-xs text-amber-600 font-medium">Outstanding Payables</p>
              <p className="text-lg font-bold text-amber-900">{fmtKES(totalOwed)}</p>
              <p className="text-xs text-amber-500">{counts.unpaid} unpaid receipt{counts.unpaid !== 1 ? 's' : ''}</p>
            </div>
          )}
          {totalAdvances > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 min-w-[140px]">
              <p className="text-xs text-purple-600 font-medium">Advances Out</p>
              <p className="text-lg font-bold text-purple-900">{fmtKES(totalAdvances)}</p>
              <p className="text-xs text-purple-500">{counts.prepaid} pending delivery</p>
            </div>
          )}
        </div>
      )}

      {/* ── Status tabs ── */}
      <div className="flex gap-1 border-b border-gray-200">
        {([ 
          { key: 'all',     label: 'All' },
          { key: 'paid',    label: 'Paid' },
          { key: 'unpaid',  label: 'Unpaid' },
          { key: 'prepaid', label: 'Advances' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              statusTab === tab.key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400">({counts[tab.key]})</span>
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden flex-1 min-w-[200px] max-w-xs">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search supplier or product…"
            className="flex-1 px-3 py-2 text-sm text-gray-900 focus:outline-none placeholder:text-gray-400"
          />
          <span className="px-3 py-2 border-l border-gray-300 bg-gray-50">
            <Search className="h-4 w-4 text-gray-500" />
          </span>
        </div>
        <input
          type="date"
          value={dateRange.start}
          onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
          className="px-2 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none"
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
          className="px-2 py-2 text-sm border border-gray-300 rounded bg-white focus:outline-none"
        />
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {/* ── Summary bar (filtered) ── */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 bg-green-50 border border-green-200 rounded px-4 py-2 text-sm">
          <span className="text-gray-700">Receipts: <strong>{filtered.length}</strong></span>
          <span className="text-gray-900">Total: <strong>{fmtKES(filteredTotal)}</strong></span>
        </div>
      )}

      {/* ── List ── */}
      <LoadingOrOffline
        isLoading={loading}
        isOffline={isOffline}
        onRetry={fetchReceipts}
        loadingText="Loading purchases…"
        offlineMessage="Unable to load purchases. Check your connection."
      >
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 bg-white rounded-lg border">
            No purchases found
          </div>
        ) : (
          <>
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[1fr_160px_100px_90px_110px_28px] bg-white border border-gray-200 rounded-t-lg px-4 py-2 border-b">
              <span className="text-xs font-semibold text-gray-500">Receipt / Supplier</span>
              <span className="text-xs font-semibold text-gray-500">Date</span>
              <span className="text-xs font-semibold text-gray-500">Items</span>
              <span className="text-xs font-semibold text-gray-500">Status</span>
              <span className="text-xs font-semibold text-gray-500 text-right">Total</span>
              <span />
            </div>

            <div className="space-y-0 border border-gray-200 rounded-b-lg md:rounded-t-none overflow-hidden bg-white">
              {paginated.map((r, idx) => {
                const isExpanded   = expanded === r._id
                const totalUnits   = r.items.reduce((s, i) => s + i.quantity, 0)
                const method       = resolveMethod(r)
                const isLast       = idx === paginated.length - 1

                return (
                  <div key={r._id} className={`${!isLast ? 'border-b border-gray-100' : ''}`}>
                    {/* ── Main row ── */}
                    <div
                      className="hidden md:grid grid-cols-[1fr_160px_100px_90px_110px_28px] px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors items-center"
                      onClick={() => setExpanded(isExpanded ? null : r._id)}
                    >
                      {/* Receipt / Supplier */}
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.receiptNumber}</p>
                        <p className="text-xs text-gray-500">{r.supplierName}{r.reference ? ` · ${r.reference}` : ''}</p>
                      </div>
                      {/* Date */}
                      <div className="text-sm text-gray-600 tabular-nums">
                        {fmtDate(r.createdAt)}
                        <span className="text-xs text-gray-400 ml-1">{fmtTime(r.createdAt)}</span>
                      </div>
                      {/* Items */}
                      <div className="text-sm text-gray-600">
                        {r.items.length > 0
                          ? `${r.items.length} item${r.items.length !== 1 ? 's' : ''} · ${totalUnits} units`
                          : <span className="text-xs text-purple-500">Advance</span>
                        }
                      </div>
                      {/* Status */}
                      <div><StatusPill status={r.paymentStatus} /></div>
                      {/* Total */}
                      <div className="text-sm font-bold text-gray-900 text-right tabular-nums">
                        {fmtKES(r.totalCost)}
                      </div>
                      {/* Expand */}
                      <div className="flex justify-end text-gray-400">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />
                        }
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div
                      className="md:hidden px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpanded(isExpanded ? null : r._id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{r.receiptNumber}</p>
                          <p className="text-xs text-gray-500">{r.supplierName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusPill status={r.paymentStatus} />
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-gray-400" />
                            : <ChevronDown className="h-4 w-4 text-gray-400" />
                          }
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{fmtDate(r.createdAt)} · {method}</span>
                        <span className="font-bold text-gray-900 tabular-nums">{fmtKES(r.totalCost)}</span>
                      </div>
                    </div>

                    {/* ── Expanded line items ── */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                        {/* Payment info */}
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
                          {method && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {method}
                              {r.paymentReference && ` · ${r.paymentReference}`}
                            </span>
                          )}
                          {r.paidAt && (
                            <span>Paid {fmtDate(r.paidAt)}</span>
                          )}
                          {r.notes && (
                            <span className="text-gray-400 italic">{r.notes}</span>
                          )}
                        </div>

                        {r.items.length === 0 ? (
                          <p className="text-xs text-purple-600 italic">Advance payment — goods not yet received</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400 border-b border-gray-200">
                                  <th className="text-left pb-1.5 font-medium">Product</th>
                                  <th className="text-right pb-1.5 font-medium w-16">Qty</th>
                                  <th className="text-right pb-1.5 font-medium w-24">Unit Price</th>
                                  <th className="text-right pb-1.5 font-medium w-24">Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.items.map((item, i) => (
                                  <tr key={i} className="border-b border-gray-100 last:border-0">
                                    <td className="py-1.5 text-gray-800 flex items-center gap-1">
                                      <Package className="h-3 w-3 text-gray-400 shrink-0" />
                                      {item.itemName}
                                    </td>
                                    <td className="py-1.5 text-right text-gray-600 tabular-nums">{item.quantity}</td>
                                    <td className="py-1.5 text-right text-gray-600 tabular-nums">{fmtKES(item.unitPrice)}</td>
                                    <td className="py-1.5 text-right font-semibold text-gray-800 tabular-nums">{fmtKES(item.lineTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-gray-200">
                                  <td colSpan={3} className="pt-2 text-right text-gray-500 font-medium">Total</td>
                                  <td className="pt-2 text-right font-bold text-gray-900 tabular-nums">{fmtKES(r.totalCost)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-1 pt-1">
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded text-sm font-semibold transition-colors ${
                      p === page
                        ? 'bg-white border border-gray-400 text-gray-900'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {page < totalPages && (
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-2 h-7 rounded text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-gray-400 flex items-center gap-0.5"
                  >
                    Next <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </LoadingOrOffline>
    </div>
  )
}
