import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/bar/bottles/[id]/variance
 * 
 * Fetches variance audit data for a closed bottle.
 * Shows expected vs actual servings breakdown for accountability and loss detection.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const bottleId = params.id

    // Fetch bottle to verify ownership
    const bottle = await models.BarBottle.findOne({
      _id: bottleId,
      userId: ownerId,
    }).lean()

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })
    }

    // Fetch variance audit record
    const audit = await models.BarBottleAudit.findOne({
      bottleId,
      userId: ownerId,
    })
      .populate('closedBy', 'name')
      .lean()

    if (!audit) {
      // Bottle exists but no audit record (pre-variance tracking)
      return NextResponse.json({
        hasVarianceData: false,
        message: 'No variance tracking data available for this bottle',
      })
    }

    // Format response
    const response = {
      hasVarianceData: true,
      bottleNumber: audit.bottleNumber,
      productName: audit.productName,
      productSize: audit.productSize,
      brandCategory: audit.brandCategory,
      remainingFraction: audit.remainingFraction,
      fractionConsumed: 1.0 - audit.remainingFraction,
      
      // Expected servings
      expectedServings: audit.expectedServings.map((s: any) => ({
        servingName: s.servingName,
        quantity: s.quantity,
      })),
      totalExpected: audit.totalExpected,
      
      // Actual servings
      actualServings: audit.actualServings.map((s: any) => ({
        servingName: s.servingName,
        quantity: s.quantity,
      })),
      totalActual: audit.totalActual,
      
      // Variance analysis
      varianceQuantity: audit.varianceQuantity,
      variancePercentage: Math.round(audit.variancePercentage * 10) / 10, // 1 decimal
      varianceFlag: audit.varianceFlag,
      
      // Context
      closedBy: (audit.closedBy as any)?.name || 'Unknown',
      closedAt: audit.closedAt,
      notes: audit.notes,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[bar/bottles/[id]/variance] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bottle variance data' },
      { status: 500 }
    )
  }
}
