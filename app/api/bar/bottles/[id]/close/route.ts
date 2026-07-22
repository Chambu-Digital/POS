import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { InventoryEngine } from '@/lib/bar/inventory-engine'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.userId

    const bottleDoc = await models.BarBottle.findOne({ _id: params.id, userId: ownerId })
    if (!bottleDoc) return NextResponse.json({ error: 'Bottle not found' }, { status: 404 })

    const bottle = await InventoryEngine.closeCurrentBottle(String(bottleDoc.inventoryItemId), staffId, conn)
    return NextResponse.json({ bottle }, { status: 200 })
  } catch (error: any) {
    console.error('[bar/bottles/[id]/close] POST error:', error)
    if (error.message === 'NO_OPEN_BOTTLE') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Failed to close bottle' }, { status: 500 })
  }
}
