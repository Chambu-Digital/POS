// ─── GET /api/inventory/stock-ledger ─────────────────────────────────────────
// Returns the immutable stock movement history for Retail products.
// Query params:
//   type       (optional) — filter by movement type (STOCK_IN, SALE, etc.)
//   productId  (optional) — filter to a specific product
//   supplierId (optional) — filter by supplier
//   startDate  (optional) — filter from date (ISO string)
//   endDate    (optional) — filter to date (ISO string)
//   search     (optional) — search product name
//   limit      (optional, default 100, max 500)

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const type = searchParams.get('type')
    const productId = searchParams.get('productId')
    const supplierId = searchParams.get('supplierId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

    // Build query
    const query: any = { userId: ownerId }
    
    // Filter by branch context (staff see only their branch, owner sees all)
    if (branchContext) {
      query.branchId = branchContext
    }
    
    if (type) query.type = type
    if (productId) query.productId = productId
    if (supplierId) query.supplierId = supplierId
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    // If search provided, first find matching products
    let productIds: any[] = []
    if (search) {
      const products = await models.Product.find({
        userId: ownerId,
        productName: { $regex: search, $options: 'i' }
      }).select('_id').lean()
      productIds = products.map(p => p._id)
      if (productIds.length > 0) {
        query.productId = { $in: productIds }
      } else {
        // No products match search, return empty
        console.log('[stock-ledger] No products match search:', search)
        return NextResponse.json({ ledger: [] })
      }
    }

    console.log('[stock-ledger] Query:', JSON.stringify(query))
    console.log('[stock-ledger] Payload:', { type: payload.type, userId: payload.userId, ownerId })
    console.log('[stock-ledger] BranchContext:', branchContext)

    // Check if StockLedger model exists
    if (!(models as any).StockLedger) {
      console.error('[stock-ledger] StockLedger model not found!')
      return NextResponse.json({ error: 'StockLedger model not found' }, { status: 500 })
    }

    const ledger = await (models as any).StockLedger
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('productId', 'productName brand model variant')
      .populate('supplierId', 'name')
      .populate('staffId', 'name')
      .lean()

    console.log('[stock-ledger] Found', ledger.length, 'records')

    return NextResponse.json({ ledger })
  } catch (error) {
    console.error('[inventory/stock-ledger] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch stock ledger', details: String(error) }, { status: 500 })
  }
}
