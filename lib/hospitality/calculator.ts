// ─── Hospitality Serving Calculator ────────────────────────────────────────────
// Core calculation logic for serving-based inventory management
// Handles both fraction-based and volume-based calculations

import type mongoose from 'mongoose'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ServingType {
  _id: string | mongoose.Types.ObjectId
  servingsPerUnit: number
  volume?: number  // For volume-based calculations
}

export interface PartialUnit {
  id: string
  servingsRemaining: Record<string, number>  // { servingTypeId: remaining }
  openedAt: Date
  batchId?: string
}

export interface InventoryState {
  wholeUnits: number
  partialUnits: PartialUnit[]
  totalAvailableServings: Record<string, number>
}

export interface OrderItem {
  servingTypeId: string
  quantity: number  // Number of servings requested
}

// ── Calculate Available Servings ───────────────────────────────────────────────

/**
 * Calculate total available servings across all serving types
 * Accounts for whole units + partial units
 * 
 * Algorithm:
 * 1. Calculate servings from whole units: wholeUnits × servingsPerUnit
 * 2. For each partial unit:
 *    - Get remaining amount as percentage of full unit
 *    - Apply percentage to this serving type's servingsPerUnit
 * 3. Sum all servings and floor the result
 */
export function calculateAvailableServings(
  wholeUnits: number,
  partialUnits: PartialUnit[],
  servingTypes: ServingType[],
  servingMode: 'fraction' | 'volume' = 'fraction'
): Record<string, number> {
  const available: Record<string, number> = {}

  for (const servingType of servingTypes) {
    const servingTypeId = servingType._id.toString()
    
    // Servings from whole units
    let total = wholeUnits * servingType.servingsPerUnit

    // Servings from partial units
    for (const partial of partialUnits) {
      const remaining = partial.servingsRemaining[servingTypeId] || 0
      total += remaining
    }

    // Floor to prevent fractional servings
    available[servingTypeId] = Math.floor(total)
  }

  return available
}

// ── Cross-Serving Validation ───────────────────────────────────────────────────

/**
 * Check if an order can be satisfied without creating negative inventory
 * Important for preventing impossible combinations when multiple serving types
 * share the same physical inventory
 * 
 * Example: Can't sell 10 tots if only 0.4 bottles remain, even if that 
 * theoretically equals 8 primes
 */
export function canSatisfyOrder(
  order: OrderItem[],
  currentInventory: InventoryState,
  servingTypes: ServingType[]
): { canSatisfy: boolean; reason?: string } {
  // Create a working copy of inventory
  const workingInventory = JSON.parse(JSON.stringify(currentInventory))

  // Try to deduct each order item
  for (const item of order) {
    const servingType = servingTypes.find(st => st._id.toString() === item.servingTypeId)
    if (!servingType) {
      return { canSatisfy: false, reason: 'Invalid serving type' }
    }

    // Check if enough servings available
    const available = workingInventory.totalAvailableServings[item.servingTypeId] || 0
    if (available < item.quantity) {
      return { 
        canSatisfy: false, 
        reason: `Only ${available} servings available, requested ${item.quantity}` 
      }
    }

    // Simulate deduction
    const deductionResult = deductServings(
      item.servingTypeId,
      item.quantity,
      workingInventory.wholeUnits,
      workingInventory.partialUnits,
      servingTypes
    )

    if (!deductionResult.success) {
      return { canSatisfy: false, reason: deductionResult.error }
    }

    // Update working inventory
    workingInventory.wholeUnits = deductionResult.newWholeUnits
    workingInventory.partialUnits = deductionResult.newPartialUnits
    workingInventory.totalAvailableServings = calculateAvailableServings(
      deductionResult.newWholeUnits,
      deductionResult.newPartialUnits,
      servingTypes
    )
  }

  return { canSatisfy: true }
}

// ── FIFO Partial Consumption ───────────────────────────────────────────────────

/**
 * Deduct servings using FIFO (First In, First Out) for partial units
 * Always consumes oldest partial first to minimize waste
 * 
 * Algorithm:
 * 1. Sort partials by openedAt (oldest first)
 * 2. Consume from oldest partial until depleted or quantity satisfied
 * 3. If partial depleted, remove it
 * 4. If quantity not satisfied, move to next partial or open new whole unit
 * 5. Continue until quantity fully deducted or inventory exhausted
 */
export function deductServings(
  servingTypeId: string,
  quantity: number,
  wholeUnits: number,
  partialUnits: PartialUnit[],
  servingTypes: ServingType[]
): {
  success: boolean
  newWholeUnits: number
  newPartialUnits: PartialUnit[]
  error?: string
} {
  const servingType = servingTypes.find(st => st._id.toString() === servingTypeId)
  if (!servingType) {
    return { 
      success: false, 
      newWholeUnits: wholeUnits, 
      newPartialUnits: partialUnits,
      error: 'Invalid serving type' 
    }
  }

  let remaining = quantity
  const updatedPartials = [...partialUnits]
  let updatedWholeUnits = wholeUnits

  // Sort partials by opened date (oldest first) - FIFO
  updatedPartials.sort((a, b) => 
    new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
  )

  // Consume from partials first (FIFO)
  for (let i = 0; i < updatedPartials.length && remaining > 0; i++) {
    const partial = updatedPartials[i]
    const available = partial.servingsRemaining[servingTypeId] || 0

    if (available > 0) {
      const toDeduct = Math.min(available, remaining)
      partial.servingsRemaining[servingTypeId] = available - toDeduct
      remaining -= toDeduct

      // Update servings for other serving types proportionally
      const percentageConsumed = toDeduct / available
      for (const otherServingType of servingTypes) {
        const otherId = otherServingType._id.toString()
        if (otherId !== servingTypeId && partial.servingsRemaining[otherId] !== undefined) {
          const otherAvailable = partial.servingsRemaining[otherId]
          partial.servingsRemaining[otherId] = Math.max(0, 
            otherAvailable - (otherAvailable * percentageConsumed)
          )
        }
      }
    }
  }

  // Remove fully depleted partials
  const cleanedPartials = updatedPartials.filter(p => {
    const hasRemaining = Object.values(p.servingsRemaining).some(val => val > 0)
    return hasRemaining
  })

  // If still need more, open whole units
  while (remaining > 0 && updatedWholeUnits > 0) {
    const servingsInUnit = servingType.servingsPerUnit
    
    if (remaining >= servingsInUnit) {
      // Consume entire unit
      updatedWholeUnits--
      remaining -= servingsInUnit
    } else {
      // Open a new partial unit
      updatedWholeUnits--
      const newPartial: PartialUnit = {
        id: `partial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        servingsRemaining: {},
        openedAt: new Date(),
      }

      // Calculate remaining servings for all serving types
      for (const st of servingTypes) {
        const stId = st._id.toString()
        if (stId === servingTypeId) {
          newPartial.servingsRemaining[stId] = servingsInUnit - remaining
        } else {
          // Calculate proportional servings for other types
          newPartial.servingsRemaining[stId] = st.servingsPerUnit * (1 - remaining / servingsInUnit)
        }
      }

      cleanedPartials.push(newPartial)
      remaining = 0
    }
  }

  if (remaining > 0) {
    return {
      success: false,
      newWholeUnits: wholeUnits,
      newPartialUnits: partialUnits,
      error: 'Insufficient inventory'
    }
  }

  return {
    success: true,
    newWholeUnits: updatedWholeUnits,
    newPartialUnits: cleanedPartials
  }
}

// ── Convert Between Serving Types ──────────────────────────────────────────────

/**
 * Convert quantity from one serving type to another
 * Useful for suggesting alternatives when stock is low
 * 
 * Example: "Only 5 tots available, but you could get 3 primes instead"
 */
export function convertServingType(
  quantity: number,
  fromServingType: ServingType,
  toServingType: ServingType
): number {
  // Calculate as fraction of base unit
  const fractionOfUnit = quantity / fromServingType.servingsPerUnit
  const convertedQuantity = fractionOfUnit * toServingType.servingsPerUnit
  return Math.floor(convertedQuantity)
}

// ── Yield Variance Calculation ─────────────────────────────────────────────────

/**
 * Calculate variance between expected and actual production yield
 * Returns both absolute difference and percentage
 */
export function calculateYieldVariance(
  expectedYield: number,
  actualYield: number
): {
  variance: number
  variancePercentage: number
  isSignificant: boolean  // > ±20% threshold
} {
  const variance = actualYield - expectedYield
  const variancePercentage = expectedYield > 0 
    ? (variance / expectedYield) * 100 
    : 0
  
  const isSignificant = Math.abs(variancePercentage) > 20

  return {
    variance,
    variancePercentage: Math.round(variancePercentage * 100) / 100,
    isSignificant
  }
}

// ── Volume-Based Calculations (for liquids) ────────────────────────────────────

/**
 * Calculate available volume in liters from inventory
 * Used for volume-based serving mode (juices, draft beer, etc.)
 */
export function calculateAvailableVolume(
  wholeUnits: number,
  partialUnits: PartialUnit[],
  unitSizeInLiters: number
): number {
  let totalLiters = wholeUnits * unitSizeInLiters

  // Add partial volumes
  for (const partial of partialUnits) {
    // For volume mode, servingsRemaining stores actual liters
    const remainingLiters = Object.values(partial.servingsRemaining)[0] || 0
    totalLiters += remainingLiters
  }

  return totalLiters
}

/**
 * Deduct volume in liters (for volume-based serving mode)
 */
export function deductVolume(
  volumeInLiters: number,
  wholeUnits: number,
  partialUnits: PartialUnit[],
  unitSizeInLiters: number
): {
  success: boolean
  newWholeUnits: number
  newPartialUnits: PartialUnit[]
  error?: string
} {
  let remaining = volumeInLiters
  const updatedPartials = [...partialUnits]
  let updatedWholeUnits = wholeUnits

  // Sort partials by opened date (oldest first) - FIFO
  updatedPartials.sort((a, b) => 
    new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
  )

  // Consume from partials first
  for (let i = 0; i < updatedPartials.length && remaining > 0; i++) {
    const partial = updatedPartials[i]
    const available = Object.values(partial.servingsRemaining)[0] || 0

    if (available > 0) {
      const toDeduct = Math.min(available, remaining)
      partial.servingsRemaining['volume'] = available - toDeduct
      remaining -= toDeduct
    }
  }

  // Remove fully depleted partials
  const cleanedPartials = updatedPartials.filter(p => {
    const remaining = Object.values(p.servingsRemaining)[0] || 0
    return remaining > 0.001  // Allow for tiny floating point errors
  })

  // If still need more, open whole units
  while (remaining > 0.001 && updatedWholeUnits > 0) {
    if (remaining >= unitSizeInLiters) {
      // Consume entire unit
      updatedWholeUnits--
      remaining -= unitSizeInLiters
    } else {
      // Open a new partial unit
      updatedWholeUnits--
      const newPartial: PartialUnit = {
        id: `partial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        servingsRemaining: { volume: unitSizeInLiters - remaining },
        openedAt: new Date(),
      }
      cleanedPartials.push(newPartial)
      remaining = 0
    }
  }

  if (remaining > 0.001) {
    return {
      success: false,
      newWholeUnits: wholeUnits,
      newPartialUnits: partialUnits,
      error: 'Insufficient volume'
    }
  }

  return {
    success: true,
    newWholeUnits: updatedWholeUnits,
    newPartialUnits: cleanedPartials
  }
}
