import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { TabManager } from '@/lib/bar/tab-manager'

export async function DELETE(request: NextRequest, { params }: { params: { id: string, lineId: string } }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    const tabDoc = await models.BarTab.findOne({ _id: params.id, userId: ownerId })
    if (!tabDoc) return NextResponse.json({ error: 'Tab not found' }, { status: 404 })

    const tab = await TabManager.removeLastLine(params.id, conn)

    return NextResponse.json({ tab })
  } catch (error: any) {
    console.error('[bar/tabs/[id]/lines/[lineId]] DELETE error:', error)
    return NextResponse.json({ error: error.message || 'Failed to remove line' }, { status: 500 })
  }
}
