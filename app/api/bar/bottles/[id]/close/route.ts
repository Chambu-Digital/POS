import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { InventoryEngine } from '@/lib/bar/inventory-engine'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.userId

    // Verify bottle exists and belongs to this user
    const bottleDoc = await models.BarBottle.findOne({ _id: id, userId: ownerId })
    if (!bottleDoc) return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })

    // Close the specific bottle (V2: closeBottle takes bottleId directly)
    const bottle = await InventoryEngine.closeBottle(id, staffId, conn)
    return NextResponse.json({ bottle }, { status: 200 })
  } catch (error: any) {
    console.error('[bar/bottles/[id]/close] POST error:', error)
    if (error.message === 'BOTTLE_NOT_FOUND_OR_CLOSED') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Failed to close bottle' }, { status: 500 })
  }
}
