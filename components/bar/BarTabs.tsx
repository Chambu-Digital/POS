'use client'

// ─── BarTabs ───────────────────────────────────────────────────────────────────
// Sheet that lists open bar tabs.
// Sits next to the Held Orders button in the Bar POS header.
//
// Features:
//   - Shows count badge when there are open tabs
//   - "New Tab" button opens a small modal for name / table
//   - Each tab card shows name, item count, running total, time
//   - "Recall" loads the tab's items into the Bar POS cart
//   - Unsynced tabs show a small indicator dot
//   - Tabs are stored offline-first in localStorage via lib/bar-tabs-cache.ts

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { GlassWater, Plus, RotateCcw, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  readTabs,
  createLocalTab,
  getOpenTabs,
  type LocalTab,
} from '@/lib/bar-tabs-cache'
import { isOnline } from '@/lib/indexeddb'

interface CartItem {
  productId:    string
  productName:  string
  brand?:       string
  sellingPrice: number
  quantity:     number
  discount:     number
}

interface BarTabsProps {
  /** Called when the user recalls a tab — loads its items into the Bar POS cart */
  onRecall: (tab: LocalTab, cart: CartItem[], cartDiscount: number) => void
  /** The current active tab's localId, if any */
  activeTabId?: string | null
}

export function BarTabs({ onRecall, activeTabId }: BarTabsProps) {
  const [open,      setOpen]      = useState(false)
  const [tabs,      setTabs]      = useState<LocalTab[]>([])
  const [creating,  setCreating]  = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newTable,  setNewTable]  = useState('')
  const [newNotes,  setNewNotes]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [online,    setOnline]    = useState(true)

  const load = useCallback(() => {
    setTabs(getOpenTabs())
    setOnline(isOnline())
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('focus',   load)
    window.addEventListener('storage', load)
    window.addEventListener('online',  load)
    window.addEventListener('offline', load)
    return () => {
      window.removeEventListener('focus',   load)
      window.removeEventListener('storage', load)
      window.removeEventListener('online',  load)
      window.removeEventListener('offline', load)
    }
  }, [load])

  // Refresh when the sheet opens
  useEffect(() => { if (open) load() }, [open, load])

  // ── Create a new tab ─────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!newName.trim()) { toast.error('Tab name is required'); return }
    setSaving(true)
    try {
      const tab = createLocalTab({
        customerName: newName.trim(),
        tableNumber:  newTable.trim() || undefined,
        notes:        newNotes.trim() || undefined,
      })

      // Fire-and-forget server sync if online
      if (isOnline()) {
        fetch('/api/bar/tabs', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            customerName: tab.customerName,
            tableNumber:  tab.tableNumber,
            notes:        tab.notes,
          }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.tab?._id) {
              // Update localStorage with the real server ID
              const { updateTab } = require('@/lib/bar-tabs-cache')
              updateTab(tab.localId, { serverId: data.tab._id, synced: true })
            }
          })
          .catch(() => {/* silent — will sync later */})
      }

      load()
      setCreating(false)
      setNewName('')
      setNewTable('')
      setNewNotes('')
      toast.success(`Tab opened for ${tab.customerName}`)

      // Auto-recall the new (empty) tab so the cashier can immediately add items
      onRecall(tab, [], 0)
      setOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create tab')
    } finally {
      setSaving(false)
    }
  }

  // ── Recall an existing tab ───────────────────────────────────────────────────

  function handleRecall(tab: LocalTab) {
    // Convert stored lines back to CartItem shape
    const cart: CartItem[] = tab.lines.map(line => ({
      productId:    line.servingId
        ? `${line.inventoryItemId}__${line.servingName}`
        : line.inventoryItemId,
      productName:  line.servingName
        ? `${line.itemName} — ${line.servingName}`
        : line.itemName,
      sellingPrice: line.unitPrice,
      quantity:     line.quantity,
      discount:     line.discount,
    }))
    onRecall(tab, cart, tab.cartDiscount)
    setOpen(false)
    toast.success(`Tab recalled: ${tab.customerName}`)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function tabTotal(tab: LocalTab): number {
    const linesTotal = tab.lines.reduce(
      (s, l) => s + l.unitPrice * l.quantity - l.discount, 0
    )
    return Math.max(0, linesTotal - tab.cartDiscount)
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1)  return 'Just now'
    if (m < 60) return `${m}m ago`
    return `${Math.floor(m / 60)}h ${m % 60}m ago`
  }

  const count    = tabs.length
  const hasOpen  = count > 0
  const isActive = !!activeTabId

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant={isActive ? 'default' : hasOpen ? 'default' : 'outline'}
            size="sm"
            className={`relative transition-all ${
              isActive
                ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-200'
                : hasOpen
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm'
                : ''
            }`}
          >
            <GlassWater className="h-4 w-4 mr-1.5" />
            {isActive ? 'On Tab' : hasOpen ? `${count} Tab${count !== 1 ? 's' : ''}` : 'Tabs'}
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Open Tabs</span>
              {!online && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-normal">
                  <WifiOff size={12} /> Offline
                </span>
              )}
              {online && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-normal">
                  <Wifi size={12} /> Online
                </span>
              )}
            </SheetTitle>
            <SheetDescription>
              Recall an open tab or start a new one.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {/* New tab button */}
            <Button
              size="sm"
              className="w-full"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Tab
            </Button>

            {/* Tab list */}
            {tabs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No open tabs
              </p>
            ) : (
              tabs.map(tab => (
                <div
                  key={tab.localId}
                  className={`border rounded-lg p-3 space-y-2 transition-colors ${
                    activeTabId === tab.localId ? 'border-orange-400 bg-orange-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">
                          {tab.customerName}
                        </p>
                        {!tab.synced && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                            title="Not synced to server yet"
                          />
                        )}
                        {activeTabId === tab.localId && (
                          <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300 shrink-0">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tab.tableNumber ? `Table ${tab.tableNumber} · ` : ''}
                        {tab.lines.length} item{tab.lines.length !== 1 ? 's' : ''}
                        {' · '}
                        {timeAgo(tab.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2">
                      KSh {tabTotal(tab).toLocaleString()}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    className="w-full"
                    variant={activeTabId === tab.localId ? 'outline' : 'default'}
                    onClick={() => handleRecall(tab)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    {activeTabId === tab.localId ? 'Re-load Tab' : 'Recall Tab'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── New Tab modal ──────────────────────────────────────────────────── */}
      <Dialog open={creating} onOpenChange={v => { setCreating(v); if (!v) { setNewName(''); setNewTable(''); setNewNotes('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Tab</DialogTitle>
            <DialogDescription>
              Enter the customer or table name to open a new tab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Customer / Guest Name <span className="text-red-500">*</span>
              </label>
              <Input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. John, Group A"
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Table Number <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Input
                value={newTable}
                onChange={e => setNewTable(e.target.value)}
                placeholder="e.g. 5, VIP"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Input
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="e.g. Birthday party"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button className="flex-1" disabled={saving || !newName.trim()} onClick={handleCreate}>
                {saving ? 'Opening…' : 'Open Tab'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
