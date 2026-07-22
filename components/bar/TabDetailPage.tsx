'use client'

import { useEffect, useState } from 'react'
import { useBarStore } from '@/store/bar-store'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import { TabStatusBadge } from './tabs/TabStatusBadge'
import { TabLineItem } from './tabs/TabLineItem'
import { RunningBalanceBar } from './tabs/RunningBalanceBar'
import { DiscountSelector } from './tabs/DiscountSelector'
import { PaymentPanel } from './tabs/PaymentPanel'
import { BrandSearchInput } from './product/BrandSearchInput'
import { CategoryFilterBar } from './product/CategoryFilterBar'
import { InventoryItemCard } from './product/InventoryItemCard'
import { BottleOpenPrompt } from './bottles/BottleOpenPrompt'
import { ScrollArea } from '@/components/ui/scroll-area'

export function TabDetailPage({ tabId }: { tabId: string }) {
  const router = useRouter()
  const { loadTab, activeTab, tabLines, searchResults, addLine, executeSearch } = useBarStore()
  const [printLoading, setPrintLoading] = useState(false)

  useEffect(() => {
    loadTab(tabId)
    executeSearch({ force: true }) // load products with servings for this tab
  }, [tabId, loadTab, executeSearch])

  if (!activeTab) return <div className="p-6">Loading...</div>

  const handleAddLine = async (inventoryItemId: string, servingId: string | null, price: number, name: string, servingName?: string) => {
    try {
      await addLine(tabId, { inventoryItemId, servingId, quantity: 1, unitPrice: price, itemName: name, servingName: servingName ?? '' })
    } catch (err) {
      console.error(err)
    }
  }

  const handlePrint = async () => {
    setPrintLoading(true)
    try {
      // Stub for printing logic. Could open a new window or trigger an API.
      window.print()
    } finally {
      setPrintLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/bar')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-3">
              Tab {activeTab.tabNumber}
              <TabStatusBadge status={activeTab.status} />
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab.customerName || 'Walk-in'} {activeTab.tableNumber ? `• Table ${activeTab.tableNumber}` : ''}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint} disabled={printLoading}>
          <Printer className="mr-2 h-4 w-4" /> Print Bill
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Product Selection (Only show if open) */}
        <div className={`flex-1 border-r flex flex-col bg-muted/20 ${activeTab.status !== 'open' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="p-4 shrink-0 space-y-2 border-b bg-background">
            <BrandSearchInput />
            <CategoryFilterBar />
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
              {searchResults.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-10">No items found</div>
              ) : (
                searchResults.map((brand: any) => (
                  <InventoryItemCard key={brand._id} item={brand} onAdd={handleAddLine} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side: Tab Current State */}
        <div className="w-[400px] shrink-0 flex flex-col bg-background relative">
          <div className="p-4 border-b font-semibold bg-muted/30">Order Summary</div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-1">
              {tabLines.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No items on this tab.</div>
              ) : (
                tabLines.map((line: any) => (
                  <TabLineItem key={line._id} line={line} tabId={tabId} />
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-4 bg-background border-t shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] z-10 space-y-4">
            <RunningBalanceBar />
            {activeTab.status === 'open' && (
              <DiscountSelector />
            )}
            <PaymentPanel />
          </div>
        </div>
      </div>
      <BottleOpenPrompt />
    </div>
  )
}
