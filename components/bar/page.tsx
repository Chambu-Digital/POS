'use client'

import { useState, useEffect } from 'react'
import {
  Wine, Plus, Minus, X, Check, Clock,
  Banknote, Smartphone, Search,
  Star, Trash2, UtensilsCrossed, CreditCard, ChevronLeft, Menu,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type DrinkCategory = 'spirits' | 'beer' | 'wine' | 'cocktails' | 'shots' | 'soft'
type TabStatus     = 'open' | 'hold' | 'billing' | 'paid'
type PaymentMethod = 'cash' | 'card' | 'mpesa'

interface DrinkItem {
  id: string; name: string; category: DrinkCategory
  price: number; description: string; popular?: boolean; emoji: string; abv?: string
}
interface TabOrderLine {
  id: string; drink: DrinkItem; quantity: number; addedAt: Date; notes?: string
}
interface BarTab {
  id: string; tabNumber: string; customerName: string
  seatLabel: string; bartenderName: string; status: TabStatus
  lines: TabOrderLine[]; openedAt: Date; lastActivityAt: Date
  discount?: number; paymentMethod?: PaymentMethod; paidAt?: Date
}
interface BarToast { id: string; message: string; type: 'success' | 'info' | 'error' }

// ── Drink menu data ───────────────────────────────────────────────────────────
const DRINKS: DrinkItem[] = [
  { id: 'd01', name: 'Jameson',         category: 'spirits',   price: 650,  description: 'Irish blend 50ml',       emoji: '', abv: '40%',   popular: true  },
  { id: 'd02', name: 'Johnnie Walker',  category: 'spirits',   price: 600,  description: 'Scotch blend 50ml',      emoji: '', abv: '40%'                   },
  { id: 'd03', name: 'Smirnoff Vodka',  category: 'spirits',   price: 550,  description: 'Triple distilled 50ml',  emoji: '', abv: '37.5%'                 },
  { id: 'd04', name: 'Bacardi Rum',     category: 'spirits',   price: 580,  description: 'White rum 50ml',         emoji: '', abv: '37.5%'                 },
  { id: 'd05', name: 'Tanqueray Gin',   category: 'spirits',   price: 700,  description: 'London dry gin 50ml',    emoji: '', abv: '43.1%', popular: true  },
  { id: 'd06', name: 'Hennessy VS',     category: 'spirits',   price: 1200, description: 'French cognac 50ml',     emoji: '', abv: '40%'                   },
  { id: 'd07', name: 'Tusker Lager',    category: 'beer',      price: 280,  description: 'Kenyan lager 500ml',     emoji: '', abv: '4.2%',  popular: true  },
  { id: 'd08', name: 'Guinness',        category: 'beer',      price: 320,  description: 'Irish stout pint',       emoji: '', abv: '4.2%'                  },
  { id: 'd09', name: 'Heineken',        category: 'beer',      price: 300,  description: 'Dutch lager 330ml',      emoji: '', abv: '5%'                    },
  { id: 'd10', name: 'White Cap',       category: 'beer',      price: 260,  description: 'Kenyan pilsner 500ml',   emoji: '', abv: '4%'                    },
  { id: 'd11', name: 'House Red',       category: 'wine',      price: 500,  description: 'Red wine 175ml',         emoji: '', popular: true                },
  { id: 'd12', name: 'House White',     category: 'wine',      price: 500,  description: 'White wine 175ml',       emoji: ''                              },
  { id: 'd13', name: 'Rosé Wine',       category: 'wine',      price: 550,  description: 'Rosé 175ml',             emoji: ''                              },
  { id: 'd14', name: 'Prosecco',        category: 'wine',      price: 650,  description: 'Sparkling flute',        emoji: '', popular: true                },
  { id: 'd15', name: 'Mojito',          category: 'cocktails', price: 850,  description: 'Rum, lime, mint, soda',  emoji: '', popular: true                },
  { id: 'd16', name: 'Gin & Tonic',     category: 'cocktails', price: 800,  description: 'Tanqueray, tonic, lime', emoji: ''                              },
  { id: 'd17', name: 'Whiskey Sour',    category: 'cocktails', price: 900,  description: 'Bourbon, lemon, sugar',  emoji: '', popular: true                },
  { id: 'd18', name: 'Negroni',         category: 'cocktails', price: 950,  description: 'Gin, Campari, vermouth', emoji: ''                              },
  { id: 'd19', name: 'Tequila Shot',    category: 'shots',     price: 350,  description: 'Jose Cuervo 25ml',       emoji: '', abv: '38%'                  },
  { id: 'd20', name: 'Sambuca',         category: 'shots',     price: 380,  description: 'Anise liqueur 25ml',     emoji: '', abv: '42%'                  },
  { id: 'd21', name: 'Tequila Bomb',    category: 'shots',     price: 420,  description: 'Tequila + energy drink', emoji: '', popular: true                },
  { id: 'd22', name: 'Soda Water',      category: 'soft',      price: 100,  description: 'Mixer or standalone',    emoji: ''                              },
  { id: 'd23', name: 'Coca-Cola',       category: 'soft',      price: 150,  description: '330ml can',              emoji: ''                              },
  { id: 'd24', name: 'Fresh Juice',     category: 'soft',      price: 250,  description: 'Orange/mango/passion',   emoji: '', popular: true                },
  { id: 'd25', name: 'Water',           category: 'soft',      price: 80,   description: '500ml bottle',           emoji: ''                              },
  { id: 'd26', name: 'Red Bull',        category: 'soft',      price: 300,  description: 'Energy drink 250ml',     emoji: '', popular: true                },
]

// ── Seed tabs ─────────────────────────────────────────────────────────────────
const SEED: BarTab[] = [
  {
    id: 't1', tabNumber: 'TAB-001', customerName: 'James O.', seatLabel: 'Bar Stool 3',
    bartenderName: 'Mike', status: 'open',
    openedAt: new Date(Date.now() - 42 * 60000), lastActivityAt: new Date(Date.now() - 5 * 60000),
    lines: [
      { id: 'l1', drink: DRINKS[0], quantity: 2, addedAt: new Date(Date.now() - 42 * 60000) },
      { id: 'l2', drink: DRINKS[6], quantity: 1, addedAt: new Date(Date.now() - 30 * 60000) },
    ],
  },
  {
    id: 't2', tabNumber: 'TAB-002', customerName: 'Table 6 Group', seatLabel: 'Table 6',
    bartenderName: 'Mike', status: 'hold',
    openedAt: new Date(Date.now() - 90 * 60000), lastActivityAt: new Date(Date.now() - 15 * 60000),
    lines: [
      { id: 'l4', drink: DRINKS[13], quantity: 4, addedAt: new Date(Date.now() - 90 * 60000) },
      { id: 'l5', drink: DRINKS[7],  quantity: 2, addedAt: new Date(Date.now() - 60 * 60000) },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
let tabCounter = 3
function uid()             { return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }
function fmtKsh(n: number) { return `KSh ${n.toLocaleString()}` }
function fmtTime(d: Date)  { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
function timeAgo(d: Date)  {
  const m = Math.floor((Date.now() - d.getTime()) / 60000)
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m`
}
function tabSubtotal(tab: BarTab) { return tab.lines.reduce((s, l) => s + l.drink.price * l.quantity, 0) }
function tabTotal(tab: BarTab) {
  const sub = tabSubtotal(tab)
  return tab.discount ? sub * (1 - tab.discount / 100) : sub
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: TabStatus }) {
  const cfg = {
    open:    'bg-green-100 text-green-700 border-green-200',
    hold:    'bg-amber-100 text-amber-700 border-amber-200',
    billing: 'bg-blue-100 text-blue-700 border-blue-200',
    paid:    'bg-gray-100 text-gray-500 border-gray-200',
  }
  const labels = { open: 'Open', hold: 'Hold', billing: 'Billing', paid: 'Paid ✓' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg[status]}`}>
      {labels[status]}
    </span>
  )
}

// ── Toast stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, dismiss }: { toasts: BarToast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white border border-gray-200 shadow-lg text-sm min-w-[220px]"
          style={{ borderLeft: `3px solid ${t.type === 'success' ? '#16a34a' : t.type === 'error' ? '#ef4444' : '#3b82f6'}` }}>
          <span style={{ color: t.type === 'success' ? '#16a34a' : t.type === 'error' ? '#ef4444' : '#3b82f6' }}>
            {t.type === 'success' ? <Check size={13} /> : t.type === 'error' ? <X size={13} /> : <Clock size={13} />}
          </span>
          <span className="flex-1 text-gray-700">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>
        </div>
      ))}
    </div>
  )
}

// ── Open tab modal ────────────────────────────────────────────────────────────
function OpenTabModal({ onOpen, onClose }: {
  onOpen: (name: string, seat: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [seat, setSeat] = useState('')
  const valid = name.trim() && seat.trim()
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Open New Tab</h3>
            <p className="text-xs text-gray-500 mt-0.5">Start a running tab for a customer</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer / Group Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John M. or Table 5 Group"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Seat / Location *</label>
            <input value={seat} onChange={e => setSeat(e.target.value)} placeholder="e.g. Bar Stool 4, Table 8"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button onClick={() => valid && onOpen(name, seat)} disabled={!valid}
            className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold text-sm transition-colors mt-1">
            Open Tab
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Bill modal ────────────────────────────────────────────────────────────────
type MpesaMode = 'stk' | 'manual'

function BillModal({ tab, onPay, onClose }: {
  tab: BarTab
  onPay: (method: PaymentMethod, discount: number, mpesaCode?: string, mpesaPhone?: string) => Promise<void>
  onClose: () => void
}) {
  const [method, setMethod]           = useState<PaymentMethod>('cash')
  const [discount, setDiscount]       = useState(tab.discount ?? 0)
  const [amountGiven, setAmountGiven] = useState('')
  const [mpesaMode, setMpesaMode]     = useState<MpesaMode>('stk')
  const [mpesaPhone, setMpesaPhone]   = useState('')
  const [mpesaCode, setMpesaCode]     = useState('')
  const [stkSent, setStkSent]         = useState(false)
  const [stkLoading, setStkLoading]   = useState(false)
  const [stkError, setStkError]       = useState('')
  const [saving, setSaving]           = useState(false)

  const sub         = tabSubtotal(tab)
  const discountAmt = sub * (discount / 100)
  const tot         = sub - discountAmt
  const change      = method === 'cash' && parseFloat(amountGiven) > tot ? parseFloat(amountGiven) - tot : 0

  async function sendSTK() {
    if (!mpesaPhone.trim()) { setStkError('Enter a phone number'); return }
    setStkLoading(true); setStkError('')
    try {
      const res = await fetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: mpesaPhone, amount: Math.round(tot), orderReference: tab.tabNumber }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'STK push failed')
      setStkSent(true)
    } catch (e: unknown) {
      setStkError(e instanceof Error ? e.message : 'STK push failed')
    } finally {
      setStkLoading(false)
    }
  }

  async function handleConfirm() {
    if (method === 'mpesa' && mpesaMode === 'manual' && !mpesaCode.trim()) return
    setSaving(true)
    await onPay(
      method, discount,
      method === 'mpesa' ? (mpesaMode === 'manual' ? mpesaCode.trim() : undefined) : undefined,
      method === 'mpesa' ? mpesaPhone.trim() || undefined : undefined,
    )
    setSaving(false)
  }

  const canConfirm =
    method === 'cash' ||
    (method === 'mpesa' && mpesaMode === 'stk' && stkSent) ||
    (method === 'mpesa' && mpesaMode === 'manual' && mpesaCode.trim().length > 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="font-bold text-gray-900 text-base">{tab.tabNumber} — Bill</div>
            <div className="text-sm text-gray-700 mt-0.5">{tab.customerName} · {tab.seatLabel}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Line items */}
          <div className="space-y-1.5">
            {tab.lines.map(line => (
              <div key={line.id} className="flex items-center gap-2 text-sm">
                <span className="text-base">{line.drink.emoji}</span>
                <span className="flex-1 text-gray-900">
                  <span className="font-semibold text-green-700 mr-1">×{line.quantity}</span>
                  {line.drink.name}
                </span>
                <span className="text-gray-900 font-semibold tabular-nums">{fmtKsh(line.drink.price * line.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex justify-between text-sm text-gray-700">
              <span>Subtotal</span><span className="tabular-nums">{fmtKsh(sub)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-gray-700">Discount</span>
              <div className="flex gap-1 flex-wrap">
                {[0, 5, 10, 15, 20].map(d => (
                  <button key={d} onClick={() => setDiscount(d)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${discount === d ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
                    {d}%
                  </button>
                ))}
              </div>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-700 font-semibold">
                <span>Discount ({discount}%)</span>
                <span className="tabular-nums">− {fmtKsh(discountAmt)}</span>
              </div>
            )}
            <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              <span className="font-bold text-gray-900">TOTAL</span>
              <span className="font-bold text-xl text-green-700 tabular-nums">{fmtKsh(tot)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <p className="text-sm font-bold text-gray-900 mb-2">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: 'cash'  as PaymentMethod, label: 'Cash',   icon: <Banknote size={18} />   },
                { v: 'mpesa' as PaymentMethod, label: 'M-Pesa', icon: <Smartphone size={18} /> },
              ]).map(pm => (
                <button key={pm.v} onClick={() => setMethod(pm.v)}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-bold transition-colors ${method === pm.v ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-900 hover:border-gray-300'}`}>
                  {pm.icon}{pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash flow */}
          {method === 'cash' && (
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Amount Given</label>
              <input type="number" value={amountGiven} onChange={e => setAmountGiven(e.target.value)}
                placeholder={`${tot}`}
                className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 tabular-nums" />
              {change > 0 && (
                <div className="mt-2 flex justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-bold">
                  <span>Change</span><span className="tabular-nums">{fmtKsh(change)}</span>
                </div>
              )}
            </div>
          )}

          {/* M-Pesa flow */}
          {method === 'mpesa' && (
            <div className="space-y-3">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => { setMpesaMode('stk'); setStkSent(false); setStkError('') }}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${mpesaMode === 'stk' ? 'bg-green-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-50'}`}>
                   STK Push
                </button>
                <button onClick={() => setMpesaMode('manual')}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${mpesaMode === 'manual' ? 'bg-green-600 text-white' : 'bg-white text-gray-900 hover:bg-gray-50'}`}>
                   Manual Code
                </button>
              </div>
              {mpesaMode === 'stk' && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">Customer Phone Number</label>
                  <div className="flex gap-2">
                    <input value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}
                      placeholder="07XX XXX XXX" disabled={stkSent}
                      className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60" />
                    <button onClick={sendSTK} disabled={stkLoading || stkSent}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold transition-colors whitespace-nowrap">
                      {stkLoading ? 'Sending…' : stkSent ? 'Sent ✓' : 'Send'}
                    </button>
                  </div>
                  {stkError && <p className="text-xs text-red-600 font-medium">{stkError}</p>}
                  {stkSent && (
                    <div className="px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium">
                       Prompt sent to {mpesaPhone}. Ask customer to enter their PIN, then confirm below.
                    </div>
                  )}
                </div>
              )}
              {mpesaMode === 'manual' && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">M-Pesa Transaction Code</label>
                  <input value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QHX4ABCDEF"
                    className="w-full px-3 py-2 text-sm text-gray-900 font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 uppercase" />
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-1">Customer Phone (optional)</label>
                    <input value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                     Ask customer to send <strong>{fmtKsh(tot)}</strong> to your M-Pesa, then enter the code above.
                  </div>
                </div>
              )}
            </div>
          )}

          <button onClick={handleConfirm} disabled={!canConfirm || saving}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
            {saving ? <><Clock size={15} className="animate-spin" /> Saving…</> : <> Confirm Payment — {fmtKsh(tot)}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Left column: tab list ─────────────────────────────────────────────────────
function TabList({ tabs, selectedId, filter, onSelect, onFilter, onNew }: {
  tabs: BarTab[]; selectedId: string | null; filter: TabStatus | 'all'
  onSelect: (id: string) => void; onFilter: (f: TabStatus | 'all') => void; onNew: () => void
}) {
  const filters: { key: TabStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'open', label: 'Open' },
    { key: 'hold', label: 'Hold' }, { key: 'billing', label: 'Bill' }, { key: 'paid', label: 'Paid' },
  ]
  const counts = {
    all: tabs.length,
    open: tabs.filter(t => t.status === 'open').length,
    hold: tabs.filter(t => t.status === 'hold').length,
    billing: tabs.filter(t => t.status === 'billing').length,
    paid: tabs.filter(t => t.status === 'paid').length,
  }
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Tabs</span>
          <button onClick={onNew}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors">
            <Plus size={12} /> New
          </button>
        </div>
        <div className="flex gap-1">
          {filters.map(f => (
            <button key={f.key} onClick={() => onFilter(f.key)}
              className={`flex-1 py-1 rounded text-xs font-bold transition-colors relative ${filter === f.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
              {f.label}
              {counts[f.key] > 0 && filter !== f.key && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Wine size={22} className="mb-2 opacity-20" />
            <p className="text-xs">No tabs</p>
          </div>
        ) : tabs.map(tab => {
          const tot   = tabTotal(tab)
          const count = tab.lines.reduce((s, l) => s + l.quantity, 0)
          const active = selectedId === tab.id
          return (
            <button key={tab.id} onClick={() => onSelect(tab.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${active ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/40'}`}>
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-xs font-bold text-green-700 font-mono">{tab.tabNumber}</span>
                <StatusPill status={tab.status} />
              </div>
              <div className="text-sm font-bold text-gray-900 truncate">{tab.customerName}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-700">{tab.seatLabel} · {timeAgo(tab.openedAt)}</span>
                <span className="text-sm font-bold text-green-700 tabular-nums">{fmtKsh(tot)}</span>
              </div>
              {count > 0 && <div className="mt-1 text-xs text-gray-700">{count} item{count !== 1 ? 's' : ''}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Middle column: drink menu ─────────────────────────────────────────────────
function DrinkMenu({ tab, onAdd, onRemove }: {
  tab: BarTab | null
  onAdd: (tabId: string, drink: DrinkItem) => void
  onRemove: (tabId: string, lineId: string) => void
}) {
  const [cat, setCat]       = useState<DrinkCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const cats: { key: DrinkCategory | 'all'; label: string; emoji: string }[] = [
    { key: 'all',       label: 'All',       emoji: '🍸' },
    { key: 'spirits',   label: 'Spirits',   emoji: '🥃' },
    { key: 'beer',      label: 'Beer',      emoji: '🍺' },
    { key: 'wine',      label: 'Wine',      emoji: '🍷' },
    { key: 'cocktails', label: 'Cocktails', emoji: '🍹' },
    { key: 'shots',     label: 'Shots',     emoji: '🔥' },
    { key: 'soft',      label: 'Soft',      emoji: '🥤' },
  ]

  const displayed = DRINKS.filter(d =>
    (cat === 'all' || d.category === cat) &&
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const isLocked = !tab || tab.status === 'billing' || tab.status === 'paid' || tab.status === 'hold'

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-3 py-2 shrink-0">
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search drinks…"
            className="w-full pl-8 pr-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 placeholder:text-gray-500" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
          {cats.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${cat === c.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
               {c.label}
            </button>
          ))}
        </div>
      </div>

      {!tab && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
          <UtensilsCrossed size={32} className="opacity-20" />
          <p className="text-sm">Select or open a tab first</p>
        </div>
      )}

      {tab && isLocked && (
        <div className="mx-3 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium shrink-0">
          {tab.status === 'hold' ? '⏸ Tab on hold — resume to add drinks' : '🔒 Tab locked for billing/payment'}
        </div>
      )}

      {tab && (
        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
          {/* Responsive grid: 2 cols on mobile, 3 on md, 4 on xl */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {displayed.map(drink => {
              const lineInTab = tab.lines.find(l => l.drink.id === drink.id)
              return (
                <div key={drink.id}
                  className={`rounded-xl border p-2.5 bg-white transition-all ${lineInTab ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300'} ${isLocked ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-1.5 mb-2">
                    <span className="text-xl shrink-0">{drink.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-gray-900 leading-tight truncate">{drink.name}</span>
                        {drink.popular && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                      </div>
                      <div className="text-xs text-gray-600 leading-tight">{drink.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-green-700 tabular-nums">{fmtKsh(drink.price)}</span>
                    {lineInTab ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => !isLocked && onRemove(tab.id, lineInTab.id)} disabled={isLocked}
                          className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                          <Minus size={10} />
                        </button>
                        <span className="text-xs font-bold text-green-700 w-5 text-center tabular-nums">{lineInTab.quantity}</span>
                        <button onClick={() => !isLocked && onAdd(tab.id, drink)} disabled={isLocked}
                          className="w-6 h-6 rounded-md bg-green-600 flex items-center justify-center text-white hover:bg-green-700 disabled:opacity-40">
                          <Plus size={10} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => !isLocked && onAdd(tab.id, drink)} disabled={isLocked}
                        className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center text-white hover:bg-green-700 disabled:opacity-40 transition-colors">
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Right column: current order ───────────────────────────────────────────────
function OrderPanel({ tab, onDeleteLine, onHold, onResume, onRequestBill, onBack }: {
  tab: BarTab | null
  onDeleteLine: (tabId: string, lineId: string) => void
  onHold: (tabId: string) => void
  onResume: (tabId: string) => void
  onRequestBill: (tabId: string) => void
  onBack?: () => void
}) {
  if (!tab) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center text-gray-600 gap-2">
        <Wine size={32} className="opacity-30" />
        <p className="text-sm font-medium text-gray-700">No tab selected</p>
      </div>
    )
  }

  const sub   = tabSubtotal(tab)
  const tot   = tabTotal(tab)
  const count = tab.lines.reduce((s, l) => s + l.quantity, 0)

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Tab header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-green-600 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button onClick={onBack} className="text-white/80 hover:text-white shrink-0">
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono opacity-80">{tab.tabNumber}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  tab.status === 'open' ? 'bg-green-500 text-white border-green-400' :
                  tab.status === 'hold' ? 'bg-amber-400 text-amber-900 border-amber-300' :
                  tab.status === 'billing' ? 'bg-blue-400 text-white border-blue-300' :
                  'bg-white/20 text-white border-white/30'
                }`}>
                  {tab.status === 'open' ? 'Open' : tab.status === 'hold' ? 'Hold' : tab.status === 'billing' ? 'Billing' : 'Paid ✓'}
                </span>
              </div>
              <div className="text-sm font-bold mt-0.5 truncate">{tab.customerName}</div>
              <div className="text-xs text-white/90 truncate">{tab.seatLabel} · opened {fmtTime(tab.openedAt)}</div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <div className="text-xl font-bold tabular-nums">{fmtKsh(tot)}</div>
            <div className="text-xs text-white/90">{count} item{count !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Order lines */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {tab.lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Wine size={24} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No drinks yet</p>
            <p className="text-xs text-gray-500 mt-1">Add from the menu</p>
          </div>
        ) : tab.lines.map(line => (
          <div key={line.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
            <span className="text-lg shrink-0">{line.drink.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">
                <span className="text-green-700 font-bold mr-1">×{line.quantity}</span>
                {line.drink.name}
              </div>
              <div className="text-xs text-gray-600">{fmtTime(line.addedAt)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtKsh(line.drink.price * line.quantity)}</div>
              {tab.status !== 'paid' && tab.status !== 'billing' && (
                <button onClick={() => onDeleteLine(tab.id, line.id)}
                  className="mt-0.5 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {tab.status !== 'paid' && (
        <div className="px-4 py-3 border-t border-gray-100 shrink-0 space-y-2.5 bg-white">
          <div className="flex justify-between text-sm text-gray-700">
            <span>Subtotal</span><span className="tabular-nums">{fmtKsh(sub)}</span>
          </div>
          {(tab.discount ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-green-700 font-semibold">
              <span>Discount ({tab.discount}%)</span>
              <span className="tabular-nums">−{fmtKsh(sub * (tab.discount! / 100))}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
            <span className="text-gray-900">Total</span>
            <span className="text-green-700 tabular-nums">{fmtKsh(tot)}</span>
          </div>
          <div className="flex gap-2">
            {tab.status === 'open' && (
              <button onClick={() => onHold(tab.id)}
                className="flex-1 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors">
                <Clock size={14} /> Hold
              </button>
            )}
            {tab.status === 'hold' && (
              <button onClick={() => onResume(tab.id)}
                className="flex-1 py-2 rounded-lg border border-green-300 bg-green-50 text-green-800 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-green-100 transition-colors">
                <Check size={14} /> Resume
              </button>
            )}
            {(tab.status === 'open' || tab.status === 'hold') && (
              <button onClick={() => onRequestBill(tab.id)}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
                <CreditCard size={14} /> Request Bill
              </button>
            )}
            {tab.status === 'billing' && (
              <button onClick={() => onRequestBill(tab.id)}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
                 Pay Now
              </button>
            )}
          </div>
        </div>
      )}
      {tab.status === 'paid' && (
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-center gap-2 py-2 bg-green-50 border border-green-200 rounded-lg text-sm font-semibold text-green-700">
            <Check size={15} /> Paid · {tab.paymentMethod?.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root page ─────────────────────────────────────────────────────────────────
// Mobile view cycles through 3 panels: 'tabs' | 'menu' | 'order'
type MobilePanel = 'tabs' | 'menu' | 'order'

export default function BarPage() {
  const [tabs, setTabs]             = useState<BarTab[]>(SEED)
  const [selectedId, setSelectedId] = useState<string | null>(SEED[0].id)
  const [showOpen, setShowOpen]     = useState(false)
  const [billTabId, setBillTabId]   = useState<string | null>(null)
  const [filter, setFilter]         = useState<TabStatus | 'all'>('all')
  const [toasts, setToasts]         = useState<BarToast[]>([])
  const [clock, setClock]           = useState(new Date())
  // Mobile panel navigation
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('tabs')

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  function addToast(message: string, type: BarToast['type'] = 'info') {
    const id = uid()
    setToasts(p => [{ id, message, type }, ...p])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }

  function openTab(name: string, seat: string) {
    const t: BarTab = {
      id: uid(), tabNumber: `TAB-00${tabCounter++}`,
      customerName: name, seatLabel: seat, bartenderName: 'Bartender',
      status: 'open', lines: [], openedAt: new Date(), lastActivityAt: new Date(),
    }
    setTabs(p => [t, ...p])
    setSelectedId(t.id)
    setShowOpen(false)
    setMobilePanel('menu')
    addToast(`Tab opened for ${name}`, 'success')
  }

  function selectTab(id: string) {
    setSelectedId(id)
    setMobilePanel('menu')
  }

  function addDrink(tabId: string, drink: DrinkItem) {
    setTabs(p => p.map(t => {
      if (t.id !== tabId) return t
      const now = new Date()
      const existing = t.lines.find(l => l.drink.id === drink.id)
      if (existing) {
        return { ...t, lastActivityAt: now, lines: t.lines.map(l => l.drink.id === drink.id ? { ...l, quantity: l.quantity + 1 } : l) }
      }
      return { ...t, lastActivityAt: now, lines: [...t.lines, { id: uid(), drink, quantity: 1, addedAt: now }] }
    }))
  }

  function removeDrink(tabId: string, lineId: string) {
    setTabs(p => p.map(t => {
      if (t.id !== tabId) return t
      const line = t.lines.find(l => l.id === lineId)
      if (!line) return t
      if (line.quantity <= 1) return { ...t, lines: t.lines.filter(l => l.id !== lineId) }
      return { ...t, lines: t.lines.map(l => l.id === lineId ? { ...l, quantity: l.quantity - 1 } : l) }
    }))
  }

  function deleteLine(tabId: string, lineId: string) {
    setTabs(p => p.map(t => t.id !== tabId ? t : { ...t, lines: t.lines.filter(l => l.id !== lineId) }))
  }

  function holdTab(tabId: string) {
    setTabs(p => p.map(t => t.id !== tabId ? t : { ...t, status: 'hold' }))
    addToast('Tab placed on hold', 'info')
  }

  function resumeTab(tabId: string) {
    setTabs(p => p.map(t => t.id !== tabId ? t : { ...t, status: 'open' }))
    addToast('Tab resumed', 'success')
  }

  function requestBill(tabId: string) {
    setTabs(p => p.map(t => t.id !== tabId ? t : { ...t, status: 'billing' }))
    setBillTabId(tabId)
  }

  async function confirmPayment(tabId: string, method: PaymentMethod, discount: number, mpesaCode?: string, mpesaPhone?: string) {
    const t = tabs.find(t => t.id === tabId)!
    const sub = tabSubtotal(t)
    const tot = tabTotal({ ...t, discount })

    try {
      await fetch('/api/bar/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabNumber:     t.tabNumber,
          items:         t.lines.map(l => ({ name: l.drink.name, quantity: l.quantity, price: l.drink.price })),
          subtotal:      sub,
          discount,
          total:         tot,
          paymentMethod: method === 'mpesa' ? 'mobile_money' : 'cash',
          mpesaCode:     mpesaCode ?? null,
          mpesaPhone:    mpesaPhone ?? null,
          notes:         `Bar tab ${t.tabNumber} — ${t.customerName} (${t.seatLabel})`,
          status:        (method === 'mpesa' && !mpesaCode) ? 'pending' : 'completed',
        }),
      })
    } catch (e) {
      console.error('Failed to save bar sale', e)
    }

    setTabs(p => p.map(tab => tab.id !== tabId ? tab : {
      ...tab, status: 'paid', paymentMethod: method, discount, paidAt: new Date(),
    }))
    setBillTabId(null)
    setMobilePanel('tabs')
    addToast(`Payment confirmed — ${t.customerName} · ${fmtKsh(tot)}`, 'success')
  }

  const selectedTab = tabs.find(t => t.id === selectedId) ?? null
  const billTab     = billTabId ? (tabs.find(t => t.id === billTabId) ?? null) : null

  const filteredTabs = tabs
    .filter(t => filter === 'all' || t.status === filter)
    .sort((a, b) => {
      const o: Record<TabStatus, number> = { billing: 0, open: 1, hold: 2, paid: 3 }
      return o[a.status] - o[b.status] || b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
    })

  const openCount = tabs.filter(t => t.status === 'open').length
  const holdCount = tabs.filter(t => t.status === 'hold').length
  const paidToday = tabs.filter(t => t.status === 'paid').reduce((s, t) => s + tabTotal(t), 0)
  const cartCount = selectedTab?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0

  return (
    <>
      <div
        className="flex flex-col bg-gray-100"
        style={{ marginLeft: '-1.5rem', marginRight: '-1.5rem', marginTop: '-1.5rem', height: 'calc(100vh - 56px)', overflow: 'hidden' }}
      >
        {/* ── Header ── */}
        <header className="bg-green-700 text-white px-3 sm:px-4 h-11 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="font-bold text-sm whitespace-nowrap">🍸 Bar</span>
            <span className="text-xs text-white/80 font-mono hidden sm:block">
              {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <div className="hidden md:flex items-center gap-3 text-xs text-white/90">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-300 inline-block"></span>{openCount} open</span>
              {holdCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block"></span>{holdCount} hold</span>}
              <span className="text-white/50">·</span>
              <span>Paid: <strong>{fmtKsh(paidToday)}</strong></span>
            </div>
          </div>

          {/* Mobile nav pills */}
          <div className="flex lg:hidden items-center gap-1 text-xs">
            {(['tabs', 'menu', 'order'] as MobilePanel[]).map(p => (
              <button key={p} onClick={() => setMobilePanel(p)}
                className={`px-2.5 py-1 rounded-full font-bold capitalize transition-colors relative ${mobilePanel === p ? 'bg-white text-green-700' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                {p === 'order' && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-gray-900 text-[9px] font-black flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
                {p}
              </button>
            ))}
          </div>

          <button onClick={() => setShowOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors border border-white/20 whitespace-nowrap shrink-0">
            <Plus size={13} /> <span className="hidden sm:inline">Open Tab</span><span className="sm:hidden">New</span>
          </button>
        </header>

        {/* ── Desktop: 3-column body ── */}
        <div className="hidden lg:flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Col 1: Tab list */}
          <div className="w-60 shrink-0 overflow-hidden">
            <TabList tabs={filteredTabs} selectedId={selectedId} filter={filter}
              onSelect={setSelectedId} onFilter={setFilter} onNew={() => setShowOpen(true)} />
          </div>
          {/* Col 2: Drink menu */}
          <div className="flex-1 overflow-hidden">
            <DrinkMenu tab={selectedTab} onAdd={addDrink} onRemove={removeDrink} />
          </div>
          {/* Col 3: Order panel */}
          <div className="w-72 shrink-0 overflow-hidden">
            <OrderPanel tab={selectedTab} onDeleteLine={deleteLine}
              onHold={holdTab} onResume={resumeTab} onRequestBill={requestBill} />
          </div>
        </div>

        {/* ── Mobile/Tablet: single panel view ── */}
        <div className="flex lg:hidden flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {mobilePanel === 'tabs' && (
            <div className="w-full overflow-hidden">
              <TabList tabs={filteredTabs} selectedId={selectedId} filter={filter}
                onSelect={selectTab} onFilter={setFilter} onNew={() => setShowOpen(true)} />
            </div>
          )}
          {mobilePanel === 'menu' && (
            <div className="w-full overflow-hidden">
              <DrinkMenu tab={selectedTab} onAdd={addDrink} onRemove={removeDrink} />
            </div>
          )}
          {mobilePanel === 'order' && (
            <div className="w-full overflow-hidden">
              <OrderPanel tab={selectedTab} onDeleteLine={deleteLine}
                onHold={holdTab} onResume={resumeTab} onRequestBill={requestBill}
                onBack={() => setMobilePanel('menu')} />
            </div>
          )}
        </div>
      </div>

      {showOpen && <OpenTabModal onOpen={openTab} onClose={() => setShowOpen(false)} />}
      {billTab && (
        <BillModal tab={billTab}
          onPay={(method, discount, mpesaCode, mpesaPhone) => confirmPayment(billTab.id, method, discount, mpesaCode, mpesaPhone)}
          onClose={() => setBillTabId(null)} />
      )}
      <ToastStack toasts={toasts} dismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
    </>
  )
}
