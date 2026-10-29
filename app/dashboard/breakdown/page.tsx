'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Search, X, Receipt, CreditCard, Wallet, PiggyBank } from 'lucide-react'
import { LoadingOrOffline } from '@/components/offline-indicator'
import { apiGet } from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentEntry {
  method: string
  displayName: string
  amount: number
}

interface TransactionItem {
  productName: string
  quantity: number
  price: number
}

interface Transaction {
  _id: string
  orderNumber: string
  source: string
  total: number
  discount: number
  debt: number
  payments: PaymentEntry[]
  customerName: string
  staffName: string
  createdAt: string
  items: TransactionItem[]
  type: 'sale'
}

interface CreditPayment {
  _id: string
  customerName: string
  amount: number
  note: string
  date: string
}

interface DepositReceipt {
  _id: string
  customerName: string
  customerId: string
  depositId: string | null
  amount: number
  methodKey: string
  methodLabel: string
  paymentReference: string
  date: string
  note: string
}

interface Summary {
  totalOrders: number
  totalRevenue: number
  bySource: Record<string, number>
  byPayment: Record<string, number>
  creditIssued: number
  creditCollected: number
  depositsReceived: number
}

interface BreakdownData {
  summary: Summary
  transactions: Transaction[]
  creditPayments: CreditPayment[]
  depositReceipts: DepositReceipt[]
  filter: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMethodName(method: string): string {
  if (method === 'mobile_money') return 'M-Pesa'
  if (method === 'cash') return 'Cash'
  if (method === 'card') return 'Card'
  if (method === 'bank_transfer' || method === 'bank') return 'Bank Transfer'
  if (method === 'credit') return 'Credit'
  return method.charAt(0).toUpperCase() + method.slice(1)
}

function filterLabel(filter: string): string {
  if (!filter) return 'All Transactions'
  if (filter === 'credit_issued') return 'Credit Issued'
  if (filter === 'credit_collected') return 'Credit Collected'
  if (filter === 'deposit_receipts') return 'Customer Deposits'
  if (filter.startsWith('source_')) return `Source: ${filter.replace('source_', '').toUpperCase()}`
  return formatMethodName(filter)
}

function sourceColor(source: string): string {
  if (source === 'pos') return 'bg-blue-100 text-blue-700'
  if (source === 'kds') return 'bg-orange-100 text-orange-700'
  if (source === 'rental') return 'bg-purple-100 text-purple-700'
  if (source === 'hospitality') return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-600'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BreakdownPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading...</div>}>
      <BreakdownPageInner />
    </Suspense>
  )
}

function BreakdownPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const filter = searchParams.get('filter') || ''

  const [data, setData] = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setIsOffline(false)
    const url = `/api/dashboard/breakdown${filter ? `?filter=${encodeURIComponent(filter)}` : ''}`
    const result = await apiGet<BreakdownData>(url)
    if (result.success && result.data) {
      setData(result.data)
    } else if (result.error) {
      setIsOffline(result.error.isOffline)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filter chips from summary (always built from full summary) ──────────────
  const summaryChips = data
    ? buildChips(data.summary)
    : []

  // ── Search filtering ────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()

  const visibleTransactions = (data?.transactions ?? []).filter(t => {
    if (!q) return true
    return (
      t.orderNumber.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.staffName.toLowerCase().includes(q) ||
      t.items.some(i => i.productName.toLowerCase().includes(q))
    )
  })

  const visibleCreditPayments = (data?.creditPayments ?? []).filter(cp => {
    if (!q) return true
    return cp.customerName.toLowerCase().includes(q) || cp.note.toLowerCase().includes(q)
  })

  const visibleDepositReceipts = (data?.depositReceipts ?? []).filter(dr => {
    if (!q) return true
    return (
      dr.customerName.toLowerCase().includes(q) ||
      dr.methodLabel.toLowerCase().includes(q) ||
      dr.paymentReference.toLowerCase().includes(q) ||
      dr.note.toLowerCase().includes(q)
    )
  })

  // When a filter is active, sum only the filtered payment amounts (not the full sale total)
  // For cash: cap at the sale total minus non-cash payments (excludes change given back)
  // For other methods: p.amount is always exact (no change scenario)
  const filteredPaymentTotal = (transactions: Transaction[]) => {
    if (!filter || filter === 'credit_issued' || filter.startsWith('source_')) {
      return transactions.reduce((s, t) => s + t.total, 0)
    }
    // Payment method filter — sum actual revenue for this method (cap cash at what was kept)
    return transactions.reduce((s, t) => {
      const otherMethodsTotal = t.payments
        .filter(p => p.method.toLowerCase() !== filter.toLowerCase())
        .reduce((ps, p) => ps + p.amount, 0)
      const maxForMethod = Math.max(0, t.total - otherMethodsTotal)
      const rawAmount = t.payments
        .filter(p => p.method.toLowerCase() === filter.toLowerCase())
        .reduce((ps, p) => ps + p.amount, 0)
      return s + Math.min(rawAmount, maxForMethod)
    }, 0)
  }

  const totalShown =
    filteredPaymentTotal(visibleTransactions) +
    visibleCreditPayments.reduce((s, c) => s + c.amount, 0) +
    visibleDepositReceipts.reduce((s, d) => s + d.amount, 0)

  return (
    <LoadingOrOffline
      isLoading={loading}
      isOffline={isOffline}
      onRetry={fetchData}
      loadingText="Loading today's transactions..."
      offlineMessage="Unable to load breakdown. Please check your connection."
    >
      <div className="space-y-5 pb-10">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Today's Breakdown</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <SummaryCard
              label="Total Revenue"
              value={`KES ${data.summary.totalRevenue.toLocaleString()}`}
              active={!filter}
              onClick={() => router.push('/dashboard/breakdown')}
            />
            {summaryChips.map(chip => (
              <SummaryCard
                key={chip.key}
                label={chip.label}
                value={`KES ${chip.amount.toLocaleString()}`}
                active={filter === chip.key}
                accent={chip.accent}
                onClick={() =>
                  router.push(
                    filter === chip.key
                      ? '/dashboard/breakdown'
                      : `/dashboard/breakdown?filter=${encodeURIComponent(chip.key)}`
                  )
                }
              />
            ))}
          </div>
        )}

        {/* Active filter pill */}
        {filter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtered by:</span>
            <Badge className="flex items-center gap-1 pr-1">
              {filterLabel(filter)}
              <button onClick={() => router.push('/dashboard/breakdown')} className="ml-1 hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search order, customer, product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Transactions table */}
        {(visibleTransactions.length > 0 || (!filter && visibleCreditPayments.length === 0 && visibleDepositReceipts.length === 0)) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                {filter === 'credit_issued' ? 'Credit Sales' : 'Sales'}
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {visibleTransactions.length} transaction{visibleTransactions.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {visibleTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions found</p>
              ) : (
                <div className="divide-y">
                  {visibleTransactions.map(t => (
                    <TransactionRow key={t._id} transaction={t} />
                  ))}
                </div>
              )}

              {/* Total row */}
              {visibleTransactions.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 bg-muted/40 rounded-b-lg text-sm font-semibold">
                  <span>Subtotal ({visibleTransactions.length} sales)</span>
                  <span>KES {filteredPaymentTotal(visibleTransactions).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Credit payments section */}
        {visibleCreditPayments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600" />
                Credit Collected
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {visibleCreditPayments.length} payment{visibleCreditPayments.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {visibleCreditPayments.map(cp => (
                  <div key={cp._id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{cp.customerName}</p>
                      {cp.note && <p className="text-xs text-muted-foreground">{cp.note}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(cp.date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="font-semibold text-blue-600">KES {cp.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-muted/40 rounded-b-lg text-sm font-semibold">
                <span>Total collected ({visibleCreditPayments.length} payment{visibleCreditPayments.length !== 1 ? 's' : ''})</span>
                <span className="text-blue-600">KES {visibleCreditPayments.reduce((s, c) => s + c.amount, 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deposit receipts section — customer prepayments received today */}
        {visibleDepositReceipts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-teal-600" />
                Customer Deposits Received
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {visibleDepositReceipts.length} receipt{visibleDepositReceipts.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {visibleDepositReceipts.map(dr => (
                  <div key={dr._id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{dr.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {dr.methodLabel}
                        {dr.paymentReference && ` · ${dr.paymentReference}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(dr.date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                        {dr.note && ` · ${dr.note}`}
                      </p>
                    </div>
                    <span className="font-semibold text-teal-600">KES {dr.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-muted/40 rounded-b-lg text-sm font-semibold">
                <span>Total received ({visibleDepositReceipts.length} receipt{visibleDepositReceipts.length !== 1 ? 's' : ''})</span>
                <span className="text-teal-600">KES {visibleDepositReceipts.reduce((s, d) => s + d.amount, 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grand total when multiple sections */}
        {(visibleTransactions.length + visibleCreditPayments.length + visibleDepositReceipts.length) > 1 &&
         (visibleCreditPayments.length > 0 || visibleDepositReceipts.length > 0) && (
          <div className="flex justify-between items-center px-4 py-3 rounded-lg border bg-amber-50 border-amber-200 text-sm font-bold">
            <span>Grand Total</span>
            <span>KES {totalShown.toLocaleString()}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && visibleTransactions.length === 0 && visibleCreditPayments.length === 0 && visibleDepositReceipts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No transactions found</p>
            <p className="text-sm mt-1">
              {filter ? `No transactions match "${filterLabel(filter)}" today` : 'No transactions recorded today yet'}
            </p>
          </div>
        )}
      </div>
    </LoadingOrOffline>
  )
}

// ── Summary card chip ─────────────────────────────────────────────────────────

function SummaryCard({
  label, value, active, accent, onClick,
}: {
  label: string
  value: string
  active: boolean
  accent?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2 transition-all hover:shadow-sm ${
        active ? 'border-gray-900 bg-gray-900 text-white' : 'bg-card hover:border-gray-400'
      }`}
    >
      <p className={`text-xs mb-1 ${active ? 'text-gray-300' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`text-sm font-bold truncate ${accent && !active ? accent : ''}`}>{value}</p>
    </button>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
      <div
        className="flex items-start justify-between cursor-pointer gap-2"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Left: order info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-xs">#{t.orderNumber}</span>
              <Badge className={`text-[10px] px-1.5 py-0 ${sourceColor(t.source)}`}>
                {t.source.toUpperCase()}
              </Badge>
              {t.debt > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">CREDIT</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
              <span>{new Date(t.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
              {t.staffName && <span>by {t.staffName}</span>}
              {t.customerName && <span>· {t.customerName}</span>}
            </div>
          </div>
        </div>

        {/* Right: payment breakdown + total */}
        <div className="text-right shrink-0">
          <p className="font-semibold">KES {t.total.toLocaleString()}</p>
          <div className="flex gap-1 justify-end flex-wrap mt-0.5">
            {t.payments
              .filter(p => p.method.toLowerCase() !== 'credit')
              .map((p, i) => (
                <span key={i} className="text-[10px] text-muted-foreground">
                  {p.displayName}: {p.amount.toLocaleString()}
                </span>
              ))}
            {t.debt > 0 && (
              <span className="text-[10px] text-amber-600">Credit: {t.debt.toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="mt-3 ml-1 space-y-1 border-t pt-2">
          {t.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-muted-foreground">
              <span>
                {item.productName}
                <span className="ml-1 text-[10px]">× {item.quantity}</span>
              </span>
              <span>KES {(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          {t.discount > 0 && (
            <div className="flex justify-between text-xs text-orange-600 pt-1 border-t">
              <span>Discount</span>
              <span>− KES {t.discount.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Build summary chips from summary data ─────────────────────────────────────

function buildChips(summary: Summary) {
  const chips: { key: string; label: string; amount: number; accent?: string }[] = []

  // Payment methods
  Object.entries(summary.byPayment).forEach(([method, amount]) => {
    if (method.toLowerCase() === 'credit') return
    chips.push({
      key: method,
      label: formatMethodName(method),
      amount,
    })
  })

  // Sources — only show if more than one source
  const sources = Object.entries(summary.bySource).filter(([, amt]) => amt > 0)
  if (sources.length > 1) {
    sources.forEach(([src, amount]) => {
      chips.push({
        key: `source_${src}`,
        label: src.charAt(0).toUpperCase() + src.slice(1),
        amount,
      })
    })
  }

  // Credit issued / collected
  if (summary.creditIssued > 0) {
    chips.push({ key: 'credit_issued', label: 'Credit Issued', amount: summary.creditIssued, accent: 'text-amber-600' })
  }
  if (summary.creditCollected > 0) {
    chips.push({ key: 'credit_collected', label: 'Credit Collected', amount: summary.creditCollected, accent: 'text-blue-600' })
  }
  // Customer deposits received today (shown as a dedicated chip for quick access)
  if (summary.depositsReceived > 0) {
    chips.push({ key: 'deposit_receipts', label: 'Deposits Received', amount: summary.depositsReceived, accent: 'text-teal-600' })
  }

  return chips
}
