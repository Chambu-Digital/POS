'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, AlertTriangle, Upload, Download, Package } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGuard } from '@/components/auth/permission-guard'
import Link from 'next/link'
import { makeSlugParam } from './[id]/page'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface InventoryItem {
  _id: string
  name: string
  size: string
  buyingPrice: number
  bottleSellingPrice: number
  stock: number
  lowStockThreshold: number
  isActive: boolean
  // The GET route returns these as flat fields joined from the brand lookup
  brandName: string
  brandCategory?: string
  // brand object may also be present depending on API version
  brand?: {
    _id: string
    name: string
    category: string
  }
  openBottle?: {
    state: string
    remainingUnits: number
  }
}

export default function BarInventoryPage() {
  return (
    <PermissionGuard requiredPermission="bar.inventory">
      <InventoryContent />
    </PermissionGuard>
  )
}

function InventoryContent() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLowStock, setFilterLowStock] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [isBrandDialogOpen, setIsBrandDialogOpen] = useState(false)
  const [brandForm, setBrandForm] = useState({ name: '', category: '', description: '' })
  const [savingBrand, setSavingBrand] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => { load() }, [])

  // Refresh stock counts when the user returns to this page
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') load() }
    function onFocus() { load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBrand) params.append('brandId', selectedBrand)
      if (filterLowStock) params.append('lowStock', 'true')
      
      const res = await fetch(`/api/bar/inventory-items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch { toast.error('Failed to load inventory') }
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedBrand, filterLowStock])

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
      toast.success('Brand created successfully')
      setBrandForm({ name: '', category: '', description: '' })
      setIsBrandDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create brand')
    }
    setSavingBrand(false)
  }

  function handleDownloadTemplate() {
    // Row 1 : column headers
    // Row 2 : human-readable description of each column  (starts with # so importer skips it)
    // Row 3 : filled Jameson example  — spirits with 4 serving sizes
    // Row 4 : filled Smirnoff example — spirits with 3 serving sizes
    // Row 5 : filled Tusker example   — beer sold as whole bottles only
    // Row 6 : filled house wine example — wine with 2 serving sizes + bottle price
    // Row 7 : blank row ready for the user to fill in

    const headers = [
      'type',
      'name',
      'size',
      'quantity',
      'buyingPrice',
      'bottleSellingPrice',
      'lowStockThreshold',
      'serving1Name', 'serving1Units', 'serving1Price',
      'serving2Name', 'serving2Units', 'serving2Price',
      'serving3Name', 'serving3Units', 'serving3Price',
      'serving4Name', 'serving4Units', 'serving4Price',
    ]

    // Description row — each cell explains that column.
    // Prefixed with # so the importer's header-index lookup simply won't find these
    // and they will be skipped (no column named "#type" etc.).
    const descriptions = [
      '#Drink category / brand group (e.g. Whiskey)',
      'Brand label (e.g. Jameson)',
      'Bottle size (e.g. 750ml)',
      'Sealed bottles in stock',
      'Cost you paid per bottle (no KSh)',
      'Whole-bottle selling price (0 = not sold whole)',
      'Low-stock alert level (default 3)',
      'Serving 1 name (e.g. Tot)',    'How many fit in 1 bottle (e.g. 18)', 'Price per serving (e.g. 50)',
      'Serving 2 name (e.g. Quarter)','How many fit in 1 bottle (e.g. 4)',  'Price per serving (e.g. 350)',
      'Serving 3 name (e.g. Half)',   'How many fit in 1 bottle (e.g. 2)',  'Price per serving (e.g. 700)',
      'Serving 4 name (e.g. Double)',  'How many fit in 1 bottle (e.g. 8)', 'Price per serving (e.g. 175)',
    ]

    const rows = [
      // ── Example 1: Jameson 750ml — 3 serving sizes ────────────────────────
      ['Whiskey', 'Jameson', '750ml', '6', '1240', '0', '3',
        'Tot',     '18', '50',
        'Quarter', '4',  '350',
        'Half',    '2',  '700',
        '',        '',   ''],

      // ── Example 2: Smirnoff 750ml — 3 serving sizes ───────────────────────
      ['Vodka', 'Smirnoff', '750ml', '12', '900', '0', '3',
        'Tot',     '20', '40',
        'Quarter', '5',  '200',
        'Half',    '2',  '400',
        '',        '',   ''],

      // ── Example 3: Tusker 500ml — sold as whole bottles, no servings ──────
      ['Beer', 'Tusker', '500ml', '24', '150', '200', '6',
        '', '', '',
        '', '', '',
        '', '', '',
        '', '', ''],

      // ── Example 4: House Red Wine 750ml — 2 serving sizes + bottle price ──
      ['Wine', 'House Red', '750ml', '8', '600', '1800', '2',
        'Glass',    '5', '300',
        'Half-btl', '2', '900',
        '',         '',  '',
        '',         '',  ''],

      // ── Blank row for the user ─────────────────────────────────────────────
      ['', '', '', '', '', '', '',
        '', '', '',
        '', '', '',
        '', '', '',
        '', '', ''],
    ]

    // Quote a cell that contains a comma
    function q(v: string) { return v.includes(',') ? `"${v}"` : v }

    const lines = [
      headers.map(q).join(','),
      descriptions.map(q).join(','),
      ...rows.map(r => r.map(q).join(',')),
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url  = window.URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'bar_inventory_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!importFile) { toast.error('Please select a file'); return }
    
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      
      const res = await fetch('/api/bar/inventory-items/import', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to import')
      }
      
      const data = await res.json()
      const servingMsg = data.servingsCreated > 0 ? ` and ${data.servingsCreated} servings` : ''
      toast.success(`Imported ${data.imported} item${data.imported !== 1 ? 's' : ''}${servingMsg}`)
      if (data.errors?.length > 0) {
        data.errors.forEach((err: string) => toast.warning(err, { duration: 6000 }))
      }
      setIsImportOpen(false)
      setImportFile(null)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to import items')
    }
    setImporting(false)
  }

  const filtered = items.filter(item => {
    const itemName  = item.name  ?? ''
    const brandName = (item.brand?.name ?? (item as any).brandName ?? '')
    const q = search.toLowerCase()
    return itemName.toLowerCase().includes(q) || brandName.toLowerCase().includes(q)
  })

  const lowStockItems = items.filter(i => i.stock > 0 && i.stock <= i.lowStockThreshold)
  const outOfStockItems = items.filter(i => i.stock === 0)
  const totalStock = items.reduce((sum, i) => sum + i.stock, 0)
  const stockValue = items.reduce((sum, i) => sum + (i.stock * i.buyingPrice), 0)
  const estimatedProfit = items.reduce((sum, i) => sum + (i.stock * (i.bottleSellingPrice - i.buyingPrice)), 0)

  return (
    <div className="space-y-6">
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
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items in Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
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
            <p className="text-sm text-muted-foreground">Stock Value</p>
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
            <Button onClick={() => setIsImportOpen(true)} variant="outline" size="sm" className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Template
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <button
          onClick={() => setFilterLowStock(true)}
          className={`border rounded-xl p-3 text-left hover:shadow-sm transition-shadow ${filterLowStock ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}
        >
          <p className="text-2xl font-bold">{lowStockItems.length}</p>
          <p className="text-xs font-medium mt-0.5">Low Stock</p>
        </button>
        <button
          onClick={() => setFilterLowStock(true)}
          className={`border rounded-xl p-3 text-left hover:shadow-sm transition-shadow ${filterLowStock ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-50 border-red-200 text-red-700'}`}
        >
          <p className="text-2xl font-bold">{outOfStockItems.length}</p>
          <p className="text-xs font-medium mt-0.5">Out of Stock</p>
        </button>
      </div>

      <Dialog open={isBrandDialogOpen} onOpenChange={setIsBrandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Brand</DialogTitle>
            <DialogDescription>Add a new brand to organize your inventory items</DialogDescription>
          </DialogHeader>
          <form onSubmit={createBrand} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Brand Name *</label>
              <Input
                value={brandForm.name}
                onChange={e => setBrandForm({ ...brandForm, name: e.target.value })}
                placeholder="e.g., Jameson, Tusker, Heineken"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Input
                value={brandForm.category}
                onChange={e => setBrandForm({ ...brandForm, category: e.target.value })}
                placeholder="e.g., Whisky, Beer, Wine, Vodka"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={brandForm.description}
                onChange={e => setBrandForm({ ...brandForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsBrandDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingBrand}>
                {savingBrand ? 'Creating...' : 'Create Brand'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Bar Inventory</DialogTitle>
            <DialogDescription>
              Upload a CSV with your stock and serving definitions in one go.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImport} className="space-y-4">
            {/* Format reminder */}
            <div className="rounded-lg bg-muted px-4 py-3 text-xs space-y-1.5">
              <p className="font-semibold text-sm">Required columns</p>
              <p><span className="font-medium">type</span> — drink category (becomes the brand, e.g. Whiskey)</p>
              <p><span className="font-medium">name</span> — brand label (e.g. Jameson)</p>
              <p><span className="font-medium">size</span> — bottle size (e.g. 750ml)</p>
              <p><span className="font-medium">quantity</span> — bottles in stock</p>
              <p><span className="font-medium">buyingPrice</span> — cost per bottle</p>
              <p className="font-semibold text-sm pt-1">Serving columns (repeat up to 4×)</p>
              <p><span className="font-medium">serving1Name</span>, <span className="font-medium">serving1Units</span>, <span className="font-medium">serving1Price</span></p>
              <p className="text-muted-foreground">Units = how many of that serving fit in one bottle</p>
              <p className="italic text-muted-foreground pt-1">Download the template to see a filled example.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">File *</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
                required
                className="w-full text-sm border rounded-md px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">Accepts .csv, .xlsx, or .xls</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={importing}>
                {importing ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={filterLowStock ? "default" : "outline"}
              onClick={() => setFilterLowStock(!filterLowStock)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Low Stock
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search || filterLowStock ? 'No items found' : 'No inventory items yet. Add your first item to get started.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(item => (
                <Link
                  key={item._id}
                  href={`/dashboard/bar/inventory/${makeSlugParam(item.brandName ?? (item as any).brand?.name ?? '', item.size, item._id)}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{(item as any).name || item.brandName || '—'} {item.size}</h3>
                    <p className="text-sm text-muted-foreground">
                      {(item.brand?.name ?? (item as any).brandName ?? '—')} • {item.size} • {item.brand?.category ?? (item as any).brandCategory ?? ''}
                    </p>
                    {item.openBottle?.state === 'open' && (
                      <p className="text-xs text-orange-600 mt-1">
                        Bottle open: {item.openBottle.remainingUnits} units remaining
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${item.stock <= item.lowStockThreshold ? 'text-red-600' : ''}`}>
                      Stock: {item.stock}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      KES {item.bottleSellingPrice.toLocaleString()}
                    </p>
                    {item.stock <= item.lowStockThreshold && (
                      <p className="text-xs text-red-600">Low stock</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
