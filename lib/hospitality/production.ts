// ─── Hospitality Production Service ────────────────────────────────────────────
// Kitchen/bar production tracking with variance analysis
// Handles conversion of ingredients to finished products

import type mongoose from 'mongoose'
import { calculateYieldVariance } from './calculator'
import { addWholeUnits, consumeServings } from './inventory'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProductionIngredient {
  itemId: string
  itemName: string
  quantityUsed: number
  unit: string
}

export interface LogProductionParams {
  producedItemId: string
  servingTypeId?: string
  expectedYield: number
  actualYield: number
  ingredientsUsed: ProductionIngredient[]
  notes?: string
  producedBy?: string
}

export interface ApproveProductionParams {
  productionLogId: string
  approvedBy: string
  notes?: string
}

// ── Log Production ─────────────────────────────────────────────────────────────

/**
 * Record a production session
 * - Deducts ingredients from inventory
 * - Adds produced items to inventory
 * - Calculates yield variance
 * - Flags for approval if variance exceeds threshold (±20%)
 */
export async function logProduction(
  params: LogProductionParams,
  models: any,
  tenantId: string,
  session?: mongoose.ClientSession
): Promise<{ 
  success: boolean
  error?: string
  productionLog?: any
  requiresApproval?: boolean
}> {
  try {
    const {
      producedItemId,
      servingTypeId,
      expectedYield,
      actualYield,
      ingredientsUsed,
      notes,
      producedBy
    } = params

    // Calculate variance
    const varianceAnalysis = calculateYieldVariance(expectedYield, actualYield)

    // Create production log
    const productionLog = await models.HospitalityProductionLog.create([{
      tenantId,
      producedItemId,
      servingTypeId: servingTypeId || null,
      expectedYield,
      actualYield,
      variance: varianceAnalysis.variance,
      variancePercentage: varianceAnalysis.variancePercentage,
      ingredientsUsed,
      notes: notes || '',
      producedBy: producedBy || null,
      status: varianceAnalysis.isSignificant ? 'pending' : 'approved',
      productionDate: new Date()
    }], { session })

    // Deduct ingredients from inventory
    for (const ingredient of ingredientsUsed) {
      // Check if ingredient is tracked
      const ingredientItem = await models.HospitalityMenuItem.findOne({
        tenantId,
        _id: new models.HospitalityMenuItem.base.Types.ObjectId(ingredient.itemId)
      }).session(session || null)

      if (ingredientItem && ingredientItem.inventoryMode === 'tracked') {
        // Deduct from inventory
        // For ingredients (which are typically not servable), we adjust whole units
        const inventory = await models.HospitalityServingInventory.findOne({
          tenantId,
          menuItemId: ingredient.itemId
        }).session(session || null)

        if (inventory) {
          inventory.wholeUnits = Math.max(0, inventory.wholeUnits - ingredient.quantityUsed)
          await inventory.save({ session })

          // Create movement record
          await models.HospitalityServingMovement.create([{
            tenantId,
            menuItemId: ingredient.itemId,
            movementType: 'production',
            quantity: ingredient.quantityUsed,
            wholeUnitsChanged: -ingredient.quantityUsed,
            beforeState: {
              wholeUnits: inventory.wholeUnits + ingredient.quantityUsed,
              partialUnits: 0,
              totalServings: {}
            },
            afterState: {
              wholeUnits: inventory.wholeUnits,
              partialUnits: 0,
              totalServings: {}
            },
            reason: `Used in production: ${ingredient.quantityUsed} ${ingredient.unit}`,
            referenceType: 'production',
            referenceId: productionLog[0]._id,
            performedBy: producedBy || null
          }], { session })
        }
      }
    }

    // Add produced items to inventory
    const producedItem = await models.HospitalityMenuItem.findOne({
      tenantId,
      _id: new models.HospitalityMenuItem.base.Types.ObjectId(producedItemId)
    }).session(session || null)

    if (producedItem && producedItem.inventoryMode === 'tracked') {
      if (producedItem.isServable && servingTypeId) {
        // For servable items, add as servings
        // We'll add whole units based on the serving type's servingsPerUnit
        const servingType = await models.HospitalityServingType.findOne({
          tenantId,
          _id: new models.HospitalityServingType.base.Types.ObjectId(servingTypeId)
        }).session(session || null)

        if (servingType) {
          const wholeUnitsProduced = Math.floor(actualYield / servingType.servingsPerUnit)
          const remainingServings = actualYield % servingType.servingsPerUnit

          if (wholeUnitsProduced > 0) {
            await addWholeUnits(
              {
                menuItemId: producedItemId,
                quantity: wholeUnitsProduced,
                reason: 'Production',
                reference: `Production Log ${productionLog[0]._id}`,
                performedBy: producedBy
              },
              models,
              tenantId,
              session
            )
          }

          // If there are remaining servings, create a partial unit
          if (remainingServings > 0) {
            const inventory = await models.HospitalityServingInventory.findOne({
              tenantId,
              menuItemId: producedItemId
            }).session(session || null)

            if (inventory) {
              // Add partial unit
              const servingTypes = await models.HospitalityServingType.find({
                tenantId,
                menuItemId: producedItemId
              }).session(session || null)

              const newPartial = {
                id: `production-${Date.now()}`,
                servingsRemaining: {},
                openedAt: new Date(),
                batchId: `PROD-${productionLog[0]._id}`
              }

              // Calculate servings for all serving types proportionally
              for (const st of servingTypes) {
                const stId = st._id.toString()
                const fraction = remainingServings / servingType.servingsPerUnit
                newPartial.servingsRemaining[stId] = st.servingsPerUnit * fraction
              }

              inventory.partialUnits.push(newPartial)
              await inventory.save({ session })
            }
          }
        }
      } else {
        // For non-servable items or whole-only items, add as whole units
        await addWholeUnits(
          {
            menuItemId: producedItemId,
            quantity: actualYield,
            reason: 'Production',
            reference: `Production Log ${productionLog[0]._id}`,
            performedBy: producedBy
          },
          models,
          tenantId,
          session
        )
      }
    }

    return {
      success: true,
      productionLog: productionLog[0],
      requiresApproval: varianceAnalysis.isSignificant
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Approve Production ─────────────────────────────────────────────────────────

/**
 * Approve a production log entry (required for entries with significant variance)
 * Updates status from 'pending' to 'approved'
 */
export async function approveProduction(
  params: ApproveProductionParams,
  models: any,
  tenantId: string,
  session?: mongoose.ClientSession
): Promise<{ success: boolean; error?: string; productionLog?: any }> {
  try {
    const { productionLogId, approvedBy, notes } = params

    const productionLog = await models.HospitalityProductionLog.findOne({
      tenantId,
      _id: new models.HospitalityProductionLog.base.Types.ObjectId(productionLogId)
    }).session(session || null)

    if (!productionLog) {
      return { success: false, error: 'Production log not found' }
    }

    if (productionLog.status !== 'pending') {
      return { success: false, error: 'Production log is not pending approval' }
    }

    productionLog.status = 'approved'
    productionLog.approvedBy = approvedBy
    if (notes) {
      productionLog.notes = `${productionLog.notes}\n\nApproval notes: ${notes}`
    }

    await productionLog.save({ session })

    return { success: true, productionLog }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Reject Production ──────────────────────────────────────────────────────────

/**
 * Reject a production log entry
 * Changes status to 'rejected' but does NOT reverse inventory changes
 * (Inventory adjustments must be done manually if needed)
 */
export async function rejectProduction(
  params: ApproveProductionParams,
  models: any,
  tenantId: string,
  session?: mongoose.ClientSession
): Promise<{ success: boolean; error?: string; productionLog?: any }> {
  try {
    const { productionLogId, approvedBy, notes } = params

    const productionLog = await models.HospitalityProductionLog.findOne({
      tenantId,
      _id: new models.HospitalityProductionLog.base.Types.ObjectId(productionLogId)
    }).session(session || null)

    if (!productionLog) {
      return { success: false, error: 'Production log not found' }
    }

    if (productionLog.status !== 'pending') {
      return { success: false, error: 'Production log is not pending approval' }
    }

    productionLog.status = 'rejected'
    productionLog.approvedBy = approvedBy
    if (notes) {
      productionLog.notes = `${productionLog.notes}\n\nRejection notes: ${notes}`
    }

    await productionLog.save({ session })

    return { success: true, productionLog }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Calculate Ingredient Cost ──────────────────────────────────────────────────

/**
 * Calculate total cost of ingredients used in production
 * Useful for cost analysis and profit margin calculations
 */
export async function calculateIngredientCost(
  ingredientsUsed: ProductionIngredient[],
  models: any,
  tenantId: string
): Promise<number> {
  let totalCost = 0

  for (const ingredient of ingredientsUsed) {
    const menuItem = await models.HospitalityMenuItem.findOne({
      tenantId,
      _id: new models.HospitalityMenuItem.base.Types.ObjectId(ingredient.itemId)
    })

    if (menuItem && menuItem.costPrice) {
      totalCost += menuItem.costPrice * ingredient.quantityUsed
    }
  }

  return totalCost
}

// ── Get Production Summary ─────────────────────────────────────────────────────

/**
 * Get production statistics for a date range
 * Returns total productions, average variance, items needing approval
 */
export async function getProductionSummary(
  startDate: Date,
  endDate: Date,
  models: any,
  tenantId: string
): Promise<{
  totalProductions: number
  averageVariancePercentage: number
  pendingApprovals: number
  totalVariance: number
}> {
  const productions = await models.HospitalityProductionLog.find({
    tenantId,
    productionDate: { $gte: startDate, $lte: endDate }
  })

  const totalProductions = productions.length
  const pendingApprovals = productions.filter(p => p.status === 'pending').length
  
  const totalVariancePercentage = productions.reduce((sum, p) => 
    sum + Math.abs(p.variancePercentage), 0
  )
  const averageVariancePercentage = totalProductions > 0 
    ? totalVariancePercentage / totalProductions 
    : 0

  const totalVariance = productions.reduce((sum, p) => sum + p.variance, 0)

  return {
    totalProductions,
    averageVariancePercentage: Math.round(averageVariancePercentage * 100) / 100,
    pendingApprovals,
    totalVariance
  }
}
