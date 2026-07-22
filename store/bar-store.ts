import { create } from 'zustand'

export interface BarTab {
  _id: string
  tabNumber: string
  customerName: string
  tableNumber: string
  status: 'open' | 'hold' | 'billing' | 'paid'
  subtotal: number
  discountPct: number
  discountAmount: number
  total: number
  amountPaid: number
  remaining?: number
  closedAt?: string
  openedAt: string
}

export interface BarState {
  openTabs: BarTab[]
  recentlyClosed: BarTab[]
  outstandingTotal: number
  activeTabId: string | null
  activeTab: BarTab | null
  tabLines: any[]
  searchQuery: string
  categoryFilter: string
  searchResults: any[]       // items from /api/bar/products with servings embedded
  allProducts: any[]         // full unfiltered list, cached after first load
  categories: string[]       // unique brand categories for filter bar
  pendingBottleOpen: { inventoryItemId: string, servingId?: string | null, quantity: number, itemName: string, servingName?: string, unitPrice: number } | null

  // Actions
  loadLandingData: () => Promise<void>
  openTab: (data: any) => Promise<string>
  loadTab: (id: string) => Promise<void>
  addLine: (tabId: string, line: any) => Promise<void>
  setBottleOpenConfirmed: (inventoryItemId: string) => Promise<void>
  cancelBottleOpen: () => void
  setTabStatus: (tabId: string, status: string) => Promise<void>
  applyDiscount: (tabId: string, pct: number) => Promise<void>
  recordPayment: (tabId: string, payment: any) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setCategoryFilter: (category: string) => void
  executeSearch: (opts?: { force?: boolean }) => Promise<void>
  deleteLastLine: (tabId: string, lineId: string) => Promise<void>
}

export const useBarStore = create<BarState>((set, get) => ({
  openTabs: [],
  recentlyClosed: [],
  outstandingTotal: 0,
  activeTabId: null,
  activeTab: null,
  tabLines: [],
  searchQuery: '',
  categoryFilter: '',
  searchResults: [],
  allProducts: [],
  categories: [],
  pendingBottleOpen: null,

  loadLandingData: async () => {
    try {
      const [tabsRes, outRes] = await Promise.all([
        fetch('/api/bar/tabs?status=open'),
        fetch('/api/bar/reports/outstanding')
      ])
      const tabsData = await tabsRes.json()
      const outData = await outRes.json()

      set({ 
        openTabs: tabsData.tabs || [],
        outstandingTotal: outData.outstanding?.totalOutstanding || 0 
      })
    } catch (err) {
      console.error(err)
    }
  },

  openTab: async (data) => {
    const res = await fetch('/api/bar/tabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to create tab')
    
    set((state) => ({ openTabs: [json.tab, ...state.openTabs] }))
    return json.tab._id
  },

  loadTab: async (id) => {
    try {
      const res = await fetch(`/api/bar/tabs/${id}`)
      const data = await res.json()
      if (res.ok) {
        set({ activeTabId: id, activeTab: data.tab, tabLines: data.tab.lines || [] })
      }
    } catch (err) {
      console.error(err)
    }
  },

  addLine: async (tabId, line) => {
    const res = await fetch(`/api/bar/tabs/${tabId}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(line)
    })
    
    if (res.status === 409) {
      const errorData = await res.json()
      if (errorData.requiresBottleOpen) {
        set({ pendingBottleOpen: { ...line, inventoryItemId: errorData.inventoryItemId } })
        return
      }
      throw new Error(errorData.error || 'Conflict')
    }

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add line')
    
    set((state) => ({ 
      activeTab: data.tab, 
      tabLines: [...state.tabLines, data.tabLine] 
    }))
  },

  setBottleOpenConfirmed: async (inventoryItemId) => {
    try {
      const res = await fetch('/api/bar/bottles/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryItemId })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to open bottle')
      }
      
      const { pendingBottleOpen, activeTabId } = get()
      if (pendingBottleOpen && activeTabId) {
        // Retry adding line
        const retryLine = { ...pendingBottleOpen }
        set({ pendingBottleOpen: null })
        await get().addLine(activeTabId, retryLine)
      }
    } catch (err) {
      console.error(err)
      throw err
    }
  },

  cancelBottleOpen: () => set({ pendingBottleOpen: null }),

  setTabStatus: async (tabId, status) => {
    const res = await fetch(`/api/bar/tabs/${tabId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    set({ activeTab: data.tab })
  },

  applyDiscount: async (tabId, pct) => {
    const res = await fetch(`/api/bar/tabs/${tabId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountPct: pct })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    set({ activeTab: data.tab })
  },

  recordPayment: async (tabId, payment) => {
    const res = await fetch(`/api/bar/tabs/${tabId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    set({ activeTab: data.tab })
  },

  closeTab: async (tabId) => {
    const res = await fetch(`/api/bar/tabs/${tabId}/close`, {
      method: 'POST'
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    set({ activeTab: data.tab, activeTabId: null })
  },

  deleteLastLine: async (tabId, lineId) => {
    const res = await fetch(`/api/bar/tabs/${tabId}/lines/${lineId}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('Failed to delete line')
    // Reload tab to get accurate lines
    await get().loadTab(tabId)
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  setCategoryFilter: (category) => {
    set({ categoryFilter: category })
  },

  executeSearch: async (opts = {}) => {
    const { searchQuery, categoryFilter, allProducts } = get()

    // ── First load or forced refresh — fetch from API ──────────────────────
    if (allProducts.length === 0 || opts.force) {
      try {
        const res  = await fetch('/api/bar/products')
        const data = await res.json()
        const products: any[] = data.products   ?? []
        const categories: string[] = data.categories ?? []
        set({ allProducts: products, categories })
        // Fall through to filter the freshly loaded list
        const q   = searchQuery.trim().toLowerCase()
        const cat = categoryFilter.trim().toLowerCase()
        const filtered = products.filter(p => {
          if (cat && p.brandCategory.toLowerCase() !== cat) return false
          if (q) {
            const inBrand = p.brandName.toLowerCase().includes(q)
            const inSize  = p.size.toLowerCase().includes(q)
            if (!inBrand && !inSize) return false
          }
          return true
        })
        set({ searchResults: filtered })
      } catch (err) {
        console.error('[bar-store] executeSearch error:', err)
      }
      return
    }

    // ── Subsequent calls — filter the cached list client-side ──────────────
    const q   = searchQuery.trim().toLowerCase()
    const cat = categoryFilter.trim().toLowerCase()
    const filtered = allProducts.filter((p: any) => {
      if (cat && p.brandCategory.toLowerCase() !== cat) return false
      if (q) {
        const inBrand = p.brandName.toLowerCase().includes(q)
        const inSize  = p.size.toLowerCase().includes(q)
        if (!inBrand && !inSize) return false
      }
      return true
    })
    set({ searchResults: filtered })
  },
}))
