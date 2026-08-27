import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const bottle = await models.BarBottle.findOne({ _id: params.id, userId: ownerId })
      .populate('inventoryItemId', 'name size brandId')
      .lean()
    
    if (!bottle) return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })

    // Get servings for this inventory item to calculate capacity projections
    const servings = await models.BarServing.find({
      inventoryItemId: (bottle as any).inventoryItemId._id,
      isActive: true
    }).lean() as any[]

    // Calculate capacity projections for open bottles
    const projections = bottle.state === 'open' && bottle.remainingFraction > 0
      ? servings.map((serving: any) => {
          const availableServings = Math.floor(
            (bottle.remainingFraction || 0) * (serving.servingsPerContainer || 0)
          )
          return {
            servingId: String(serving._id),
            servingName: serving.name,
            servingsPerContainer: serving.servingsPerContainer || 0,
            sellingPrice: serving.sellingPrice || 0,
            availableServings,
            potentialRevenue: availableServings * (serving.sellingPrice || 0),
          }
        }).filter((proj: any) => proj.servingsPerContainer > 0) // Only show configured servings
      : []

    // Calculate total potential revenue
    const totalPotentialRevenue = projections.reduce((sum: number, proj: any) => sum + proj.potentialRevenue, 0)

    return NextResponse.json({ 
      bottle,
      projections,
      summary: {
        totalPotentialRevenue,
        remainingPercentage: Math.round((bottle.remainingFraction || 0) * 100),
        servingTypesAvailable: projections.length
      }
    })
  } catch (error) {
    console.error('[bar/bottles/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch bottle' }, { status: 500 })
  }
}
