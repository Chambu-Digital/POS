// Capital allocation algorithm for budget-aware restocking

export interface RestockItem {
  moduleItemId: string
  module: string
  itemName: string
  category: string
  currentStock: number
  velocity: number
  daysRemaining: number
  urgency: number
  recommendedQty: number
  unitPrice: number
  totalCost: number
  supplier: { id: string; name: string } | null
}

export interface AllocationResult {
  allocated: Array<RestockItem & { allocatedQty: number; allocatedCost: number; reason: string }>
  deferred: Array<RestockItem & { deferredReason: string }>
  totalSpent: number
  remainingBudget: number
}

/**
 * Allocate budget intelligently across items to prevent maximum stockouts
 */
export function allocateBudget(
  items: RestockItem[],
  budget: number,
  leadTimeDays: number
): AllocationResult {
  // Sort by urgency (most urgent first)
  const sortedItems = [...items].sort((a, b) => b.urgency - a.urgency)

  let remainingBudget = budget
  const allocated: AllocationResult['allocated'] = []
  const deferred: AllocationResult['deferred'] = []

  // Phase 1: Prevent immediate stockouts (< 2 days)
  for (const item of sortedItems) {
    if (remainingBudget <= 0) break
    if (item.daysRemaining >= 2) continue // Not immediate

    // Calculate quantity to reach 2 days coverage
    const qtyFor2Days = Math.max(0, Math.ceil((item.velocity * 2) - item.currentStock))
    const costFor2Days = qtyFor2Days * item.unitPrice

    if (costFor2Days <= remainingBudget && qtyFor2Days > 0) {
      allocated.push({
        ...item,
        allocatedQty: qtyFor2Days,
        allocatedCost: costFor2Days,
        reason: '🚨 Emergency allocation - prevents immediate stockout'
      })
      remainingBudget -= costFor2Days
      // Mark as partially handled
      item.currentStock += qtyFor2Days
      item.daysRemaining = item.currentStock / item.velocity
    }
  }

  // Phase 2: Extend critical items toward lead time coverage
  for (const item of sortedItems) {
    if (remainingBudget <= 0) break
    if (item.daysRemaining >= leadTimeDays) continue // Already safe

    // Already allocated in phase 1?
    const existingAllocation = allocated.find(a => a.moduleItemId === item.moduleItemId)

    // Calculate quantity to reach lead time coverage
    const targetStock = item.velocity * leadTimeDays
    const currentEffective = existingAllocation 
      ? item.currentStock 
      : item.currentStock
    const additionalQty = Math.max(0, Math.ceil(targetStock - currentEffective))
    const additionalCost = additionalQty * item.unitPrice

    if (additionalCost <= remainingBudget && additionalQty > 0) {
      if (existingAllocation) {
        // Update existing allocation
        existingAllocation.allocatedQty += additionalQty
        existingAllocation.allocatedCost += additionalCost
        existingAllocation.reason = '✅ Full coverage - extends to lead time + safety buffer'
      } else {
        // New allocation
        allocated.push({
          ...item,
          allocatedQty: additionalQty,
          allocatedCost: additionalCost,
          reason: '✅ Full coverage - extends to lead time'
        })
      }
      remainingBudget -= additionalCost
      item.currentStock += additionalQty
      item.daysRemaining = item.currentStock / item.velocity
    }
  }

  // Phase 3: Proportional distribution of remaining budget
  if (remainingBudget > 0) {
    // Find items still below lead time
    const needsMore = sortedItems.filter(item => {
      const hasAllocation = allocated.find(a => a.moduleItemId === item.moduleItemId)
      return item.daysRemaining < leadTimeDays || !hasAllocation
    })

    if (needsMore.length > 0) {
      // Calculate urgency weights
      const totalUrgency = needsMore.reduce((sum, item) => sum + item.urgency, 0)

      for (const item of needsMore) {
        if (remainingBudget <= item.unitPrice) break // Can't afford even 1 unit

        // Proportional allocation
        const weight = item.urgency / totalUrgency
        const allocatedBudget = Math.floor(remainingBudget * weight)
        const qty = Math.floor(allocatedBudget / item.unitPrice)

        if (qty > 0) {
          const cost = qty * item.unitPrice
          const existing = allocated.find(a => a.moduleItemId === item.moduleItemId)

          if (existing) {
            existing.allocatedQty += qty
            existing.allocatedCost += cost
            existing.reason = '📈 Partial allocation - proportional to urgency'
          } else {
            allocated.push({
              ...item,
              allocatedQty: qty,
              allocatedCost: cost,
              reason: '📈 Partial allocation - proportional to urgency'
            })
          }
          remainingBudget -= cost
        }
      }
    }
  }

  // Phase 4: Identify deferred items
  const allocatedIds = new Set(allocated.map(a => a.moduleItemId))
  for (const item of sortedItems) {
    if (!allocatedIds.has(item.moduleItemId)) {
      let deferredReason = ''
      
      if (item.daysRemaining >= leadTimeDays) {
        deferredReason = `✓ Adequate coverage: ${Math.floor(item.daysRemaining)} days remaining (safe through next restock)`
      } else if (remainingBudget < item.unitPrice) {
        deferredReason = `💰 Budget exhausted: Requires KES ${item.unitPrice.toLocaleString()} per unit, only KES ${remainingBudget.toLocaleString()} remaining`
      } else {
        deferredReason = `📊 Lower priority: Budget allocated to higher-urgency items`
      }

      deferred.push({
        ...item,
        deferredReason
      })
    }
  }

  return {
    allocated,
    deferred,
    totalSpent: budget - remainingBudget,
    remainingBudget
  }
}
