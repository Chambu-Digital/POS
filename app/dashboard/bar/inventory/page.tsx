'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, AlertTriangle, Upload, Download, PackageX, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { BarImportModal } from '@/components/bar/BarImportModal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface InventoryItem {
  _id: string
  name: string          // specific product label, e.g. "Jameson"
  size: string          // e.g. "750ml"
  buyingPrice: number
  bottleSellingPrice: number
  stock: number
  lowStockThreshold: number
  isActive: boolean
  brandId: string
  brandName: string     // brand group name, e.g. "Whiskey"
  brandCategory: string // same as brandName for bar
  openBottle: { _id: string; state: string; remainingUnits: number } | null
  servingCount: number  // how many serving configs exist
  lowStockAlert: boolean
}

type FilterMode = 'all' | 'low' | 'out'

// ── Slug helper (must match [id]/page.tsx) ────────────────────────────────────
function makeSlug(name: string, size: string, id: string): string {
  const slug = `${name} ${size}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug}--${id}`
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BarInventoryPage() {
  return (
    <PermissionGuard requiredPermission="bar.inventory">
      <InventoryContent />
    </PermissionGuard>
  )
}

function InventoryContent() {
  const [items,       setItems]       = useState<InventoryItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterMode,  setFilterMode]  = useState<FilterMode>('all')

  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false)
  const [brandForm, setBrandForm]     = useState({ name: '', category: '', description: '' })
  const [savingBrand, setSavingBrand] = useState(false)

  const [isImportOpen, setIsImportOpen] = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterMode === 'low') params.append('lowStock', 'true')
      if (filterMode === 'out') params.append('outStock', 'true')

      const res = await fetch(`/api/bar/inventory-items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch { toast.error('Failed to load inventory') }
    setLoading(false)
  }

  useEffect(() => { load() }, [filterMode])

  // Refresh when the page regains focus (e.g. returning after a sale)
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') load() }
    function onFocus()   { load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // ── Client-side search filter (applied on top of server filter) ────────────

  const filtered = items.filter(item => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      item.brandName.toLowerCase().includes(q) ||
      item.brandCategory.toLowerCase().includes(q) ||
      item.size.toLowerCase().includes(q)
    )
  })

  // ── Stats (always computed from the full unfiltered list) ──────────────────

  const allItems     = items
  const lowCount     = allItems.filter(i => i.stock > 0 && i.lowStockAlert).length
  const outCount     = allItems.filter(i => i.stock === 0).length
  const totalStock   = allItems.reduce((s, i) => s + i.stock, 0)
  const stockValue   = allItems.reduce((s, i) => s + i.stock * i.buyingPrice, 0)
  const estProfit    = allItems.reduce((s, i) => s + i.stock * (i.bottleSellingPrice - i.buyingPrice), 0)

  // ── Brand creation ─────────────────────────────────────────────────────────

  async function createBrand(e: React.FormEvent) {
    e.preventDefault()
    if (!brandForm.name.trim()) { toast.error('Brand name is required'); return }
    setSavingBrand(true)
    try {
      const res = await fetch('/api/bar/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandForm),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create brand')
      }
      toast.success('Brand created')
      setBrandForm({ name: '', category: '', description: '' })
      setIsBrandDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create brand')
    }
    setSavingBrand(false)
  }

  // ── Template download ──────────────────────────────────────────────────────

  function handleDownloadTemplate() {
    const headers = [
      'type', 'name', 'size', 'quantity', 'buyingPrice', 'bottleSellingPrice', 'lowStockThreshold',
      'serving1Name', 'serving1Units', 'serving1Price',
      'serving2Name', 'serving2Units', 'serving2Price',
      'serving3Name', 'serving3Units', 'serving3Price',
      'serving4Name', 'serving4Units', 'serving4Price',
    ]
    const descriptions = [
      '#Drink category / brand group (e.g. Whiskey)', 'Brand label (e.g. Jameson)',
      'Bottle size (e.g. 750ml)', 'Sealed bottles in stock', 'Cost you paid per bottle (no KSh)',
      'Whole-bottle selling price (0 = not sold whole)', 'Low-stock alert level (default 3)',
      'Serving 1 name (e.g. Tot)', 'How many fit in 1 bottle (e.g. 18)', 'Price per serving (e.g. 50)',
      'Serving 2 name (e.g. Quarter)', 'How many fit in 1 bottle (e.g. 4)', 'Price per serving (e.g. 350)',
      'Serving 3 name (e.g. Half)', 'How many fit in 1 bottle (e.g. 2)', 'Price per serving (e.g. 700)',
      'Serving 4 name (e.g. Double)', 'How many fit in 1 bottle (e.g. 8)', 'Price per serving (e.g. 175)',
    ]
    const rows = [
      ['Whiskey', 'Jameson',   '750ml', '6',  '1240', '0',    '3', 'Tot', '18', '50', 'Quarter', '4', '350', 'Half', '2', '700', '', '', ''],
      ['Vodka',   'Smirnoff',  '750ml', '12', '900',  '0',    '3', 'Tot', '20', '40', 'Quarter', '5', '200', 'Half', '2', '400', '', '', ''],
      ['Beer',    'Tusker',    '500ml', '24', '150',  '200',  '6', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['Wine',    'House Red', '750ml', '8',  '600',  '1800', '2', 'Glass', '5', '300', 'Half-btl', '2', '900', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ]
    const q = (v: string) => v.includes(',') ? `"${v}"` : v
    const lines = [headers.map(q).join(','), descriptions.map(q).join(','), ...rows.map(r => r.map(q).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'bar_inventory_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function deleteItem(item: InventoryItem, e: React.MouseEvent) {
    e.preventDefault()   // stop the Link from navigating
    e.stopPropagation()
    if (!confirm(`Delete "${item.name || item.brandName} ${item.size}"? This also removes its servings and bottle history.`)) return
    setDeletingId(item._id)
    try {
      const res = await fetch(`/api/bar/inventory-items/${item._id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete')
      }
      toast.success('Item deleted')
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete item')
    }
    setDeletingId(null)
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!importFile) { toast.error('Please select a file'); return }
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await fetch('/api/bar/inventory-items/import', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to import')
      }
      const data = await res.json()
      const servingMsg = data.servingsCreated > 0 ? ` and ${data.servingsCreated} servings` : ''
      toast.success(`Imported ${data.imported} item${data.imported !== 1 ? 's' : ''}${servingMsg}`)
      if (data.errors?.length > 0) data.errors.forEach((err: string) => toast.warning(err, { duration: 6000 }))
      setIsImportOpen(false)
      setImportFile(null)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to import items')
    }
    setImporting(false)
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bar Inventory</h1>
          <p className="text-muted-foreground">Manage stock, bottles, and servings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBrandDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Brand
          </Button>
          <Link href="/dashboard/bar/inventory/new">
            <Button><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Catalog</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allItems.length} items</div>
            <p className="text-xs text-muted-foreground mt-1">Estimated profit on current stock</p>
            <p className="text-lg font-semibold text-primary mt-1">KES {estProfit.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Total Stock</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock.toLocaleString()} bottles</div>
            <p className="text-xs text-muted-foreground mt-1">Stock value at buying price</p>
            <p className="text-lg font-semibold text-primary mt-1">KES {stockValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button onClick={() => setIsImportOpen(true)} variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Template
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all', label: 'All Items',   count: allItems.length },
          { key: 'low', label: 'Low Stock',   count: lowCount,  color: 'bg-orange-100 text-orange-700 border-orange-300' },
          { key: 'out', label: 'Out of Stock', count: outCount, color: 'bg-red-100 text-red-700 border-red-300' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilterMode(f.key)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filterMode === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : (f as any).color ?? 'bg-muted text-foreground border-border hover:bg-muted/80',
            ].join(' ')}
          >
            {f.key === 'low' && <AlertTriangle size={13} />}
            {f.key === 'out' && <PackageX size={13} />}
            {f.label}
            <span className="bg-white/30 rounded-full px-1.5 text-xs font-bold">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Brand creation dialog */}
      <Dialog open={isBrandDialogOpen} onOpenChange={setIsBrandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Brand</DialogTitle>
            <DialogDescription>Add a brand group to organise your inventory items</DialogDescription>
          </DialogHeader>
          <form onSubmit={createBrand} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Brand Name *</label>
              <Input value={brandForm.name} onChange={e => setBrandForm({ ...brandForm, name: e.target.value })}
                placeholder="e.g., Whiskey, Beer, Wine" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Input value={brandForm.category} onChange={e => setBrandForm({ ...brandForm, category: e.target.value })}
                placeholder="e.g., Spirits, Beer, Wine" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input value={brandForm.description} onChange={e => setBrandForm({ ...brandForm, description: e.target.value })}
                placeholder="Optional" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsBrandDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingBrand}>{savingBrand ? 'Creating...' : 'Create Brand'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import dialog — full multi-step flow */}
      <BarImportModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={load}
      />

      {/* Item list */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, brand, or size…" value={search}
              onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>

          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {search || filterMode !== 'all' ? 'No items match your filter' : 'No inventory items yet. Add your first item to get started.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(item => {
                // Slug uses the item's own name (e.g. "Jameson"), not the brand group
                const slugHref = `/dashboard/bar/inventory/${makeSlug(item.name || item.brandName, item.size, item._id)}`
                const outOfStock = item.stock === 0
                const lowStock   = !outOfStock && item.lowStockAlert

                return (
                  <Link key={item._id} href={slugHref}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">
                          {item.name || item.brandName} {item.size}
                        </h3>
                        {/* Serving count badge */}
                        {item.servingCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.servingCount} serving{item.servingCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {/* Open bottle indicator */}
                        {item.openBottle && (
                          <span className="text-[10px] font-medium text-orange-500">
                            ● bottle open ({item.openBottle.remainingUnits} units)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.brandCategory && <span>{item.brandCategory} · </span>}
                        KES {item.buyingPrice.toLocaleString()} cost ·{' '}
                        KES {item.bottleSellingPrice.toLocaleString()} bottle
                      </p>
                    </div>

                    <div className="text-right shrink-0 ml-4">
                      <Badge
                        variant={outOfStock ? 'destructive' : lowStock ? 'outline' : 'secondary'}
                        className={lowStock ? 'text-orange-600 border-orange-300' : ''}
                      >
                        {outOfStock ? 'Out of stock' : `${item.stock} left`}
                      </Badge>
                      {lowStock && (
                        <p className="text-[10px] text-orange-500 mt-0.5">Low stock</p>
                      )}
                      <button
                        onClick={(e) => deleteItem(item, e)}
                        disabled={deletingId === item._id}
                        className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                        title="Delete item"
                      >
                        <Trash2 size={12} />
                        {deletingId === item._id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
