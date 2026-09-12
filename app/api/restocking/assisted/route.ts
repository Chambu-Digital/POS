import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import {
  calculateVelocity,
  calculateCoverage,
  calculateRecommendedQuantity,
  type StockMovement
} from '@/lib/restocking/velocity-analyzer'
import { allocateBudget, type RestockItem } from '@/lib/restocking/capital-allocator'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { budget, modules = ['retail'] } = body

    if (!budget || budget <= 0) {
      return NextResponse.json(
        { error: 'Budget must be a positive number' },
        { status: 400 }
      )
    }

    const { models } = await getTenantDB()

    const userId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Fetch user settings for restocking configuration
    const user = await models.User.findById(userId).lean() as {
      settings?: Record<string, any>
    } | null

    // Use provided values or fall back to user settings or defaults
    const restockingSettings = user?.settings?.restocking || {}
    const leadTimeDays = body.leadTimeDays ?? restockingSettings.defaultLeadTime ?? 7
    const safetyBufferDays = body.safetyBufferDays ?? restockingSettings.safetyBuffer ?? 2

    // Get all products from retail
    const products = await models.Product.find({})
      .populate('supplierId', 'name')
      .lean()

    const candidateItems: RestockItem[] = []

    // Analyze each product for velocity and urgency
    for (const product of products) {
      // Use product-specific settings if available, otherwise fall back to global
      const productLeadTime = product.restocking?.customLeadTime ?? leadTimeDays
      const productSafetyBuffer = product.restocking?.safetyBuffer ?? safetyBufferDays

      // Fetch movements for this product (last 30 days)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)

      const movements = await models.StockLedger.find({
        productId: product._id,
        timestamp: { $gte: startDate }
      })
        .sort({ timestamp: 1 })
        .lean()

      // Transform to standard format
      const standardMovements: StockMovement[] = movements.map((m: any) => ({
        timestamp: m.timestamp,
        type: ['SALE', 'RETURN', 'DAMAGE', 'WASTAGE', 'EXPIRED', 'LOSS'].includes(m.type)
          ? 'OUT'
          : 'IN',
        quantity: Math.abs(m.quantity),
        reason: m.type
      }))

      // Calculate velocity
      const velocity = calculateVelocity(standardMovements, 30)

      // Skip if no sales data
      if (!velocity.hasSufficientData || velocity.averageDailySales === 0) {
        continue
      }

      // Calculate coverage
      const coverage = calculateCoverage(
        product.stock || 0,
        velocity.averageDailySales,
        productLeadTime
      )

      // Include all items that need restocking (will stock out before lead time)
      // The allocation algorithm will decide what to prioritize
      if (!coverage.willStockOut) {
        continue
      }

      // Calculate recommended quantity using product-specific settings
      const recommendedQty = calculateRecommendedQuantity(
        product.stock || 0,
        velocity.averageDailySales,
        productLeadTime,
        productSafetyBuffer
      )

      if (recommendedQty === 0) {
        continue
      }

      candidateItems.push({
        moduleItemId: product._id.toString(),
        module: 'retail',
        itemName: product.productName + (product.variant ? ` (${product.variant})` : ''),
        category: product.category || 'Uncategorized',
        currentStock: product.stock || 0,
        velocity: velocity.averageDailySales,
        daysRemaining: coverage.daysRemaining,
        urgency: coverage.urgency,
        recommendedQty,
        unitPrice: product.buyingPrice || 0,
        totalCost: recommendedQty * (product.buyingPrice || 0),
        supplier: product.supplierId
          ? {
              id: product.supplierId._id?.toString() || product.supplierId.toString(),
              name: product.supplierId.name || 'Unknown Supplier'
            }
          : null
      })
    }

    // Run capital allocation algorithm
    const allocationResult = allocateBudget(candidateItems, budget, leadTimeDays)

    return NextResponse.json({
      budget,
      totalSpent: allocationResult.totalSpent,
      remainingBudget: allocationResult.remainingBudget,
      allocated: allocationResult.allocated,
      deferred: allocationResult.deferred,
      summary: {
        itemsAllocated: allocationResult.allocated.length,
        itemsDeferred: allocationResult.deferred.length,
        budgetUtilization: ((allocationResult.totalSpent / budget) * 100).toFixed(1) + '%',
        leadTimeDays,
        safetyBufferDays
      }
    })
  } catch (error: any) {
    console.error('Assisted restock error:', error)
    return NextResponse.json(
      { error: 'Failed to generate assisted restock plan', details: error.message },
      { status: 500 }
    )
  }
}
