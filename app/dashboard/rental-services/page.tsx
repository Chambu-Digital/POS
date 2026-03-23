'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Trash2, Pencil, BedDouble, Bike, Car, Home, MoreHorizontal,
  Clock, User, CheckCircle2, XCircle, CalendarClock, Phone, CreditCard,
  ArrowLeft, Star, Users, Info, Banknote, Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceCategory = 'room' | 'bike' | 'car' | 'airbnb' | 'other'

interface PricingTier {
  label: string
  duration: number
  price: number
}

interface RentalService {
  _id: string
  name: string
  category: ServiceCategory
  description?: string
  pricing: PricingTier[]
  amenities: string[]
  capacity?: number
  isActive: boolean
}

interface RentalBooking {
  _id: string
  serviceId: string
  serviceName: string
  serviceCategory: string
  pricingLabel: string
  pricingDuration: number
  pricingRate: number
  startTime: string
  endTime?: string
  customer: { name: string; phone: string; idNo?: string }
  guestCount: number
  notes?: string
  deposit: number
  depositPaymentMethod?: string
  totalAmount?: number
  paymentMethod?: string
  mpesaCode?: string
  status: 'active' | 'completed' | 'cancelled' | 'overdue'
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ServiceCategory; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'room',   label: 'Room',   icon: BedDouble,      color: 'bg-blue-50 text-blue-700 border-blue-200'   },
  { value: 'bike',   label: 'Bike',   icon: Bike,           color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'car',    label: 'Car',    icon: Car,            color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'airbnb', label: 'AirBnB', icon: Home,           color: 'bg-pink-50 text-pink-700 border-pink-200'   },
  { value: 'other',  label: 'Other',  icon: MoreHorizontal, color: 'bg-gray-50 text-gray-700 border-gray-200'   },
]

const DURATION_PRESETS = [
  { label: 'Per 30 min', minutes: 30    },
  { label: 'Per Hour',   minutes: 60    },
  { label: 'Per Night',  minutes: 720   },
  { label: 'Per Day',    minutes: 1440  },
  { label: 'Per Week',   minutes: 10080 },
  { label: 'Per Month',  minutes: 43200 },
]

function getCategoryMeta(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[4]
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${mins / 60}h`
  if (mins < 10080) return `${mins / 1440}d`
  return `${Math.round(mins / 10080)}w`
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    overdue:   'bg-red-100 text-red-700',
    cancelled: 'bg-yellow-100 text-yellow-700',
  }
  return <Badge className={map[status] ?? 'bg-gray-100 text-gray-600'}>{status}</Badge>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RentalServicesPage() {
  const [activeTab, setActiveTab] = useState('services')

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Rental Services</h1>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="services">Manage Services</TabsTrigger>
          <TabsTrigger value="book">New Booking</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="book"><NewBookingTab onBooked={() => setActiveTab('bookings')} /></TabsContent>
        <TabsContent value="bookings"><BookingsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab() {
  const [services, setServices] = useState<RentalService[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RentalService | null>(null)

  useEffect(() => { fetchServices() }, [])

  async function fetchServices() {
    setLoading(true)
    try {
      const res = await fetch('/api/rental-services?active=false')
      if (res.ok) { const d = await res.json(); setServices(d.services || []) }
    } catch { toast.error('Failed to load services') }
    finally { setLoading(false) }
  }

  async function toggleActive(service: RentalService) {
    try {
      const res = await fetch(`/api/rental-services/${service._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !service.isActive }),
      })
      if (res.ok) { toast.success(service.isActive ? 'Deactivated' : 'Activated'); fetchServices() }
    } catch { toast.error('Failed to update') }
  }

  async function deleteService(id: string) {
    if (!confirm('Delete this service?')) return
    try {
      const res = await fetch(`/api/rental-services/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Deleted'); fetchServices() }
    } catch { toast.error('Failed to delete') }
  }

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: services.filter(s => s.category === cat.value),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus size={16} className="mr-2" /> Add Service
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading...</p>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BedDouble size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No services yet</p>
          <p className="text-sm">Add your first rental service to get started</p>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.value}>
            <div className="flex items-center gap-2 mb-3">
              <group.icon size={18} className="text-muted-foreground" />
              <h2 className="font-semibold text-lg">{group.label}</h2>
              <Badge variant="outline">{group.items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map(service => {
                const meta = getCategoryMeta(service.category)
                return (
                  <Card key={service._id} className={!service.isActive ? 'opacity-60' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                         
                          <div>
                            <CardTitle className="text-base">{service.name}</CardTitle>
                            {service.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={service.isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
                          {service.isActive ? 'Active' : 'Off'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        {service.pricing.map((p, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock size={12} /> {p.label}
                            </span>
                            <span className="font-medium">KES {p.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      {service.capacity && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users size={12} /> Capacity: {service.capacity}
                        </p>
                      )}
                      {service.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {service.amenities.map((a, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                          ))}
                        </div>
                      )}
                      <Separator />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1"
                          onClick={() => { setEditing(service); setShowForm(true) }}>
                          <Pencil size={14} className="mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(service)}>
                          {service.isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600"
                          onClick={() => deleteService(service._id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}

      <ServiceFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        editing={editing}
        onSaved={() => { setShowForm(false); fetchServices() }}
      />
    </div>
  )
}

// ─── New Booking Tab ──────────────────────────────────────────────────────────
// Shows a grid of service cards. Clicking one opens a full detail/booking panel.

function NewBookingTab({ onBooked }: { onBooked: () => void }) {
  const [services, setServices] = useState<RentalService[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [openService, setOpenService] = useState<RentalService | null>(null)

  useEffect(() => { fetchServices() }, [])

  async function fetchServices() {
    setLoading(true)
    try {
      const res = await fetch('/api/rental-services')
      if (res.ok) { const d = await res.json(); setServices(d.services || []) }
    } catch { toast.error('Failed to load services') }
    finally { setLoading(false) }
  }

  const filtered = categoryFilter === 'all' ? services : services.filter(s => s.category === categoryFilter)

  // If a service is open, show its detail/booking panel
  if (openService) {
    return (
      <ServiceBookingPanel
        service={openService}
        onBack={() => setOpenService(null)}
        onBooked={() => { setOpenService(null); onBooked() }}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${categoryFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
          onClick={() => setCategoryFilter('all')}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value}
            className={`text-sm px-4 py-1.5 rounded-full border flex items-center gap-1.5 transition-colors ${categoryFilter === c.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            onClick={() => setCategoryFilter(c.value)}>
          {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-16">Loading services...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BedDouble size={48} className="mx-auto mb-4 opacity-30" />
          <p>No active services found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(service => {
            const meta = getCategoryMeta(service.category)
            const lowestPrice = Math.min(...service.pricing.map(p => p.price))
            return (
              <Card key={service._id}
                className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group"
                onClick={() => setOpenService(service)}>
                {/* Header band */}
                <div className={`h-2 rounded-t-lg ${meta.color.split(' ')[0]}`} />
                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`p-2.5 rounded-xl border ${meta.color}`}>
                        <meta.icon size={20} />
                      </span>
                      <div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                          {service.name}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs mt-1">{meta.label}</Badge>
                      </div>
                    </div>
                  </div>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{service.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {/* Pricing preview */}
                  <div className="space-y-1.5">
                    {service.pricing.slice(0, 3).map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Clock size={12} /> {p.label}
                        </span>
                        <span className="font-semibold">KES {p.price.toLocaleString()}</span>
                      </div>
                    ))}
                    {service.pricing.length > 3 && (
                      <p className="text-xs text-muted-foreground">+{service.pricing.length - 3} more tiers</p>
                    )}
                  </div>

                  {/* Amenities */}
                  {service.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {service.amenities.slice(0, 4).map((a, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                      ))}
                      {service.amenities.length > 4 && (
                        <Badge variant="secondary" className="text-xs">+{service.amenities.length - 4}</Badge>
                      )}
                    </div>
                  )}

                  <Separator />
                  <div className="flex items-center justify-between">
                    {service.capacity && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users size={12} /> Max {service.capacity}
                      </span>
                    )}
                    <Button size="sm" className="ml-auto">
                      Book Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Service Booking Panel ────────────────────────────────────────────────────
// Full-page detail view for a specific service with booking form + payment

function ServiceBookingPanel({
  service, onBack, onBooked,
}: {
  service: RentalService
  onBack: () => void
  onBooked: () => void
}) {
  const meta = getCategoryMeta(service.category)
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(
    service.pricing.length === 1 ? service.pricing[0] : null
  )

  // Customer
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerIdNo, setCustomerIdNo] = useState('')
  const [guestCount, setGuestCount] = useState(1)
  const [notes, setNotes] = useState('')

  // Deposit
  const [deposit, setDeposit] = useState<number | ''>('')
  const [depositMethod, setDepositMethod] = useState('')

  // Payment (pay now on booking)
  const [payNow, setPayNow] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [cashReceived, setCashReceived] = useState<number | ''>('')

  const [processing, setProcessing] = useState(false)

  const cashChange = payNow && paymentMethod === 'cash' && cashReceived !== '' && selectedTier
    ? Number(cashReceived) - selectedTier.price
    : null

  async function book() {
    if (!selectedTier) { toast.error('Select a pricing tier'); return }
    if (!customerName.trim()) { toast.error('Customer name is required'); return }
    if (!customerPhone.trim()) { toast.error('Customer phone is required'); return }
    if (payNow && !paymentMethod) { toast.error('Select a payment method'); return }
    if (payNow && paymentMethod === 'cash' && cashReceived !== '' && Number(cashReceived) < selectedTier.price) {
      toast.error('Cash received is less than the total'); return
    }

    setProcessing(true)
    try {
      // 1. Create booking
      const bookingRes = await fetch('/api/rental-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service._id,
          serviceName: service.name,
          serviceCategory: service.category,
          pricingLabel: selectedTier.label,
          pricingDuration: selectedTier.duration,
          pricingRate: selectedTier.price,
          customer: { name: customerName, phone: customerPhone, idNo: customerIdNo || undefined },
          guestCount,
          notes: notes || undefined,
          deposit: deposit || 0,
          depositPaymentMethod: depositMethod || undefined,
          startTime: new Date().toISOString(),
        }),
      })
      const bookingData = await bookingRes.json()
      if (!bookingRes.ok) { toast.error(bookingData.error || 'Failed to create booking'); return }

      // 2. If paying now, immediately complete the booking
      if (payNow) {
        const checkoutRes = await fetch(`/api/rental-bookings/${bookingData.booking._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalAmount: selectedTier.price,
            paymentMethod,
            mpesaCode: paymentMethod === 'mobile_money' ? mpesaCode : undefined,
            mpesaPhone: paymentMethod === 'mobile_money' ? mpesaPhone : undefined,
            status: 'completed',
          }),
        })
        if (!checkoutRes.ok) {
          toast.warning('Booking created but payment failed — complete from Bookings tab')
        } else {
          toast.success('Booking created and payment recorded')
        }
      } else {
        toast.success('Booking started successfully')
      }

      onBooked()
    } catch { toast.error('Error creating booking') }
    finally { setProcessing(false) }
  }

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft size={16} /> Back
        </Button>
        <div className="flex items-center gap-3">
          <span className={`p-2.5 rounded-xl border ${meta.color}`}>
            <meta.icon size={20} />
          </span>
          <div>
            <h2 className="text-2xl font-bold">{service.name}</h2>
            <Badge variant="outline">{meta.label}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: service info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {service.description && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  <p>{service.description}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Capacity */}
          {service.capacity && (
            <Card>
              <CardContent className="pt-4 flex items-center gap-2 text-sm">
                <Users size={16} className="text-muted-foreground" />
                <span>Max capacity: <strong>{service.capacity}</strong> guests / riders</span>
              </CardContent>
            </Card>
          )}

          {/* Amenities */}
          {service.amenities.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star size={14} /> Amenities & Features
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pb-4">
                {service.amenities.map((a, i) => (
                  <Badge key={i} variant="secondary">{a}</Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pricing tiers — select one */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock size={14} /> Select Pricing Tier *
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {service.pricing.map((tier, i) => (
                <button key={i} type="button"
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-lg border-2 transition-all text-sm ${
                    selectedTier?.label === tier.label
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted'
                  }`}
                  onClick={() => setSelectedTier(tier)}>
                  <div className="flex items-center gap-2 text-left">
                    <Clock size={14} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{tier.label}</p>
                      <p className="text-xs text-muted-foreground">Duration: {formatDuration(tier.duration)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base">KES {tier.price.toLocaleString()}</p>
                    {selectedTier?.label === tier.label && (
                      <CheckCircle2 size={14} className="text-primary ml-auto mt-0.5" />
                    )}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: booking form */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User size={16} /> Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Full Name *</Label>
                  <Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Phone *</Label>
                  <Input placeholder="07XXXXXXXX" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>ID / Passport No.</Label>
                  <Input placeholder="Optional" value={customerIdNo} onChange={e => setCustomerIdNo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Guests / Riders</Label>
                  <Input type="number" min={1} max={service.capacity || 99} value={guestCount}
                    onChange={e => setGuestCount(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea placeholder="Special requests, notes..." value={notes}
                  onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Deposit */}
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote size={16} /> Deposit (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Deposit Amount (KES)</Label>
                  <Input type="number" min={0} placeholder="0" value={deposit}
                    onChange={e => setDeposit(e.target.value ? Number(e.target.value) : '')} />
                </div>
                {deposit ? (
                  <div className="space-y-1">
                    <Label>Deposit Method</Label>
                    <Select value={depositMethod} onValueChange={setDepositMethod}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mobile_money">M-Pesa</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard size={16} /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pay now toggle */}
              <div className="flex gap-3">
                <button type="button"
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${!payNow ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  onClick={() => setPayNow(false)}>
                  Pay Later (on checkout)
                </button>
                <button type="button"
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${payNow ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  onClick={() => setPayNow(true)}>
                  Pay Now
                </button>
              </div>

              {payNow && selectedTier && (
                <>
                  <div className="bg-muted rounded-lg px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Amount to pay</span>
                    <span className="font-bold text-lg">KES {selectedTier.price.toLocaleString()}</span>
                  </div>

                  <div className="space-y-1">
                    <Label>Payment Method *</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'cash', label: 'Cash', icon: Banknote },
                        { value: 'mobile_money', label: 'M-Pesa', icon: Smartphone },
                        { value: 'card', label: 'Card', icon: CreditCard },
                      ].map(m => (
                        <button key={m.value} type="button"
                          className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 text-sm transition-all ${paymentMethod === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                          onClick={() => setPaymentMethod(m.value)}>
                          <m.icon size={18} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'mobile_money' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>M-Pesa Code</Label>
                        <Input placeholder="e.g. QGH7XXXXX" value={mpesaCode} onChange={e => setMpesaCode(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>M-Pesa Phone</Label>
                        <Input placeholder="07XXXXXXXX" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'cash' && (
                    <div className="space-y-1">
                      <Label>Cash Received (KES)</Label>
                      <Input type="number" min={0} placeholder={`${selectedTier.price}`} value={cashReceived}
                        onChange={e => setCashReceived(e.target.value ? Number(e.target.value) : '')} />
                      {cashChange !== null && cashChange >= 0 && (
                        <p className="text-sm text-green-600 font-medium mt-1">
                          Change: KES {cashChange.toLocaleString()}
                        </p>
                      )}
                      {cashChange !== null && cashChange < 0 && (
                        <p className="text-sm text-red-500 font-medium mt-1">
                          Insufficient — short by KES {Math.abs(cashChange).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary + confirm */}
          {selectedTier && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pricing</span>
                  <span>{selectedTier.label} — {formatDuration(selectedTier.duration)}</span>
                </div>
                {deposit ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deposit</span>
                    <span>KES {Number(deposit).toLocaleString()}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>KES {selectedTier.price.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Button className="w-full h-12 text-base" onClick={book} disabled={processing || !selectedTier}>
            {processing ? 'Processing...' : payNow ? 'Confirm & Pay' : 'Start Booking'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab() {
  const [bookings, setBookings] = useState<RentalBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<RentalBooking | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)

  useEffect(() => { fetchBookings() }, [])

  async function fetchBookings() {
    setLoading(true)
    try {
      const res = await fetch('/api/rental-bookings')
      if (res.ok) { const d = await res.json(); setBookings(d.bookings || []) }
    } catch { toast.error('Failed to load bookings') }
    finally { setLoading(false) }
  }

  async function cancelBooking(id: string) {
    if (!confirm('Cancel this booking?')) return
    try {
      const res = await fetch(`/api/rental-bookings/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Booking cancelled'); fetchBookings() }
    } catch { toast.error('Failed to cancel') }
  }

  const filtered = bookings.filter(b => statusFilter === 'all' || b.status === statusFilter)
  const activeCount = bookings.filter(b => b.status === 'active' || b.status === 'overdue').length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'active', 'overdue', 'completed', 'cancelled'] as const).map(s => (
          <button key={s}
            className={`text-sm px-3 py-1.5 rounded-full border capitalize transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            onClick={() => setStatusFilter(s)}>
            {s === 'all' ? `All (${bookings.length})` : s === 'active' ? `Active (${activeCount})` : s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No bookings found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(booking => {
            const meta = getCategoryMeta(booking.serviceCategory)
            return (
              <Card key={booking._id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`p-1.5 rounded-lg border ${meta.color}`}>
                          <meta.icon size={14} />
                        </span>
                        <span className="font-semibold">{booking.serviceName}</span>
                        {statusBadge(booking.status)}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock size={13} /> {booking.pricingLabel} — KES {booking.pricingRate.toLocaleString()}
                      </p>
                      <p className="text-sm flex items-center gap-2">
                        <User size={13} className="text-muted-foreground" />
                        <span>{booking.customer.name}</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Phone size={12} />{booking.customer.phone}
                        </span>
                        {booking.customer.idNo && (
                          <span className="text-xs text-muted-foreground">ID: {booking.customer.idNo}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock size={12} /> Started: {formatDateTime(booking.startTime)}
                      </p>
                      {booking.endTime && (
                        <p className="text-xs text-muted-foreground">Ended: {formatDateTime(booking.endTime)}</p>
                      )}
                      {booking.deposit > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Deposit: KES {booking.deposit.toLocaleString()} ({booking.depositPaymentMethod})
                        </p>
                      )}
                      {booking.totalAmount != null && (
                        <p className="text-sm font-semibold flex items-center gap-1 text-green-700">
                          <CreditCard size={13} /> Total paid: KES {booking.totalAmount.toLocaleString()}
                        </p>
                      )}
                      {booking.notes && <p className="text-xs text-muted-foreground italic">{booking.notes}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {(booking.status === 'active' || booking.status === 'overdue') && (
                        <>
                          <Button size="sm" onClick={() => { setSelected(booking); setShowCheckout(true) }}>
                            <CheckCircle2 size={14} className="mr-1" /> Check Out
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-500"
                            onClick={() => cancelBooking(booking._id)}>
                            <XCircle size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CheckoutDialog
        open={showCheckout}
        booking={selected}
        onClose={() => setShowCheckout(false)}
        onDone={() => { setShowCheckout(false); fetchBookings() }}
      />
    </div>
  )
}

// ─── Checkout Dialog ──────────────────────────────────────────────────────────

function CheckoutDialog({
  open, booking, onClose, onDone,
}: {
  open: boolean
  booking: RentalBooking | null
  onClose: () => void
  onDone: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [manualTotal, setManualTotal] = useState<number | ''>('')
  const [cashReceived, setCashReceived] = useState<number | ''>('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (open) { setPaymentMethod(''); setMpesaCode(''); setMpesaPhone(''); setManualTotal(''); setCashReceived('') }
  }, [open])

  if (!booking) return null

  const elapsed = Math.ceil((Date.now() - new Date(booking.startTime).getTime()) / (1000 * 60))
  const tiers = Math.ceil(elapsed / booking.pricingDuration)
  const estimated = tiers * booking.pricingRate
  const finalTotal = manualTotal !== '' ? Number(manualTotal) : estimated
  const change = paymentMethod === 'cash' && cashReceived !== '' ? Number(cashReceived) - finalTotal : null

  function fmtElapsed(mins: number) {
    if (mins < 60) return `${mins} min`
    if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`
    return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
  }

  async function checkout() {
    if (!paymentMethod) { toast.error('Select a payment method'); return }
    if (paymentMethod === 'cash' && cashReceived !== '' && Number(cashReceived) < finalTotal) {
      toast.error('Cash received is less than the total'); return
    }
    setProcessing(true)
    try {
      const res = await fetch(`/api/rental-bookings/${booking!._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: finalTotal,
          paymentMethod,
          mpesaCode: paymentMethod === 'mobile_money' ? mpesaCode : undefined,
          mpesaPhone: paymentMethod === 'mobile_money' ? mpesaPhone : undefined,
          status: 'completed',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to checkout'); return }
      toast.success('Checkout complete — order saved')
      onDone()
    } catch { toast.error('Error processing checkout') }
    finally { setProcessing(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check Out — {booking.serviceName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{booking.customer.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{booking.customer.phone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pricing tier</span><span>{booking.pricingLabel}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span>KES {booking.pricingRate.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Time elapsed</span><span>{fmtElapsed(elapsed)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Billing units</span><span>{tiers} × {booking.pricingLabel}</span></div>
            {booking.deposit > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit paid</span><span>KES {booking.deposit.toLocaleString()}</span></div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Estimated Total</span><span>KES {estimated.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Override Total (optional)</Label>
            <Input type="number" min={0} placeholder={`${estimated}`} value={manualTotal}
              onChange={e => setManualTotal(e.target.value ? Number(e.target.value) : '')} />
          </div>

          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'cash', label: 'Cash', icon: Banknote },
                { value: 'mobile_money', label: 'M-Pesa', icon: Smartphone },
                { value: 'card', label: 'Card', icon: CreditCard },
              ].map(m => (
                <button key={m.value} type="button"
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 text-sm transition-all ${paymentMethod === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  onClick={() => setPaymentMethod(m.value)}>
                  <m.icon size={18} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'mobile_money' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>M-Pesa Code</Label>
                <Input placeholder="QGH7XXXXX" value={mpesaCode} onChange={e => setMpesaCode(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>M-Pesa Phone</Label>
                <Input placeholder="07XXXXXXXX" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
              </div>
            </div>
          )}

          {paymentMethod === 'cash' && (
            <div className="space-y-1">
              <Label>Cash Received (KES)</Label>
              <Input type="number" min={0} placeholder={`${finalTotal}`} value={cashReceived}
                onChange={e => setCashReceived(e.target.value ? Number(e.target.value) : '')} />
              {change !== null && change >= 0 && (
                <p className="text-sm text-green-600 font-medium">Change: KES {change.toLocaleString()}</p>
              )}
              {change !== null && change < 0 && (
                <p className="text-sm text-red-500 font-medium">Short by KES {Math.abs(change).toLocaleString()}</p>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-1">
            <div>
              <p className="text-xs text-muted-foreground">Final total</p>
              <p className="font-bold text-lg">KES {finalTotal.toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={checkout} disabled={processing}>
                {processing ? 'Processing...' : 'Complete & Save Order'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Service Form Dialog ──────────────────────────────────────────────────────

function ServiceFormDialog({
  open, onClose, editing, onSaved,
}: {
  open: boolean
  onClose: () => void
  editing: RentalService | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ServiceCategory>('room')
  const [description, setDescription] = useState('')
  const [capacity, setCapacity] = useState<number | ''>('')
  const [amenityInput, setAmenityInput] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [pricing, setPricing] = useState<PricingTier[]>([{ label: 'Per Hour', duration: 60, price: 0 }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name); setCategory(editing.category); setDescription(editing.description || '')
      setCapacity(editing.capacity || ''); setAmenities(editing.amenities || [])
      setPricing(editing.pricing.length ? editing.pricing : [{ label: 'Per Hour', duration: 60, price: 0 }])
    } else {
      setName(''); setCategory('room'); setDescription(''); setCapacity('')
      setAmenities([]); setPricing([{ label: 'Per Hour', duration: 60, price: 0 }])
    }
  }, [editing, open])

  function addPricingTier() { setPricing(prev => [...prev, { label: '', duration: 60, price: 0 }]) }
  function removePricingTier(i: number) { setPricing(prev => prev.filter((_, idx) => idx !== i)) }
  function updatePricing(i: number, field: keyof PricingTier, value: string | number) {
    setPricing(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }
  function applyPreset(i: number, preset: { label: string; minutes: number }) {
    setPricing(prev => prev.map((p, idx) => idx === i ? { ...p, label: preset.label, duration: preset.minutes } : p))
  }
  function addAmenity() {
    const val = amenityInput.trim()
    if (val && !amenities.includes(val)) { setAmenities(prev => [...prev, val]); setAmenityInput('') }
  }

  async function save() {
    if (!name.trim()) { toast.error('Service name is required'); return }
    if (pricing.some(p => !p.label || p.price <= 0)) {
      toast.error('All pricing tiers need a label and price > 0'); return
    }
    setSaving(true)
    try {
      const body = { name, category, description, capacity: capacity || undefined, amenities, pricing }
      const url = editing ? `/api/rental-services/${editing._id}` : '/api/rental-services'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to save'); return }
      toast.success(editing ? 'Service updated' : 'Service created')
      onSaved()
    } catch { toast.error('Error saving') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Service' : 'Add Rental Service'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Service Name *</Label>
              <Input placeholder="e.g. Deluxe Room, Mountain Bike" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={category} onValueChange={v => setCategory(v as ServiceCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">{c.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea placeholder="Optional description..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1 w-40">
            <Label>Capacity</Label>
            <Input type="number" min={1} placeholder="e.g. 2" value={capacity}
              onChange={e => setCapacity(e.target.value ? Number(e.target.value) : '')} />
          </div>

          {/* Pricing Tiers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Pricing Tiers *</Label>
              <Button type="button" size="sm" variant="outline" onClick={addPricingTier}>
                <Plus size={14} className="mr-1" /> Add Tier
              </Button>
            </div>
            {pricing.map((tier, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Tier {i + 1}</span>
                  {pricing.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" className="text-red-500 h-7 px-2"
                      onClick={() => removePricingTier(i)}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {DURATION_PRESETS.map(p => (
                    <button key={p.label} type="button"
                      className={`text-xs px-2 py-1 rounded border transition-colors ${tier.label === p.label ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                      onClick={() => applyPreset(i, p)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Label *</Label>
                    <Input placeholder="e.g. Per Hour" value={tier.label}
                      onChange={e => updatePricing(i, 'label', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duration (minutes)</Label>
                    <Input type="number" min={1} value={tier.duration}
                      onChange={e => updatePricing(i, 'duration', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price (KES) *</Label>
                    <Input type="number" min={0} placeholder="0" value={tier.price || ''}
                      onChange={e => updatePricing(i, 'price', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Amenities */}
          <div className="space-y-2">
            <Label>Amenities / Features</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g. WiFi, AC, Parking" value={amenityInput}
                onChange={e => setAmenityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAmenity())} />
              <Button type="button" variant="outline" onClick={addAmenity}>Add</Button>
            </div>
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {amenities.map((a, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 cursor-pointer"
                    onClick={() => setAmenities(prev => prev.filter((_, idx) => idx !== i))}>
                    {a} <XCircle size={12} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create Service'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
