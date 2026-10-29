import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

// GET /api/customers/[id]/deposits — active deposits for this customer.
// Used by the checkout flow to populate the "apply deposit" picker. Only
// returns deposits the customer can still draw from (status active/partial).
//
// Query params:
//   ?activeOnly=true  (default)  → only active + partial
//   ?all=true                    → include used/refunded/void (history view)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId =
      payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const { id } = await params

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 })
    }

    const url = new URL(request.url)
    const all = url.searchParams.get('all') === 'true'

    const query: any = {
      userId: ownerId,
      customerId: new Types.ObjectId(id),
    }
    if (!all) {
      query.status = { $in: ['active', 'partial'] }
      query.balance = { $gt: 0 }
    }

    // Oldest first when picking deposits to draw down (FIFO default in UI)
    const deposits = await models.Deposit.find(query).sort({ createdAt: 1 }).lean()

    return NextResponse.json({ deposits })
  } catch (error) {
    console.error('[customers/[id]/deposits] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch customer deposits' }, { status: 500 })
  }
}
