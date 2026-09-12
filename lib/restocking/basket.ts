// Restock basket item type
export interface BasketItem {
  moduleItemId: string
  module: string
  itemName: string
  category: string
  quantity: number
  unitPrice: number
  totalCost: number
  supplier: {
    id: string
    name: string
  } | null
  notes?: string
  // Track original recommended values for visual diff
  originalQuantity?: number
  originalPrice?: number
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
    // Update existing item - keep original values
    const updated = [...currentBasket]
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: updated[existingIndex].quantity + quantity,
      totalCost: (updated[existingIndex].quantity + quantity) * updated[existingIndex].unitPrice
    }
    return updated
  }

  // Add new item - store original values for diff tracking
  return [
    ...currentBasket,
    {
      ...newItem,
      quantity,
      totalCost: quantity * newItem.unitPrice,
      originalQuantity: quantity,
      originalPrice: newItem.unitPrice,
      notes: newItem.notes || ''
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

export function updateBasketItemPrice(
  basket: BasketItem[],
  moduleItemId: string,
  module: string,
  unitPrice: number
): BasketItem[] {
  if (unitPrice < 0) return basket

  return basket.map((item) => {
    if (item.moduleItemId === moduleItemId && item.module === module) {
      return {
        ...item,
        unitPrice,
        totalCost: item.quantity * unitPrice
      }
    }
    return item
  })
}

export function updateBasketItemNotes(
  basket: BasketItem[],
  moduleItemId: string,
  module: string,
  notes: string
): BasketItem[] {
  return basket.map((item) => {
    if (item.moduleItemId === moduleItemId && item.module === module) {
      return {
        ...item,
        notes
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
