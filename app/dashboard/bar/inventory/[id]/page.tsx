'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Plus, Edit2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'

// ── Types ──────────────────────────────────────────────────────────────────────

interface InventoryItem {
  _id: string
  name: string   // the brand label from the CSV 'name' column, e.g. "Jameson"
  size: string
  buyingPrice: number
  bottleSellingPrice: number
  stock: number
  lowStockThreshold: number
  isActive: boolean
}

interface Brand {
  _id: string
  name: string
  category: string
}

interface Serving {
  _id: string
  name: string
  sellingPrice: number
  unitsProduced: number
  isActive: boolean
}

interface Bottle {
  _id: string
  bottleNumber: number
  state: 'full' | 'open' | 'closed'
  openedAt?: string
  closedAt?: string
  expectedUnits?: number
  remainingUnits?: number
  actualUnitsSold?: number
  difference?: number
}

// ── Route ──────────────────────────────────────────────────────────────────────

export default function InventoryItemDetailPage() {
  return (
    <PermissionGuard requiredPermission="bar.inventory">
      <ItemDetailContent />
    </PermissionGuard>
  )
}

// ── Slug helpers ───────────────────────────────────────────────────────────────
// URL format:  /dashboard/bar/inventory/jameson-750ml--6a604a6e48e8d5de16a6651b
// The param is  `<slug>--<24-char-objectid>`
// We always resolve by the ID suffix, so slugs don't need to be unique.

function extractId(param: string): string {
  console.log('[extractId] Input param:', param)
  // Last 24 chars are the ObjectId when format is slug--id
  if (param.includes('--')) {
    const extracted = param.split('--').pop()!
    console.log('[extractId] Extracted ID from slug:', extracted)
    return extracted
  }
  // Fallback: raw ObjectId (old links / direct navigation)
  console.log('[extractId] Using raw param as ID:', param)
  return param
}

export function makeSlugParam(brandName: string, size: string, id: string): string {
  const slug = `${brandName} ${size}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug}--${id}`
}

// ── Main content ───────────────────────────────────────────────────────────────

function ItemDetailContent() {
  const params = useParams()
  const router = useRouter()

  const rawId  = Array.isArray(params.id) ? params.id[0] : (params.id as string)
  const itemId = extractId(rawId)

  const [item,     setItem]     = useState<InventoryItem | null>(null)
  const [brand,    setBrand]    = useState<Brand | null>(null)
  const [servings, setServings] = useState<Serving[]>([])
  const [bottles,  setBottles]  = useState<Bottle[]>([])
  const [loading,  setLoading]  = useState(true)
  const [servingsLoading, setServingsLoading] = useState(false)
  const [bottlesLoading, setBottlesLoading] = useState(false)

  const [isEditing,    setIsEditing]    = useState(false)
  const [isStockOpen,  setIsStockOpen]  = useState(false)
  const [isServingOpen, setIsServingOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    buyingPrice: 0,
    bottleSellingPrice: 0,
    lowStockThreshold: 3,
  })
  const [stockForm,   setStockForm]   = useState({ adjustment: '', reason: '' })
  const [servingForm, setServingForm] = useState({ name: '', sellingPrice: '', unitsProduced: '' })

  useEffect(() => { load() }, [itemId])

  async function load() {
    setLoading(true)
    setServingsLoading(true)
    setBottlesLoading(true)
    try {
      console.log('[Inventory Detail] Loading with itemId:', itemId)
      console.log('[Inventory Detail] Raw ID from params:', rawId)
      
      const [itemRes, servingsRes, bottlesRes] = await Promise.all([
        fetch(`/api/bar/inventory-items/${itemId}`),
        fetch(`/api/bar/inventory-items/${itemId}/servings`),
        fetch(`/api/bar/bottles?inventoryItemId=${itemId}`),
      ])

      if (itemRes.ok) {
        const data = await itemRes.json()
        console.log('[Inventory Detail] Item response:', data)
        setItem(data.item)
        setBrand(data.brand ?? null)
        setEditForm({
          buyingPrice:        data.item.buyingPrice,
          bottleSellingPrice: data.item.bottleSellingPrice,
          lowStockThreshold:  data.item.lowStockThreshold,
        })
      } else {
        console.error('[Inventory Detail] Item API failed:', itemRes.status, itemRes.statusText)
        toast.error('Failed to load item details')
      }
      if (servingsRes.ok) {
        const data = await servingsRes.json()
        console.log('[Inventory Detail] Servings response:', data)
        console.log('[Inventory Detail] Servings array:', data.servings)
        console.log('[Inventory Detail] Servings array length:', data.servings?.length)
        console.log('[Inventory Detail] Debug data:', data.debug)
        console.log('[Inventory Detail] Setting servings state with:', data.servings)
        setServings(data.servings ?? [])
      } else {
        console.error('[Inventory Detail] Servings API failed:', servingsRes.status, servingsRes.statusText)
        toast.error('Failed to load servings')
        setServings([])
      }
      if (bottlesRes.ok) {
        const data = await bottlesRes.json()
        console.log('[Inventory Detail] Bottles response:', data)
        setBottles(data.bottles ?? [])
      } else {
        console.error('[Inventory Detail] Bottles API failed:', bottlesRes.status, bottlesRes.statusText)
        toast.error('Failed to load bottle history')
        setBottles([])
      }
    } catch (err) {
      console.error('[Inventory Detail] Load error:', err)
      toast.error('Failed to load item data')
    } finally {
      setLoading(false)
      setServingsLoading(false)
      setBottlesLoading(false)
    }
  }

  async function updateItem(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/bar/inventory-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Item updated')
      setIsEditing(false)
      load()
    } catch { toast.error('Failed to update item') }
    setSaving(false)
  }

  async function adjustStock(e: React.FormEvent) {
    e.preventDefault()
    const adj = parseInt(stockForm.adjustment)
    if (!adj || adj === 0) { toast.error('Enter a valid adjustment'); return }
    if (!stockForm.reason.trim()) { toast.error('Enter a reason'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/bar/inventory-items/${itemId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment: adj, reason: stockForm.reason }),
      })
      if (!res.ok) throw new Error('Failed to adjust stock')
      toast.success('Stock adjusted')
      setStockForm({ adjustment: '', reason: '' })
      setIsStockOpen(false)
      load()
    } catch { toast.error('Failed to adjust stock') }
    setSaving(false)
  }

  async function createServing(e: React.FormEvent) {
    e.preventDefault()
    if (!servingForm.name.trim()) { toast.error('Serving name is required'); return }
    const sellingPrice  = parseFloat(servingForm.sellingPrice)
    const unitsProduced = parseInt(servingForm.unitsProduced)
    if (!sellingPrice  || sellingPrice  <= 0) { toast.error('Valid selling price required'); return }
    if (!unitsProduced || unitsProduced <  1) { toast.error('Units produced must be at least 1'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/bar/inventory-items/${itemId}/servings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: servingForm.name, sellingPrice, unitsProduced }),
      })
      if (!res.ok) throw new Error('Failed to create serving')
      toast.success('Serving added')
      setServingForm({ name: '', sellingPrice: '', unitsProduced: '' })
      setIsServingOpen(false)
      load()
    } catch { toast.error('Failed to create serving') }
    setSaving(false)
  }

  async function toggleServing(s: Serving) {
    try {
      const res = await fetch(`/api/bar/servings/${s._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !s.isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success('Serving updated')
      load()
    } catch { toast.error('Failed to update serving') }
  }

  async function openBottle() {
    try {
      const res = await fetch('/api/bar/bottles/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryItemId: itemId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to open bottle')
      }
      toast.success('Bottle opened')
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to open bottle')
    }
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading…</div>
  if (!item)   return <div className="text-center py-8 text-muted-foreground">Item not found</div>

  const brandName    = brand?.name ?? ''
  // item.name is e.g. "Jameson" (from CSV). Fall back to brand name for older records.
  const itemName     = (item.name && item.name.trim()) ? item.name : brandName
  const displayTitle = `${itemName} ${item.size}`.trim()
  // Derive open bottle from bottles array for consistency
  const openBottleDoc = bottles.find(b => b.state === 'open')

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{displayTitle}</h1>
          <p className="text-muted-foreground text-sm">
            {brand?.category && <span>{brand.category} · </span>}
            {item.stock <= item.lowStockThreshold
              ? <span className="text-red-600 font-medium">{item.stock} bottles — low stock</span>
              : <span>{item.stock} bottles in stock</span>
            }
          </p>
        </div>
        <Button onClick={() => setIsEditing(v => !v)} variant={isEditing ? 'outline' : 'default'}>
          <Edit2 className="mr-2 h-4 w-4" />
          {isEditing ? 'Cancel Edit' : 'Edit Item'}
        </Button>
      </div>

      {/* Edit form */}
      {isEditing && (
        <Card>
          <CardHeader><CardTitle>Edit Prices &amp; Threshold</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={updateItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Buying Price (KES)</label>
                  <Input type="number" value={editForm.buyingPrice}
                    onChange={e => setEditForm({ ...editForm, buyingPrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bottle Selling Price (KES)</label>
                  <Input type="number" value={editForm.bottleSellingPrice}
                    onChange={e => setEditForm({ ...editForm, bottleSellingPrice: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="max-w-xs">
                <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
                <Input type="number" value={editForm.lowStockThreshold}
                  onChange={e => setEditForm({ ...editForm, lowStockThreshold: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Stock</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${item.stock <= item.lowStockThreshold ? 'text-red-600' : ''}`}>
              {item.stock}
            </p>
            <p className="text-xs text-muted-foreground mt-1">sealed bottles</p>
            <Button size="sm" className="mt-3 w-full" onClick={() => setIsStockOpen(v => !v)}>
              <Package className="mr-2 h-3 w-3" /> Adjust Stock
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Open Bottle</CardTitle></CardHeader>
          <CardContent>
            {openBottleDoc ? (
              <>
                <p className="text-3xl font-bold text-orange-500">{openBottleDoc.remainingUnits}</p>
                <p className="text-xs text-muted-foreground mt-1">units remaining</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-1 mb-3">No bottle open</p>
                <Button size="sm" className="w-full" disabled={item.stock === 0} onClick={openBottle}>
                  Open Bottle
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Bottle sell price</p>
              <p className="text-lg font-bold">KES {item.bottleSellingPrice.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Buying price</p>
              <p className="text-lg font-bold">KES {item.buyingPrice.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock adjustment form */}
      {isStockOpen && (
        <Card>
          <CardHeader><CardTitle>Adjust Stock</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={adjustStock} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-medium mb-1">Adjustment (+ or −)</label>
                <Input type="number" value={stockForm.adjustment} placeholder="e.g. 10 or -3"
                  onChange={e => setStockForm({ ...stockForm, adjustment: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <Input value={stockForm.reason} placeholder="e.g. Restock, Breakage"
                  onChange={e => setStockForm({ ...stockForm, reason: e.target.value })} required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Adjusting…' : 'Apply'}</Button>
                <Button type="button" variant="outline" onClick={() => setIsStockOpen(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Servings */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Serving Options ({servings.filter(s => s.isActive).length} active)</CardTitle>
            <Button size="sm" onClick={() => setIsServingOpen(v => !v)} disabled={servingsLoading}>
              <Plus className="mr-2 h-4 w-4" />
              {isServingOpen ? 'Cancel' : 'Add Serving'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isServingOpen && (
            <form onSubmit={createServing} className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <p className="text-sm font-semibold">New Serving</p>
              <div>
                <label className="block text-xs font-medium mb-1">Name *</label>
                <Input value={servingForm.name} placeholder="e.g. Tot, Quarter, Half"
                  onChange={e => setServingForm({ ...servingForm, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Selling Price (KES) *</label>
                  <Input type="number" value={servingForm.sellingPrice} placeholder="e.g. 50"
                    onChange={e => setServingForm({ ...servingForm, sellingPrice: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Units per Bottle *</label>
                  <Input type="number" value={servingForm.unitsProduced} placeholder="e.g. 18"
                    onChange={e => setServingForm({ ...servingForm, unitsProduced: e.target.value })} required />
                  <p className="text-[10px] text-muted-foreground mt-1">How many of this serving fit in one bottle</p>
                </div>
              </div>
              <Button type="submit" disabled={saving} size="sm">{saving ? 'Adding…' : 'Add Serving'}</Button>
            </form>
          )}

          {servingsLoading ? (
            <p className="text-center text-muted-foreground text-sm py-6">Loading servings…</p>
          ) : servings.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-6">
              <p className="mb-3">No servings yet. Add one to enable portion sales from this item.</p>
              <Button size="sm" onClick={() => setIsServingOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add First Serving
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {servings.map(s => (
                <div key={s._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      KES {s.sellingPrice.toLocaleString()} · {s.unitsProduced} units/bottle
                    </p>
                  </div>
                  <Button variant={s.isActive ? 'default' : 'outline'} size="sm"
                    onClick={() => toggleServing(s)}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottle history */}
      <Card>
        <CardHeader><CardTitle>Bottle History ({bottles.length})</CardTitle></CardHeader>
        <CardContent>
          {bottles.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No bottles opened yet</p>
          ) : (
            <div className="space-y-2">
              {bottles.map(b => (
                <div key={b._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Bottle #{b.bottleNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.state === 'open'   && b.openedAt  && `Opened ${new Date(b.openedAt).toLocaleDateString()}`}
                      {b.state === 'closed' && b.closedAt  && `Closed ${new Date(b.closedAt).toLocaleDateString()}`}
                      {b.state === 'full'   && 'Not yet opened'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold uppercase ${
                      b.state === 'open'   ? 'text-orange-500' :
                      b.state === 'closed' ? 'text-muted-foreground' : ''
                    }`}>
                      {b.state}
                    </p>
                    {b.state === 'open' && b.remainingUnits !== undefined && (
                      <p className="text-xs text-muted-foreground">{b.remainingUnits} units left</p>
                    )}
                    {b.state === 'closed' && b.difference !== undefined && (
                      <p className={`text-xs font-medium ${b.difference < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        Diff: {b.difference > 0 ? '+' : ''}{b.difference}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
