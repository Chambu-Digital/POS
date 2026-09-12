// Purchase Order generation service
import type { BasketItem } from './basket'

export interface POItem {
  moduleItemId: string
  module: string
  itemName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface PurchaseOrder {
  supplierId: string | null
  supplierName: string
  items: POItem[]
  subtotal: number
  total: number
  notes: string
}

/**
 * Generate purchase orders grouped by supplier from basket items
 */
export function generatePurchaseOrders(
  basketItems: BasketItem[],
  notes: string = ''
): PurchaseOrder[] {
  if (basketItems.length === 0) {
    return []
  }

  // Group items by supplier
  const supplierGroups = new Map<string, BasketItem[]>()

  for (const item of basketItems) {
    const supplierId = item.supplier?.id || null
    const supplierName = item.supplier?.name || 'No Supplier'
    const key = supplierId || 'no-supplier'

    if (!supplierGroups.has(key)) {
      supplierGroups.set(key, [])
    }
    supplierGroups.get(key)!.push(item)
  }

  // Create PO for each supplier
  const purchaseOrders: PurchaseOrder[] = []

  for (const [supplierId, items] of supplierGroups.entries()) {
    const poItems: POItem[] = items.map((item) => ({
      moduleItemId: item.moduleItemId,
      module: item.module,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.totalCost
    }))

    const subtotal = poItems.reduce((sum, item) => sum + item.lineTotal, 0)

    purchaseOrders.push({
      supplierId: supplierId === 'no-supplier' ? null : supplierId,
      supplierName: items[0].supplier?.name || 'No Supplier',
      items: poItems,
      subtotal,
      total: subtotal, // Can add tax/shipping later
      notes
    })
  }

  return purchaseOrders
}

/**
 * Generate PO number in format: PO-YYYY-NNNN
 */
export function generatePONumber(lastPONumber: string | null): string {
  const currentYear = new Date().getFullYear()
  
  if (!lastPONumber) {
    return `PO-${currentYear}-0001`
  }

  // Parse last PO number
  const match = lastPONumber.match(/^PO-(\d{4})-(\d+)$/)
  if (!match) {
    return `PO-${currentYear}-0001`
  }

  const lastYear = parseInt(match[1])
  const lastNumber = parseInt(match[2])

  // Reset counter if new year
  if (lastYear < currentYear) {
    return `PO-${currentYear}-0001`
  }

  // Increment counter
  const nextNumber = lastNumber + 1
  return `PO-${currentYear}-${nextNumber.toString().padStart(4, '0')}`
}
