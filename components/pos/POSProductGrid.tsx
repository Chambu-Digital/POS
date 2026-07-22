'use client'

// ─── POSProductGrid ────────────────────────────────────────────────────────────
// Generic product browser shared by Retail POS, Bar POS, and Pharmacy POS.
// Renders a search bar, optional category filter chips, and a grid of product
// cards. The actual card rendering is left to the caller via `renderCard` so
// each module can display domain-specific fields (servings, Rx badges, etc.)

import { useEffect, useRef, useState } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ManualBarcodeEntry } from '@/components/barcode/manual-barcode-entry'
import { ScannerFeedback } from '@/components/barcode/scanner-feedback'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import type { ScanResult } from '@/lib/barcode-scanner/types'
import { cn } from '@/lib/utils'

export interface POSProductGridProps<T> {
  /** All products for the current module */
  products: T[]
  /** Loading state */
  loading: boolean
  /** Show offline warning banner */
  offline?: boolean
  /** Categories for the filter chips (empty = no chips rendered) */
  categories?: string[]
  /** Active category filter value */
  categoryFilter?: string
  /** Called when the user clicks a category chip */
  onCategoryChange?: (cat: string) => void
  /** Search placeholder text */
  searchPlaceholder?: string
  /** Barcode scanner context identifier — keeps scanner isolated per POS */
  scannerContext?: 'sales' | 'bar' | 'pharmacy'
  /** Called when a barcode scan resolves to a product */
  onScanResult?: (result: ScanResult) => void
  /** Renders one product card; caller handles click internally */
  renderCard: (product: T, helpers: { enterEditing: () => void; exitEditing: () => void }) => React.ReactNode
  /** Content to render in the top-right corner of the header row (e.g. HeldOrders) */
  headerActions?: React.ReactNode
  /** Page title */
  title?: string
  /** Page subtitle */
  subtitle?: string
  /** Ref for scrolling back to the top from mobile */
  containerRef?: React.RefObject<HTMLDivElement>
}

export function POSProductGrid<T>({
  products,
  loading,
  offline = false,
  categories = [],
  categoryFilter = '',
  onCategoryChange,
  searchPlaceholder = 'Search…',
  scannerContext = 'sales',
  onScanResult,
  renderCard,
  headerActions,
  title = 'Make Sale',
  subtitle = 'Search and add products to cart',
  containerRef,
}: POSProductGridProps<T>) {
  const [search, setSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const [displayProducts, setDisplayProducts] = useState<T[]>(products)

  // Re-filter whenever search or category changes
  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      // Products are already pre-filtered server-side or by the parent.
      // This client-side filter is a fast UX layer on top.
      if (!search.trim()) {
        setDisplayProducts(products)
        return
      }
      const q = search.toLowerCase()
      setDisplayProducts(
        products.filter(p => {
          const obj = p as any
          return (
            (obj.productName  || '').toLowerCase().includes(q) ||
            (obj.name         || '').toLowerCase().includes(q) ||
            (obj.brandName    || '').toLowerCase().includes(q) ||
            (obj.brand        || '').toLowerCase().includes(q) ||
            (obj.model        || '').toLowerCase().includes(q) ||
            (obj.variant      || '').toLowerCase().includes(q) ||
            (obj.genericName  || '').toLowerCase().includes(q) ||
            (obj.size         || '').toLowerCase().includes(q)
          )
        })
      )
    }, 120)
    return () => clearTimeout(searchTimer.current)
  }, [search, products])

  // ── Barcode scanner ────────────────────────────────────────────────────────
  const { state: scannerState, lastResult, submitManual, enterEditing, exitEditing } =
    useBarcodeScanner({
      context: scannerContext,
      onResult: (result) => onScanResult?.(result),
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <p className="font-semibold">Loading products…</p>
            <p className="text-sm text-muted-foreground mt-1">Please wait</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Offline banner */}
      {offline && (
        <Alert className="mx-4 mt-3 bg-yellow-50 border-yellow-200 shrink-0">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 text-sm">
            You are offline. Sales will be saved locally and synced when you reconnect.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold leading-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {headerActions}
        </div>

        {/* Search bar */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={enterEditing}
            onBlur={exitEditing}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {/* Manual barcode */}
        <ManualBarcodeEntry onSubmit={submitManual} onFocus={enterEditing} onBlur={exitEditing} />

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-2 scrollbar-hide">
            <button
              onClick={() => onCategoryChange?.('')}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                categoryFilter === ''
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              )}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => onCategoryChange?.(cat)}
                className={cn(
                  'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                  categoryFilter === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {displayProducts.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            {search ? `No results for "${search}"` : 'No products found'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {displayProducts.map((p, i) => (
              <div key={(p as any)._id ?? i}>
                {renderCard(p, { enterEditing, exitEditing })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scanner feedback overlay */}
      <ScannerFeedback state={scannerState} lastResult={lastResult} />
    </div>
  )
}
