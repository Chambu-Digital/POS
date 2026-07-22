import { getTenantDB } from '@/lib/tenant/get-db'
import { getAuthPayload } from '@/lib/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { TabManager, TabStatus } from '@/lib/bar/tab-manager'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId

    // Try by _id + userId match first, then fall back to _id alone so we can
    // return a more specific error if the tab exists but belongs to another owner.
    const tab = await models.BarTab.findOne({ _id: id, userId: ownerId }).lean()
    if (!tab) {
      // Check if it's a real ObjectId format before declaring not found
      console.warn(`[bar/tabs/${id}] Not found for ownerId=${ownerId}`)
      return NextResponse.json({ error: 'Tab not found' }, { status: 404 })
    }

    const lines = await models.BarTabLine.find({ tabId: tab._id, voided: false }).sort({ addedAt: 1 }).lean()
    const balance = await TabManager.getRunningBalance((tab._id as any).toString(), conn)

    return NextResponse.json({ tab: { ...tab, lines, ...balance } })
  } catch (error) {
    console.error('[bar/tabs/[id]] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tab' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuthPayload()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { conn, models } = await getTenantDB(request)
    const ownerId = payload.type === 'staff' && payload.adminId ? payload.adminId : payload.userId
    const staffId = payload.userId

    const tabDoc = await models.BarTab.findOne({ _id: id, userId: ownerId })
    if (!tabDoc) return NextResponse.json({ error: 'Tab not found' }, { status: 404 })

    const body = await request.json()
    let updatedTab = tabDoc.toObject()

    if (body.status !== undefined && body.status !== tabDoc.status) {
      updatedTab = await TabManager.setStatus(id, body.status as TabStatus, staffId, conn)
    }

    if (body.discountPct !== undefined && body.discountPct !== tabDoc.discountPct) {
      updatedTab = await TabManager.applyDiscount(id, body.discountPct, staffId, conn)
    }

    if (body.customerName !== undefined || body.tableNumber !== undefined || body.notes !== undefined) {
      const tabToUpdate = await models.BarTab.findById(id)
      if (tabToUpdate) {
        if (body.customerName !== undefined) tabToUpdate.customerName = body.customerName
        if (body.tableNumber !== undefined) tabToUpdate.tableNumber = body.tableNumber
        if (body.notes !== undefined) tabToUpdate.notes = body.notes
        tabToUpdate.updatedAt = new Date()
        await tabToUpdate.save()
        updatedTab = tabToUpdate.toObject()
      }
    }

    return NextResponse.json({ tab: updatedTab })
  } catch (error: any) {
    console.error('[bar/tabs/[id]] PATCH error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update tab' }, { status: 500 })
  }
}
