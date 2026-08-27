import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { InventoryEngine } from '@/lib/bar/inventory-engine'
import { ServingEngine } from '@/lib/bar/serving-engine'
import { Types } from 'mongoose'

/**
 * GET /api/bar/bottles/availability
 * 
 * Get detailed availability information for open bottles of a product.
 * Shows which bottles are open and how many of each serving type they can provide.
 * 
 * Query Params:
 *   - inventoryItemId: (required) Product SKU
 *   - servingId: (optional) Filter by specific serving
 *   - quantity: (optional) Check if bottles can provide this quantity
 * 
 * Response:
 *   - bottles: Array of open bottles with availability projections
 *   - totalAvailability: Sum of all servings across all bottles
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models, conn } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const url = new URL(request.url)
    const inventoryItemId = url.searchParams.get('inventoryItemId')
    const servingId = url.searchParams.get('servingId')
    const quantityStr = url.searchParams.get('quantity')

    if (!inventoryItemId) {
      return NextResponse.json({ error: 'inventoryItemId is required' }, { status: 400 })
    }

    // Fetch open bottles
    const openBottles = await InventoryEngine.getOpenBottles(inventoryItemId, conn)

    // Fetch all active servings for this product
    const servings = await models.BarServing.find({
      inventoryItemId: new Types.ObjectId(inventoryItemId),
      userId: ownerId,
      isActive: true,
    }).lean()

    // If specific serving requested, filter
    const relevantServings = servingId
      ? servings.filter(s => String(s._id) === servingId)
      : servings

    // Calculate availability for each bottle
    const bottlesWithAvailability = openBottles.map((bottle: any) => {
      const availability: Record<string, { servingId: string; servingName: string; available: number; canProvide: boolean }> = {}

      relevantServings.forEach((serving: any) => {
        const available = ServingEngine.getAvailableServings(
          { remainingFraction: bottle.remainingFraction },
          { servingsPerContainer: serving.servingsPerContainer }
        )

        const requestedQty = quantityStr ? parseInt(quantityStr) : 0
        const canProvide = requestedQty > 0
          ? ServingEngine.canProvideServings(
              { remainingFraction: bottle.remainingFraction },
              { servingsPerContainer: serving.servingsPerContainer },
              requestedQty
            )
          : true

        availability[String(serving._id)] = {
          servingId: String(serving._id),
          servingName: serving.name,
          available,
          canProvide,
        }
      })

      return {
        bottleId: String(bottle._id),
        bottleNumber: bottle.bottleNumber,
        remainingFraction: bottle.remainingFraction,
        openedAt: bottle.openedAt,
        availability,
      }
    })

    // Calculate total availability across all bottles
    const totalAvailability: Record<string, number> = {}
    relevantServings.forEach((serving: any) => {
      totalAvailability[String(serving._id)] = openBottles.reduce((sum: number, bottle: any) => {
        return sum + ServingEngine.getAvailableServings(
          { remainingFraction: bottle.remainingFraction },
          { servingsPerContainer: serving.servingsPerContainer }
        )
      }, 0)
    })

    return NextResponse.json({
      inventoryItemId,
      openBottlesCount: openBottles.length,
      bottles: bottlesWithAvailability,
      totalAvailability,
      servings: relevantServings.map((s: any) => ({
        servingId: String(s._id),
        name: s.name,
        servingsPerContainer: s.servingsPerContainer,
        sellingPrice: s.sellingPrice,
      })),
    })
  } catch (error: any) {
    console.error('[bar/bottles/availability] GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch availability' }, { status: 500 })
  }
}
