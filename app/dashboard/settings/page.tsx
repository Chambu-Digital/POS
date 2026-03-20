'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Store, Bell, CreditCard, Receipt, Shield, Save, RefreshCw,
  UtensilsCrossed, Settings2, Upload, Globe, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────
interface GeneralSettings {
  shopName: string; logo?: string; phone: string; email: string
  country: string; address: string; businessType: string; kraPin: string
  currency: string; timezone: string; receiptFooter: string
}
interface FeaturesSettings {
  taxEnabled: boolean; taxRate: number
  termsEnabled: boolean; termsText: string
  discountsEnabled: boolean
  kdsEnabled: boolean; kdsRestaurantName: string; kdsTableCount: number
  shiftsEnabled: boolean
  barEnabled: boolean
}
interface NotificationSettings {
  emailNotifications: boolean; smsNotifications: boolean
  lowStockAlerts: boolean; dailySalesReport: boolean; newOrderNotification: boolean
}
interface PaymentSettings {
  enableCash: boolean; enableCard: boolean; enableMpesa: boolean
  mpesaPaybill: string; mpesaAccountNumber: string
}
interface ReceiptSettings {
  showLogo: boolean; showTaxId: boolean; showAddress: boolean; showPhone: boolean
  customMessage: string; paperSize: 'A4' | '80mm'
}

type NavKey = 'general' | 'payment' | 'notifications' | 'receipt' | 'features' | 'security'

const NAV: { key: NavKey; label: string; desc: string; icon: React.ElementType }[] = [
  { key: 'general',       label: 'General',       desc: 'Store info & branding',  icon: Settings2       },
  { key: 'payment',       label: 'Payments',      desc: 'Methods & tax',          icon: CreditCard      },
  { key: 'notifications', label: 'Notifications', desc: 'Alerts & reports',       icon: Bell            },
  { key: 'receipt',       label: 'Receipt',       desc: 'Print & layout',         icon: Receipt         },
  // { key: 'features',      label: 'Features',      desc: 'KDS, shifts & more',     icon: UtensilsCrossed },
  { key: 'security',      label: 'Security',      desc: 'Password & sessions',    icon: Shield          },
]

// ── Reusable row: label + description on left, control on right ──────────────
function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 py-5 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="flex items-start">{children}</div>
    </div>
  )
}

// ── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────
function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="px-6">{children}</div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [dirty, setDirty]           = useState(false)
  const [activeNav, setActiveNav]   = useState<NavKey>('general')
  const fileRef = useRef<HTMLInputElement>(null)

  const [general, setGeneral] = useState<GeneralSettings>({
    shopName: '', logo: '', phone: '', email: '', country: '',
    address: '', businessType: '', kraPin: '',
    currency: 'KES', timezone: 'Africa/Nairobi',
    receiptFooter: 'Thank you for your business!',
  })
  const [features, setFeatures] = useState<FeaturesSettings>({
    taxEnabled: true, taxRate: 16,
    termsEnabled: false, termsText: '',
    discountsEnabled: true,
    kdsEnabled: false, kdsRestaurantName: '', kdsTableCount: 10,
    shiftsEnabled: false,
    barEnabled: false,
  })
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true, smsNotifications: false,
    lowStockAlerts: true, dailySalesReport: false, newOrderNotification: true,
  })
  const [payment, setPayment] = useState<PaymentSettings>({
    enableCash: true, enableCard: false, enableMpesa: true,
    mpesaPaybill: '', mpesaAccountNumber: '',
  })
  const [receipt, setReceipt] = useState<ReceiptSettings>({
    showLogo: true, showTaxId: true, showAddress: true, showPhone: true,
    customMessage: 'Thank You For Shopping With Us!', paperSize: 'A4',
  })

  // Refs to always have latest state for autoSave
  const generalRef       = useRef(general)
  const featuresRef      = useRef(features)
  const notificationsRef = useRef(notifications)
  const paymentRef       = useRef(payment)
  const receiptRef       = useRef(receipt)
  useEffect(() => { generalRef.current = general },             [general])
  useEffect(() => { featuresRef.current = features },           [features])
  useEffect(() => { notificationsRef.current = notifications }, [notifications])
  useEffect(() => { paymentRef.current = payment },             [payment])
  useEffect(() => { receiptRef.current = receipt },             [receipt])

  // Helpers that also mark form dirty
  const upGeneral       = (v: Partial<GeneralSettings>)       => { setGeneral(p => ({ ...p, ...v }));       setDirty(true) }
  const upFeatures      = (v: Partial<FeaturesSettings>)      => { setFeatures(p => ({ ...p, ...v }));      setDirty(true) }
  const upNotifications = (v: Partial<NotificationSettings>)  => { setNotifications(p => ({ ...p, ...v })); setDirty(true) }
  const upPayment       = (v: Partial<PaymentSettings>)       => { setPayment(p => ({ ...p, ...v }));       setDirty(true) }
  const upReceipt       = (v: Partial<ReceiptSettings>)       => { setReceipt(p => ({ ...p, ...v }));       setDirty(true) }

  // Auto-save: immediately persist a toggle change without requiring Save button
  async function autoSave(patch: {
    general?: Partial<GeneralSettings>
    features?: Partial<FeaturesSettings>
    notifications?: Partial<NotificationSettings>
    payment?: Partial<PaymentSettings>
    receipt?: Partial<ReceiptSettings>
  }) {
    setAutoSaving(true)
    try {
      const body = {
        general:       { ...generalRef.current,       ...(patch.general       || {}) },
        features:      { ...featuresRef.current,      ...(patch.features      || {}) },
        notifications: { ...notificationsRef.current, ...(patch.notifications || {}) },
        payment:       { ...paymentRef.current,       ...(patch.payment       || {}) },
        receipt:       { ...receiptRef.current,       ...(patch.receipt       || {}) },
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      // Signal sidebar to re-fetch feature flags (same tab)
      window.dispatchEvent(new CustomEvent('settings_updated'))
      localStorage.setItem('settings_updated', Date.now().toString())
    } catch {
      toast.error('Failed to save setting')
    } finally {
      setAutoSaving(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to load')
      const { settings } = await res.json()
      if (settings?.general)       setGeneral(s => ({ ...s, ...settings.general }))
      if (settings?.features)      setFeatures(s => ({ ...s, ...settings.features }))
      if (settings?.notifications) setNotifications(s => ({ ...s, ...settings.notifications }))
      if (settings?.payment)       setPayment(s => ({ ...s, ...settings.payment }))
      if (settings?.receipt)       setReceipt(s => ({ ...s, ...settings.receipt }))
      setDirty(false)
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ general, features, notifications, payment, receipt }),
      })
      if (!res.ok) throw new Error()
      toast.success('Settings saved')
      setDirty(false)
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { toast.error('Image must be under 1MB'); return }
    const reader = new FileReader()
    reader.onload = ev => upGeneral({ logo: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-2 text-gray-500">
        <RefreshCw size={16} className="animate-spin" /> Loading settings…
      </div>
    </div>
  )

  return (
    <div className="-mx-6 -mt-6 min-h-screen bg-gray-50">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Shop Settings {general.shopName ? `- ${general.shopName}` : ''}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your store settings and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          {autoSaving && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <RefreshCw size={12} className="animate-spin" /> Saving…
            </span>
          )}
          {savedFlash && !autoSaving && (
            <span className="text-xs text-green-600 font-medium">✓ Saved</span>
          )}
          {dirty && !autoSaving && !savedFlash && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
          <button onClick={loadSettings}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors">
            <RefreshCw size={14} /> Reset
          </button>
          <button onClick={saveSettings} disabled={saving || !dirty}
            className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 transition-colors">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* ── Horizontal tab bar ── */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex overflow-x-auto">
          {NAV.map(n => {
            const active = activeNav === n.key
            return (
              <button key={n.key} onClick={() => setActiveNav(n.key)}
                className={cn(
                  'px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}>
                {n.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* ── Content ── */}
        <main className="py-6 px-4 min-w-0">

          {/* ══ GENERAL ══════════════════════════════════════════════════════ */}
          {activeNav === 'general' && (
            <>
              <Section title="Store settings" desc="View and update your store details">
                <SettingRow label="Company name" desc="As it appears on receipts, invoices, and reports">
                  <Input value={general.shopName} onChange={e => upGeneral({ shopName: e.target.value })}
                    placeholder="My Shop" className="focus-visible:ring-green-500 max-w-md" />
                </SettingRow>

                <SettingRow label="Avatar / Logo" desc="Appears on receipts, invoices, and reports">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center overflow-hidden shrink-0">
                      {general.logo
                        ? <img src={general.logo} alt="logo" className="w-full h-full object-cover" />
                        : <span className="text-green-700 font-bold text-lg">{general.shopName?.charAt(0)?.toUpperCase() || 'S'}</span>
                      }
                    </div>
                    <button onClick={() => fileRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                      <Upload size={13} /> Choose
                    </button>
                    <span className="text-xs text-gray-400">JPG, GIF or PNG. 1MB Max.</span>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </div>
                </SettingRow>

                <SettingRow label="Company Phone Number" desc="Where customers can reach you for support. Appears on receipts and invoices.">
                  <Input value={general.phone} onChange={e => upGeneral({ phone: e.target.value })}
                    placeholder="+254 712 345 678" className="focus-visible:ring-green-500 max-w-md" />
                </SettingRow>

                <SettingRow label="Email" desc="Where customers can contact you for support. Appears on receipts and invoices.">
                  <Input type="email" value={general.email} onChange={e => upGeneral({ email: e.target.value })}
                    placeholder="sales@myshop.co.ke" className="focus-visible:ring-green-500 max-w-md" />
                </SettingRow>

                <SettingRow label="Country" desc="This will apply to pricing in this store.">
                  <Select value={general.country} onValueChange={v => upGeneral({ country: v })}>
                    <SelectTrigger className="max-w-md focus:ring-green-500">
                      <Globe size={14} className="mr-2 text-gray-400" />
                      <SelectValue placeholder="Choose Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KE">Kenya</SelectItem>
                      <SelectItem value="UG">Uganda</SelectItem>
                      <SelectItem value="TZ">Tanzania</SelectItem>
                      <SelectItem value="RW">Rwanda</SelectItem>
                      <SelectItem value="NG">Nigeria</SelectItem>
                      <SelectItem value="GH">Ghana</SelectItem>
                      <SelectItem value="ZA">South Africa</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow label="Address" desc="Where customers can contact you for support. Appears on receipts and invoices.">
                  <Input value={general.address} onChange={e => upGeneral({ address: e.target.value })}
                    placeholder="e.g. Nairobi Road, Shop 3 Opposite Rave Fashion"
                    className="focus-visible:ring-green-500 max-w-md" />
                </SettingRow>

                <SettingRow label="Business Type" desc="This will help profile the best resources, businesses are.">
                  <Input value={general.businessType} onChange={e => upGeneral({ businessType: e.target.value })}
                    placeholder="e.g. Retail clothing store"
                    className="focus-visible:ring-green-500 max-w-md" />
                </SettingRow>

                <SettingRow label="KRA Pin" desc="Your KRA PIN is a string of letters as verification that may appear on your receipts and invoices.">
                  <Input value={general.kraPin} onChange={e => upGeneral({ kraPin: e.target.value })}
                    placeholder="P051234567X" className="focus-visible:ring-green-500 max-w-md" />
                </SettingRow>
              </Section>

              <Section title="Taxes and VAT" desc="Tax can be added to every sale. Go to Sales to view reports and reports for more info.">
                <ToggleRow label="Enable Tax & Discounts" checked={features.taxEnabled}
                  onChange={v => { upFeatures({ taxEnabled: v }); autoSave({ features: { taxEnabled: v } }) }} />
                {features.taxEnabled && (
                  <SettingRow label="Tax Rate (%)" desc="Kenya VAT is 16%">
                    <Input type="number" value={features.taxRate} min={0} max={100} step={0.01}
                      onChange={e => upFeatures({ taxRate: parseFloat(e.target.value) || 0 })}
                      className="focus-visible:ring-green-500 w-32" />
                  </SettingRow>
                )}
              </Section>

              <Section title="Terms / Extra" desc="Add a custom message for your store with a limit of 512 characters.">
                <ToggleRow label="Enable After-Sale Terms" checked={features.termsEnabled}
                  onChange={v => { upFeatures({ termsEnabled: v }); autoSave({ features: { termsEnabled: v } }) }} />
                {features.termsEnabled && (
                  <SettingRow label="Terms text">
                    <Textarea value={features.termsText}
                      onChange={e => upFeatures({ termsText: e.target.value })}
                      placeholder="e.g. Goods once sold are not returnable…" rows={3} maxLength={512}
                      className="focus-visible:ring-green-500 max-w-md" />
                  </SettingRow>
                )}
              </Section>

              <Section title="Discounts" desc="You can go to discounts to change the discount time.">
                <ToggleRow label="Enable discount" checked={features.discountsEnabled}
                  onChange={v => { upFeatures({ discountsEnabled: v }); autoSave({ features: { discountsEnabled: v } }) }} />
              </Section>

              <Section title="KDS" desc="This is applicable to restaurants that want to send orders to kitchen.">
                <ToggleRow label="Enable KDS" checked={features.kdsEnabled}
                  onChange={v => { upFeatures({ kdsEnabled: v }); autoSave({ features: { kdsEnabled: v } }) }} />
                {features.kdsEnabled && (
                  <>
                    <SettingRow label="Restaurant / Kitchen Name" desc="Displayed on the kitchen display header">
                      <Input value={features.kdsRestaurantName}
                        onChange={e => upFeatures({ kdsRestaurantName: e.target.value })}
                        placeholder="e.g. The Grill House" className="focus-visible:ring-green-500 max-w-md" />
                    </SettingRow>
                    <SettingRow label="Number of Tables" desc="Used for table selection when taking orders">
                      <Input type="number" min={1} max={200} value={features.kdsTableCount}
                        onChange={e => upFeatures({ kdsTableCount: parseInt(e.target.value) || 10 })}
                        className="focus-visible:ring-green-500 w-32" />
                    </SettingRow>
                    <div className="py-3">
                      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                        ✅ KDS enabled — Kitchen Display will appear in the sidebar. Save to apply.
                      </div>
                    </div>
                  </>
                )}
              </Section>

              <Section title="Shifts" desc="Do you have teams working with shifts?">
                <ToggleRow label="Enable Shifts" checked={features.shiftsEnabled}
                  onChange={v => { upFeatures({ shiftsEnabled: v }); autoSave({ features: { shiftsEnabled: v } }) }} />
              </Section>

              <Section title="Bar / Restaurant Tabs" desc="Enable the bar tab system for bartenders to manage customer drink tabs.">
                <ToggleRow label="Enable Bar Tabs" checked={features.barEnabled}
                  onChange={v => { upFeatures({ barEnabled: v }); autoSave({ features: { barEnabled: v } }) }} />
                {features.barEnabled && (
                  <div className="py-3">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                      🍺 Bar Tabs enabled — the Bar management system will appear in the sidebar. Save to apply.
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}

          {/* ══ PAYMENTS ═════════════════════════════════════════════════════ */}
          {activeNav === 'payment' && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-xl font-bold text-gray-900">Payments &amp; Taxes</h2>
                <p className="text-sm text-gray-500 mt-0.5">View and update your payments and taxes details</p>
              </div>

              {/* Payment Methods card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Info banner */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">You can create other payment methods for your business</p>
                    <p className="text-xs text-gray-500 mt-0.5">Example: bank transfer, cheque, custom mobile wallets, etc.</p>
                  </div>
                </div>

                {/* M-Pesa row */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">M-Pesa</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={payment.enableMpesa} onCheckedChange={v => { upPayment({ enableMpesa: v }); autoSave({ payment: { enableMpesa: v } }) }} />
                    <span className={`text-sm font-medium w-14 ${payment.enableMpesa ? 'text-green-600' : 'text-gray-400'}`}>
                      {payment.enableMpesa ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Buy Now Pay Later row */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Buy Now Pay Later</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={false} disabled
                      className="opacity-50" />
                    <span className="text-sm font-medium w-14 text-gray-400">Disabled</span>
                  </div>
                </div>

                {/* Cash row */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Cash</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={payment.enableCash} onCheckedChange={v => { upPayment({ enableCash: v }); autoSave({ payment: { enableCash: v } }) }} />
                    <span className={`text-sm font-medium w-14 ${payment.enableCash ? 'text-green-600' : 'text-gray-400'}`}>
                      {payment.enableCash ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Cards row */}
                <div className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Cards</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={payment.enableCard} onCheckedChange={v => { upPayment({ enableCard: v }); autoSave({ payment: { enableCard: v } }) }} />
                    <span className={`text-sm font-medium w-14 ${payment.enableCard ? 'text-green-600' : 'text-gray-400'}`}>
                      {payment.enableCard ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* M-Pesa Setup */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Setup M-Pesa <span className="text-green-600">*</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Choose Paybill / Till Number to use</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={payment.enableMpesa} onCheckedChange={v => { upPayment({ enableMpesa: v }); autoSave({ payment: { enableMpesa: v } }) }} />
                      <span className="text-sm text-gray-500">We have our own Paybill / Till</span>
                    </div>
                  </div>
                </div>

                {payment.enableMpesa && (
                  <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Paybill / Till Number</label>
                      <Input value={payment.mpesaPaybill}
                        onChange={e => upPayment({ mpesaPaybill: e.target.value })}
                        placeholder="e.g. 522522"
                        className="focus-visible:ring-green-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Account Number</label>
                      <Input value={payment.mpesaAccountNumber}
                        onChange={e => upPayment({ mpesaAccountNumber: e.target.value })}
                        placeholder="e.g. 7716828"
                        className="focus-visible:ring-green-500" />
                    </div>
                  </div>
                )}
              </div>

              {/* Taxes & Levies */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Taxes &amp; Levies</p>
                    <p className="text-xs text-gray-500 mt-0.5">Manage applicable taxes</p>
                  </div>
                </div>

                {/* VAT row */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">VAT / Tax</p>
                    <p className="text-xs text-gray-500 mt-0.5">Applied to all sales. Kenya standard VAT is 16%.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Switch checked={features.taxEnabled} onCheckedChange={v => { upFeatures({ taxEnabled: v }); autoSave({ features: { taxEnabled: v } }) }} />
                    <span className={`text-sm font-medium w-14 ${features.taxEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {features.taxEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {features.taxEnabled && (
                      <div className="flex items-center gap-2">
                        <Input type="number" value={features.taxRate} min={0} max={100} step={0.01}
                          onChange={e => upFeatures({ taxRate: parseFloat(e.target.value) || 0 })}
                          className="focus-visible:ring-green-500 w-24 text-center font-mono" />
                        <span className="text-sm text-gray-500 font-medium">%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Discounts row */}
                <div className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Discounts</p>
                    <p className="text-xs text-gray-500 mt-0.5">Allow discounts to be applied at point of sale</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={features.discountsEnabled} onCheckedChange={v => { upFeatures({ discountsEnabled: v }); autoSave({ features: { discountsEnabled: v } }) }} />
                    <span className={`text-sm font-medium w-14 ${features.discountsEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {features.discountsEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ NOTIFICATIONS ════════════════════════════════════════════════ */}
          {activeNav === 'notifications' && (
            <Section title="Notification Preferences" desc="Manage how you receive notifications">
              <ToggleRow label="Email Notifications" desc="Receive notifications via email"
                checked={notifications.emailNotifications} onChange={v => { upNotifications({ emailNotifications: v }); autoSave({ notifications: { emailNotifications: v } }) }} />
              <ToggleRow label="SMS Notifications" desc="Receive notifications via SMS"
                checked={notifications.smsNotifications} onChange={v => { upNotifications({ smsNotifications: v }); autoSave({ notifications: { smsNotifications: v } }) }} />
              <ToggleRow label="Low Stock Alerts" desc="Get notified when products are running low"
                checked={notifications.lowStockAlerts} onChange={v => { upNotifications({ lowStockAlerts: v }); autoSave({ notifications: { lowStockAlerts: v } }) }} />
              <ToggleRow label="Daily Sales Report" desc="Receive daily sales summary"
                checked={notifications.dailySalesReport} onChange={v => { upNotifications({ dailySalesReport: v }); autoSave({ notifications: { dailySalesReport: v } }) }} />
              <ToggleRow label="New Order Notifications" desc="Get notified for each new order"
                checked={notifications.newOrderNotification} onChange={v => { upNotifications({ newOrderNotification: v }); autoSave({ notifications: { newOrderNotification: v } }) }} />
            </Section>
          )}

          {/* ══ RECEIPT ══════════════════════════════════════════════════════ */}
          {activeNav === 'receipt' && (
            <Section title="Receipt Configuration" desc="Customize your receipt appearance">
              <ToggleRow label="Show Logo" desc="Display shop logo on receipts"
                checked={receipt.showLogo} onChange={v => { upReceipt({ showLogo: v }); autoSave({ receipt: { showLogo: v } }) }} />
              <ToggleRow label="Show Tax ID" desc="Display tax ID on receipts"
                checked={receipt.showTaxId} onChange={v => { upReceipt({ showTaxId: v }); autoSave({ receipt: { showTaxId: v } }) }} />
              <ToggleRow label="Show Address" desc="Display shop address on receipts"
                checked={receipt.showAddress} onChange={v => { upReceipt({ showAddress: v }); autoSave({ receipt: { showAddress: v } }) }} />
              <ToggleRow label="Show Phone Number" desc="Display phone number on receipts"
                checked={receipt.showPhone} onChange={v => { upReceipt({ showPhone: v }); autoSave({ receipt: { showPhone: v } }) }} />
              <SettingRow label="Paper Size">
                <Select value={receipt.paperSize} onValueChange={(v: 'A4' | '80mm') => upReceipt({ paperSize: v })}>
                  <SelectTrigger className="max-w-xs focus:ring-green-500"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (Standard)</SelectItem>
                    <SelectItem value="80mm">80mm (Thermal)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="Custom Message" desc="Appears at the bottom of receipts">
                <Textarea value={receipt.customMessage}
                  onChange={e => upReceipt({ customMessage: e.target.value })}
                  placeholder="Thank You For Shopping With Us!" rows={3}
                  className="focus-visible:ring-green-500 max-w-md" />
              </SettingRow>
            </Section>
          )}

          {/* ══ FEATURES ═════════════════════════════════════════════════════ */}
          {activeNav === 'features' && (
            <Section title="Advanced Features" desc="Enable or disable features for your business type">
              <ToggleRow label="Kitchen Display System (KDS)" desc="Enable for restaurants — waiters take orders, chefs see them on the kitchen display"
                checked={features.kdsEnabled} onChange={v => { upFeatures({ kdsEnabled: v }); autoSave({ features: { kdsEnabled: v } }) }} />
              <ToggleRow label="Shifts" desc="Enable shift management for your team"
                checked={features.shiftsEnabled} onChange={v => { upFeatures({ shiftsEnabled: v }); autoSave({ features: { shiftsEnabled: v } }) }} />
              <ToggleRow label="Discounts" desc="Allow discounts to be applied on sales"
                checked={features.discountsEnabled} onChange={v => { upFeatures({ discountsEnabled: v }); autoSave({ features: { discountsEnabled: v } }) }} />
            </Section>
          )}

          {/* ══ SECURITY ═════════════════════════════════════════════════════ */}
          {activeNav === 'security' && (
            <Section title="Security & Privacy" desc="Manage your account security">
              <SettingRow label="Change Password" desc="Update your password to keep your account secure">
                <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Change Password
                </button>
              </SettingRow>
              <SettingRow label="Two-Factor Authentication" desc="Add an extra layer of security to your account">
                <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Enable 2FA
                </button>
              </SettingRow>
              <SettingRow label="Active Sessions" desc="Manage devices where you're currently logged in">
                <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  View Sessions
                </button>
              </SettingRow>
            </Section>
          )}

        </main>
      </div>
    </div>
  )
}
