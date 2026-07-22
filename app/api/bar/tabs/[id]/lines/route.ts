import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { TabManager } from '@/lib/bar/tab-manager'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let inventoryItemIdForError: string | undefined
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.userId

    const body = await request.json()
    const { inventoryItemId, servingId, quantity, itemName, servingName, unitPrice } = body
    inventoryItemIdForError = inventoryItemId

    const tabDoc = await models.BarTab.findOne({ _id: id, userId: ownerId })
    if (!tabDoc) return NextResponse.json({ error: 'Tab not found' }, { status: 404 })

    const result = await TabManager.addLine(id, {
      inventoryItemId,
      servingId,
      quantity,
      staffId,
      itemName,
      servingName,
      unitPrice,
    }, conn)

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('[bar/tabs/[id]/lines] POST error:', error)
    if (error.message === 'NO_OPEN_BOTTLE') {
      return NextResponse.json({ requiresBottleOpen: true, inventoryItemId: inventoryItemIdForError }, { status: 409 })
    }
    if (error.message === 'TAB_LOCKED' || error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Failed to add line' }, { status: 500 })
  }
}
