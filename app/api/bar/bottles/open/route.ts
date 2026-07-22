import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { InventoryEngine } from '@/lib/bar/inventory-engine'

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conn } = await getTenantDB(request)
    const staffId = payload.userId

    const body = await request.json()
    const { inventoryItemId } = body

    if (!inventoryItemId) {
      return NextResponse.json({ error: 'inventoryItemId is required' }, { status: 400 })
    }

    const bottle = await InventoryEngine.openBottle(inventoryItemId, staffId, conn)
    return NextResponse.json({ bottle }, { status: 201 })
  } catch (error: any) {
    console.error('[bar/bottles/open] POST error:', error)
    if (error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Failed to open bottle' }, { status: 500 })
  }
}
