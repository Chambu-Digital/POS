// ─── Hospitality Inventory Service ─────────────────────────────────────────────
// Inventory management operations with transaction safety
// All operations create audit trail entries

import type mongoose from 'mongoose'
import { 
  calculateAvailableServings, 
  deductServings,
  deductVolume,
  type ServingType,
  type PartialUnit,
  type InventoryState
} from './calculator'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AddWholeUnitsParams {
  menuItemId: string
  quantity: number
  reason?: string
  reference?: string
  performedBy?: string
  batchId?: string
}

export interface ConsumeServingsParams {
  menuItemId: string
  servingTypeId: string
  quantity: number
  referenceType: 'sale' | 'production' | 'adjustment' | 'other'
  referenceId?: string
  performedBy?: string
}

export interface AdjustInventoryParams {
  menuItemId: string
  servingTypeId?: string
  adjustmentType: 'set-whole' | 'set-partial' | 'add' | 'subtract'
  value: number
  reason: string
  performedBy?: string
  requiresApproval?: boolean
  approvedBy?: string
}

export interface ConsolidatePartialsParams {
  menuItemId: string
  partialIds: string[]
  performedBy?: string
}

// ── Add Whole Units (Receive Stock) ────────────────────────────────────────────

/**
 * Add whole unopened units to inventory
 * Used for receiving stock deliveries
 * Creates RECEIVE movement record
 */
export async function addWholeUnits(
  params: AddWholeUnitsParams,
  models: any,
  tenantId: string,
  session?: mongoose.ClientSession
): Promise<{ success: boolean; error?: string; newInventory?: any }> {
  try {
    const { menuItemId, quantity, reason, reference, performedBy, batchId } = params

    // Get or create inventory record
    let inventory = await models.HospitalityServingInventory.findOne({
      tenantId,
      menuItemId: new models.HospitalityServingInventory.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    const previousWholeUnits = inventory?.wholeUnits || 0
    const previousPartialUnits = inventory?.partialUnits || []
    const previousTotalServings = inventory?.totalAvailableServings || {}

    if (!inventory) {
      inventory = new models.HospitalityServingInventory({
        tenantId,
        menuItemId,
        wholeUnits: quantity,
        partialUnits: [],
        totalAvailableServings: {}
      })
    } else {
      inventory.wholeUnits += quantity
    }

    // Recalculate total available servings
    const servingTypes = await models.HospitalityServingType.find({
      tenantId,
      menuItemId: new models.HospitalityServingType.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    inventory.totalAvailableServings = calculateAvailableServings(
      inventory.wholeUnits,
      inventory.partialUnits,
      servingTypes
    )

    await inventory.save({ session })

    // Create movement record
    await models.HospitalityServingMovement.create([{
      tenantId,
      menuItemId,
      movementType: 'receive',
      quantity: 0,  // Not serving-specific
      wholeUnitsChanged: quantity,
      beforeState: {
        wholeUnits: previousWholeUnits,
        partialUnits: previousPartialUnits.length,
        totalServings: previousTotalServings
      },
      afterState: {
        wholeUnits: inventory.wholeUnits,
        partialUnits: inventory.partialUnits.length,
        totalServings: inventory.totalAvailableServings
      },
      reason: reason || 'Stock received',
      referenceType: 'other',
      performedBy: performedBy || null,
      metadata: { reference, batchId }
    }], { session })

    return { success: true, newInventory: inventory }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Consume Servings (Sales/Production) ────────────────────────────────────────

/**
 * Deduct servings from inventory using FIFO algorithm
 * Automatically handles partial unit consumption
 * Creates SALE or PRODUCTION movement record
 */
export async function consumeServings(
  params: ConsumeServingsParams,
  models: any,
  tenantId: string,
  session?: mongoose.ClientSession
): Promise<{ success: boolean; error?: string; newInventory?: any }> {
  try {
    const { menuItemId, servingTypeId, quantity, referenceType, referenceId, performedBy } = params

    // Get inventory record
    const inventory = await models.HospitalityServingInventory.findOne({
      tenantId,
      menuItemId: new models.HospitalityServingInventory.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    if (!inventory) {
      return { success: false, error: 'Inventory record not found' }
    }

    const previousWholeUnits = inventory.wholeUnits
    const previousPartialUnits = [...inventory.partialUnits]
    const previousTotalServings = { ...inventory.totalAvailableServings }

    // Get serving types
    const servingTypes = await models.HospitalityServingType.find({
      tenantId,
      menuItemId: new models.HospitalityServingType.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    // Get menu item to check serving mode
    const menuItem = await models.HospitalityMenuItem.findOne({
      tenantId,
      _id: new models.HospitalityMenuItem.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    // Deduct servings using FIFO
    const deductionResult = deductServings(
      servingTypeId,
      quantity,
      inventory.wholeUnits,
      inventory.partialUnits,
      servingTypes
    )

    if (!deductionResult.success) {
      return { success: false, error: deductionResult.error }
    }

    // Update inventory
    inventory.wholeUnits = deductionResult.newWholeUnits
    inventory.partialUnits = deductionResult.newPartialUnits
    inventory.totalAvailableServings = calculateAvailableServings(
      inventory.wholeUnits,
      inventory.partialUnits,
      servingTypes
    )

    await inventory.save({ session })

    // Create movement record
    await models.HospitalityServingMovement.create([{
      tenantId,
      menuItemId,
      movementType: referenceType === 'sale' ? 'sale' : 'production',
      servingTypeId: servingTypeId || null,
      quantity,
      wholeUnitsChanged: previousWholeUnits - deductionResult.newWholeUnits,
      beforeState: {
        wholeUnits: previousWholeUnits,
        partialUnits: previousPartialUnits.length,
        totalServings: previousTotalServings
      },
      afterState: {
        wholeUnits: inventory.wholeUnits,
        partialUnits: inventory.partialUnits.length,
        totalServings: inventory.totalAvailableServings
      },
      reason: referenceType === 'sale' ? 'Sold to customer' : 'Used in production',
      referenceType,
      referenceId: referenceId || null,
      performedBy: performedBy || null
    }], { session })

    return { success: true, newInventory: inventory }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Manual Inventory Adjustment ────────────────────────────────────────────────

/**
 * Manually adjust inventory levels
 * Used for corrections, waste, spillage, etc.
 * Creates ADJUSTMENT or WASTE movement record
 */
export async function adjustInventory(
  params: AdjustInventoryParams,
  models: any,
  tenantId: string,
  session?: mongoose.ClientSession
): Promise<{ success: boolean; error?: string; newInventory?: any }> {
  try {
    const { 
      menuItemId, 
      servingTypeId, 
      adjustmentType, 
      value, 
      reason, 
      performedBy,
      requiresApproval,
      approvedBy 
    } = params

    // Get inventory record
    let inventory = await models.HospitalityServingInventory.findOne({
      tenantId,
      menuItemId: new models.HospitalityServingInventory.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    if (!inventory) {
      inventory = new models.HospitalityServingInventory({
        tenantId,
        menuItemId,
        wholeUnits: 0,
        partialUnits: [],
        totalAvailableServings: {}
      })
    }

    const previousWholeUnits = inventory.wholeUnits
    const previousPartialUnits = [...inventory.partialUnits]
    const previousTotalServings = { ...inventory.totalAvailableServings }

    // Apply adjustment based on type
    switch (adjustmentType) {
      case 'set-whole':
        inventory.wholeUnits = value
        break
      case 'add':
        inventory.wholeUnits += value
        break
      case 'subtract':
        inventory.wholeUnits = Math.max(0, inventory.wholeUnits - value)
        break
      case 'set-partial':
        // Clear partials and set new value
        inventory.partialUnits = []
        break
    }

    // Recalculate total available servings
    const servingTypes = await models.HospitalityServingType.find({
      tenantId,
      menuItemId: new models.HospitalityServingType.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    inventory.totalAvailableServings = calculateAvailableServings(
      inventory.wholeUnits,
      inventory.partialUnits,
      servingTypes
    )

    await inventory.save({ session })

    // Determine movement type based on reason
    const movementType = reason.toLowerCase().includes('waste') || 
                        reason.toLowerCase().includes('spill') ||
                        reason.toLowerCase().includes('damage')
      ? 'waste'
      : 'adjustment'

    // Create movement record
    await models.HospitalityServingMovement.create([{
      tenantId,
      menuItemId,
      movementType,
      servingTypeId: servingTypeId || null,
      quantity: 0,
      wholeUnitsChanged: inventory.wholeUnits - previousWholeUnits,
      beforeState: {
        wholeUnits: previousWholeUnits,
        partialUnits: previousPartialUnits.length,
        totalServings: previousTotalServings
      },
      afterState: {
        wholeUnits: inventory.wholeUnits,
        partialUnits: inventory.partialUnits.length,
        totalServings: inventory.totalAvailableServings
      },
      reason,
      referenceType: 'adjustment',
      performedBy: performedBy || null,
      approvedBy: (requiresApproval && approvedBy) ? approvedBy : null,
      metadata: { requiresApproval }
    }], { session })

    return { success: true, newInventory: inventory }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Consolidate Partial Units ──────────────────────────────────────────────────

/**
 * Merge multiple partial units into fewer partials
 * Only works for items with canConsolidate=true
 * Creates CONSOLIDATION movement record
 */
export async function consolidatePartials(
  params: ConsolidatePartialsParams,
  models: any,
  tenantId: string,
  session?: mongoose.ClientSession
): Promise<{ success: boolean; error?: string; newInventory?: any }> {
  try {
    const { menuItemId, partialIds, performedBy } = params

    // Get menu item to check if consolidation is allowed
    const menuItem = await models.HospitalityMenuItem.findOne({
      tenantId,
      _id: new models.HospitalityMenuItem.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    if (!menuItem) {
      return { success: false, error: 'Menu item not found' }
    }

    if (!menuItem.canConsolidate) {
      return { success: false, error: 'Consolidation not allowed for this item' }
    }

    // Get inventory
    const inventory = await models.HospitalityServingInventory.findOne({
      tenantId,
      menuItemId: new models.HospitalityServingInventory.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    if (!inventory) {
      return { success: false, error: 'Inventory record not found' }
    }

    const previousPartialUnits = [...inventory.partialUnits]
    const previousTotalServings = { ...inventory.totalAvailableServings }

    // Filter partials to consolidate
    const partialsToConsolidate = inventory.partialUnits.filter(p => 
      partialIds.includes(p.id)
    )

    if (partialsToConsolidate.length < 2) {
      return { success: false, error: 'Need at least 2 partials to consolidate' }
    }

    // Sum up all servings
    const consolidatedServings: Record<string, number> = {}
    for (const partial of partialsToConsolidate) {
      for (const [servingTypeId, remaining] of Object.entries(partial.servingsRemaining)) {
        consolidatedServings[servingTypeId] = (consolidatedServings[servingTypeId] || 0) + remaining
      }
    }

    // Get serving types to calculate whole units
    const servingTypes = await models.HospitalityServingType.find({
      tenantId,
      menuItemId: new models.HospitalityServingType.base.Types.ObjectId(menuItemId)
    }).session(session || null)

    // Check if we can make whole units
    let newWholeUnits = 0
    if (servingTypes.length > 0) {
      const firstServingType = servingTypes[0]
      const servingTypeId = firstServingType._id.toString()
      const totalServings = consolidatedServings[servingTypeId] || 0
      newWholeUnits = Math.floor(totalServings / firstServingType.servingsPerUnit)
      
      if (newWholeUnits > 0) {
        // Subtract the whole units from consolidated servings
        for (const st of servingTypes) {
          const stId = st._id.toString()
          consolidatedServings[stId] = (consolidatedServings[stId] || 0) - 
            (newWholeUnits * st.servingsPerUnit)
        }
      }
    }

    // Remove consolidated partials and add new partial if remainder exists
    inventory.partialUnits = inventory.partialUnits.filter(p => 
      !partialIds.includes(p.id)
    )

    // Add new partial if there's a remainder
    const hasRemainder = Object.values(consolidatedServings).some(v => v > 0)
    if (hasRemainder) {
      inventory.partialUnits.push({
        id: `consolidated-${Date.now()}`,
        servingsRemaining: consolidatedServings,
        openedAt: new Date()
      })
    }

    // Add whole units created
    inventory.wholeUnits += newWholeUnits

    // Recalculate totals
    inventory.totalAvailableServings = calculateAvailableServings(
      inventory.wholeUnits,
      inventory.partialUnits,
      servingTypes
    )

    await inventory.save({ session })

    // Create movement record
    await models.HospitalityServingMovement.create([{
      tenantId,
      menuItemId,
      movementType: 'consolidation',
      quantity: 0,
      wholeUnitsChanged: newWholeUnits,
      beforeState: {
        wholeUnits: inventory.wholeUnits - newWholeUnits,
        partialUnits: previousPartialUnits.length,
        totalServings: previousTotalServings
      },
      afterState: {
        wholeUnits: inventory.wholeUnits,
        partialUnits: inventory.partialUnits.length,
        totalServings: inventory.totalAvailableServings
      },
      reason: `Consolidated ${partialsToConsolidate.length} partials${newWholeUnits > 0 ? `, created ${newWholeUnits} whole units` : ''}`,
      referenceType: 'other',
      performedBy: performedBy || null,
      metadata: { partialIds, newWholeUnits }
    }], { session })

    return { success: true, newInventory: inventory }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ── Get Inventory Snapshot ─────────────────────────────────────────────────────

/**
 * Get current inventory state with calculated servings
 * Used for display and validation purposes
 */
export async function getInventorySnapshot(
  menuItemId: string,
  models: any,
  tenantId: string
): Promise<InventoryState | null> {
  try {
    const inventory = await models.HospitalityServingInventory.findOne({
      tenantId,
      menuItemId: new models.HospitalityServingInventory.base.Types.ObjectId(menuItemId)
    })

    if (!inventory) {
      return null
    }

    return {
      wholeUnits: inventory.wholeUnits,
      partialUnits: inventory.partialUnits,
      totalAvailableServings: inventory.totalAvailableServings
    }
  } catch (error) {
    return null
  }
}
