import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ── POST: Sync stock movements to ProductInventory ────────────────────────────
// Reapplies ADJUSTMENT movements from StockLedger to ProductInventory
// Useful when stock count was recorded but ProductInventory wasn't updated
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    if (!branchContext) {
      return NextResponse.json({ 
        error: 'Branch context required. This operation only works in multi-branch mode.' 
      }, { status: 400 })
    }

    const { models } = await getTenantDB(request)
    const { movementIds } = await request.json()

    if (!movementIds || !Array.isArray(movementIds) || movementIds.length === 0) {
      return NextResponse.json({ error: 'Movement IDs required' }, { status: 400 })
    }

    console.log('[sync-movements] Syncing movements:', movementIds)

    // Fetch the movements
    const movements = await models.StockLedger.find({
      _id: { $in: movementIds.map(id => new Types.ObjectId(id)) },
      userId: ownerId,
      branchId: branchContext,
      type: 'ADJUSTMENT', // Only sync adjustment movements
    })

    if (movements.length === 0) {
      return NextResponse.json({ 
        error: 'No valid adjustment movements found' 
      }, { status: 404 })
    }

    const synced = []
    const errors = []

    for (const movement of movements) {
      try {
        const difference = movement.newStock - movement.previousStock

        // Find or create ProductInventory record
        let inventory = await models.ProductInventory.findOne({
          userId: ownerId,
          branchId: branchContext,
          productId: movement.productId,
        })

        if (!inventory) {
          // Create new inventory record
          inventory = new models.ProductInventory({
            userId: ownerId,
            branchId: branchContext,
            productId: movement.productId,
            stock: movement.newStock,
            reserved: 0,
            lastUpdated: new Date(),
          })
          await inventory.save()
          synced.push({
            movementId: movement._id,
            productId: movement.productId,
            action: 'created',
            stock: movement.newStock,
          })
        } else {
          // Update existing inventory
          inventory.stock += difference
          inventory.lastUpdated = new Date()
          await inventory.save()
          synced.push({
            movementId: movement._id,
            productId: movement.productId,
            action: 'updated',
            difference,
            newStock: inventory.stock,
          })
        }
      } catch (error: any) {
        errors.push({
          movementId: movement._id,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced.length} movements to ProductInventory`,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[sync-movements] POST error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to sync movements' 
    }, { status: 500 })
  }
}

// ── DELETE: Remove selected movements from StockLedger ────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    const { searchParams } = new URL(request.url)
    const movementIds = searchParams.get('ids')?.split(',') || []

    if (movementIds.length === 0) {
      return NextResponse.json({ error: 'Movement IDs required' }, { status: 400 })
    }

    const { models } = await getTenantDB(request)

    console.log('[sync-movements] Deleting movements:', movementIds)

    // Only allow deleting ADJUSTMENT movements to prevent data corruption
    const result = await models.StockLedger.deleteMany({
      _id: { $in: movementIds.map(id => new Types.ObjectId(id)) },
      userId: ownerId,
      branchId: branchContext,
      type: 'ADJUSTMENT', // Safety: only delete adjustment movements
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} adjustment movements`,
      deletedCount: result.deletedCount,
    })
  } catch (error: any) {
    console.error('[sync-movements] DELETE error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete movements' 
    }, { status: 500 })
  }
}
