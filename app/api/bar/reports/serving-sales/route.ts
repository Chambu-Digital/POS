/**
 * GET /api/bar/reports/serving-sales
 * 
 * Returns serving-level sales breakdown with bottle tracking.
 * Shows which servings were sold from which bottles.
 * 
 * This endpoint exposes the V2 bottle tracking system, showing:
 * - Servings sold per product
 * - Bottles used for each serving
 * - Revenue breakdown by serving type
 * 
 * Query params:
 *   from — ISO date string, default: 30 days ago
 *   to   — ISO date string, default: now
 */

import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const { searchParams } = new URL(request.url)
    const toParam = searchParams.get('to')
    const fromParam = searchParams.get('from')
    
    // Parse dates and set to end of day for 'to' date (in UTC)
    const to = toParam ? new Date(toParam + 'T23:59:59.999Z') : new Date()
    const from = fromParam ? new Date(fromParam + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Query BarTabLine (has bottle tracking)
    const tabLines = await models.BarTabLine.find({
      userId: ownerId,
      addedAt: { $gte: from, $lte: to },
      voided: false,
      servingId: { $ne: null }, // Only serving sales (exclude bottle sales)
    })
      .populate('servingId', 'name servingsPerContainer sellingPrice')
      .populate('bottleId', 'bottleNumber')
      .populate('inventoryItemId', 'name size brandId')
      .lean()

    if (tabLines.length === 0) {
      return NextResponse.json({
        products: [],
        summary: {
          totalRevenue: 0,
          totalServings: 0,
          productsCount: 0,
        },
      })
    }

    // Get brand info for all inventory items
    const inventoryItemIds = [...new Set(tabLines.map((line: any) => line.inventoryItemId?._id).filter(Boolean))]
    const inventoryItems = await models.BarInventoryItem.find({
      _id: { $in: inventoryItemIds }
    })
      .populate('brandId', 'name category')
      .lean() as any[]
    
    const inventoryItemMap = new Map(
      inventoryItems.map((item: any) => [String(item._id), item])
    )

    // Group by inventoryItemId → servingId
    const productMap = new Map<string, any>()

    for (const line of tabLines as any[]) {
      if (!line.inventoryItemId || !line.servingId) continue
      
      const itemId = String(line.inventoryItemId._id)
      const servingId = String(line.servingId._id)
      const inventoryItem = inventoryItemMap.get(itemId)
      
      if (!productMap.has(itemId)) {
        productMap.set(itemId, {
          inventoryItemId: itemId,
          productName: line.inventoryItemId.name || 'Unknown',
          productSize: line.inventoryItemId.size || '',
          brandName: inventoryItem?.brandId?.name || '',
          brandCategory: inventoryItem?.brandId?.category || '',
          servings: new Map(),
          totalRevenue: 0,
          totalQuantity: 0,
        })
      }

      const product = productMap.get(itemId)
      
      if (!product.servings.has(servingId)) {
        product.servings.set(servingId, {
          servingId,
          servingName: line.servingId.name || 'Unknown',
          servingsPerContainer: line.servingId.servingsPerContainer || 0,
          sellingPrice: line.servingId.sellingPrice || 0,
          quantity: 0,
          revenue: 0,
          bottlesUsed: new Set(),
        })
      }

      const serving = product.servings.get(servingId)
      serving.quantity += line.quantity || 0
      serving.revenue += line.lineTotal || 0
      
      // Track which bottles were used
      if (line.bottleId?.bottleNumber) {
        serving.bottlesUsed.add(line.bottleId.bottleNumber)
      }

      product.totalRevenue += line.lineTotal || 0
      product.totalQuantity += line.quantity || 0
    }

    // Convert to array format and calculate bottle usage stats
    const products = Array.from(productMap.values()).map(p => {
      const servingsArray = Array.from(p.servings.values()).map(s => ({
        servingId: s.servingId,
        servingName: s.servingName,
        servingsPerContainer: s.servingsPerContainer,
        sellingPrice: s.sellingPrice,
        quantity: s.quantity,
        revenue: s.revenue,
        bottlesUsed: Array.from(s.bottlesUsed).sort((a, b) => a - b),
        bottleCount: s.bottlesUsed.size,
        // Calculate estimated bottles consumed (if servingsPerContainer is configured)
        estimatedBottlesConsumed: s.servingsPerContainer > 0 
          ? (s.quantity / s.servingsPerContainer).toFixed(2)
          : null,
      }))
        .sort((a, b) => b.revenue - a.revenue)

      return {
        inventoryItemId: p.inventoryItemId,
        productName: p.productName,
        productSize: p.productSize,
        brandName: p.brandName,
        brandCategory: p.brandCategory,
        servings: servingsArray,
        totalRevenue: p.totalRevenue,
        totalQuantity: p.totalQuantity,
      }
    })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0)
    const totalServings = products.reduce((sum, p) => sum + p.totalQuantity, 0)

    // Calculate data quality metrics
    const servingSalesWithBottleTracking = (tabLines as any[]).filter(
      line => line.bottleId !== null && line.bottleId !== undefined
    ).length
    const bottleTrackingCoverage = tabLines.length > 0
      ? ((servingSalesWithBottleTracking / tabLines.length) * 100).toFixed(1)
      : '0'

    return NextResponse.json({
      products,
      summary: {
        totalRevenue,
        totalServings,
        productsCount: products.length,
        bottleTrackingCoverage: parseFloat(bottleTrackingCoverage),
        totalSalesLines: tabLines.length,
        linesWithBottleTracking: servingSalesWithBottleTracking,
      },
    })
  } catch (error) {
    console.error('[bar/reports/serving-sales] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch serving sales' }, { status: 500 })
  }
}
