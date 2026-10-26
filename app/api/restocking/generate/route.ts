import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
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

    const { models } = await getTenantDB(request)

    const userId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Fetch user settings for restocking configuration
    const user = await models.User.findById(userId).lean() as {
      settings?: Record<string, any>
    } | null

    const restockingSettings = user?.settings?.restocking || {}
    const leadTimeDays = body.leadTimeDays ?? restockingSettings.defaultLeadTime ?? 7
    const safetyBufferDays = body.safetyBufferDays ?? restockingSettings.safetyBuffer ?? 2

    const branchContext = await getBranchContext(request)

    // Fetch products — branch-aware if branch context exists
    let products: any[]

    if (branchContext) {
      const inventories = await models.ProductInventory.find({
        userId,
        branchId: branchContext,
      }).lean()

      const inventoryMap = new Map(
        inventories.map((inv: any) => [inv.productId.toString(), inv])
      )

      products = (await models.Product.find({
        userId,
        _id: { $in: inventories.map((inv: any) => inv.productId) }
      })
        .populate('supplierId', 'name')
        .lean())
        .map((product: any) => ({
          ...product,
          stock: inventoryMap.get(product._id.toString())?.stock ?? 0
        }))
    } else {
      products = await models.Product.find({ userId })
        .populate('supplierId', 'name')
        .lean()
    }

    // Batch fetch all stock movements (last 30 days) — avoids N+1 queries
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const productIds = products.map((p: any) => p._id)
    const allMovements = await models.StockLedger.find({
      productId: { $in: productIds },
      timestamp: { $gte: startDate }
    }).lean()

    const movementsByProduct = new Map<string, any[]>()
    for (const m of allMovements) {
      const pid = m.productId.toString()
      if (!movementsByProduct.has(pid)) {
        movementsByProduct.set(pid, [])
      }
      movementsByProduct.get(pid)!.push(m)
    }

    const recommendations = []

    for (const product of products) {
      const productLeadTime = product.restocking?.customLeadTime ?? leadTimeDays
      const productSafetyBuffer = product.restocking?.safetyBuffer ?? safetyBufferDays

      const movements = movementsByProduct.get(product._id.toString()) || []

      const standardMovements: StockMovement[] = movements.map((m: any) => ({
        timestamp: m.timestamp,
        type: ['SALE', 'RETURN', 'DAMAGE', 'WASTAGE', 'EXPIRED', 'LOSS'].includes(m.type)
          ? 'OUT'
          : 'IN',
        quantity: Math.abs(m.quantity),
        reason: m.type
      }))

      const velocity = calculateVelocity(standardMovements, 30)

      if (!velocity.hasSufficientData || velocity.averageDailySales === 0) {
        continue
      }

      const coverage = calculateCoverage(
        product.stock || 0,
        velocity.averageDailySales,
        productLeadTime
      )

      if (!coverage.willStockOut) {
        continue
      }

      const recommendedQty = calculateRecommendedQuantity(
        product.stock || 0,
        velocity.averageDailySales,
        productLeadTime,
        productSafetyBuffer
      )

      if (recommendedQty === 0) {
        continue
      }

      const reason = explainRecommendation(
        product.stock || 0,
        velocity,
        coverage,
        recommendedQty,
        productLeadTime
      )

      // Build descriptive name including brand, model, and variant
      const descriptor = [product.brand, product.model, product.variant]
        .filter(Boolean)
        .join(' ')

      recommendations.push({
        moduleItemId: product._id.toString(),
        module: 'retail',
        itemName: descriptor ? `${product.productName} (${descriptor})` : product.productName,
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
