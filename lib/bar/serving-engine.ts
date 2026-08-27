/**
 * Serving Engine
 * 
 * Generic serving/portion computation engine that operates on fractional container state.
 * This design makes it reusable for any divisible inventory (bar drinks, pizza, cake, cheese, etc.)
 * 
 * The engine never interprets domain-specific units (ml, oz, slices, etc.) - it treats
 * servingsPerContainer as an opaque positive integer defined by the owner.
 * 
 * V2 FRACTIONAL MODEL:
 * - Containers have a unified fractional state (0.0 to 1.0)
 * - Servings are projections, not independent stocks
 * - All serving interdependencies are automatic
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class ServingEngine {
  /**
   * Compute the total cost and fraction deduction for a serving selection.
   * 
   * This is the core calculation that drives portion-based sales across any divisible inventory.
   * It operates on generic abstractions:
   * - A Container (bottle, pizza, cake) has a fractional state (0.0 to 1.0)
   * - A Serving consumes 1/servingsPerContainer of the container per sale
   * - Selling Q servings costs Q × price and consumes Q/servingsPerContainer of the container
   * 
   * @param serving - The serving configuration with price and servingsPerContainer
   * @param quantity - How many servings are being sold (must be positive integer)
   * @returns Object with lineTotal (cost) and fractionToDeduct (container impact)
   * @throws Error if quantity is less than 1 or not an integer
   * 
   * @example
   * // Bar: 750ml bottle → 20 tots
   * const result = ServingEngine.computeServing(
   *   { sellingPrice: 50, servingsPerContainer: 20 },
   *   2
   * )
   * // result: { lineTotal: 100, fractionToDeduct: 0.1 }
   * // Selling 2 tots costs KSh 100 and consumes 10% of the bottle
   * 
   * @example
   * // Pizza: 1 large → 8 slices
   * const result = ServingEngine.computeServing(
   *   { sellingPrice: 150, servingsPerContainer: 8 },
   *   3
   * )
   * // result: { lineTotal: 450, fractionToDeduct: 0.375 }
   * // Selling 3 slices costs KSh 450 and consumes 37.5% of the pizza
   */
  static computeServing(
    serving: { sellingPrice: number; servingsPerContainer: number },
    quantity: number
  ): { lineTotal: number; fractionToDeduct: number } {
    // Validate quantity is a positive integer
    if (quantity < 1 || !Number.isInteger(quantity)) {
      throw new Error('Quantity must be a positive integer')
    }

    // Validate serving configuration
    if (!serving.servingsPerContainer || serving.servingsPerContainer <= 0) {
      throw new Error(`Invalid servingsPerContainer: ${serving.servingsPerContainer}. Must be a positive number.`)
    }

    if (!serving.sellingPrice || serving.sellingPrice < 0) {
      throw new Error(`Invalid sellingPrice: ${serving.sellingPrice}. Must be a non-negative number.`)
    }

    // Core computation: multiply price by quantity, divide quantity by servings per container
    return {
      lineTotal: serving.sellingPrice * quantity,
      fractionToDeduct: quantity / serving.servingsPerContainer,
    }
  }

  /**
   * Calculate how many servings are available from a container's remaining fraction.
   * 
   * Projects the container's fractional state into serving availability.
   * Uses floor() because you can't serve partial servings (can't serve 2.7 tots).
   * 
   * @param container - Container with remainingFraction (0.0 to 1.0)
   * @param serving - Serving configuration with servingsPerContainer
   * @returns Number of whole servings available (floored)
   * 
   * @example
   * // Bottle 75% full, configured for 20 tots per bottle
   * const available = ServingEngine.getAvailableServings(
   *   { remainingFraction: 0.75 },
   *   { servingsPerContainer: 20 }
   * )
   * // available: 15 (floor(0.75 × 20))
   */
  static getAvailableServings(
    container: { remainingFraction: number },
    serving: { servingsPerContainer: number }
  ): number {
    return Math.floor(container.remainingFraction * serving.servingsPerContainer)
  }

  /**
   * Check if a container can provide the requested serving quantity.
   * 
   * Validates that the container has sufficient remaining fraction to fulfill
   * the sale without going negative.
   * 
   * @param container - Container with remainingFraction
   * @param serving - Serving configuration
   * @param quantity - Requested serving count
   * @returns true if container can provide servings, false otherwise
   * 
   * @example
   * // Can a 60% full bottle provide 3 halfs (servingsPerContainer = 2)?
   * const canProvide = ServingEngine.canProvideServings(
   *   { remainingFraction: 0.6 },
   *   { servingsPerContainer: 2 },
   *   3
   * )
   * // canProvide: false (need 1.5, only have 0.6)
   */
  static canProvideServings(
    container: { remainingFraction: number },
    serving: { servingsPerContainer: number },
    quantity: number
  ): boolean {
    const required = quantity / serving.servingsPerContainer
    return container.remainingFraction >= required
  }

  /**
   * Project a container's state into all configured servings.
   * 
   * Calculates how many of each serving type are available from the container.
   * This demonstrates that servings are projections, not independent stocks.
   * 
   * @param container - Container with remainingFraction
   * @param servings - Array of serving configurations
   * @returns Object mapping serving IDs to available counts
   * 
   * @example
   * // Bottle 75% full with 3 serving configs
   * const availability = ServingEngine.projectAvailability(
   *   { remainingFraction: 0.75 },
   *   [
   *     { _id: '1', servingsPerContainer: 20 },  // Tot
   *     { _id: '2', servingsPerContainer: 5 },   // Quarter
   *     { _id: '3', servingsPerContainer: 2 },   // Half
   *   ]
   * )
   * // availability: { '1': 15, '2': 3, '3': 1 }
   */
  static projectAvailability(
    container: { remainingFraction: number },
    servings: Array<{ _id: string; servingsPerContainer: number }>
  ): Record<string, number> {
    return servings.reduce((acc, serving) => {
      acc[serving._id] = this.getAvailableServings(container, serving)
      return acc
    }, {} as Record<string, number>)
  }
}

