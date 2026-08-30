import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// ─── GET /api/sales/[id] ──────────────────────────────────────────────────────
// Fetch sale details with populated product and customer information

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const saleId = new Types.ObjectId(params.id)
    const sale = await models.Sale.findOne({
      _id: saleId,
      userId: ownerId,
    })
      .populate('customerId', 'name phone email')
      .populate('staffId', 'name')
      .lean()

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    return NextResponse.json({ sale })
  } catch (error) {
    console.error('[sales/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch sale' }, { status: 500 })
  }
}
