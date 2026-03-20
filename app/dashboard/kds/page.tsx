'use client'

import { useState, useEffect } from 'react'
import {
  ChefHat, UtensilsCrossed, BookOpen, Plus, Trash2, Edit3,
  ShoppingCart, CheckCheck, Clock, Flame, Crown,
  Bell, Wifi, LayoutGrid, List, X, Check, AlertCircle,
  ArrowRight, Search, Package, Star,
  Users, Minus, StickyNote, Table
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS  — single source of truth for the green/white theme
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Greens
  g900: '#14532d',  // darkest — text on white
  g800: '#166534',
  g700: '#15803d',
  g600: '#16a34a',  // primary action
  g500: '#22c55e',  // accent / hover
  g400: '#4ade80',
  g200: '#bbf7d0',
  g100: '#dcfce7',
  g50:  '#f0fdf4',  // lightest green tint

  // Neutrals (light mode)
  white:  '#ffffff',
  n50:    '#f9fafb',
  n100:   '#f3f4f6',
  n200:   '#e5e7eb',
  n300:   '#d1d5db',
  n400:   '#9ca3af',
  n500:   '#6b7280',
  n600:   '#4b5563',
  n700:   '#374151',
  n800:   '#1f2937',
  n900:   '#111827',

  // Semantic
  red:    '#ef4444',
  redBg:  '#fef2f2',
  redBdr: '#fecaca',
  amber:  '#f59e0b',
  amberBg:'#fffbeb',
  blue:   '#3b82f6',
  blueBg: '#eff6ff',

  // Typography
  textPrimary:   '#111827',
  textSecondary: '#050d1bff',
  textMuted:     '#070b13ff',
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'menu' | 'order' | 'kitchen' | 'tables'
type OrderStatus = 'pending' | 'acknowledged' | 'preparing' | 'ready' | 'collected'
type Priority = 'normal' | 'rush' | 'vip'
type Category = 'starter' | 'main' | 'side' | 'dessert' | 'drink'

interface MenuItem {
  id: string; name: string; description: string; price: number
  category: Category; prepTime: number; available: boolean; popular?: boolean; emoji: string
}
interface CartItem { menuItem: MenuItem; quantity: number; notes: string }
interface KitchenOrderItem { id: string; name: string; quantity: number; notes?: string; category: Category; prepTime: number }
interface KitchenOrder {
  id: string; orderNumber: string; tableNumber: string; waiterName: string; coverCount: number
  items: KitchenOrderItem[]; status: OrderStatus; priority: Priority; createdAt: Date
  acknowledgedAt?: Date; preparingAt?: Date; readyAt?: Date; collectedAt?: Date; specialInstructions?: string
}
interface Toast { id: string; message: string; type: 'success' | 'info' | 'warning' }

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY META — updated for light mode legibility
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_META: Record<Category, { label: string; color: string; bg: string; border: string; text: string }> = {
  starter: { label: 'Starters', color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd', text: '#0369a1' },
  main:    { label: 'Mains',    color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  side:    { label: 'Sides',    color: '#65a30d', bg: '#f7fee7', border: '#d9f99d', text: '#4d7c0f' },
  dessert: { label: 'Desserts', color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' },
  drink:   { label: 'Drinks',   color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_MENU: MenuItem[] = [
  { id: 'm1',  name: 'Bruschetta',         description: 'Toasted bread with tomato, garlic & basil',     price: 8.50,  category: 'starter', prepTime: 6,  available: true,  popular: true,  emoji: '' },
  { id: 'm2',  name: 'Caesar Salad',       description: 'Romaine, croutons, parmesan & caesar dressing', price: 10.00, category: 'starter', prepTime: 7,  available: true,  popular: false, emoji: '' },
  { id: 'm3',  name: 'Soup of the Day',    description: "Ask your waiter for today's soup",              price: 7.50,  category: 'starter', prepTime: 5,  available: true,  popular: false, emoji: '' },
  { id: 'm4',  name: 'Grilled Salmon',     description: 'Atlantic salmon, lemon butter, seasonal veg',  price: 24.00, category: 'main',    prepTime: 16, available: true,  popular: true,  emoji: '' },
  { id: 'm5',  name: 'Beef Burger',        description: '180g beef patty, brioche bun, house sauce',    price: 18.00, category: 'main',    prepTime: 14, available: true,  popular: true,  emoji: '' },
  { id: 'm6',  name: 'Pasta Carbonara',    description: 'Spaghetti, guanciale, egg yolk, pecorino',     price: 16.50, category: 'main',    prepTime: 12, available: true,  popular: false, emoji: '' },
  { id: 'm7',  name: 'Margherita Pizza',   description: 'San Marzano tomato, fior di latte mozzarella', price: 15.00, category: 'main',    prepTime: 14, available: true,  popular: false, emoji: '' },
  { id: 'm8',  name: 'Sweet Potato Fries', description: 'Crispy fries with chipotle aioli',             price: 6.00,  category: 'side',    prepTime: 8,  available: true,  popular: false, emoji: '' },
  { id: 'm9',  name: 'Garlic Bread',       description: 'Rustic bread with herb butter',                price: 4.50,  category: 'side',    prepTime: 5,  available: true,  popular: false, emoji: '' },
  { id: 'm10', name: 'Tiramisu',           description: 'Espresso-soaked ladyfingers, mascarpone',      price: 9.00,  category: 'dessert', prepTime: 3,  available: true,  popular: true,  emoji: '' },
  { id: 'm11', name: 'Lava Cake',          description: 'Warm chocolate cake with vanilla ice cream',   price: 10.00, category: 'dessert', prepTime: 12, available: true,  popular: false, emoji: '' },
  { id: 'm12', name: 'Sparkling Water',    description: '750ml bottle',                                 price: 3.50,  category: 'drink',   prepTime: 1,  available: true,  popular: false, emoji: '' },
  { id: 'm13', name: 'House Red Wine',     description: "Glass of the day's selected red",              price: 8.00,  category: 'drink',   prepTime: 1,  available: true,  popular: false, emoji: '' },
  { id: 'm14', name: 'Fresh Lemonade',     description: 'House-made with mint & ginger',                price: 5.00,  category: 'drink',   prepTime: 3,  available: true,  popular: true,  emoji: '' },
]

const SEED_KITCHEN_ORDERS: KitchenOrder[] = [
  {
    id: 'ko1', orderNumber: '#041', tableNumber: '3', waiterName: 'Alice', coverCount: 2,
    status: 'preparing', priority: 'normal',
    createdAt: new Date(Date.now() - 11 * 60000),
    acknowledgedAt: new Date(Date.now() - 10 * 60000),
    preparingAt: new Date(Date.now() - 9 * 60000),
    items: [
      { id: 'ki1', name: 'Beef Burger',        quantity: 1, notes: 'well done, no onion', category: 'main',  prepTime: 14 },
      { id: 'ki2', name: 'Sweet Potato Fries', quantity: 1, category: 'side',  prepTime: 8 },
      { id: 'ki3', name: 'Fresh Lemonade',     quantity: 2, category: 'drink', prepTime: 3 },
    ],
  },
  {
    id: 'ko2', orderNumber: '#042', tableNumber: '7', waiterName: 'Bob', coverCount: 4,
    status: 'ready', priority: 'rush',
    createdAt: new Date(Date.now() - 22 * 60000),
    acknowledgedAt: new Date(Date.now() - 21 * 60000),
    preparingAt: new Date(Date.now() - 19 * 60000),
    readyAt: new Date(Date.now() - 2 * 60000),
    items: [
      { id: 'ki4', name: 'Grilled Salmon', quantity: 2, notes: 'no lemon', category: 'main',    prepTime: 16 },
      { id: 'ki5', name: 'Caesar Salad',   quantity: 2,                    category: 'starter', prepTime: 7  },
    ],
  },
  {
    id: 'ko3', orderNumber: '#043', tableNumber: '11', waiterName: 'Carol', coverCount: 1,
    status: 'pending', priority: 'vip',
    createdAt: new Date(Date.now() - 90000),
    items: [
      { id: 'ki6', name: 'Pasta Carbonara', quantity: 1, notes: 'extra parmesan', category: 'main',  prepTime: 12 },
      { id: 'ki7', name: 'Garlic Bread',    quantity: 1,                           category: 'side',  prepTime: 5  },
      { id: 'ki8', name: 'House Red Wine',  quantity: 1,                           category: 'drink', prepTime: 1  },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function elapsed(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
function fmtTime(d: Date) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
function fmtPrice(n: number) { return `KSh ${n.toFixed(2)}` }
function uid() { return `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLE OBJECTS
// ─────────────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  background: T.white,
  border: `1.5px solid ${T.n200}`,
  borderRadius: 8,
  color: T.textPrimary,
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  outline: 'none',
  width: '100%',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: T.n500,
  letterSpacing: '0.05em',
  marginBottom: 5,
  textTransform: 'uppercase' as const,
}
const cardStyle: React.CSSProperties = {
  background: T.white,
  border: `1.5px solid ${T.n200}`,
  borderRadius: 14,
  overflow: 'hidden',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 9,
  border: 'none',
  background: `linear-gradient(135deg, ${T.g600}, ${T.g700})`,
  color: T.white,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  boxShadow: `0 2px 8px ${T.g600}33`,
  transition: 'all 0.15s',
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE TIMER
// ─────────────────────────────────────────────────────────────────────────────
function LiveTimer({ date, style }: { date: Date; style?: React.CSSProperties }) {
  const [t, setT] = useState(elapsed(date))
  useEffect(() => {
    const iv = setInterval(() => setT(elapsed(date)), 1000)
    return () => clearInterval(iv)
  }, [date])
  return <span style={style}>{t}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST STACK
// ─────────────────────────────────────────────────────────────────────────────
function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', borderRadius: 10,
          background: T.white,
          borderLeft: `3px solid ${t.type === 'success' ? T.g600 : t.type === 'warning' ? T.amber : T.blue}`,
          border: `1px solid ${t.type === 'success' ? T.g200 : t.type === 'warning' ? '#fde68a' : '#bfdbfe'}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          animation: 'toastIn 0.3s ease',
          minWidth: 240, maxWidth: 320,
          color: T.textPrimary, fontSize: 13, fontFamily: 'var(--font-body)',
        }}>
          {t.type === 'success' && <Check size={15} style={{ color: T.g600, flexShrink: 0 }} />}
          {t.type === 'warning' && <AlertCircle size={15} style={{ color: T.amber, flexShrink: 0 }} />}
          {t.type === 'info'    && <Bell size={15} style={{ color: T.blue, flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.n400 }}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [{ n: 1, label: 'Details' }, { n: 2, label: 'Select Items' }, { n: 3, label: 'Confirm' }]
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)',
              background: current > s.n ? T.g600 : current === s.n ? T.g600 : T.n100,
              color: current >= s.n ? T.white : T.n400,
              border: current === s.n ? `2.5px solid ${T.g400}` : `2px solid transparent`,
              boxShadow: current === s.n ? `0 0 0 3px ${T.g100}` : 'none',
            }}>
              {current > s.n ? <Check size={13} /> : s.n}
            </div>
            <span style={{ fontSize: 10, color: current === s.n ? T.g700 : T.n400, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: current > s.n ? T.g500 : T.n200, margin: '0 6px', marginBottom: 16, borderRadius: 2 }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 1: MENU MANAGEMENT (Owner) ───────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function MenuManagementTab({ menu, setMenu, toast }: {
  menu: MenuItem[]
  setMenu: React.Dispatch<React.SetStateAction<MenuItem[]>>
  toast: (msg: string, type?: Toast['type']) => void
}) {
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)

  const emptyForm: Omit<MenuItem, 'id'> = { name: '', description: '', price: 0, category: 'main', prepTime: 10, available: true, popular: false, emoji: '🍽️' }
  const [form, setForm] = useState<Omit<MenuItem, 'id'>>(emptyForm)

  function openAdd()           { setForm(emptyForm); setEditItem(null); setShowForm(true) }
  function openEdit(i: MenuItem){ setForm({ ...i }); setEditItem(i);    setShowForm(true) }
  function closeForm()         { setShowForm(false); setEditItem(null) }

  function saveItem() {
    if (!form.name.trim())    { toast('Item name is required', 'warning'); return }
    if (form.price <= 0)      { toast('Price must be greater than 0', 'warning'); return }
    if (editItem) { setMenu(p => p.map(m => m.id === editItem.id ? { ...form, id: editItem.id } : m)); toast(`"${form.name}" updated`, 'success') }
    else          { setMenu(p => [...p, { ...form, id: uid() }]); toast(`"${form.name}" added`, 'success') }
    closeForm()
  }

  const displayed = menu.filter(m =>
    (activeCategory === 'all' || m.category === activeCategory) &&
    (m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase()))
  )
  const categories: (Category | 'all')[] = ['all', 'starter', 'main', 'side', 'dessert', 'drink']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.n400 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items…"
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <button onClick={openAdd} style={btnPrimary}>
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {categories.map(cat => {
          const count = cat === 'all' ? menu.length : menu.filter(m => m.category === cat).length
          const meta = cat === 'all' ? null : CATEGORY_META[cat]
          const active = activeCategory === cat
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              border: active ? `1.5px solid ${meta?.color ?? T.g600}` : `1.5px solid ${T.n200}`,
              background: active ? (meta?.bg ?? T.g100) : T.white,
              color: active ? (meta?.text ?? T.g700) : T.n500,
              transition: 'all 0.15s',
            }}>
              {cat === 'all' ? 'All Items' : CATEGORY_META[cat].label} ({count})
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {displayed.map(item => {
          const meta = CATEGORY_META[item.category]
          return (
            <div key={item.id} style={{
              ...cardStyle,
              opacity: item.available ? 1 : 0.6,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column',
              transition: 'box-shadow 0.15s',
            }}>
              <div style={{ padding: '13px 14px 10px', display: 'flex', gap: 10 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                  background: meta.bg, border: `1.5px solid ${meta.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {item.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>{item.name}</span>
                    {item.popular && <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />}
                  </div>
                  <p style={{ fontSize: 11, color: T.n500, marginTop: 2, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.description}
                  </p>
                </div>
              </div>
              <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: meta.bg, color: meta.text, border: `1px solid ${meta.border}`, borderRadius: 4, padding: '2px 7px', fontSize: 9, fontWeight: 800, letterSpacing: '0.05em' }}>
                  {CATEGORY_META[item.category].label.toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: T.n400, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={10} /> ~{item.prepTime}m
                </span>
                <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 15, color: T.g700, fontFamily: 'var(--font-mono)' }}>
                  {fmtPrice(item.price)}
                </span>
              </div>
              <div style={{ padding: '8px 14px 12px', borderTop: `1px solid ${T.n100}`, display: 'flex', gap: 6 }}>
                <button onClick={() => setMenu(p => p.map(m => m.id === item.id ? { ...m, available: !m.available } : m))} style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: item.available ? T.g100 : T.redBg,
                  color: item.available ? T.g700 : T.red,
                  fontSize: 11, fontWeight: 700,
                }}>
                  {item.available ? '● Available' : '○ Unavailable'}
                </button>
                <button onClick={() => openEdit(item)} style={{
                  padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.n200}`,
                  background: T.white, color: T.n600, cursor: 'pointer',
                }}>
                  <Edit3 size={13} />
                </button>
                <button onClick={() => { setMenu(p => p.filter(m => m.id !== item.id)); toast(`"${item.name}" removed`, 'info') }} style={{
                  padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.redBdr}`,
                  background: T.redBg, color: T.red, cursor: 'pointer',
                }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: T.n400 }}>
          <Package size={40} style={{ margin: '0 auto 12px', color: T.n300 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: T.n500 }}>No items found</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Try a different filter or add a new item.</p>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={closeForm}>
          <div style={{
            background: T.white, borderRadius: 16, width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto', padding: 24,
            boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: T.g800, fontStyle: 'italic' }}>
                {editItem ? 'Edit Item' : 'Add Menu Item'}
              </h3>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.n400 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Emoji</label>
                  <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    style={{ ...inputStyle, width: 60, textAlign: 'center', fontSize: 20 }} maxLength={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Item Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Grilled Salmon" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description…" rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))} style={inputStyle}>
                    {(['starter','main','side','dessert','drink'] as Category[]).map(c => (
                      <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Price (KSh)</label>
                  <input type="number" value={form.price} min={0} step={0.5}
                    onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Prep (min)</label>
                  <input type="number" value={form.prepTime} min={1}
                    onChange={e => setForm(f => ({ ...f, prepTime: parseInt(e.target.value) || 5 }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: 'available', label: 'Available' }, { key: 'popular', label: '⭐ Popular' }].map(tog => (
                  <button key={tog.key} onClick={() => setForm(f => ({ ...f, [tog.key]: !f[tog.key as keyof typeof f] }))} style={{
                    flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                    border: form[tog.key as keyof typeof form] ? `1.5px solid ${T.g500}` : `1.5px solid ${T.n200}`,
                    background: form[tog.key as keyof typeof form] ? T.g100 : T.white,
                    color: form[tog.key as keyof typeof form] ? T.g700 : T.n500,
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {tog.label}
                  </button>
                ))}
              </div>
              <button onClick={saveItem} style={{ ...btnPrimary, padding: '12px' }}>
                {editItem ? 'Save Changes' : 'Add to Menu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 2: TAKE ORDER (Waiter) ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function TakeOrderTab({ menu, onSendToKitchen, toast }: {
  menu: MenuItem[]
  onSendToKitchen: (o: Omit<KitchenOrder, 'id' | 'orderNumber'>) => void
  toast: (msg: string, type?: Toast['type']) => void
}) {
  const [step, setStep] = useState<'details' | 'menu' | 'confirm'>('details')
  const [tableNumber, setTableNumber] = useState('')
  const [waiterName, setWaiterName] = useState('')
  const [coverCount, setCoverCount] = useState(2)
  const [priority, setPriority] = useState<Priority>('normal')
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')
  const [noteTarget, setNoteTarget] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')

  const availableMenu = menu.filter(m => m.available)
  const displayed = availableMenu.filter(m =>
    (activeCategory === 'all' || m.category === activeCategory) &&
    m.name.toLowerCase().includes(search.toLowerCase())
  )
  const cartTotal = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  function addToCart(item: MenuItem) {
    setCart(p => {
      const ex = p.find(c => c.menuItem.id === item.id)
      return ex ? p.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
                : [...p, { menuItem: item, quantity: 1, notes: '' }]
    })
  }
  function removeFromCart(id: string) {
    setCart(p => {
      const ex = p.find(c => c.menuItem.id === id)
      if (!ex) return p
      return ex.quantity <= 1 ? p.filter(c => c.menuItem.id !== id) : p.map(c => c.menuItem.id === id ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }
  function cartQty(id: string) { return cart.find(c => c.menuItem.id === id)?.quantity ?? 0 }

  function goToMenu() {
    if (!tableNumber.trim()) { toast('Please enter a table number', 'warning'); return }
    if (!waiterName.trim())  { toast('Please enter your name', 'warning'); return }
    setStep('menu')
  }
  function goToConfirm() {
    if (cart.length === 0) { toast('Add at least one item', 'warning'); return }
    setStep('confirm')
  }
  function sendOrder() {
    onSendToKitchen({
      tableNumber, waiterName, coverCount, priority, specialInstructions,
      status: 'pending', createdAt: new Date(),
      items: cart.map(c => ({ id: uid(), name: c.menuItem.name, quantity: c.quantity, notes: c.notes || undefined, category: c.menuItem.category, prepTime: c.menuItem.prepTime })),
    })
    setCart([]); setStep('details'); setTableNumber(''); setWaiterName(''); setCoverCount(2); setPriority('normal'); setSpecialInstructions('')
    toast('Order sent to kitchen!', 'success')
  }

  const categories: (Category | 'all')[] = ['all', 'starter', 'main', 'side', 'dessert', 'drink']

  // ── Step 1 ─────────────────────────────────────────────────────────────────
  if (step === 'details') return (
    <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
       
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: T.g800, fontStyle: 'italic' }}>New Order</h2>
        <p style={{ fontSize: 13, color: T.n500, marginTop: 4 }}>Enter table details to get started</p>
      </div>
      <StepIndicator current={1} />
      <div style={{ ...cardStyle, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Table Number *</label>
            <input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="e.g. 5" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Your Name *</label>
            <input value={waiterName} onChange={e => setWaiterName(e.target.value)} placeholder="Waiter name" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Number of Guests</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <button onClick={() => setCoverCount(c => Math.max(1, c - 1))} style={{
              width: 36, height: 36, borderRadius: 9, border: `1.5px solid ${T.n200}`,
              background: T.white, color: T.n600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Minus size={14} /></button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: T.g700, minWidth: 30, textAlign: 'center' }}>{coverCount}</span>
            <button onClick={() => setCoverCount(c => c + 1)} style={{
              width: 36, height: 36, borderRadius: 9, border: 'none',
              background: T.g100, color: T.g700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Plus size={14} /></button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Priority</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {([
              { v: 'normal', label: 'Normal', ac: T.g600, bg: T.g100 },
              { v: 'rush',   label: ' Rush',ac: T.red,  bg: T.redBg },
              { v: 'vip',    label: ' VIP', ac: '#d97706', bg: '#fffbeb' },
            ] as const).map(p => (
              <button key={p.v} onClick={() => setPriority(p.v)} style={{
                flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: priority === p.v ? `1.5px solid ${p.ac}` : `1.5px solid ${T.n200}`,
                background: priority === p.v ? p.bg : T.white,
                color: priority === p.v ? p.ac : T.n500,
                transition: 'all 0.15s',
              }}>{p.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Special Instructions</label>
          <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}
            placeholder="Allergies, dietary requirements…" rows={2}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
        </div>
        <button onClick={goToMenu} style={btnPrimary}>
          Browse Menu 
        </button>
      </div>
    </div>
  )

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  if (step === 'menu') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: T.g800, fontStyle: 'italic' }}>
            Table {tableNumber} — {waiterName}
          </h2>
          <p style={{ fontSize: 12, color: T.n500, marginTop: 2 }}>
            <Users size={11} style={{ display: 'inline', marginRight: 4 }} />{coverCount} guests
            {priority !== 'normal' && <span style={{ marginLeft: 8 }}>{priority === 'rush' ? '🔥 Rush' : '👑 VIP'}</span>}
          </p>
        </div>
        <button onClick={() => setStep('details')} style={{
          padding: '6px 14px', borderRadius: 7, border: `1.5px solid ${T.n200}`,
          background: T.white, color: T.n600, cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>← Back</button>
      </div>
      <StepIndicator current={2} />
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.n400 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes…"
          style={{ ...inputStyle, paddingLeft: 36 }} />
      </div>
      {/* Category pills */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {categories.map(cat => {
          const meta = cat === 'all' ? null : CATEGORY_META[cat]
          const active = activeCategory === cat
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '5px 14px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
              border: active ? `1.5px solid ${meta?.color ?? T.g600}` : `1.5px solid ${T.n200}`,
              background: active ? (meta?.bg ?? T.g100) : T.white,
              color: active ? (meta?.text ?? T.g700) : T.n500,
              cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
            }}>
              {cat === 'all' ? 'All' : CATEGORY_META[cat].label}
            </button>
          )
        })}
      </div>
      {/* Two-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
        {/* Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(item => {
            const meta = CATEGORY_META[item.category]
            const qty = cartQty(item.id)
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: T.white,
                border: qty > 0 ? `1.5px solid ${meta.color}` : `1.5px solid ${T.n200}`,
                borderRadius: 10, padding: '10px 12px',
                boxShadow: qty > 0 ? `0 2px 8px ${meta.color}22` : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: meta.bg, border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {item.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{item.name}</span>
                    {item.popular && <Star size={10} style={{ color: '#f59e0b', fill: '#f59e0b' }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: T.n400, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Clock size={9} /> ~{item.prepTime}m
                    </span>
                    <span style={{ fontSize: 11, color: T.n400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {item.description}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: T.g700 }}>{fmtPrice(item.price)}</span>
                  {qty > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => removeFromCart(item.id)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.n200}`, background: T.white, color: T.n600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: meta.text, minWidth: 18, textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => addToCart(item)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: meta.color, color: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={12} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: T.g600, color: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {displayed.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: T.n400 }}>No items found</div>
          )}
        </div>

        {/* Cart */}
        <div style={{ position: 'sticky', top: 80, ...cardStyle, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.n100}`, display: 'flex', alignItems: 'center', gap: 8, background: T.g50 }}>
            <ShoppingCart size={15} style={{ color: T.g600 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: T.g800 }}>Order ({cartCount})</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 800, color: T.g700, fontSize: 14 }}>
              {fmtPrice(cartTotal)}
            </span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px 0' }}>
            {cart.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: T.n400, fontSize: 13 }}>
                No items yet.<br />Add from the menu.
              </div>
            ) : cart.map(c => (
              <div key={c.menuItem.id} style={{ padding: '7px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: T.textPrimary, flex: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: T.g600, marginRight: 4, fontWeight: 700 }}>×{c.quantity}</span>
                    {c.menuItem.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: T.n500 }}>{fmtPrice(c.menuItem.price * c.quantity)}</span>
                </div>
                {c.notes && (
                  <div style={{ fontSize: 11, color: '#d97706', fontStyle: 'italic', marginTop: 2, paddingLeft: 4 }}>✏ {c.notes}</div>
                )}
                <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                  <button onClick={() => { setNoteTarget(c.menuItem.id); setNoteValue(c.notes) }} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.n200}`,
                    background: T.white, color: T.n500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                  }}><StickyNote size={9} /> Note</button>
                  <button onClick={() => setCart(p => p.filter(x => x.menuItem.id !== c.menuItem.id))} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.redBdr}`,
                    background: T.redBg, color: T.red, cursor: 'pointer',
                  }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.n100}` }}>
            <button onClick={goToConfirm} disabled={cart.length === 0} style={{
              ...btnPrimary,
              width: '100%',
              opacity: cart.length > 0 ? 1 : 0.45,
              cursor: cart.length > 0 ? 'pointer' : 'default',
            }}>
              Review Order <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Note modal */}
      {noteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setNoteTarget(null)}>
          <div style={{ background: T.white, borderRadius: 14, padding: 20, width: '100%', maxWidth: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.16)' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ color: T.g800, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              Add Note — {cart.find(c => c.menuItem.id === noteTarget)?.menuItem.name}
            </h4>
            <textarea value={noteValue} onChange={e => setNoteValue(e.target.value)}
              placeholder="e.g. no onions, extra spicy…" rows={3}
              style={{ ...inputStyle, resize: 'none' }} autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setNoteTarget(null)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${T.n200}`, background: T.white, color: T.n600, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => { setCart(p => p.map(c => c.menuItem.id === noteTarget ? { ...c, notes: noteValue } : c)); setNoteTarget(null); setNoteValue('') }} style={{ ...btnPrimary, flex: 1 }}>Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Step 3 ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setStep('menu')} style={{ padding: '6px 14px', borderRadius: 7, border: `1.5px solid ${T.n200}`, background: T.white, color: T.n600, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>← Back</button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: T.g800, fontStyle: 'italic' }}>Confirm Order</h2>
          <p style={{ fontSize: 12, color: T.n500 }}>Review before sending to kitchen</p>
        </div>
      </div>
      <StepIndicator current={3} />
      <div style={{ ...cardStyle, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        {/* Table info bar */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.n100}`, display: 'flex', gap: 20, background: T.g50 }}>
          {[
            { label: 'Table',    value: tableNumber },
            { label: 'Waiter',   value: waiterName  },
            { label: 'Guests',   value: coverCount  },
            { label: 'Priority', value: priority === 'normal' ? 'Normal' : priority === 'rush' ? '🔥 Rush' : '👑 VIP' },
          ].map(info => (
            <div key={info.label} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: T.n400, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 3, textTransform: 'uppercase' }}>{info.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.g800 }}>{info.value}</div>
            </div>
          ))}
        </div>
        {/* Items */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cart.map((c, i) => {
            const meta = CATEGORY_META[c.menuItem.category]
            return (
              <div key={c.menuItem.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{c.menuItem.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: meta.text, marginRight: 5, fontWeight: 700 }}>×{c.quantity}</span>
                      {c.menuItem.name}
                    </span>
                    {c.notes && <span style={{ display: 'block', fontSize: 11, color: '#d97706', fontStyle: 'italic', marginTop: 1 }}>✏ {c.notes}</span>}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: T.n600 }}>{fmtPrice(c.menuItem.price * c.quantity)}</span>
                </div>
                {i < cart.length - 1 && <div style={{ marginTop: 10, borderBottom: `1px solid ${T.n100}` }} />}
              </div>
            )
          })}
        </div>
        {/* Total */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.n100}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.g50 }}>
          <span style={{ fontSize: 13, color: T.n500, fontWeight: 700 }}>TOTAL</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: T.g700 }}>{fmtPrice(cartTotal)}</span>
        </div>
        {specialInstructions && (
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.n100}`, background: '#fffbeb' }}>
            <span style={{ fontSize: 11, color: '#92400e', fontStyle: 'italic' }}>📌 {specialInstructions}</span>
          </div>
        )}
      </div>
      <button onClick={sendOrder} style={{
        ...btnPrimary,
        padding: '14px',
        fontSize: 15,
        fontWeight: 800,
        background: `linear-gradient(135deg, ${T.g600}, ${T.g800})`,
        boxShadow: `0 4px 20px ${T.g600}44`,
        letterSpacing: '0.01em',
      }}>
         Send Order to Kitchen
      </button>
    </div>
  )
}


function KitchenDisplayTab({ orders, onUpdateStatus }: {
  orders: KitchenOrder[]
  onUpdateStatus: (id: string, status: OrderStatus) => void
}) {
  const [viewMode, setViewMode] = useState<'chef' | 'waiter'>('chef')
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const displayed = orders.filter(o => {
    if (viewMode === 'chef'   && !['pending','acknowledged','preparing','ready'].includes(o.status)) return false
    if (viewMode === 'waiter' && !['preparing','ready','collected'].includes(o.status))              return false
    return filter === 'all' || o.status === filter
  }).sort((a, b) => {
    const pw: Record<Priority, number> = { vip: 0, rush: 1, normal: 2 }
    const p = pw[a.priority] - pw[b.priority]
    return p !== 0 ? p : a.createdAt.getTime() - b.createdAt.getTime()
  })

  const counts = {
    pending:      orders.filter(o => o.status === 'pending').length,
    acknowledged: orders.filter(o => o.status === 'acknowledged').length,
    preparing:    orders.filter(o => o.status === 'preparing').length,
    ready:        orders.filter(o => o.status === 'ready').length,
    collected:    orders.filter(o => o.status === 'collected').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', background: T.n100, border: `1px solid ${T.n200}`, borderRadius: 10, padding: 4, gap: 4 }}>
          {([
            { v: 'chef',   label: 'Chef View',   color: T.g600   },
            { v: 'waiter', label: 'Waiter View',  color: '#0284c7' },
          ] as const).map(m => (
            <button key={m.v} onClick={() => { setViewMode(m.v); setFilter('all') }} style={{
              padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: viewMode === m.v ? m.color : 'transparent',
              color: viewMode === m.v ? T.white : T.n500,
              fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              boxShadow: viewMode === m.v ? `0 2px 10px ${m.color}44` : 'none',
            }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: T.n100, border: `1px solid ${T.n200}`, borderRadius: 9, padding: 4, gap: 3 }}>
            {[{ v: 'grid', icon: <LayoutGrid size={15} /> }, { v: 'list', icon: <List size={15} /> }].map(l => (
              <button key={l.v} onClick={() => setLayout(l.v as 'grid' | 'list')} style={{
                padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: layout === l.v ? T.white : 'transparent',
                color: layout === l.v ? T.g700 : T.n400,
                boxShadow: layout === l.v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>{l.icon}</button>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: T.n500, letterSpacing: '0.04em' }}>
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
        {[
          { label: 'Pending',   value: counts.pending,   color: T.blue,   bg: T.blueBg  },
          { label: 'Preparing', value: counts.preparing, color: '#ea580c', bg: '#fff7ed' },
          { label: 'Ready',     value: counts.ready,     color: T.g600,   bg: T.g50     },
          { label: 'Collected', value: counts.collected, color: T.n400,   bg: T.n50     },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1.5px solid ${s.color}33`, borderRadius: 12,
            padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
            minWidth: 110,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 11, color: s.color, fontWeight: 700, letterSpacing: '0.06em' }}>{s.label.toUpperCase()}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { v: 'all',          label: 'All',          color: T.n600,    bg: T.n100   },
          { v: 'pending',      label: 'New',          color: T.blue,    bg: T.blueBg },
          { v: 'acknowledged', label: 'Acknowledged', color: '#7c3aed', bg: '#f5f3ff' },
          { v: 'preparing',    label: 'Preparing',    color: '#ea580c', bg: '#fff7ed' },
          { v: 'ready',        label: 'Ready',        color: T.g700,    bg: T.g50    },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v as OrderStatus | 'all')} style={{
            padding: '8px 20px', borderRadius: 24, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: filter === f.v ? `1.5px solid ${f.color}` : `1.5px solid ${T.n200}`,
            background: filter === f.v ? f.bg : T.white,
            color: filter === f.v ? f.color : T.n500,
            transition: 'all 0.15s',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Context hint */}
      <div style={{
        padding: '12px 18px', borderRadius: 10, fontSize: 13,
        background: viewMode === 'chef' ? T.g50 : T.blueBg,
        border: viewMode === 'chef' ? `1px solid ${T.g200}` : '1px solid #bfdbfe',
        color: viewMode === 'chef' ? T.g700 : '#1e40af',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {viewMode === 'chef'
          ? <><ChefHat size={14} /> Chef: Acknowledge → Start Preparing → Mark Ready to notify waiters</>
          : <><Bell size={14} /> Waiter: Monitor progress — collect orders marked Ready from the kitchen</>}
      </div>

      {/* Orders */}
      {displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: T.n400 }}>
          <UtensilsCrossed size={48} style={{ margin: '0 auto 16px', color: T.n300 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: T.n500 }}>All clear</p>
          <p style={{ fontSize: 14, marginTop: 6 }}>No orders in this view right now.</p>
        </div>
      ) : (
        <div style={{
          display: layout === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: layout === 'grid' ? 'repeat(auto-fill, minmax(340px, 1fr))' : undefined,
          flexDirection: layout === 'list' ? 'column' : undefined,
          gap: 20,
        }}>
          {displayed.map((order, i) => (
            <KitchenOrderCard key={order.id} order={order} viewMode={viewMode} onUpdate={onUpdateStatus} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KITCHEN ORDER CARD
// ─────────────────────────────────────────────────────────────────────────────
function KitchenOrderCard({ order, viewMode, onUpdate, index }: {
  order: KitchenOrder; viewMode: 'chef' | 'waiter'
  onUpdate: (id: string, status: OrderStatus) => void; index: number
}) {
  const elapsedMins = Math.floor((Date.now() - order.createdAt.getTime()) / 60000)
  const urgency = order.priority === 'rush' ? (elapsedMins > 5 ? 'critical' : 'warning')
    : elapsedMins > 20 ? 'critical' : elapsedMins > 12 ? 'warning' : 'normal'

  const borderColor =
    urgency === 'critical' ? T.red :
    urgency === 'warning'  ? T.amber :
    order.status === 'ready'     ? T.g600 :
    order.status === 'preparing' ? '#ea580c' :
    order.status === 'pending'   ? T.blue : T.n200

  const headerBg =
    urgency === 'critical' ? T.redBg :
    urgency === 'warning'  ? T.amberBg :
    order.status === 'ready' ? T.g50 : T.n50

  const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; border: string }> = {
    pending:      { label: 'NEW',       color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
    acknowledged: { label: 'SEEN',      color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
    preparing:    { label: 'COOKING',   color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
    ready:        { label: ' READY',   color: T.g700,   bg: T.g100,   border: T.g200    },
    collected:    { label: 'DONE',      color: T.n500,   bg: T.n100,   border: T.n200    },
  }
  const sc = statusConfig[order.status]

  return (
    <div style={{
      background: T.white,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: urgency === 'critical' ? `0 4px 20px ${T.red}22` : urgency === 'warning' ? `0 4px 16px ${T.amber}22` : '0 2px 8px rgba(0,0,0,0.07)',
      animation: `cardIn 0.3s ease ${index * 0.05}s both`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', background: headerBg, borderBottom: `1px solid ${borderColor}44` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: T.textPrimary }}>{order.orderNumber}</span>
              {order.priority === 'rush' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, background: T.redBg, color: T.red, border: `1px solid ${T.redBdr}`, letterSpacing: '0.05em' }}>
                  RUSH
                </span>
              )}
              {order.priority === 'vip' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', letterSpacing: '0.05em' }}>
                 
                </span>
              )}
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                {sc.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: T.n500 }}>
              <span>Table {order.tableNumber}</span>
              <span>·</span><span>{order.waiterName}</span>
              <span>·</span><span><Users size={10} style={{ display: 'inline', marginRight: 2 }} />{order.coverCount}</span>
            </div>
          </div>
          {/* <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <LiveTimer date={order.createdAt} style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              color: urgency === 'critical' ? T.red : urgency === 'warning' ? T.amber : T.n400,
            }} />
            {urgency === 'critical' && <div style={{ fontSize: 9, color: T.red, fontWeight: 700, marginTop: 2 }}>⚠ OVERDUE</div>}
          </div> */}
        </div>
      </div>

      {/* Items */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {order.items.map(item => {
          const meta = CATEGORY_META[item.category]
          return (
            <div key={item.id} style={{ display: 'flex', gap: 8, padding: '9px 12px', borderRadius: 7, background: T.n50, border: `1px solid ${T.n100}`, alignItems: 'flex-start' }}>
              <span style={{ background: meta.bg, color: meta.text, border: `1px solid ${meta.border}`, borderRadius: 3, padding: '1px 5px', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', marginTop: 1, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                {meta.label.slice(0,3).toUpperCase()}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: meta.text, marginRight: 4 }}>×{item.quantity}</span>
                  {item.name}
                </span>
                {item.notes && <span style={{ display: 'block', fontSize: 12, color: '#d97706', fontStyle: 'italic', marginTop: 2 }}>✏ {item.notes}</span>}
              </div>
            </div>
          )
        })}
        {order.specialInstructions && (
          <div style={{ marginTop: 2, padding: '5px 8px', borderRadius: 6, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 11, color: '#92400e', fontStyle: 'italic' }}>
             {order.specialInstructions}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.n100}`, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: T.n400 }}>
        <span>🕐 {fmtTime(order.createdAt)}</span>
        {order.acknowledgedAt && <span>→  {fmtTime(order.acknowledgedAt)}</span>}
        {order.preparingAt    && <span>→  {fmtTime(order.preparingAt)}</span>}
        {order.readyAt        && <span>→  {fmtTime(order.readyAt)}</span>}
      </div>

      {/* Action */}
      <div style={{ padding: '14px 16px', borderTop: `1px solid ${T.n100}` }}>
        {viewMode === 'chef' && order.status === 'pending' && (
          <ActionBtn onClick={() => onUpdate(order.id, 'acknowledged')} bg={`linear-gradient(135deg,#6d28d9,#5b21b6)`} label="Acknowledge Order" icon={<Check size={14} />} />
        )}
        {viewMode === 'chef' && order.status === 'acknowledged' && (
          <ActionBtn onClick={() => onUpdate(order.id, 'preparing')} bg={`linear-gradient(135deg,#ea580c,#c2410c)`} label="Start Preparing" icon={<ChefHat size={14} />} />
        )}
        {viewMode === 'chef' && order.status === 'preparing' && (
          <ActionBtn onClick={() => onUpdate(order.id, 'ready')} bg={`linear-gradient(135deg,${T.g600},${T.g800})`} label="Mark Ready — Notify Waiter" icon={<Bell size={14} />} />
        )}
        {viewMode === 'chef' && order.status === 'ready' && (
          <div style={{ padding: '8px', borderRadius: 7, background: T.g50, border: `1px solid ${T.g200}`, fontSize: 12, color: T.g700, textAlign: 'center', fontWeight: 600 }}>
             Awaiting waiter pickup
          </div>
        )}
        {viewMode === 'waiter' && order.status === 'ready' && (
          <ActionBtn onClick={() => onUpdate(order.id, 'collected')} bg={`linear-gradient(135deg,#0284c7,#0369a1)`} label="Collect & Deliver to Table" icon={<CheckCheck size={14} />} pulse />
        )}
        {viewMode === 'waiter' && order.status !== 'ready' && (
          <div style={{ padding: '8px', borderRadius: 7, background: T.n50, border: `1px solid ${T.n200}`, fontSize: 12, color: T.n500, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Clock size={12} />
            {order.status === 'preparing' ? 'Chef is preparing…' : order.status === 'acknowledged' ? 'Chef acknowledged…' : order.status === 'collected' ? '✓ Delivered' : 'Awaiting kitchen'}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ onClick, bg, label, icon, pulse }: { onClick: () => void; bg: string; label: string; icon: React.ReactNode; pulse?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '12px', borderRadius: 8, border: 'none',
      background: bg, color: T.white, fontWeight: 700, fontSize: 14, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      fontFamily: 'var(--font-body)',
      animation: pulse ? 'collectPulse 2s ease-in-out infinite' : 'none',
      boxShadow: pulse ? '0 2px 12px rgba(2,132,199,0.35)' : '0 2px 6px rgba(0,0,0,0.12)',
    }}>
      {icon} {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB 4: TABLE MANAGEMENT (Owner) ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface TableStat {
  tableNumber: string
  totalOrders: number
  completedOrders: number
  activeOrders: number
  totalCovers: number
  totalRevenue: number
  avgPrepMins: number
  lastActivity: string | null
  waiters: string[]
}
interface StaffStat {
  waiterName: string
  ordersServed: number
  tablesCount: number
  tablesServed: string[]
  coversServed: number
  revenue: number
}
interface DayTotals {
  totalOrders: number
  completedOrders: number
  activeOrders: number
  totalRevenue: number
  totalCovers: number
  tablesUsed: number
}

function TableManagementTab() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tables, setTables]   = useState<TableStat[]>([])
  const [staff, setStaff]     = useState<StaffStat[]>([])
  const [totals, setTotals]   = useState<DayTotals | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView]       = useState<'tables' | 'staff'>('tables')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/kds/tables?date=${date}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setTables(data.tables ?? [])
      setStaff(data.staff ?? [])
      setTotals(data.totals ?? null)
    } catch {
      // silent — no toast dependency here
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [date])

  const isToday = date === new Date().toISOString().slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: T.n700 }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, width: 160 }} />
        </div>
        {isToday && (
          <button onClick={load} style={{ ...btnPrimary, padding: '8px 16px', fontSize: 13 }}>
             Refresh
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['tables', 'staff'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '8px 18px', borderRadius: 8, border: `1.5px solid ${view === v ? T.g600 : T.n200}`,
              background: view === v ? T.g600 : T.white, color: view === v ? T.white : T.n700,
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
              textTransform: 'capitalize',
            }}>{v === 'tables' ? ' Tables' : ' Staff'}</button>
          ))}
        </div>
      </div>

      {/* ── Day Summary Cards ── */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {[
            { label: 'Total Orders',     value: totals.totalOrders,     color: T.blue,  bg: T.blueBg },
            { label: 'Completed',        value: totals.completedOrders, color: T.g700,  bg: T.g50   },
            { label: 'Active Now',       value: totals.activeOrders,    color: T.amber, bg: T.amberBg },
            { label: 'Tables Used',      value: totals.tablesUsed,      color: T.n700,  bg: T.n100  },
            { label: 'Total Covers',     value: totals.totalCovers,     color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Revenue (KES)',    value: `${totals.totalRevenue.toLocaleString()}`, color: T.g800, bg: T.g100 },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1.5px solid ${s.color}22`,
              borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: T.n600, fontWeight: 600, marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.n400, fontSize: 14 }}>
          Loading…
        </div>
      )}

      {/* ── Tables View ── */}
      {!loading && view === 'tables' && (
        tables.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.n400 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}></div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No table activity for this date</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {tables.map(t => (
              <div key={t.tableNumber} style={{
                background: T.white, borderRadius: 14, border: `1.5px solid ${t.activeOrders > 0 ? T.g200 : T.n200}`,
                boxShadow: t.activeOrders > 0 ? `0 4px 16px ${T.g600}18` : '0 2px 8px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}>
                {/* Card header */}
                <div style={{
                  padding: '14px 18px',
                  background: t.activeOrders > 0 ? T.g50 : T.n50,
                  borderBottom: `1px solid ${t.activeOrders > 0 ? T.g200 : T.n200}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: t.activeOrders > 0 ? T.g600 : T.n300,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: T.white, fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-mono)',
                    }}>
                      {t.tableNumber}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: T.textPrimary }}>Table {t.tableNumber}</div>
                      <div style={{ fontSize: 11, color: T.n500 }}>{t.totalCovers} covers</div>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: t.activeOrders > 0 ? T.g100 : T.n100,
                    color: t.activeOrders > 0 ? T.g700 : T.n500,
                    border: `1px solid ${t.activeOrders > 0 ? T.g200 : T.n200}`,
                  }}>
                    {t.activeOrders > 0 ? `${t.activeOrders} active` : 'Closed'}
                  </span>
                </div>
                {/* Stats */}
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Orders',    value: t.totalOrders },
                      { label: 'Completed', value: t.completedOrders },
                      { label: 'Avg Prep',  value: t.avgPrepMins ? `${t.avgPrepMins}m` : '—' },
                      { label: 'Revenue',   value: t.totalRevenue ? `KES ${t.totalRevenue.toLocaleString()}` : '—' },
                    ].map(s => (
                      <div key={s.label} style={{ background: T.n50, borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.textPrimary, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: T.n500, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {t.waiters.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {t.waiters.map(w => (
                        <span key={w} style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: T.g50, color: T.g700, border: `1px solid ${T.g200}`,
                        }}>👤 {w}</span>
                      ))}
                    </div>
                  )}
                  {t.lastActivity && (
                    <div style={{ fontSize: 11, color: T.n400 }}>
                      Last activity: {new Date(t.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Staff View ── */}
      {!loading && view === 'staff' && (
        staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.n400 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}></div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No staff activity for this date</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              padding: '10px 18px', background: T.n100, borderRadius: 10,
              fontSize: 11, fontWeight: 800, color: T.n600, letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              <span>Employee</span>
              <span style={{ textAlign: 'center' }}>Orders</span>
              <span style={{ textAlign: 'center' }}>Tables</span>
              <span style={{ textAlign: 'center' }}>Covers</span>
              <span style={{ textAlign: 'right' }}>Revenue</span>
            </div>
            {staff.map((s, i) => (
              <div key={s.waiterName} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                padding: '14px 18px', background: T.white, borderRadius: 12,
                border: `1.5px solid ${T.n200}`, alignItems: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${T.g500}, ${T.g700})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.white, fontWeight: 800, fontSize: 14,
                  }}>
                    {s.waiterName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>{s.waiterName}</div>
                    <div style={{ fontSize: 11, color: T.n500 }}>
                      Tables: {s.tablesServed.join(', ')}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, color: T.blue, fontFamily: 'var(--font-mono)' }}>
                  {s.ordersServed}
                </div>
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, color: T.n700, fontFamily: 'var(--font-mono)' }}>
                  {s.tablesCount}
                </div>
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>
                  {s.coversServed}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: T.g700, fontFamily: 'var(--font-mono)' }}>
                  {s.revenue ? `KES ${s.revenue.toLocaleString()}` : '—'}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────
let orderCounter = 44

export default function KDSPage() {
  const [tab, setTab] = useState<Tab>('order')
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU)
  const [kitchenOrders, setKitchenOrders] = useState<KitchenOrder[]>(SEED_KITCHEN_ORDERS)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Load live orders from DB on mount + poll every 30s
  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch('/api/kds')
        if (!res.ok) return
        const { orders } = await res.json()
        setKitchenOrders(orders.map((o: KitchenOrder & { createdAt: string; acknowledgedAt?: string; preparingAt?: string; readyAt?: string; collectedAt?: string }) => ({
          ...o,
          createdAt:      new Date(o.createdAt),
          acknowledgedAt: o.acknowledgedAt ? new Date(o.acknowledgedAt) : undefined,
          preparingAt:    o.preparingAt    ? new Date(o.preparingAt)    : undefined,
          readyAt:        o.readyAt        ? new Date(o.readyAt)        : undefined,
          collectedAt:    o.collectedAt    ? new Date(o.collectedAt)    : undefined,
        })))
      } catch { /* keep seed data */ }
    }
    fetchOrders()
    const iv = setInterval(fetchOrders, 30_000)
    return () => clearInterval(iv)
  }, [])

  function toast(message: string, type: Toast['type'] = 'info') {
    const id = uid()
    setToasts(prev => [{ id, message, type }, ...prev])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  async function handleSendToKitchen(order: Omit<KitchenOrder, 'id' | 'orderNumber'>) {
    // Optimistic local update
    const tempId = uid()
    const tempOrder: KitchenOrder = { ...order, id: tempId, orderNumber: `#...` }
    setKitchenOrders(prev => [tempOrder, ...prev])
    setTab('kitchen')
    try {
      const res = await fetch('/api/kds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      })
      if (res.ok) {
        const { order: saved } = await res.json()
        setKitchenOrders(prev => prev.map(o =>
          o.id === tempId ? { ...saved, createdAt: new Date(saved.createdAt) } : o
        ))
      }
    } catch { /* keep optimistic */ }
  }

  async function handleUpdateStatus(id: string, status: OrderStatus) {
    // Optimistic local update
    setKitchenOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const now = new Date()
      const updated: KitchenOrder = { ...o, status }
      if (status === 'acknowledged') updated.acknowledgedAt = now
      if (status === 'preparing')    updated.preparingAt    = now
      if (status === 'ready')        updated.readyAt        = now
      if (status === 'collected')    updated.collectedAt    = now
      return updated
    }))
    const order = kitchenOrders.find(o => o.id === id)
    if (order) {
      const msgs: Partial<Record<OrderStatus, { msg: string; type: Toast['type'] }>> = {
        acknowledged: { msg: `${order.orderNumber} acknowledged`, type: 'info' },
        preparing:    { msg: `Chef started ${order.orderNumber}`, type: 'info' },
        ready:        { msg: ` ${order.orderNumber} READY — Table ${order.tableNumber}`, type: 'success' },
        collected:    { msg: `${order.orderNumber} collected by ${order.waiterName}`, type: 'success' },
      }
      const m = msgs[status]
      if (m) toast(m.msg, m.type)
    }
    // Persist to DB
    try {
      await fetch('/api/kds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, status }),
      })
    } catch { /* optimistic already applied */ }
  }

  const pendingCount = kitchenOrders.filter(o => o.status === 'pending').length
  const readyCount   = kitchenOrders.filter(o => o.status === 'ready').length

  const tabs = [
    { id: 'menu'    as Tab, label: 'Menu',       desc: 'Owner',        badge: 0 },
    { id: 'order'   as Tab, label: 'Take Order', desc: 'Waiter',       badge: 0 },
    { id: 'kitchen' as Tab, label: 'Kitchen',    desc: 'Chef / Waiter',badge: pendingCount + readyCount },
    { id: 'tables'  as Tab, label: 'Tables',     desc: 'Owner',        badge: 0 },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Lora:ital,wght@0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        :root {
          --font-body:    'Plus Jakarta Sans', sans-serif;
          --font-display: 'Lora', serif;
          --font-mono:    'JetBrains Mono', monospace;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes toastIn   { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes cardIn    { from { transform: translateY(8px); opacity: 0; }  to { transform: translateY(0); opacity: 1; } }
        @keyframes collectPulse {
          0%,100% { box-shadow: 0 2px 12px rgba(2,132,199,0.35), 0 0 0 0   rgba(2,132,199,0.4); }
          50%      { box-shadow: 0 2px 12px rgba(2,132,199,0.35), 0 0 0 8px rgba(2,132,199,0);   }
        }

        input:focus, textarea:focus, select:focus {
          border-color: ${T.g500} !important;
          box-shadow: 0 0 0 3px ${T.g100} !important;
          outline: none;
        }

        select option { background: ${T.white}; color: ${T.textPrimary}; }

        ::-webkit-scrollbar       { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${T.n100}; }
        ::-webkit-scrollbar-thumb { background: ${T.g200}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.g400}; }

        .kds-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.12) !important; transform: translateY(-1px); transition: all 0.15s; }
      `}</style>

      <div style={{ minHeight: '100vh', background: T.n50, fontFamily: 'var(--font-body)', color: T.textPrimary }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{
          background: T.white,
          borderBottom: `1px solid ${T.n200}`,
          padding: '0 24px',
          height: 62,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.g500}, ${T.g700})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 3px 10px ${T.g600}44`,
            }}>
              <UtensilsCrossed size={20} color={T.white} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontStyle: 'italic', color: T.g800, lineHeight: 1, fontWeight: 600 }}>
                Kitchen Order System
              </div>
              
            </div>
          </div>
          
        </header>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div style={{
          background: T.white,
          borderBottom: `1px solid ${T.n200}`,
          padding: '0 32px',
          display: 'flex', gap: 4,
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '16px 28px',
              border: 'none',
              borderBottom: tab === t.id ? `3px solid ${T.g600}` : '3px solid transparent',
              background: 'transparent',
              color: tab === t.id ? T.g700 : T.n900,
              cursor: 'pointer', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
              position: 'relative',
              minWidth: 120,
              justifyContent: 'center',
            }}>
              {t.label}
              <span style={{ fontSize: 11, color: tab === t.id ? T.g500 : T.n700, fontWeight: 700 }}>{t.desc}</span>
              {t.badge > 0 && (
                <span style={{
                  background: T.red, color: T.white, borderRadius: '50%',
                  width: 19, height: 19, fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', position: 'absolute', top: 10, right: 6,
                  boxShadow: `0 0 0 2px ${T.white}`,
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main style={{ padding: '32px', maxWidth: 1600, margin: '0 auto' }}>
          {tab === 'menu'    && <MenuManagementTab menu={menu} setMenu={setMenu} toast={toast} />}
          {tab === 'order'   && <TakeOrderTab menu={menu} onSendToKitchen={handleSendToKitchen} toast={toast} />}
          {tab === 'kitchen' && <KitchenDisplayTab orders={kitchenOrders} onUpdateStatus={handleUpdateStatus} />}
          {tab === 'tables'  && <TableManagementTab />}
        </main>

        <ToastStack toasts={toasts} dismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      </div>
    </>
  )
}