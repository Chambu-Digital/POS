import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { getBranchContext } from '@/lib/branch-context'
import { NextRequest, NextResponse } from 'next/server'

// ── GET: Count pending transfers for current branch ────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const branchContext = await getBranchContext(request)

    if (!branchContext) {
      return NextResponse.json({ count: 0 })
    }

    // Count transfers pending receipt for this branch
    const count = await models.StockTransfer.countDocuments({
      userId: ownerId,
      toBranchId: branchContext,
      status: 'pending_receipt',
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('[stock-transfers/pending-count] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 })
  }
}
