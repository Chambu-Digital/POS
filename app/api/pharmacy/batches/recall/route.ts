import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/pharmacy/batches/recall
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    
    const body = await request.json()
    const { manufacturerLot } = body

    if (!manufacturerLot) {
      return NextResponse.json({ error: 'manufacturerLot is required' }, { status: 400 })
    }

    // Find all batches with this lot number
    const batches = await models.DrugBatch.find({
      userId: ownerId,
      manufacturerLot: manufacturerLot,
      status: { $in: ['active', 'quarantined'] } // only recall active or quarantined
    })

    if (batches.length === 0) {
      return NextResponse.json({ message: 'No active batches found with this lot number', recalledCount: 0 })
    }

    // Update their status
    const batchIds = batches.map(b => b._id)
    await models.DrugBatch.updateMany(
      { _id: { $in: batchIds } },
      { $set: { status: 'recalled' } }
    )

    return NextResponse.json({ 
      message: `Successfully recalled ${batches.length} batches`,
      recalledCount: batches.length
    })
  } catch (error) {
    console.error('[pharmacy/batches/recall POST]', error)
    return NextResponse.json({ error: 'Failed to recall batches' }, { status: 500 })
  }
}
