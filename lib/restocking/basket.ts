// Restock basket item type
// The basket is a shopping list — items and quantities only.
// Prices are estimates (from buyingPrice) and get confirmed later
// at the purchase order level, not in the basket.
export interface BasketItem {
  moduleItemId: string
  module: string
  itemName: string
  category: string
  quantity: number
  unitPrice: number      // estimate from buyingPrice, can be 0
  totalCost: number      // estimate, can be 0
  supplier: {
    id: string
    name: string
  } | null
}

export interface BasketState {
  items: BasketItem[]
  totalItems: number
  totalCost: number
}

// Client-side basket utilities
export function addToBasket(
  currentBasket: BasketItem[],
  newItem: Omit<BasketItem, 'totalCost'> & { quantity?: number }
): BasketItem[] {
  const quantity = newItem.quantity || 1
  const existingIndex = currentBasket.findIndex(
    (item) => item.moduleItemId === newItem.moduleItemId && item.module === newItem.module
  )

  if (existingIndex >= 0) {
    // Update existing item — accumulate quantity
    const updated = [...currentBasket]
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: updated[existingIndex].quantity + quantity,
      totalCost: (updated[existingIndex].quantity + quantity) * updated[existingIndex].unitPrice
    }
    return updated
  }

  // Add new item
  return [
    ...currentBasket,
    {
      ...newItem,
      quantity,
      totalCost: quantity * newItem.unitPrice
    }
  ]
}

export function updateBasketItemQuantity(
  basket: BasketItem[],
  moduleItemId: string,
  module: string,
  quantity: number
): BasketItem[] {
  if (quantity <= 0) {
    return removeFromBasket(basket, moduleItemId, module)
  }

  return basket.map((item) => {
    if (item.moduleItemId === moduleItemId && item.module === module) {
      return {
        ...item,
        quantity,
        totalCost: quantity * item.unitPrice
      }
    }
    return item
  })
}

export function removeFromBasket(
  basket: BasketItem[],
  moduleItemId: string,
  module: string
): BasketItem[] {
  return basket.filter(
    (item) => !(item.moduleItemId === moduleItemId && item.module === module)
  )
}

export function clearBasket(): BasketItem[] {
  return []
}

export function getBasketSummary(basket: BasketItem[]): BasketState {
  return {
    items: basket,
    totalItems: basket.reduce((sum, item) => sum + item.quantity, 0),
    totalCost: basket.reduce((sum, item) => sum + item.totalCost, 0)
  }
}

export function groupBasketBySupplier(basket: BasketItem[]): Map<string, BasketItem[]> {
  const grouped = new Map<string, BasketItem[]>()

  for (const item of basket) {
    const supplierId = item.supplier?.id || 'no-supplier'
    const supplierName = item.supplier?.name || 'No Supplier'
    const key = `${supplierId}:${supplierName}`

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(item)
  }

  return grouped
}
