import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/pharmacy/batches/[id]/history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    
    const batchId = params.id

    // Find all inventory transactions for this batch
    const transactions = await models.InventoryTransaction.find({
      userId: ownerId,
      batchId: batchId
    })
      .populate('userIdPerformed', 'name')
      .sort({ timestamp: -1 })
      .lean()

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('[pharmacy/batches/[id]/history GET]', error)
    return NextResponse.json({ error: 'Failed to fetch batch history' }, { status: 500 })
  }
}
