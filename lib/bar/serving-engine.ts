/**
 * Serving Engine
 * 
 * Generic serving/portion computation engine that operates on abstract Unit/Portion concepts.
 * This design makes it reusable for any divisible inventory (bar drinks, pizza, cake, cheese, etc.)
 * 
 * The engine never interprets domain-specific units (ml, oz, slices, etc.) - it treats
 * unitsProduced as an opaque positive integer defined by the owner.
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class ServingEngine {
  /**
   * Compute the total cost and unit deduction for a serving selection.
   * 
   * This is the core calculation that drives portion-based sales across any divisible inventory.
   * It operates on generic abstractions:
   * - A Container (bottle, pizza, cake) has N units (owner-defined)
   * - A Portion (serving) consumes M units per sale
   * - Selling Q portions costs Q × price and consumes Q × M units
   * 
   * @param serving - The serving configuration with price and units produced per portion
   * @param quantity - How many portions are being sold (must be positive integer)
   * @returns Object with lineTotal (cost) and unitsToDeduct (inventory impact)
   * @throws Error if quantity is less than 1 or not an integer
   * 
   * @example
   * // Bar: 1L bottle → 25 tots (owner decides 25)
   * const result = ServingEngine.computeServing(
   *   { sellingPrice: 200, unitsProduced: 1 },
   *   2
   * )
   * // result: { lineTotal: 400, unitsToDeduct: 2 }
   * 
   * @example
   * // Pizza: 1 large → 8 slices
   * const result = ServingEngine.computeServing(
   *   { sellingPrice: 150, unitsProduced: 1 },
   *   3
   * )
   * // result: { lineTotal: 450, unitsToDeduct: 3 }
   */
  static computeServing(
    serving: { sellingPrice: number; unitsProduced: number },
    quantity: number
  ): { lineTotal: number; unitsToDeduct: number } {
    // Validate quantity is a positive integer
    if (quantity < 1 || !Number.isInteger(quantity)) {
      throw new Error('Quantity must be a positive integer')
    }

    // Core computation: multiply price and units by quantity
    return {
      lineTotal: serving.sellingPrice * quantity,
      unitsToDeduct: serving.unitsProduced * quantity,
    }
  }
}
