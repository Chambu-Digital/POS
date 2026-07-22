// ─── GET /api/inventory/stock-ledger ─────────────────────────────────────────
// Returns the immutable stock movement history for Retail products.
// Query params:
//   productId  (required) — filter to a specific product
//   limit      (optional, default 100)

import { NextRequest, NextResponse } from 'next/server'
import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const limit     = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

    const query: any = { userId: ownerId }
    if (productId) query.productId = productId

    const ledger = await (models as any).StockLedger
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json({ ledger })
  } catch (error) {
    console.error('[inventory/stock-ledger] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch stock ledger' }, { status: 500 })
  }
}
