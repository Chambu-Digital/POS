import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import {
  calculateVelocity,
  calculateCoverage,
  calculateRecommendedQuantity,
  explainRecommendation,
  type StockMovement
} from '@/lib/restocking/velocity-analyzer'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { modules = ['retail'] } = body

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

    const recommendations = []

    // Analyze each product
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

      // Only recommend if will stock out before lead time
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

      // Generate explanation
      const reason = explainRecommendation(
        product.stock || 0,
        velocity,
        coverage,
        recommendedQty,
        productLeadTime
      )

      recommendations.push({
        moduleItemId: product._id.toString(),
        module: 'retail',
        itemName: product.productName + (product.variant ? ` (${product.variant})` : ''),
        category: product.category || 'Uncategorized',
        currentStock: product.stock || 0,
        velocity: velocity.averageDailySales,
        daysRemaining: coverage.daysRemaining,
        urgency: coverage.urgency,
        confidence: velocity.confidence,
        recommendedQty,
        unitPrice: product.buyingPrice || 0,
        totalCost: recommendedQty * (product.buyingPrice || 0),
        reason,
        supplier: product.supplierId
          ? {
              id: product.supplierId._id?.toString() || product.supplierId.toString(),
              name: product.supplierId.name || 'Unknown Supplier'
            }
          : null,
        deferred: false
      })
    }

    // Sort by urgency (descending)
    recommendations.sort((a, b) => b.urgency - a.urgency)

    const totalCost = recommendations.reduce((sum, r) => sum + r.totalCost, 0)

    return NextResponse.json({
      recommendations,
      summary: {
        itemsRecommended: recommendations.length,
        totalCost,
        leadTimeDays,
        safetyBufferDays
      }
    })
  } catch (error: any) {
    console.error('Generate restock error:', error)
    return NextResponse.json(
      { error: 'Failed to generate restock recommendations', details: error.message },
      { status: 500 }
    )
  }
}
