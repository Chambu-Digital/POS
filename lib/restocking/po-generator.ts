// RFQ generation service
import type { BasketItem } from './basket'

export interface RFQItem {
  moduleItemId: string
  module: string
  itemName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface RFQ {
  supplierId: string | null
  supplierName: string
  items: RFQItem[]
  subtotal: number
  total: number
  notes: string
}

/**
 * Generate a single RFQ from basket items — no supplier grouping.
 * All items go into one restock list.
 */
export function generateRFQ(
  basketItems: BasketItem[],
  notes: string = ''
): RFQ {
  if (basketItems.length === 0) {
    return {
      supplierId: null,
      supplierName: 'Restock List',
      items: [],
      subtotal: 0,
      total: 0,
      notes
    }
  }

  const items: RFQItem[] = basketItems.map((item) => ({
    moduleItemId: item.moduleItemId,
    module: item.module,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.totalCost
  }))

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)

  return {
    supplierId: null,
    supplierName: 'Restock List',
    items,
    subtotal,
    total: subtotal,
    notes
  }
}

/**
 * Generate RFQ number in format: RFQ-YYYY-NNNN
 * Handles legacy PO- prefixed numbers for continuity.
 */
export function generateRFQNumber(lastNumber: string | null): string {
  const currentYear = new Date().getFullYear()

  if (!lastNumber) {
    return `RFQ-${currentYear}-0001`
  }

  // Parse last number (supports both PO- and RFQ- prefixes)
  const match = lastNumber.match(/^(?:PO|RFQ)-(\d{4})-(\d+)$/)
  if (!match) {
    return `RFQ-${currentYear}-0001`
  }

  const lastYear = parseInt(match[1])
  const lastNum = parseInt(match[2])

  if (lastYear < currentYear) {
    return `RFQ-${currentYear}-0001`
  }

  const nextNumber = lastNum + 1
  return `RFQ-${currentYear}-${nextNumber.toString().padStart(4, '0')}`
}
