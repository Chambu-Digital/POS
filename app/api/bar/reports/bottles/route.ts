import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

/**
 * GET /api/bar/reports/bottles?date={YYYY-MM-DD}&productId={id}&staffId={id}
 * 
 * Returns aggregated bottle data for the Reports → Bottles page:
 * - Summary counts (open bottles, closed today, variances)
 * - Open bottles list (all currently open bottles)
 * - Closed bottles list (filtered by date)
 * - Variance bottles list (bottles closed with remaining fraction > 0)
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    const productId = url.searchParams.get('productId')
    const staffId = url.searchParams.get('staffId')

    // Build base filter
    const baseFilter: any = { userId: ownerId }
    if (productId) baseFilter.inventoryItemId = new Types.ObjectId(productId)

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Open Bottles (always current state, not filtered by date)
    // ═══════════════════════════════════════════════════════════════════════════
    const openFilter = { ...baseFilter, state: 'open' }
    if (staffId) openFilter.openedBy = new Types.ObjectId(staffId)

    const openBottles = await models.BarBottle.find(openFilter)
      .populate('inventoryItemId', 'name size brandName brandCategory')
      .populate('openedBy', 'name')
      .sort({ createdAt: 1 }) // FIFO order
      .lean()

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Closed Bottles (filtered by date range)
    // ═══════════════════════════════════════════════════════════════════════════
    const closedFilter: any = { ...baseFilter, state: 'closed' }
    if (staffId) closedFilter.closedBy = new Types.ObjectId(staffId)

    // Date filtering for closed bottles
    if (dateParam) {
      const targetDate = new Date(dateParam)
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))
      closedFilter.closedAt = { $gte: startOfDay, $lte: endOfDay }
    } else {
      // Default to today
      const now = new Date()
      const startOfToday = new Date(now.setHours(0, 0, 0, 0))
      const endOfToday = new Date(now.setHours(23, 59, 59, 999))
      closedFilter.closedAt = { $gte: startOfToday, $lte: endOfToday }
    }

    const closedBottles = await models.BarBottle.find(closedFilter)
      .populate('inventoryItemId', 'name size brandName brandCategory')
      .populate('openedBy', 'name')
      .populate('closedBy', 'name')
      .sort({ closedAt: -1 })
      .lean()

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Variance Bottles (closed bottles with varianceFraction > 0)
    // ═══════════════════════════════════════════════════════════════════════════
    const varianceBottles = closedBottles.filter((bottle: any) => {
      return (bottle.varianceFraction || 0) > 0
    })

    // Enrich variance bottles with human-readable unaccounted servings
    const enrichedVariances = await Promise.all(
      varianceBottles.map(async (bottle: any) => {
        // Fetch the first serving config to get servingsPerContainer
        const serving = await models.BarServing.findOne({
          inventoryItemId: bottle.inventoryItemId?._id,
        })
          .sort({ servingsPerContainer: -1 }) // Get the smallest unit (highest count)
          .lean()

        const varianceFraction = bottle.varianceFraction || 0
        const servingsPerContainer = serving?.servingsPerContainer || 20
        const servingUnit = serving?.name || 'unit'
        const unaccountedServings = Math.floor(varianceFraction * servingsPerContainer)

        return {
          _id: bottle._id,
          bottleNumber: bottle.bottleNumber,
          productName: bottle.inventoryItemId?.name || 'Unknown',
          productSize: bottle.inventoryItemId?.size || '',
          closedAt: bottle.closedAt,
          closedBy: bottle.closedBy,
          varianceFraction,
          servingsPerContainer,
          unaccountedServings,
          servingUnit,
        }
      })
    )

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. Format open bottles for response
    // ═══════════════════════════════════════════════════════════════════════════
    const formattedOpenBottles = openBottles.map((bottle: any) => ({
      _id: bottle._id,
      bottleNumber: bottle.bottleNumber,
      productName: bottle.inventoryItemId?.name || 'Unknown',
      productSize: bottle.inventoryItemId?.size || '',
      brandCategory: bottle.inventoryItemId?.brandCategory || '',
      openedAt: bottle.openedAt,
      openedBy: bottle.openedBy,
      remainingFraction: bottle.remainingFraction,
    }))

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. Format closed bottles for response
    // ═══════════════════════════════════════════════════════════════════════════
    const formattedClosedBottles = closedBottles.map((bottle: any) => ({
      _id: bottle._id,
      bottleNumber: bottle.bottleNumber,
      productName: bottle.inventoryItemId?.name || 'Unknown',
      productSize: bottle.inventoryItemId?.size || '',
      openedAt: bottle.openedAt,
      closedAt: bottle.closedAt,
      openedBy: bottle.openedBy,
      closedBy: bottle.closedBy,
      hasVariance: (bottle.varianceFraction || 0) > 0,
      varianceFraction: bottle.varianceFraction,
    }))

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. Summary counts
    // ═══════════════════════════════════════════════════════════════════════════
    const summary = {
      openBottles: openBottles.length,
      closedToday: closedBottles.length,
      variancesCount: varianceBottles.length,
    }

    return NextResponse.json({
      summary,
      openBottles: formattedOpenBottles,
      closedBottles: formattedClosedBottles,
      variances: enrichedVariances,
    })
  } catch (error) {
    console.error('[bar/reports/bottles] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bottle reports' },
      { status: 500 }
    )
  }
}
